import { createHmac, randomBytes } from 'node:crypto';

import type { LevelTheme } from '../../shared/level';

/** Définition complète d'un niveau, flag compris : ne doit jamais quitter le serveur. */
export interface Level {
  id: string;
  order: number;
  theme: LevelTheme;
  title: string;
  summary: string;
  /** Consigne affichée en tête de la page du niveau. */
  instructions: string;
  /** Texte narratif pour le futur mode escape room (vide en v1). */
  story: string;
  flag: string;
}

const DEFINITIONS: Omit<Level, 'flag'>[] = [
  {
    id: 'recherche-bavarde',
    order: 1,
    theme: 'XSS',
    title: 'Le moteur de recherche bavard',
    summary: "Une recherche réaffichée sans échappement. Faites exécuter du JavaScript via l'URL.",
    instructions:
      'Le moteur de recherche réaffiche le terme cherché. Faites-lui exécuter du JavaScript : le flag apparaîtra.',
    story: '',
  },
  {
    id: 'livre-d-or',
    order: 2,
    theme: 'XSS stockée',
    title: "Le livre d'or",
    summary: 'Un commentaire piégé vole la session du bot administrateur qui relit chaque message.',
    instructions:
      "Le bot administrateur relit chaque message du livre d'or. Laissez-lui un message qui lui vole son cookie.",
    story: '',
  },
  {
    id: 'mur-invisible',
    order: 3,
    theme: 'CSP',
    title: 'Le mur invisible',
    summary: 'Même faille, nouvelle défense : la Content Security Policy bloque-t-elle votre payload ?',
    instructions:
      "Rejouez votre attaque du livre d'or avec une CSP en mode rapport, puis bloquante. Observez ce qui change.",
    story: '',
  },
  {
    id: 'virement-fantome',
    order: 4,
    theme: 'CSRF',
    title: 'Le virement fantôme',
    summary: 'Une page piège déclenche un virement dans la banque de la victime, à son insu.',
    instructions:
      'Connecté à sa banque, la victime visite votre page piège. Faites-lui signer un virement à son insu.',
    story: '',
  },
  {
    id: 'coffre-qui-fuit',
    order: 5,
    theme: 'Secrets',
    title: 'Le coffre qui fuit',
    summary: "Une clé dans le bundle, une autre dans l'historique Git. Retrouvez-les, puis rangez-les au coffre.",
    instructions:
      "Deux clés ont fuité : l'une dans le code envoyé au navigateur, l'autre dans l'historique Git. Retrouvez-les.",
    story: '',
  },
  {
    id: 'chatbot-serviable',
    order: 6,
    theme: 'IA',
    title: 'Le chatbot trop serviable',
    summary: "L'assistant garde un secret dans ses instructions. Faites-le parler par injection de prompt.",
    instructions:
      "L'assistant garde un flag dans ses instructions et a ordre de ne jamais le révéler. Faites-le parler.",
    story: '',
  },
];

/**
 * Les flags sont dérivés d'un secret (HMAC) : aucun flag n'est écrit dans le dépôt,
 * et chaque déploiement a les siens.
 */
export function buildLevels(secret: string): Level[] {
  return DEFINITIONS.map((definition) => {
    const digest = createHmac('sha256', secret).update(definition.id).digest('hex').slice(0, 12);
    return { ...definition, flag: `BREACH{${definition.id.replaceAll('-', '_')}_${digest}}` };
  });
}

let levels: Level[] | undefined;

/** Catalogue du serveur. Sans `FLAG_SECRET`, un secret aléatoire est tiré au démarrage. */
export function useLevels(): Level[] {
  levels ??= buildLevels(process.env['FLAG_SECRET'] ?? randomBytes(32).toString('hex'));
  return levels;
}
