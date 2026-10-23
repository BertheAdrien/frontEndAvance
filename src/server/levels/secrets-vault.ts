import { defineEventHandler, setResponseHeader } from 'h3';

import type {
  GitCommit,
  GitHistoryResponse,
  GitleaksFinding,
  VaultConfig,
  VaultConfigResponse,
} from '../../shared/secrets-vault';
import { getLevelMode } from '../mode';
import type { Level } from './catalog';

/** Niveau 5 : le coffre qui fuit. Deux fuites (bundle, historique Git), aucun vrai secret du site. */
export const SECRETS_LEVEL_ID = 'coffre-qui-fuit';

type Deps = { levels: () => Level[]; vulnerableModeEnabled: () => boolean };

const flagOf = (deps: Deps) => deps.levels().find((l) => l.id === SECRETS_LEVEL_ID)?.flag;

/** Fichier front où la clé a « fuité » : un classique `environment.ts` d'Angular. */
const CONFIG_FILE = 'src/environments/environment.ts';

/** Configuration publique, toujours envoyée au navigateur (rien de sensible). */
function publicConfig(): VaultConfig {
  return {
    appName: 'Breach Academy',
    apiBaseUrl: '/api',
    features: { leaderboard: true, push: true },
  };
}

/**
 * Fuite n°1 : le bundle. En mode vulnérable, la config livrée au navigateur contient
 * une « clé analytics » (le flag). Leçon : tout ce qui part au front est public.
 */
export function createVaultConfigHandler(deps: Deps) {
  return defineEventHandler((event): VaultConfigResponse => {
    setResponseHeader(event, 'Cache-Control', 'no-store');
    const vulnerable = getLevelMode(event, deps.vulnerableModeEnabled()) === 'vulnerable';
    const config = publicConfig();

    // VULNERABLE (démo): une clé secrète glissée dans la config du front part avec le reste
    // dans la réponse HTTP — n'importe qui la lit dans les DevTools (onglet Réseau / Sources).
    const flag = vulnerable ? flagOf(deps) : undefined;
    return flag ? { config: { ...config, analyticsKey: flag }, leaked: true } : { config, leaked: false };
  });
}

/** Historique où la clé a été commitée puis « retirée » : elle reste pourtant dans un commit antérieur. */
function leakyHistory(flag: string): GitCommit[] {
  return [
    {
      hash: 'a1b2c3d',
      author: 'dev.presse',
      date: '2026-01-12',
      subject: 'Ajout de la configuration analytics',
      diff: [
        ' export const environment = {',
        '   production: false,',
        '+  // clé du service analytics',
        `+  analyticsKey: '${flag}',`,
        ' };',
      ],
    },
    {
      hash: 'e4f5a6b',
      author: 'dev.presse',
      date: '2026-01-13',
      subject: 'Oups : on retire la clé du dépôt',
      diff: [
        ' export const environment = {',
        '   production: false,',
        '-  // clé du service analytics',
        `-  analyticsKey: '${flag}',`,
        ' };',
      ],
    },
  ];
}

/** Historique propre : la clé n'a jamais été écrite, le serveur la lit de l'environnement. */
function cleanHistory(): GitCommit[] {
  return [
    {
      hash: '7c0ffee',
      author: 'dev',
      date: '2026-01-12',
      subject: "Lecture de la clé analytics depuis l'environnement",
      diff: [
        ' // src/server/config.ts',
        "+// la clé reste côté serveur, lue à l'exécution — jamais dans le dépôt ni le bundle",
        "+export const analyticsKey = process.env['ANALYTICS_KEY'];",
      ],
    },
  ];
}

function gitleaksFinding(flag: string): GitleaksFinding {
  return { rule: 'generic-api-key', commit: 'a1b2c3d', file: CONFIG_FILE, secret: flag };
}

/**
 * Fuite n°2 : l'historique Git. En mode vulnérable, `git log -p` montre la clé commitée
 * puis retirée ; gitleaks la retrouve dans le commit d'origine. Un `git rm` ne suffit pas.
 */
export function createGitHistoryHandler(deps: Deps) {
  return defineEventHandler((event): GitHistoryResponse => {
    setResponseHeader(event, 'Cache-Control', 'no-store');
    const vulnerable = getLevelMode(event, deps.vulnerableModeEnabled()) === 'vulnerable';
    const flag = vulnerable ? flagOf(deps) : undefined;
    return flag
      ? { commits: leakyHistory(flag), gitleaks: gitleaksFinding(flag), leaked: true }
      : { commits: cleanHistory(), gitleaks: null, leaked: false };
  });
}
