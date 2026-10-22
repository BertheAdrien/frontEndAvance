import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { injectResponse } from '@analogjs/router/tokens';

/**
 * Codes HTTP fixés par une page. Pendant le rendu serveur, on agit sur la vraie réponse
 * (404, 302) ; dans le navigateur, une redirection passe par le routeur.
 */
export function injectHttpStatus() {
  const response = injectResponse();
  const router = inject(Router);

  return {
    notFound() {
      if (response) response.statusCode = 404;
    },
    redirect(url: string) {
      if (response) {
        response.statusCode = 302;
        response.setHeader('Location', url);
        return;
      }
      void router.navigateByUrl(url, { replaceUrl: true });
    },
  };
}
