import type { DatabaseSync } from 'node:sqlite';
import { createError, defineEventHandler, getQuery, readBody, setResponseHeader } from 'h3';
import { z } from 'zod';

import type { GuestbookMessage, GuestbookResponse, LootResponse } from '../../shared/guestbook';
import { getLevelMode } from '../mode';
import { getPlayerId } from '../player';
import type { Level } from './catalog';

/** Niveau 2 : livre d'or stocké en SQLite, relu par un faux bot administrateur. */
export const GUESTBOOK_LEVEL_ID = 'livre-d-or';

const messageSchema = z.object({
  author: z.string().trim().min(1).max(40),
  body: z.string().min(1).max(500),
});

/**
 * Détecte une tentative d'injection HTML (balise ou gestionnaire d'événement).
 * Un livre d'or ne contient que du texte : en mode sécurisé, tout HTML est refusé.
 */
export function hasDangerousHtml(body: string): boolean {
  return /<\s*[a-z!/]/i.test(body) || /\son\w+\s*=/i.test(body);
}

export function addMessage(db: DatabaseSync, playerId: string, author: string, body: string): void {
  db.prepare('INSERT INTO guestbook (player_id, author, body) VALUES (?, ?, ?)').run(playerId, author, body);
}

/** Messages du joueur, du plus ancien au plus récent (ordre d'affichage du livre d'or). */
export function listMessages(db: DatabaseSync, playerId: string): GuestbookMessage[] {
  const rows = db
    .prepare('SELECT id, author, body, created_at FROM guestbook WHERE player_id = ? ORDER BY id ASC')
    .all(playerId) as { id: number; author: string; body: string; created_at: string }[];
  return rows.map((row) => ({ id: row.id, author: row.author, body: row.body, createdAt: row.created_at }));
}

/** Liste les messages du joueur courant. */
export function createGuestbookListHandler(deps: { db: () => DatabaseSync }) {
  return defineEventHandler((event): GuestbookResponse => {
    return { messages: listMessages(deps.db(), getPlayerId(event)) };
  });
}

/**
 * Publication d'un message. En mode sécurisé, le serveur refuse tout HTML (défense
 * en profondeur, en plus du rendu texte côté client) ; en mode vulnérable, il stocke
 * le message tel quel, payload compris.
 */
export function createGuestbookPostHandler(deps: {
  db: () => DatabaseSync;
  vulnerableModeEnabled: () => boolean;
}) {
  return defineEventHandler(async (event): Promise<GuestbookResponse> => {
    const playerId = getPlayerId(event);
    const mode = getLevelMode(event, deps.vulnerableModeEnabled());

    const parsed = messageSchema.safeParse(await readBody(event).catch(() => undefined));
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Message invalide' });

    const { author, body } = parsed.data;
    if (mode === 'secure' && hasDangerousHtml(body)) {
      throw createError({ statusCode: 400, message: 'Le message ne doit pas contenir de HTML' });
    }

    addMessage(deps.db(), playerId, author, body);
    return { messages: listMessages(deps.db(), playerId) };
  });
}

/**
 * Session du faux bot admin : un cookie non HttpOnly qui contient le flag, lisible par
 * `document.cookie`. Le serveur ne le délivre qu'en mode vulnérable (comme le reveal du
 * niveau 1) : en mode sécurisé, le flag ne sort jamais.
 */
export function createBotSessionHandler(deps: { levels: () => Level[]; vulnerableModeEnabled: () => boolean }) {
  return defineEventHandler((event) => {
    if (getLevelMode(event, deps.vulnerableModeEnabled()) !== 'vulnerable') {
      throw createError({ statusCode: 403, message: 'Le bot admin n\'a pas de session en mode sécurisé' });
    }
    const level = deps.levels().find((l) => l.id === GUESTBOOK_LEVEL_ID);
    if (!level) throw createError({ statusCode: 404, message: 'Niveau inconnu' });

    setResponseHeader(event, 'Cache-Control', 'no-store');
    return { session: `ba_admin=${level.flag}` };
  });
}

/** Faux collecteur de l'attaquant : mémorise le butin volé par joueur (en mémoire). */
export interface EvilCollector {
  collect(playerId: string, loot: string): void;
  loot(playerId: string): string[];
}

const MAX_LOOT = 20;

export function createEvilCollector(): EvilCollector {
  const store = new Map<string, string[]>();
  return {
    collect(playerId, loot) {
      const list = store.get(playerId) ?? [];
      list.push(loot);
      if (list.length > MAX_LOOT) list.shift();
      store.set(playerId, list);
    },
    loot(playerId) {
      return store.get(playerId) ?? [];
    },
  };
}

let sharedCollector: EvilCollector | undefined;

/** Collecteur partagé par les routes du serveur (butin en mémoire, non persisté). */
export function useEvilCollector(): EvilCollector {
  sharedCollector ??= createEvilCollector();
  return sharedCollector;
}

/**
 * Point de collecte piégé. Avec `?c=…`, enregistre ce que le payload a exfiltré ;
 * sans paramètre, renvoie le butin déjà collecté pour l'afficher dans la console du niveau.
 */
export function createCollectHandler(deps: { collector: EvilCollector }) {
  return defineEventHandler((event): LootResponse | { ok: true } => {
    const playerId = getPlayerId(event);
    const c = getQuery(event)['c'];

    setResponseHeader(event, 'Cache-Control', 'no-store');
    if (typeof c === 'string' && c.length > 0) {
      deps.collector.collect(playerId, c.slice(0, 500));
      return { ok: true };
    }
    return { loot: deps.collector.loot(playerId) };
  });
}
