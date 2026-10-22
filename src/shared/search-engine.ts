/** Faux moteur de recherche du niveau 1 (XSS réfléchie). */

export interface Article {
  title: string;
  excerpt: string;
}

/** Réponse de `GET /api/recherche-bavarde/articles` : le terme cherché est renvoyé tel quel. */
export interface SearchResponse {
  query: string;
  articles: Article[];
}
