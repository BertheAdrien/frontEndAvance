import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { injectContentFiles } from '@analogjs/content';
import { filter, map } from 'rxjs';

import { type FicheAttributes, isFiche } from '../fiches/fiche';

/**
 * Habillage des fiches de cours. Chaque `src/content/fiches/<slug>.md` est une route de
 * contenu Analog (`/fiches/<slug>`) rendue dans l'outlet ; la liste est `fiches/index.page.ts`.
 */
@Component({
  selector: 'app-fiches-layout',
  imports: [RouterOutlet, RouterLink],
  template: `
    @if (fiche(); as f) {
      <article class="flex flex-col gap-8">
        <nav aria-label="Fil d'Ariane" class="text-sm text-muted">
          <ol class="m-0 flex list-none flex-wrap gap-2 p-0">
            <li><a routerLink="/fiches">Fiches</a></li>
            <li aria-hidden="true">/</li>
            <li><span aria-current="page">{{ f.attributes.title }}</span></li>
          </ol>
        </nav>
        <header class="flex flex-col gap-4">
          <p class="font-mono text-sm text-accent">&gt; fiche_{{ f.attributes.order }}</p>
          <h1 class="text-4xl font-bold">{{ f.attributes.title }}</h1>
          <p class="max-w-[720px] text-lg text-muted">{{ f.attributes.summary }}</p>
        </header>
        <div class="fiche-content"><router-outlet /></div>
        <p>
          <a [routerLink]="['/niveaux', f.attributes.level]" class="font-semibold">
            Mettre en pratique : niveau {{ f.attributes.order }}
          </a>
        </p>
      </article>
    } @else {
      <router-outlet />
    }
  `,
})
export default class FichesLayout {
  private readonly fiches = injectContentFiles<FicheAttributes>(isFiche);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly fiche = computed(() => {
    const slug = this.url().split(/[?#]/)[0].split('/')[2];
    return this.fiches.find((f) => f.slug === slug);
  });

  constructor() {
    const title = inject(Title);
    effect(() => {
      const name = this.fiche()?.attributes.title;
      title.setTitle(name ? `Breach Academy — ${name}` : 'Breach Academy — Fiches de cours');
    });
  }
}
