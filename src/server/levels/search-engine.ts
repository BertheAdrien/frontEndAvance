import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3';
import { z } from 'zod';

import type { Article, SearchResponse } from '../../shared/search-engine';
import { getLevelMode } from '../mode';
import type { Level } from './catalog';

/** Niveau 1 : faux moteur de recherche d'un blog, service isolé du reste du site. */
export const SEARCH_LEVEL_ID = 'recherche-bavarde';

const ARTICLES: Article[] = [
  {
    title: 'Dix réflexes de sécurité pour vos formulaires',
    excerpt: 'Valider côté serveur, limiter les tailles, ne jamais faire confiance au navigateur.',
  },
  {
    title: 'Angular et les signaux : le guide pratique',
    excerpt: 'Signal, computed, effect : réécrire un composant sans RxJS, pas à pas.',
  },
  {
    title: 'Pourquoi échapper le HTML ?',
    excerpt: "Ce qui arrive quand une saisie de l'utilisateur est réinjectée telle quelle dans la page.",
  },
  {
    title: 'Les cookies sans les miettes',
    excerpt: 'HttpOnly, Secure, SameSite : trois attributs qui changent tout pour une session.',
  },
  {
    title: 'Mettre une application Node en production',
    excerpt: 'Docker multi-stage, utilisateur non root et variables d’environnement.',
  },
  {
    title: 'Tests de bout en bout avec Playwright',
    excerpt: 'Écrire des scénarios fiables, et prouver la sécurité dans un vrai navigateur.',
  },
];

/** Minuscules sans accents, pour qu'« securite » trouve « Sécurité ». */
const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function searchArticles(query: string): Article[] {
  const term = normalize(query);
  if (!term) return ARTICLES;
  return ARTICLES.filter((a) => normalize(`${a.title} ${a.excerpt}`).includes(term));
}

const searchSchema = z.object({ q: z.string().max(200).default('') });

/** Recherche : le terme est renvoyé tel quel. C'est le client qui choisit comment l'afficher. */
export function createSearchHandler() {
  return defineEventHandler((event): SearchResponse => {
    const parsed = searchSchema.safeParse(getQuery(event));
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Recherche invalide' });
    return { query: parsed.data.q, articles: searchArticles(parsed.data.q) };
  });
}

/**
 * Appelée par `window.revealFlag()`, que le client n'expose qu'en mode vulnérable.
 * Le serveur relit lui-même le mode : en mode sécurisé, le flag ne sort jamais.
 */
export function createRevealHandler(deps: { levels: () => Level[]; vulnerableModeEnabled: () => boolean }) {
  return defineEventHandler((event) => {
    if (getLevelMode(event, deps.vulnerableModeEnabled()) !== 'vulnerable') {
      throw createError({ statusCode: 403, message: 'Aucun flag en mode sécurisé' });
    }
    const level = deps.levels().find((l) => l.id === SEARCH_LEVEL_ID);
    if (!level) throw createError({ statusCode: 404, message: 'Niveau inconnu' });

    setResponseHeader(event, 'Cache-Control', 'no-store');
    return { flag: level.flag };
  });
}
