import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { PublicLevel } from '../../shared/level';

@Component({
  selector: 'app-level-card',
  imports: [RouterLink],
  host: { class: 'contents' },
  template: `
    @let lvl = level();
    <article
      class="flex h-full flex-col gap-3.5 rounded-xl p-6"
      [class]="
        lvl.status === 'locked'
          ? 'border border-dashed border-line bg-ground-2'
          : lvl.status === 'available'
            ? 'border-2 border-accent bg-surface'
            : 'border border-line bg-surface'
      "
    >
      <div class="flex items-center justify-between gap-3">
        <span class="font-mono text-sm text-muted">NIVEAU {{ number() }} · {{ lvl.theme }}</span>
        @switch (lvl.status) {
          @case ('captured') {
            <span class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              Flag capturé
            </span>
          }
          @case ('available') {
            <span class="rounded-full bg-vuln-soft px-2.5 py-1 text-[13px] font-semibold text-vuln">À jouer</span>
          }
          @case ('locked') {
            <span class="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-semibold text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
              Verrouillé
            </span>
          }
        }
      </div>
      <h3 class="text-xl font-semibold">{{ lvl.title }}</h3>
      <p class="text-[15px] text-muted">{{ lvl.summary }}</p>
      @switch (lvl.status) {
        @case ('available') {
          <a
            [routerLink]="['/niveaux', lvl.id]"
            class="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg bg-accent font-bold text-ground no-underline hover:brightness-110"
          >
            Jouer<span class="sr-only"> : {{ lvl.title }}</span>
          </a>
        }
        @case ('captured') {
          <a [routerLink]="['/niveaux', lvl.id]" class="mt-auto font-semibold">
            Revoir le niveau<span class="sr-only"> : {{ lvl.title }}</span>
          </a>
        }
        @case ('locked') {
          <p class="mt-auto text-sm text-muted">Capturez le flag du niveau {{ lvl.order - 1 }} pour déverrouiller.</p>
        }
      }
    </article>
  `,
})
export class LevelCard {
  readonly level = input.required<PublicLevel>();
  protected readonly number = computed(() => String(this.level().order).padStart(2, '0'));
}
