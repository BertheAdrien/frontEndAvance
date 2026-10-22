import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RouteMeta } from '@analogjs/router';

export const routeMeta = {
  title: 'Breach Academy — Niveau',
} satisfies RouteMeta;

// Page provisoire : chaque niveau aura sa propre page.
@Component({
  selector: 'app-level-page',
  imports: [RouterLink],
  template: `
    <nav aria-label="Fil d'Ariane" class="mb-6 text-sm text-muted"><a routerLink="/">Niveaux</a></nav>
    <h1 class="text-4xl font-bold">Niveau en construction</h1>
  `,
})
export default class LevelPage {}
