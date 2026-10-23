import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS captures (
    player_id   TEXT NOT NULL,
    level_id    TEXT NOT NULL,
    captured_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player_id, level_id)
  );

  CREATE TABLE IF NOT EXISTS guestbook (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id  TEXT NOT NULL,
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

/** Ouvre la base SQLite (`:memory:` pour les tests) et applique le schéma. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

let shared: DatabaseSync | undefined;

/** Base partagée par les routes du serveur ; chemin configurable via `DATABASE_PATH`. */
export function useDatabase(): DatabaseSync {
  shared ??= openDatabase(process.env['DATABASE_PATH'] ?? 'breach-academy.db');
  return shared;
}
