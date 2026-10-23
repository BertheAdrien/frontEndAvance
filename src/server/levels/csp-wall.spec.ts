// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createApp, createRouter, eventHandler, toWebHandler } from 'h3';

import { PLAYER_COOKIE } from '../player';
import { MODE_COOKIE } from '../mode';
import type { Level } from './catalog';
import {
  CSP_COOKIE,
  CSP_LEVEL_ID,
  createCspChangeHandler,
  createCspHeaderMiddleware,
  createCspReportHandler,
  createCspStateHandler,
  createViolationLog,
  createViolationsHandler,
} from './csp-wall';

const PLAYER_A = '11111111-1111-4111-8111-111111111111';
const PLAYER_B = '22222222-2222-4222-8222-222222222222';
const PAGE = `/niveaux/${CSP_LEVEL_ID}`;

const levels: Level[] = [
  { id: CSP_LEVEL_ID, order: 3, theme: 'CSP', title: '', summary: '', instructions: '', story: '', flag: 'BREACH{mur}' },
];

function cookies({ player = PLAYER_A, mode, csp }: { player?: string; mode?: string; csp?: string } = {}): string {
  const parts = [`${PLAYER_COOKIE}=${player}`];
  if (mode) parts.push(`${MODE_COOKIE}=${mode}`);
  if (csp) parts.push(`${CSP_COOKIE}=${csp}`);
  return parts.join('; ');
}

const app = (vulnerableModeEnabled = true, log = createViolationLog()) => {
  const deps = { vulnerableModeEnabled: () => vulnerableModeEnabled };
  const page = eventHandler(() => '<html></html>');
  return toWebHandler(
    createApp()
      .use(createCspHeaderMiddleware(deps))
      .use(
        createRouter()
          .get(PAGE, page)
          .get('/niveaux/livre-d-or', page)
          .get('/csp', createCspStateHandler(deps))
          .post('/csp', createCspChangeHandler())
          .post('/csp-report', createCspReportHandler({ log }))
          .get('/violations', createViolationsHandler({ ...deps, log, levels: () => levels })),
      ),
  );
};

const get = (handler: ReturnType<typeof app>, path: string, cookie = cookies({ csp: 'enforce' })) =>
  handler(new Request(`http://localhost${path}`, { headers: { cookie } }));

/** Rapport tel que l'envoie le navigateur pour un gestionnaire `onerror` injecté. */
const report = (directive = 'script-src-attr') => ({
  'csp-report': {
    'document-uri': `http://localhost${PAGE}`,
    'effective-directive': directive,
    'violated-directive': directive,
    'blocked-uri': 'inline',
    disposition: 'enforce',
  },
});

