// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createApp, createRouter, eventHandler, toWebHandler } from 'h3';

import { MODE_COOKIE, changeLevelMode, getLevelMode } from './mode';

const app = (enabled: boolean) =>
  toWebHandler(
    createApp().use(
      createRouter()
        .get('/mode', eventHandler((event) => ({ mode: getLevelMode(event, enabled) })))
        .post('/mode', eventHandler((event) => changeLevelMode(event, enabled))),
    ),
  );

const readMode = async (enabled: boolean, cookie?: string) =>
  (await (await app(enabled)(new Request('http://localhost/mode', { headers: cookie ? { cookie } : {} }))).json()).mode;

const postMode = (enabled: boolean, body: unknown) =>
  app(enabled)(
    new Request('http://localhost/mode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('getLevelMode', () => {
  it('reste en mode sécurisé quand le mode vulnérable est désactivé, même si le cookie demande le contraire', async () => {
    expect(await readMode(false, `${MODE_COOKIE}=vulnerable`)).toBe('secure');
  });

  it('démarre en mode vulnérable quand il est autorisé et que le joueur n’a rien choisi', async () => {
    expect(await readMode(true)).toBe('vulnerable');
  });

  it('respecte le choix du joueur mémorisé en cookie', async () => {
    expect(await readMode(true, `${MODE_COOKIE}=secure`)).toBe('secure');
  });

  it('ignore une valeur de cookie inconnue', async () => {
    expect(await readMode(true, `${MODE_COOKIE}=<script>`)).toBe('vulnerable');
  });
});

describe('changeLevelMode', () => {
  it('mémorise le choix dans un cookie HttpOnly et SameSite', async () => {
    const response = await postMode(true, { mode: 'secure' });
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(await response.json()).toEqual({ mode: 'secure' });
    expect(setCookie).toContain(`${MODE_COOKIE}=secure`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it('refuse de passer en mode vulnérable quand il est désactivé', async () => {
    const response = await postMode(false, { mode: 'vulnerable' });

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejette un mode invalide', async () => {
    const response = await postMode(true, { mode: 'admin' });

    expect(response.status).toBe(400);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
