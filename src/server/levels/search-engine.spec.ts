// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createApp, createRouter, toWebHandler } from 'h3';

import { MODE_COOKIE } from '../mode';
import type { Level } from './catalog';
import { SEARCH_LEVEL_ID, createRevealHandler, createSearchHandler, searchArticles } from './search-engine';

const levels: Level[] = [
  { id: SEARCH_LEVEL_ID, order: 1, theme: 'XSS', title: '', summary: '', instructions: '', story: '', flag: 'BREACH{un}' },
  { id: 'n2', order: 2, theme: 'CSP', title: '', summary: '', instructions: '', story: '', flag: 'BREACH{deux}' },
];

const app = (vulnerableModeEnabled: boolean) =>
  toWebHandler(
    createApp().use(
      createRouter()
        .get('/search', createSearchHandler())
        .post('/reveal', createRevealHandler({ levels: () => levels, vulnerableModeEnabled: () => vulnerableModeEnabled })),
    ),
  );

const reveal = (enabled: boolean, mode: string) =>
  app(enabled)(new Request('http://localhost/reveal', { method: 'POST', headers: { cookie: `${MODE_COOKIE}=${mode}` } }));

describe('searchArticles', () => {
  it('trouve les articles sans tenir compte de la casse ni des accents', () => {
    const titles = searchArticles('  FORMULAIRE ').map((a) => a.title);

    expect(titles).toContain('Dix réflexes de sécurité pour vos formulaires');
    expect(searchArticles('securite')).toEqual(searchArticles('Sécurité'));
    expect(searchArticles('securite').length).toBeGreaterThan(0);
  });

  it("ne renvoie rien pour un terme absent de tous les articles, payload XSS compris", () => {
    expect(searchArticles('<img src=x onerror=alert(1)>')).toEqual([]);
  });
});

describe('GET /api/recherche-bavarde/articles', () => {
  it('réaffiche le terme cherché tel quel, avec les articles trouvés', async () => {
    const payload = '<img src=x onerror=revealFlag()>';
    const response = await app(true)(new Request(`http://localhost/search?q=${encodeURIComponent(payload)}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ query: payload, articles: [] });
  });

  it('rejette en 400 un terme trop long ou répété', async () => {
    expect((await app(true)(new Request(`http://localhost/search?q=${'a'.repeat(201)}`))).status).toBe(400);
    expect((await app(true)(new Request('http://localhost/search?q=a&q=b'))).status).toBe(400);
  });
});

describe('POST /api/recherche-bavarde/reveal', () => {
  it('révèle le flag du niveau 1, et lui seul, en mode vulnérable', async () => {
    const response = await reveal(true, 'vulnerable');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ flag: 'BREACH{un}' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('refuse en 403 quand le joueur est en mode sécurisé', async () => {
    const response = await reveal(true, 'secure');

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('BREACH{');
  });

  it('refuse en 403 quand le serveur interdit le mode vulnérable, même si le cookie le demande', async () => {
    expect((await reveal(false, 'vulnerable')).status).toBe(403);
  });
});