const sendReport = (handler: ReturnType<typeof app>, query: string, body: unknown, cookie = cookies()) =>
  handler(
    new Request(`http://localhost/csp-report${query}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/csp-report' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const readViolations = async (handler: ReturnType<typeof app>, cookie = cookies()) =>
  (await (await get(handler, '/violations', cookie)).json()) as { violations: unknown[]; flag?: string };

describe('en-tête CSP de la page du niveau', () => {
  it('pose une CSP bloquante qui interdit les scripts inline quand le joueur la choisit', async () => {
    const res = await get(app(), PAGE, cookies({ csp: 'enforce' }));

    const csp = res.headers.get('content-security-policy');
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(csp).toContain("object-src 'none'");
    // Vite inline les petites polices en data: ; sans cette source, elles seraient bloquées.
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain('report-uri /api/mur-invisible/csp-report?d=enforce');
    expect(res.headers.get('content-security-policy-report-only')).toBeNull();
  });

  it('en mode rapport, envoie la même politique dans Content-Security-Policy-Report-Only', async () => {
    const res = await get(app(), PAGE, cookies({ csp: 'report-only' }));

    expect(res.headers.get('content-security-policy')).toBeNull();
    expect(res.headers.get('content-security-policy-report-only')).toContain('report-uri /api/mur-invisible/csp-report?d=report');
  });

  it("ne pose aucune CSP quand le joueur choisit « aucune », ni sur les autres pages", async () => {
    const none = await get(app(), PAGE, cookies({ csp: 'none' }));
    const other = await get(app(), '/niveaux/livre-d-or', cookies({ csp: 'enforce' }));

    for (const res of [none, other]) {
      expect(res.headers.get('content-security-policy')).toBeNull();
      expect(res.headers.get('content-security-policy-report-only')).toBeNull();
    }
  });

  it('impose la CSP bloquante en mode sécurisé ou quand le mode vulnérable est désactivé', async () => {
    const secure = await get(app(), PAGE, cookies({ mode: 'secure', csp: 'none' }));
    const disabled = await get(app(false), PAGE, cookies({ csp: 'none' }));

    expect(secure.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(disabled.headers.get('content-security-policy')).toContain("script-src 'self'");
  });
});

describe('choix de la CSP', () => {
  it('mémorise le choix du joueur dans un cookie HttpOnly et le renvoie', async () => {
    const res = await app()(
      new Request('http://localhost/csp', {
        method: 'POST',
        headers: { cookie: cookies(), 'content-type': 'application/json' },
        body: JSON.stringify({ csp: 'report-only' }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`${CSP_COOKIE}=report-only.*HttpOnly`, 'i'));
    expect(await (await get(app(), '/csp', cookies({ csp: 'report-only' }))).json()).toMatchObject({
      csp: 'report-only',
      header: { name: 'Content-Security-Policy-Report-Only' },
    });
  });

  it('refuse une valeur inconnue', async () => {
    const res = await app()(
      new Request('http://localhost/csp', {
        method: 'POST',
        headers: { cookie: cookies(), 'content-type': 'application/json' },
        body: JSON.stringify({ csp: "'unsafe-inline'" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('collecte des violations (report-uri)', () => {
  it('révèle le flag à la première violation bloquée, propre au joueur', async () => {
    const handler = app();

    expect((await sendReport(handler, '?d=enforce', report())).status).toBe(204);

    const own = await readViolations(handler);
    expect(own.violations).toEqual([{ disposition: 'enforce', directive: 'script-src-attr', blockedUri: 'inline' }]);
    expect(own.flag).toBe('BREACH{mur}');
    expect(await readViolations(handler, cookies({ player: PLAYER_B }))).toEqual({ violations: [] });
  });

  it("une violation seulement signalée (report-only) est journalisée sans donner le flag", async () => {
    const handler = app();

    await sendReport(handler, '?d=report', report());

    const result = await readViolations(handler);
    expect(result.violations).toHaveLength(1);
    expect(result.flag).toBeUndefined();
  });

  it("une violation bloquée hors scripts (ex. une image) ne donne pas le flag", async () => {
    const handler = app();

    await sendReport(handler, '?d=enforce', report('img-src'));

    expect((await readViolations(handler)).flag).toBeUndefined();
  });

  it('ne révèle jamais le flag en mode sécurisé, même avec un rapport forgé', async () => {
    const handler = app();

    await sendReport(handler, '?d=enforce', report(), cookies({ mode: 'secure' }));

    expect((await readViolations(handler, cookies({ mode: 'secure' }))).flag).toBeUndefined();
  });

  it('rejette un rapport mal formé ou trop volumineux', async () => {
    const handler = app();

    expect((await sendReport(handler, '?d=enforce', 'pas du json')).status).toBe(400);
    expect((await sendReport(handler, '?d=autre', report())).status).toBe(400);
    expect((await sendReport(handler, '?d=enforce', { 'csp-report': { 'blocked-uri': 'x'.repeat(20_000) } })).status).toBe(413);
    expect((await readViolations(handler)).violations).toEqual([]);
  });
});
