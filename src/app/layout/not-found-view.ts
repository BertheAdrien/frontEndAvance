import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { injectHttpStatus } from '../http-status';

/** Contenu « page introuvable » ; renvoie un vrai code HTTP 404 au rendu serveur. */
@Component({
  selector: 'app-not-found-view',
  imports: [RouterLink],
  template: `
    <div class="flex flex-col gap-4">
      <p class="font-mono text-sm text-vuln">&gt; 404</p>
      <h1 class="text-4xl font-bold">Page introuvable</h1>
      <p class="text-muted">Cette page n'existe pas. <a routerLink="/">Retour aux niveaux</a></p>
    </div>
  `,
})
export class NotFoundView {
  constructor() {
    injectHttpStatus().notFound();
  }
}
