import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectContentFiles } from '@analogjs/content';
import type { RouteMeta } from '@analogjs/router';

import { type FicheAttributes, isFiche } from '../../fiches/fiche';

export const routeMeta = {
  title: 'Breach Academy — Fiches de cours',
} satisfies RouteMeta;

/** Liste des fiches de cours, une par faille ; lisible hors ligne (voir le service worker). */
@Component({
  selector: 'app-fiches-page',
  imports: [RouterLink],
  template: `
    <div class="flex flex-col gap-10">
      <header class="flex flex-col gap-4">
        <p class="font-mono text-sm text-accent">&gt; fiches</p>
        <h1 class="text-4xl font-bold">Fiches de cours</h1>
        <p class="max-w-[720px] text-lg text-muted">
          L'essentiel de chaque faille : le principe, l'attaque et la défense. Une fois le site visité, les fiches
          restent consultables hors ligne.
        </p>
      </header>

      <ul class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-5 p-0">
        @for (fiche of fiches; track fiche.slug) {
          <li class="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6">
            <span class="font-mono text-sm text-muted">FICHE {{ fiche.attributes.order }}</span>
            <a [routerLink]="['/fiches', fiche.slug]" class="text-xl font-bold">{{ fiche.attributes.title }}</a>
            <p class="text-muted">{{ fiche.attributes.summary }}</p>
          </li>
        }
      </ul>
    </div>
  `,
})
export default class FichesPage {
  protected readonly fiches = injectContentFiles<FicheAttributes>(isFiche).sort(
    (a, b) => a.attributes.order - b.attributes.order,
  );
}
