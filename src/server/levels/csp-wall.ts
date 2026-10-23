import type { H3Event } from 'h3';
import { createError, defineEventHandler, getCookie, getQuery, getRequestURL, readBody, readRawBody, setCookie, setResponseHeader, setResponseStatus } from 'h3';
import { z } from 'zod';

import type { CspMode, CspStateResponse, CspViolation, ViolationsResponse } from '../../shared/csp-wall';
import type { LevelMode } from '../../shared/level';
import { getLevelMode } from '../mode';
import { getPlayerId } from '../player';
import type { Level } from './catalog';

/** Niveau 3 : la CSP, deuxième ligne de défense du livre d'or resté vulnérable. */
export const CSP_LEVEL_ID = 'mur-invisible';
export const CSP_COOKIE = 'ba_csp';

const LEVEL_PAGE = `/niveaux/${CSP_LEVEL_ID}`;
const REPORT_URI = `/api/${CSP_LEVEL_ID}/csp-report`;

/**
 * Politique statique (pas de nonce) : aucun script inline ni `eval`. `style-src` tolère
 * l'inline, compromis assumé car Angular injecte des styles (risque bien plus faible).
 * `font-src` accepte `data:` : Vite inline les petites polices dans la feuille de style.
 */
export const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const cspModeSchema = z.enum(['none', 'report-only', 'enforce']);
const changeCspSchema = z.object({ csp: cspModeSchema });

/**
 * CSP en vigueur : le choix du joueur en mode vulnérable ; toujours bloquante sinon
 * (mode sécurisé, ou mode vulnérable désactivé sur le serveur).
 */
export function getCspMode(event: H3Event, levelMode: LevelMode): CspMode {
  if (levelMode !== 'vulnerable') return 'enforce';
  const parsed = cspModeSchema.safeParse(getCookie(event, CSP_COOKIE));
  return parsed.success ? parsed.data : 'none';
}

/**
 * En-tête correspondant au mode. Le `report-uri` porte la disposition : le serveur sait
 * ainsi si la violation a été bloquée ou seulement signalée.
 */
export function cspHeaderFor(mode: CspMode): CspStateResponse['header'] {
  if (mode === 'none') return null;
  const disposition = mode === 'enforce' ? 'enforce' : 'report';
  const value = `${CSP_POLICY}; report-uri ${REPORT_URI}?d=${disposition}`;
  return { name: mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', value };
}

type ModeDeps = { vulnerableModeEnabled: () => boolean };

function currentCsp(event: H3Event, deps: ModeDeps): CspMode {
  return getCspMode(event, getLevelMode(event, deps.vulnerableModeEnabled()));
}

/** Middleware Nitro : pose la CSP choisie sur la page du niveau, et seulement sur elle. */
export function createCspHeaderMiddleware(deps: ModeDeps) {
  return defineEventHandler((event) => {
    if (getRequestURL(event).pathname.replace(/\/$/, '') !== LEVEL_PAGE) return;
    const header = cspHeaderFor(currentCsp(event, deps));
    if (header) setResponseHeader(event, header.name, header.value);
  });
}

export function createCspStateHandler(deps: ModeDeps) {
  return defineEventHandler((event): CspStateResponse => {
    const csp = currentCsp(event, deps);
    return { csp, header: cspHeaderFor(csp) };
  });
}

/** Mémorise la CSP choisie ; elle s'applique au prochain chargement de la page. */
export function createCspChangeHandler() {
  return defineEventHandler(async (event): Promise<{ csp: CspMode }> => {
    const parsed = changeCspSchema.safeParse(await readBody(event).catch(() => undefined));
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Mode de CSP invalide' });

    setCookie(event, CSP_COOKIE, parsed.data.csp, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return { csp: parsed.data.csp };
  });
}

/** Journal des violations reçues, par joueur (en mémoire, non persisté). */
export interface ViolationLog {
  record(playerId: string, violation: CspViolation): void;
  list(playerId: string): CspViolation[];
}

const MAX_VIOLATIONS = 20;

export function createViolationLog(): ViolationLog {
  const store = new Map<string, CspViolation[]>();
  return {
    record(playerId, violation) {
      const list = store.get(playerId) ?? [];
      list.push(violation);
      if (list.length > MAX_VIOLATIONS) list.shift();
      store.set(playerId, list);
    },
    list(playerId) {
      return store.get(playerId) ?? [];
    },
  };
}

let sharedLog: ViolationLog | undefined;

export function useViolationLog(): ViolationLog {
  sharedLog ??= createViolationLog();
  return sharedLog;
}

const MAX_REPORT_BYTES = 8 * 1024;
const text = z.string().max(500).optional();
const reportSchema = z.object({
  'csp-report': z.object({
    'effective-directive': text,
    'violated-directive': text,
    'blocked-uri': text,
  }),
});
const dispositionSchema = z.enum(['enforce', 'report']);

/**
 * Endpoint `report-uri` : le navigateur y signale chaque violation (corps
 * `application/csp-report`). Ces rapports sont forgeables : on les valide, on borne
 * leur taille, et ils ne servent qu'à l'affichage du niveau.
 */
export function createCspReportHandler(deps: { log: ViolationLog }) {
  return defineEventHandler(async (event) => {
    const disposition = dispositionSchema.safeParse(getQuery(event)['d']);
    if (!disposition.success) throw createError({ statusCode: 400, message: 'Disposition inconnue' });

    const raw = (await readRawBody(event)) ?? '';
    if (raw.length > MAX_REPORT_BYTES) throw createError({ statusCode: 413, message: 'Rapport trop volumineux' });

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw createError({ statusCode: 400, message: 'Rapport CSP invalide' });
    }
    const parsed = reportSchema.safeParse(json);
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Rapport CSP invalide' });

    const report = parsed.data['csp-report'];
    deps.log.record(getPlayerId(event), {
      disposition: disposition.data,
      directive: report['effective-directive'] ?? report['violated-directive'] ?? '',
      blockedUri: report['blocked-uri'] ?? '',
    });
    setResponseStatus(event, 204);
    return null;
  });
}

/** Violations du joueur ; le flag tombe dès qu'un script a été bloqué (mode vulnérable seulement). */
export function createViolationsHandler(deps: ModeDeps & { log: ViolationLog; levels: () => Level[] }) {
  return defineEventHandler((event): ViolationsResponse => {
    const violations = deps.log.list(getPlayerId(event));
    setResponseHeader(event, 'Cache-Control', 'no-store');

    const blocked = violations.some((v) => v.disposition === 'enforce' && v.directive.startsWith('script-src'));
    const vulnerable = getLevelMode(event, deps.vulnerableModeEnabled()) === 'vulnerable';
    const flag = blocked && vulnerable ? deps.levels().find((l) => l.id === CSP_LEVEL_ID)?.flag : undefined;
    return flag ? { violations, flag } : { violations };
  });
}
