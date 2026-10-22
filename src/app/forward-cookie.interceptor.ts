import type { HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { injectBaseURL, injectRequest } from '@analogjs/router/tokens';

/**
 * Pendant le rendu serveur, relaie le cookie du visiteur vers les appels internes
 * (ex. fonctions `load`). Doit précéder `requestContextInterceptor`, qui court-circuite
 * la chaîne avant l'intercepteur équivalent d'Analog.
 * Limité à l'origine du site : le cookie ne part jamais vers un autre domaine.
 */
export const forwardCookieInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID))) return next(req);

  const cookie = injectRequest()?.headers.cookie;

  return next(cookie && isSameOrigin(req.url, injectBaseURL()) ? req.clone({ setHeaders: { cookie } }) : req);
};

function isSameOrigin(url: string, baseUrl: string | null): boolean {
  try {
    const base = new URL(baseUrl ?? 'http://localhost');
    return new URL(url, base).origin === base.origin;
  } catch {
    return false;
  }
}
