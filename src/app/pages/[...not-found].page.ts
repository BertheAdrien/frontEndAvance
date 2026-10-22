import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RouteMeta } from '@analogjs/router';

export const routeMeta = {
  title: 'Breach Academy — Page introuvable',
} satisfies RouteMeta;

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="flex flex-col gap-4">
      <p class="font-mono text-sm text-vuln">&gt; 404</p>
      <h1 class="text-4xl font-bold">Page introuvable</h1>
      <p class="text-muted">Cette page n'existe pas. <a routerLink="/">Retour aux niveaux</a></p>
    </div>
  `,
})
export default class NotFound {}
