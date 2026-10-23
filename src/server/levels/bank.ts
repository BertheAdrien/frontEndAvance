import { randomUUID } from 'node:crypto';
import type { H3Event } from 'h3';
import {
  createError,
  defineEventHandler,
  getCookie,
  getHeader,
  getQuery,
  getRequestURL,
  readBody,
  setCookie,
  setResponseHeader,
} from 'h3';
import { z } from 'zod';

import type { AccountResponse, TransferReceipt, TransferResponse } from '../../shared/bank';
import { getLevelMode } from '../mode';
import type { Level } from './catalog';

/** Niveau 4 : une fausse banque isolée. Le vrai site (progression, flags) n'est jamais exposé. */
export const BANK_LEVEL_ID = 'virement-fantome';
export const BANK_COOKIE = 'ba_bank';
/** Cookie double-submit lu côté client par Angular (`withXsrfConfiguration`). Non HttpOnly, par conception. */
export const XSRF_COOKIE = 'XSRF-TOKEN';
export const XSRF_HEADER = 'x-xsrf-token';

const INITIAL_SOLDE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Compte d'une session bancaire (en mémoire, non persisté : propre à la démo). */
interface Account {
  solde: number;
  historique: TransferReceipt[];
  /** Jeton double-submit de la session (mode sécurisé). */
  xsrf: string;
  /** Flag mémorisé dès qu'un virement frauduleux a réussi dans cette session. */
  flag?: string;
}

export interface BankStore {
  read(sessionId: string): Account | undefined;
  ensure(sessionId: string): Account;
  reset(sessionId: string): void;
}

export function createBankStore(): BankStore {
  const accounts = new Map<string, Account>();
  return {
    read: (id) => accounts.get(id),
    ensure(id) {
      let account = accounts.get(id);
      if (!account) {
        account = { solde: INITIAL_SOLDE, historique: [], xsrf: randomUUID() };
        accounts.set(id, account);
      }
      return account;
    },
    reset: (id) => void accounts.delete(id),
  };
}

let sharedStore: BankStore | undefined;
export function useBankStore(): BankStore {
  sharedStore ??= createBankStore();
  return sharedStore;
}

type Deps = { vulnerableModeEnabled: () => boolean; levels: () => Level[]; store: BankStore };

const isProd = () => process.env['NODE_ENV'] === 'production';

/** Retrouve (ou crée) la session bancaire. Ses attributs de cookie dépendent du mode. */
function openAccount(event: H3Event, secure: boolean, store: BankStore): Account {
  let id = getCookie(event, BANK_COOKIE);
  if (!id || !UUID.test(id)) {
    id = randomUUID();
    // VULNERABLE (démo): en mode vulnérable, cookie SameSite=Lax (défaut) — le navigateur
    // l'envoie encore sur une navigation GET inter-site, ce qui rend la CSRF possible.
    // En mode sécurisé, SameSite=Strict : le cookie ne quitte jamais le site de la banque.
    setCookie(event, BANK_COOKIE, id, {
      httpOnly: true,
      sameSite: secure ? 'strict' : 'lax',
      secure: isProd(),
      path: '/',
    });
  }

  const account = store.ensure(id);
  if (secure) {
    // Jeton double-submit : lisible par le script de la banque, jamais par une autre origine.
    setCookie(event, XSRF_COOKIE, account.xsrf, {
      httpOnly: false,
      sameSite: 'strict',
      secure: isProd(),
      path: '/',
    });
  }
  return account;
}

const transferSchema = z.object({
  beneficiaire: z.string().trim().min(1).max(60),
  montant: z.coerce.number().int().positive().max(1_000_000),
});

function readTransferInput(event: H3Event): Promise<{ beneficiaire: string; montant: number }> | { beneficiaire: string; montant: number } {
  const source = event.method === 'GET' ? Promise.resolve(getQuery(event)) : readBody(event).catch(() => ({}));
  return Promise.resolve(source).then((raw) => {
    const parsed = transferSchema.safeParse(raw);
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Virement invalide' });
    return parsed.data;
  });
}

/**
 * Défenses du mode sécurisé, en profondeur :
 * 1. un virement est un POST (jamais un GET qui changerait l'état) ;
 * 2. l'en-tête Origin, s'il est présent, doit être celui de la banque ;
 * 3. jeton anti-CSRF double-submit : l'en-tête doit égaler le cookie `XSRF-TOKEN`.
 */
function assertSecureTransfer(event: H3Event): void {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, message: 'Un virement doit être envoyé en POST' });
  }

  const origin = getHeader(event, 'origin');
  if (origin && new URL(origin).host !== getRequestURL(event).host) {
    throw createError({ statusCode: 403, message: 'Origine non autorisée' });
  }

  const header = getHeader(event, XSRF_HEADER);
  const cookie = getCookie(event, XSRF_COOKIE);
  if (!header || !cookie || header !== cookie) {
    throw createError({ statusCode: 403, message: 'Jeton anti-CSRF manquant ou invalide' });
  }
}

function applyTransfer(account: Account, beneficiaire: string, montant: number, frauduleux: boolean, flag: string | undefined): TransferReceipt {
  if (montant > account.solde) throw createError({ statusCode: 400, message: 'Solde insuffisant' });

  account.solde -= montant;
  const recu: TransferReceipt = { beneficiaire, montant, date: new Date().toISOString(), frauduleux };
  account.historique.unshift(recu);
  if (frauduleux && flag) account.flag = flag;
  return recu;
}

