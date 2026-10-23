// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createApp, createRouter, toWebHandler } from 'h3';

import { MODE_COOKIE } from '../mode';
import type { Level } from './catalog';
import {
  BANK_COOKIE,
  BANK_LEVEL_ID,
  XSRF_COOKIE,
  createAccountHandler,
  createBankStore,
  createTransferHandler,
  createTrapPageHandler,
} from './bank';

const levels: Level[] = [
  { id: BANK_LEVEL_ID, order: 4, theme: 'CSRF', title: '', summary: '', instructions: '', story: '', flag: 'BREACH{virement}' },
];

const BANK_HOST = 'localhost';
const EVIL_ORIGIN = 'http://127.0.0.1';

/** Monte la banque avec un magasin partagé pour que les requêtes successives voient la même session. */
const app = (vulnerableModeEnabled = true, store = createBankStore()) => {
  const deps = { vulnerableModeEnabled: () => vulnerableModeEnabled, levels: () => levels, store };
  return toWebHandler(
    createApp().use(
      createRouter()
        .get('/compte', createAccountHandler(deps))
        .get('/virement', createTransferHandler(deps))
        .post('/virement', createTransferHandler(deps))
        .get('/piege', createTrapPageHandler()),
    ),
  );
};

type Opts = { mode?: string; bank?: string; xsrf?: string };
const cookie = ({ mode, bank, xsrf }: Opts = {}) =>
  [mode && `${MODE_COOKIE}=${mode}`, bank && `${BANK_COOKIE}=${bank}`, xsrf && `${XSRF_COOKIE}=${xsrf}`]
    .filter(Boolean)
    .join('; ');

const BANK_SESSION = '11111111-1111-4111-8111-111111111111';

