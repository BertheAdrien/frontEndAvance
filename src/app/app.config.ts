import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser';
import { provideFileRouter, requestContextInterceptor } from '@analogjs/router';

import { forwardCookieInterceptor } from './forward-cookie.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideFileRouter(),
    provideHttpClient(
      withInterceptors([forwardCookieInterceptor, requestContextInterceptor])
    ),
    // Sans hydratation incrémentale (active par défaut, elle embarque l'event replay) : le
    // replay injecte des scripts inline dans le HTML SSR, bloqués par une CSP sans 'unsafe-inline'.
    provideClientHydration(withNoIncrementalHydration()),
  ],
};
