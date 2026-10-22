import { defineEventHandler } from 'h3';

import { getPlayerId } from '../player';

// Attribue l'identifiant joueur dès la requête de page : créé plus tard, dans l'appel
// interne d'un `load` pendant le SSR, son cookie n'atteindrait jamais le navigateur.
export default defineEventHandler((event) => {
  getPlayerId(event);
});