const req = (
  handler: ReturnType<typeof app>,
  path: string,
  { method = 'GET', headers = {} as Record<string, string>, body }: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
) =>
  handler(
    new Request(`http://${BANK_HOST}${path}`, {
      method,
      headers: { host: BANK_HOST, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

describe('GET /compte', () => {
  it('ouvre un compte approvisionné et pose la session bancaire', async () => {
    const res = await req(app(), '/compte', { headers: { cookie: cookie({ mode: 'vulnerable' }) } });

    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`${BANK_COOKIE}=.*HttpOnly`, 'i'));
    const body = await json(res);
    expect(body['solde']).toBeGreaterThan(0);
    expect(body['historique']).toEqual([]);
    expect(body['flag']).toBeUndefined();
  });

  it('en mode sécurisé, pose un cookie XSRF lisible par le script et marqué SameSite=Strict', async () => {
    const res = await req(app(), '/compte', { headers: { cookie: cookie({ mode: 'secure' }) } });

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(new RegExp(`${XSRF_COOKIE}=`, 'i'));
    expect(setCookie).not.toMatch(new RegExp(`${XSRF_COOKIE}=[^;]*;[^,]*HttpOnly`, 'i'));
    expect(setCookie).toMatch(new RegExp(`${BANK_COOKIE}=[^,]*SameSite=Strict`, 'i'));
  });
});

describe('POST /virement — virement légitime depuis la banque', () => {
  it('débite le compte sans marquer le virement frauduleux ni révéler le flag', async () => {
    const store = createBankStore();
    const handler = app(true, store);
    await req(handler, '/compte', { headers: { cookie: cookie({ mode: 'vulnerable', bank: BANK_SESSION }) } });

    const res = await req(handler, '/virement', {
      method: 'POST',
      headers: { cookie: cookie({ mode: 'vulnerable', bank: BANK_SESSION }), origin: `http://${BANK_HOST}` },
      body: { beneficiaire: 'Alice', montant: 200 },
    });

    const body = await json(res);
    expect((body['recu'] as { frauduleux: boolean }).frauduleux).toBe(false);
    expect(body['flag']).toBeUndefined();
    expect(body['solde']).toBe(800);
  });

  it('refuse un montant supérieur au solde', async () => {
    const res = await req(app(), '/virement', {
      method: 'POST',
      headers: { cookie: cookie({ mode: 'vulnerable', bank: BANK_SESSION }), origin: `http://${BANK_HOST}` },
      body: { beneficiaire: 'Alice', montant: 999999 },
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /virement — requête frauduleuse (CSRF) en mode vulnérable', () => {
  it('exécute le virement sur simple cookie et le reçu porte le flag', async () => {
    const res = await req(app(), '/virement?beneficiaire=PIRATE_CSRF&montant=500', {
      headers: { cookie: cookie({ mode: 'vulnerable', bank: BANK_SESSION }), accept: 'application/json' },
    });

    const body = await json(res);
    expect((body['recu'] as { frauduleux: boolean }).frauduleux).toBe(true);
    expect(body['flag']).toBe('BREACH{virement}');
  });

  it('un reçu demandé en HTML (navigation de la page piège) contient le flag', async () => {
    const res = await req(app(), '/virement?beneficiaire=PIRATE_CSRF&montant=500', {
      headers: { cookie: cookie({ mode: 'vulnerable', bank: BANK_SESSION }), accept: 'text/html' },
    });

    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('BREACH{virement}');
  });

  it('le flag reste propre à la session volée', async () => {
    const store = createBankStore();
    const handler = app(true, store);
    await req(handler, '/virement?beneficiaire=PIRATE_CSRF&montant=500', {
      headers: { cookie: cookie({ mode: 'vulnerable', bank: BANK_SESSION }), accept: 'application/json' },
    });

    const autre = await json(
      await req(handler, '/compte', { headers: { cookie: cookie({ mode: 'vulnerable', bank: '99999999-9999-4999-8999-999999999999' }) } }),
    );
    expect(autre['flag']).toBeUndefined();
  });
});

describe('mode sécurisé — les défenses CSRF', () => {
  it('rejette un virement déclenché par un GET (changement d\'état interdit sur GET)', async () => {
    const res = await req(app(), '/virement?beneficiaire=PIRATE_CSRF&montant=500', {
      headers: { cookie: cookie({ mode: 'secure', bank: BANK_SESSION }), accept: 'text/html' },
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await res.text()).not.toContain('BREACH{');
  });

  it('rejette un POST sans jeton anti-CSRF (double submit)', async () => {
    const res = await req(app(), '/virement', {
      method: 'POST',
      headers: { cookie: cookie({ mode: 'secure', bank: BANK_SESSION }), origin: `http://${BANK_HOST}` },
      body: { beneficiaire: 'PIRATE_CSRF', montant: 500 },
    });
    expect(res.status).toBe(403);
  });

  it('rejette un POST dont l\'en-tête Origin est une autre origine', async () => {
    const res = await req(app(), '/virement', {
      method: 'POST',
      headers: {
        cookie: cookie({ mode: 'secure', bank: BANK_SESSION, xsrf: 'jeton-valide' }),
        origin: EVIL_ORIGIN,
        'x-xsrf-token': 'jeton-valide',
      },
      body: { beneficiaire: 'PIRATE_CSRF', montant: 500 },
    });
    expect(res.status).toBe(403);
  });

  it('accepte un virement avec jeton valide et Origin de la banque, sans révéler de flag', async () => {
    const res = await req(app(), '/virement', {
      method: 'POST',
      headers: {
        cookie: cookie({ mode: 'secure', bank: BANK_SESSION, xsrf: 'jeton-valide' }),
        origin: `http://${BANK_HOST}`,
        'x-xsrf-token': 'jeton-valide',
      },
      body: { beneficiaire: 'Alice', montant: 100 },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body['recu'] as { frauduleux: boolean }).frauduleux).toBe(false);
    expect(body['flag']).toBeUndefined();
  });
});

describe('GET /piege — la page piège', () => {
  it('vise la banque sur l\'autre origine (localhost ⇆ 127.0.0.1) via un virement GET', async () => {
    const res = await req(app(), '/piege', { headers: { host: '127.0.0.1:4200', accept: 'text/html' } });

    const html = await res.text();
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('http://localhost:4200/api/virement-fantome/virement');
    expect(html).toContain('method="get"');
  });
});
