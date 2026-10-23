// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createApp, createRouter, toWebHandler } from 'h3';

import { MODE_COOKIE } from '../mode';
import type { Level } from './catalog';
import { SECRETS_LEVEL_ID, createGitHistoryHandler, createVaultConfigHandler } from './secrets-vault';

const FLAG = 'BREACH{coffre}';
const levels: Level[] = [
  { id: SECRETS_LEVEL_ID, order: 5, theme: 'Secrets', title: '', summary: '', instructions: '', story: '', flag: FLAG },
];

const app = (vulnerableModeEnabled = true) => {
  const deps = { levels: () => levels, vulnerableModeEnabled: () => vulnerableModeEnabled };
  return toWebHandler(
    createApp().use(
      createRouter()
        .get('/config', createVaultConfigHandler(deps))
        .get('/historique-git', createGitHistoryHandler(deps)),
    ),
  );
};

const req = (handler: ReturnType<typeof app>, path: string, mode?: string) =>
  handler(new Request(`http://localhost${path}`, { headers: mode ? { cookie: `${MODE_COOKIE}=${mode}` } : {} }));

describe('GET /config — fuite dans le bundle', () => {
  it('en mode vulnérable, livre la clé analytics (le flag) au navigateur', async () => {
    const body = (await (await req(app(), '/config', 'vulnerable')).json()) as {
      config: { analyticsKey?: string }; leaked: boolean;
    };
    expect(body.leaked).toBe(true);
    expect(body.config.analyticsKey).toBe(FLAG);
  });

  it('en mode sécurisé, ne livre aucune clé et aucune trace du flag', async () => {
    const res = await req(app(), '/config', 'secure');
    const text = await res.text();
    expect(text).not.toContain('BREACH{');
    expect((JSON.parse(text) as { config: { analyticsKey?: string }; leaked: boolean }).config.analyticsKey).toBeUndefined();
    expect((JSON.parse(text) as { leaked: boolean }).leaked).toBe(false);
  });

  it('serveur sans mode vulnérable autorisé : la clé ne fuite pas, même avec le cookie vulnérable', async () => {
    const body = (await (await req(app(false), '/config', 'vulnerable')).json()) as { config: { analyticsKey?: string } };
    expect(body.config.analyticsKey).toBeUndefined();
  });
});

describe('GET /historique-git — fuite dans l\'historique', () => {
  it('en mode vulnérable, le secret retiré d\'un commit reste visible dans un commit antérieur', async () => {
    const body = (await (await req(app(), '/historique-git', 'vulnerable')).json()) as {
      commits: { subject: string; diff: string[] }[]; gitleaks: { secret: string; commit: string } | null; leaked: boolean;
    };
    expect(body.leaked).toBe(true);
    // Le flag apparaît bien dans au moins une ligne de diff de l'historique.
    expect(body.commits.some((c) => c.diff.some((line) => line.includes(FLAG)))).toBe(true);
    // Le scan gitleaks le retrouve et pointe un commit précis.
    expect(body.gitleaks?.secret).toBe(FLAG);
    expect(body.gitleaks?.commit).toBeTruthy();
  });

  it('en mode sécurisé, aucun secret dans l\'historique ni détection gitleaks', async () => {
    const res = await req(app(), '/historique-git', 'secure');
    const text = await res.text();
    expect(text).not.toContain('BREACH{');
    const body = JSON.parse(text) as { gitleaks: unknown; leaked: boolean };
    expect(body.gitleaks).toBeNull();
    expect(body.leaked).toBe(false);
  });
});