export function createAccountHandler(deps: Deps) {
  return defineEventHandler((event): AccountResponse => {
    const secure = getLevelMode(event, deps.vulnerableModeEnabled()) === 'secure';
    const account = openAccount(event, secure, deps.store);
    setResponseHeader(event, 'Cache-Control', 'no-store');
    return { solde: account.solde, historique: account.historique, ...(account.flag ? { flag: account.flag } : {}) };
  });
}

/** Réinitialise le compte de la session (solde et historique) : évite de redémarrer le serveur. */
export function createAccountResetHandler(deps: Deps) {
  return defineEventHandler((event): AccountResponse => {
    const secure = getLevelMode(event, deps.vulnerableModeEnabled()) === 'secure';
    const id = getCookie(event, BANK_COOKIE);
    if (id) deps.store.reset(id);
    const account = openAccount(event, secure, deps.store);
    setResponseHeader(event, 'Cache-Control', 'no-store');
    return { solde: account.solde, historique: account.historique };
  });
}

export function createTransferHandler(deps: Deps) {
  return defineEventHandler(async (event) => {
    const secure = getLevelMode(event, deps.vulnerableModeEnabled()) === 'secure';
    if (secure) assertSecureTransfer(event);

    const { beneficiaire, montant } = await readTransferInput(event);
    const account = openAccount(event, secure, deps.store);

    // Aucun chemin légitime n'utilise GET : un virement déclenché par un GET est forcément frauduleux (CSRF).
    const frauduleux = event.method === 'GET';
    const flag = deps.levels().find((l) => l.id === BANK_LEVEL_ID)?.flag;
    const recu = applyTransfer(account, beneficiaire, montant, frauduleux, flag);
    setResponseHeader(event, 'Cache-Control', 'no-store');

    // Une navigation de page (la page piège) attend du HTML : on lui sert le reçu, flag compris.
    if ((getHeader(event, 'accept') ?? '').includes('text/html')) {
      setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');
      return receiptPage(recu, account.flag);
    }

    const response: TransferResponse = { recu, solde: account.solde, ...(recu.frauduleux && account.flag ? { flag: account.flag } : {}) };
    return response;
  });
}

/** Banque et page piège partagent le même serveur ; seul l'hôte change (localhost ⇆ 127.0.0.1). */
function bankOrigin(event: H3Event): string {
  const url = getRequestURL(event);
  const host = url.host.includes('127.0.0.1') ? url.host.replace('127.0.0.1', 'localhost') : url.host.replace('localhost', '127.0.0.1');
  return `${url.protocol}//${host}`;
}

/**
 * Page piège servie sur l'autre origine. À son chargement, elle soumet un formulaire GET
 * vers la banque : une navigation inter-site que le cookie SameSite=Lax accompagne encore.
 */
export function createTrapPageHandler() {
  return defineEventHandler((event) => {
    const action = `${bankOrigin(event)}/api/${BANK_LEVEL_ID}/virement`;
    setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');
    return trapPage(action);
  });
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function receiptPage(recu: TransferReceipt, flag: string | undefined): string {
  const flagBlock =
    recu.frauduleux && flag
      ? `<div style="margin-top:20px;padding:16px;border-radius:10px;background:#2a1215;border:1px solid #b4232a;color:#ffb3b8">
           <strong>⚠ Virement frauduleux (CSRF)</strong>
           <p style="margin:8px 0 0">Ce virement a été signé à l'insu du titulaire. Preuve du niveau&nbsp;:</p>
           <code style="display:inline-block;margin-top:8px;font-size:18px;user-select:all">${escapeHtml(flag)}</code>
         </div>`
      : '';
  return page(
    'Reçu de virement',
    `<h1 style="margin:0 0 4px">Reçu de virement</h1>
     <p style="color:#9aa">Banque Fantôme — opération enregistrée</p>
     <dl style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:20px 0">
       <dt style="color:#9aa">Bénéficiaire</dt><dd style="margin:0;font-weight:600">${escapeHtml(recu.beneficiaire)}</dd>
       <dt style="color:#9aa">Montant</dt><dd style="margin:0;font-weight:600">${recu.montant} €</dd>
       <dt style="color:#9aa">Date</dt><dd style="margin:0">${escapeHtml(recu.date)}</dd>
     </dl>
     ${flagBlock}
     <p style="margin-top:24px"><a href="/niveaux/${BANK_LEVEL_ID}" style="color:#7cd">← Retour à la banque</a></p>`,
  );
}

function trapPage(action: string): string {
  const safeAction = escapeHtml(action);
  return page(
    'Vous avez gagné !',
    `<h1 style="margin:0 0 8px">🎁 Félicitations, vous avez gagné !</h1>
     <p style="color:#9aa">Cliquez pour réclamer votre cadeau… ou patientez, on s'occupe de tout.</p>
     <form method="get" action="${safeAction}" style="margin-top:20px">
       <input type="hidden" name="beneficiaire" value="PIRATE_CSRF" />
       <input type="hidden" name="montant" value="500" />
       <button type="submit" style="padding:12px 20px;border:0;border-radius:10px;background:#6a4cff;color:#fff;font-weight:600;cursor:pointer">
         Réclamer mon cadeau
       </button>
     </form>
     <p style="margin-top:16px;color:#667;font-size:13px">Page servie sur une autre origine que la banque.</p>
     <script>setTimeout(function(){document.forms[0].submit();}, 1500);</script>`,
  );
}

function page(title: string, inner: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0e1116;color:#e6e6e6;font-family:system-ui,sans-serif">
<main style="max-width:520px;padding:32px;border-radius:16px;background:#151a22;border:1px solid #232a35">${inner}</main>
</body></html>`;
}
