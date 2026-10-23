import { Component, computed, input } from '@angular/core';

import type { LeaderboardResponse } from '../../shared/leaderboard';
import { WebVitalsPanel } from './web-vitals-panel';

export type Rendering = 'csr' | 'ssr' | 'ssg';

const RENDERINGS: { id: Rendering; label: string; how: string }[] = [
  {
    id: 'csr',
    label: 'CSR',
    how: "Rendu côté client : le serveur envoie une page vide, le navigateur télécharge l'application puis demande le classement à l'API.",
  },
  {
    id: 'ssr',
    label: 'SSR',
    how: 'Rendu côté serveur à chaque requête : le HTML arrive avec le classement à jour, puis Angular hydrate la page.',
  },
  {
    id: 'ssg',
    label: 'SSG',
    how: "Pré-rendu au build : un fichier HTML statique, servi instantanément, mais figé à l'instant du build.",
  },
];

// Fuseau explicite : le serveur (UTC) et le navigateur produisent le même texte, sans écart à l'hydratation.
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Europe/Paris' });

/** Même classement pour les trois routes ; seul le mode de rendu change. */
@Component({
  selector: 'app-leaderboard-view',
  imports: [WebVitalsPanel],
  template: `
    <div class="flex flex-col gap-8">
      <header class="flex flex-col gap-4">
        <p class="font-mono text-sm text-accent">&gt; classement --rendu {{ rendering() }}</p>
        <h1 class="text-4xl font-bold">Classement · {{ current().label }}</h1>
        <p class="max-w-[720px] text-lg text-muted">{{ current().how }}</p>
        <!-- Liens classiques (rechargement complet) : une navigation Angular ne referait ni le rendu serveur ni la mesure. -->
        <nav aria-label="Modes de rendu">
          <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
            @for (mode of renderings; track mode.id) {
              <li>
                <a
                  [href]="'/classement/' + mode.id"
                  [attr.aria-current]="mode.id === rendering() ? 'page' : null"
                  class="inline-block rounded-lg border border-line px-4 py-2.5 font-mono font-semibold no-underline"
                  [class.bg-surface-2]="mode.id === rendering()"
                  [class.text-ink]="mode.id === rendering()"
                  [class.text-muted]="mode.id !== rendering()"
                >
                  {{ mode.label }}
                </a>
              </li>
            }
            <li><a href="/classement" class="inline-block px-4 py-2.5 text-muted">Choisir mon pseudonyme</a></li>
          </ul>
        </nav>
      </header>

      <app-web-vitals-panel />

      <section aria-labelledby="table-title" class="flex flex-col gap-4">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="table-title" class="text-2xl font-bold">Joueurs</h2>
          @if (data(); as board) {
            <p class="text-sm text-muted">Calculé le {{ formatDate(board.generatedAt) }}</p>
          }
        </div>
        @if (data(); as board) {
          @if (board.entries.length) {
            <div class="overflow-x-auto rounded-xl border border-line">
              <table class="w-full border-collapse text-left">
                <thead class="bg-surface text-sm text-muted">
                  <tr>
                    <th scope="col" class="px-4 py-3">Rang</th>
                    <th scope="col" class="px-4 py-3">Pseudonyme</th>
                    <th scope="col" class="px-4 py-3">Niveaux réussis</th>
                    <th scope="col" class="px-4 py-3">Dernier flag</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entry of board.entries; track entry.pseudonym) {
                    <tr class="border-t border-line">
                      <td class="px-4 py-3 font-mono">{{ entry.rank }}</td>
                      <td class="px-4 py-3 font-semibold">{{ entry.pseudonym }}</td>
                      <td class="px-4 py-3 font-mono">{{ entry.captured }}</td>
                      <td class="px-4 py-3 text-muted">{{ entry.lastCaptureAt ? formatDate(entry.lastCaptureAt) : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="text-muted">Personne au classement pour l'instant. <a href="/classement">Choisissez un pseudonyme</a> pour y figurer.</p>
          }
        } @else if (failed()) {
          <p role="alert" class="text-vuln">Impossible de charger le classement.</p>
        } @else {
          <p role="status" class="text-muted">Chargement du classement…</p>
        }
      </section>
    </div>
  `,
})
export class LeaderboardView {
  readonly rendering = input.required<Rendering>();
  readonly data = input<LeaderboardResponse | undefined>();
  readonly failed = input(false);

  protected readonly renderings = RENDERINGS;
  protected readonly formatDate = (iso: string) => DATE_FORMAT.format(new Date(iso));
  protected readonly current = computed(() => RENDERINGS.find((r) => r.id === this.rendering()) ?? RENDERINGS[0]);
}
