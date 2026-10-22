// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createApp, eventHandler, getRequestHeader, toWebHandler } from 'h3';

import { PLAYER_COOKIE, getPlayerId } from './player';

const handler = toWebHandler(
  createApp().use(eventHandler((event) => ({ playerId: getPlayerId(event) }))),
);

const call = (cookie?: string) =>
  handler(new Request('http://localhost/', { headers: cookie ? { cookie } : {} }));

describe('getPlayerId', () => {
  it('attribue un identifiant à un nouveau visiteur via un cookie HttpOnly et SameSite', async () => {
    const response = await call();
    const setCookie = response.headers.get('set-cookie') ?? '';
    const { playerId } = await response.json();

    expect(setCookie).toContain(`${PLAYER_COOKIE}=${playerId}`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it("réutilise l'identifiant d'un visiteur connu sans redéfinir le cookie", async () => {
    const id = '0b6f2c1e-6a0e-4d53-9d0a-3f4a7c2b9e11';
    const response = await call(`${PLAYER_COOKIE}=${id}`);

    expect((await response.json()).playerId).toBe(id);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('remplace un identifiant falsifié qui ne respecte pas le format attendu', async () => {
    const response = await call(`${PLAYER_COOKIE}=' OR 1=1 --`);

    expect((await response.json()).playerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('garde le même identifiant pour toute la requête, même appelé plusieurs fois', async () => {
    const twice = toWebHandler(
      createApp().use(eventHandler((event) => ({ first: getPlayerId(event), second: getPlayerId(event) }))),
    );

    const { first, second } = await (await twice(new Request('http://localhost/'))).json();

    expect(second).toBe(first);
  });

  it("transmet l'identifiant créé à la suite de la requête (rendu SSR et appels internes)", async () => {
    const downstream = toWebHandler(
      createApp()
        .use(eventHandler((event) => void getPlayerId(event)))
        .use(eventHandler((event) => ({ cookie: getRequestHeader(event, 'cookie') }))),
    );

    const response = await downstream(new Request('http://localhost/', { headers: { cookie: 'theme=dark' } }));
    const { cookie } = await response.json();
    const created = /ba_player=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')?.[1];

    expect(cookie).toBe(`theme=dark; ${PLAYER_COOKIE}=${created}`);
  });
});
