import { NgComponentOutlet, ViewportScroller } from '@angular/common';
import { Component, computed, effect, inject, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { injectLoad, type RouteMeta } from '@analogjs/router';
import { map } from 'rxjs';

import { injectHttpStatus } from '../../http-status';
import { NotFoundView } from '../../layout/not-found-view';
import { FlagForm } from '../../levels/flag-form';
import { loadLevelComponent } from '../../levels/level-components';
import { ModeToggle } from '../../levels/mode-toggle';
import type { load } from './[levelId].server';

export const routeMeta = {
  title: 'Breach Academy — Niveau',
} satisfies RouteMeta;

/**
 * Page commune aux niveaux : en-tête, consigne, bascule de mode et soumission du flag.
 * Le terrain de jeu propre à chaque niveau est chargé depuis `level-components.ts`.
 */
@Component({
  selector: 'app-level-page',
  imports: [RouterLink, NgComponentOutlet, NotFoundView, FlagForm, ModeToggle],
  template: `
    @let lvl = level();
    @if (!lvl) {
      <app-not-found-view />
    } @else if (lvl.status !== 'locked') {
      <div class="flex flex-col gap-10">
        <nav aria-label="Fil d'Ariane" class="text-sm text-muted">
          <ol class="m-0 flex list-none flex-wrap gap-2 p-0">
            <li><a routerLink="/">Niveaux</a></li>
            <li aria-hidden="true">/</li>
            <li><span aria-current="page">Niveau {{ number() }}</span></li>
          </ol>
        </nav>

        <header class="flex flex-col gap-4">
          <p class="font-mono text-sm text-accent">&gt; niveau_{{ number() }} · {{ lvl.theme }}</p>
          <div class="flex flex-wrap items-center gap-4">
            <h1 class="text-4xl font-bold">{{ lvl.title }}</h1>
            @if (lvl.status === 'captured') {
              <span class="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent">Flag capturé</span>
            }
          </div>
          <section aria-labelledby="consigne-title" class="max-w-[720px] rounded-xl border-l-[3px] border-accent bg-surface p-5">
            <h2 id="consigne-title" class="mb-2 font-mono text-sm text-muted">Consigne</h2>
            <p class="text-lg">{{ lvl.instructions }}</p>
          </section>
        </header>

        @if (data().vulnerableModeAvailable) {
          <app-mode-toggle [mode]="mode()" (modeChange)="mode.set($event)" />
        } @else {
          <p class="text-sm text-muted">Ce serveur n'autorise que le mode sécurisé : les attaques échoueront.</p>
        }

        @if (playground.value(); as component) {
          <ng-container *ngComponentOutlet="component; inputs: { level: lvl, mode: mode() }" />
        }

        <app-flag-form [levelId]="lvl.id" (captured)="levels.set($event)" />

        @if (lvl.status === 'captured') {
          <p role="status" class="text-lg">
            @if (next(); as nextLevel) {
              Niveau suivant déverrouillé :
              <a [routerLink]="['/niveaux', nextLevel.id]" class="font-semibold">{{ nextLevel.title }}</a>
            } @else {
              Tous les niveaux sont réussis. <a routerLink="/" class="font-semibold">Retour aux niveaux</a>
            }
          </p>
        }
      </div>
    }
  `,
})
export default class LevelPage {
  protected readonly data = toSignal(injectLoad<typeof load>(), { requireSync: true });
  private readonly levelId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('levelId'))), {
    requireSync: true,
  });

  /** Progression du joueur, rafraîchie par la réponse du serveur après une capture. */
  protected readonly levels = linkedSignal(() => this.data().levels);
  protected readonly mode = linkedSignal(() => this.data().mode);
  protected readonly level = computed(() => this.levels().find((l) => l.id === this.levelId()));
  protected readonly number = computed(() => String(this.level()?.order ?? 0).padStart(2, '0'));
  protected readonly next = computed(() => {
    const order = this.level()?.order;
    return this.levels().find((l) => l.order === (order ?? 0) + 1);
  });

  protected readonly playground = resource({
    params: () => this.level()?.id,
    loader: ({ params }) => loadLevelComponent(params),
  });

  constructor() {
    const status = injectHttpStatus();
    const title = inject(Title);

    effect(() => {
      const level = this.level();
      if (level?.status === 'locked') status.redirect('/');
      if (level) title.setTitle(`Breach Academy — ${level.title}`);
    });

    // La page est réutilisée d'un niveau à l'autre : sans ça, le lien « Niveau suivant »
    // (en bas, sous le formulaire de flag) ouvrirait le niveau suivant au même défilement.
    const scroller = inject(ViewportScroller);
    let previousLevelId = this.levelId();
    effect(() => {
      const levelId = this.levelId();
      if (levelId !== previousLevelId) scroller.scrollToPosition([0, 0]);
      previousLevelId = levelId;
    });
  }
}
