import { Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectLoad, type RouteMeta } from '@analogjs/router';

import { PseudonymForm } from '../../leaderboard/pseudonym-form';
import type { load } from './index.server';

export const routeMeta = {
  title: 'Breach Academy — Classement',
} satisfies RouteMeta;

@Component({
  selector: 'app-leaderboard-home',
  imports: [PseudonymForm],
  template: `
    <div class="flex flex-col gap-10">
      <header class="flex flex-col gap-4">
        <p class="font-mono text-sm text-accent">&gt; classement</p>
        <h1 class="text-4xl font-bold">Classement</h1>
        <p class="max-w-[720px] text-lg text-muted">
          Le même classement, rendu de trois façons. Ouvrez chaque version et comparez les Web Vitals mesurés dans
          votre navigateur : temps du premier octet, premier affichage, plus grand élément et stabilité de la page.
        </p>
      </header>

      <app-pseudonym-form [current]="pseudonym()" />

      <section aria-labelledby="rendus-title" class="flex flex-col gap-5">
        <h2 id="rendus-title" class="text-2xl font-bold">Voir le classement</h2>
        <!-- Liens classiques : chaque version doit être chargée par le navigateur pour être mesurée. -->
        <ul class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-5 p-0">
          @for (mode of modes; track mode.path) {
            <li class="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6">
              <a [href]="mode.path" class="font-mono text-xl font-bold">{{ mode.label }}</a>
              <p class="text-muted">{{ mode.text }}</p>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export default class LeaderboardHome {
  private readonly data = toSignal(injectLoad<typeof load>(), { requireSync: true });

  protected readonly pseudonym = computed(() => this.data().pseudonym);
  protected readonly modes = [
    { path: '/classement/csr', label: 'CSR', text: 'Rendu dans le navigateur, données chargées par l’API.' },
    { path: '/classement/ssr', label: 'SSR', text: 'Rendu par le serveur à chaque requête.' },
    { path: '/classement/ssg', label: 'SSG', text: 'Pré-rendu au build, servi en fichier statique.' },
  ];
}
