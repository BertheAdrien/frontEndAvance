import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, linkedSignal, output, signal } from '@angular/core';

import type { FlagSubmissionResponse, PublicLevel } from '../../shared/level';

type Feedback = { tone: 'success' | 'error'; text: string };

@Component({
  selector: 'app-flag-form',
  template: `
    <form (submit)="submit($event)" class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
      <label for="flag-input" class="font-semibold">Soumettre le flag</label>
      <div class="flex flex-wrap gap-3">
        <input
          id="flag-input"
          name="flag"
          autocomplete="off"
          spellcheck="false"
          maxlength="200"
          placeholder="BREACH{…}"
          aria-describedby="flag-feedback"
          [value]="flag()"
          (input)="flag.set($any($event.target).value)"
          class="min-h-12 min-w-0 flex-[1_1_260px] rounded-lg border border-line bg-ground px-4 font-mono"
        />
        <button
          type="submit"
          [disabled]="pending()"
          class="min-h-12 rounded-lg bg-accent px-5.5 font-bold text-ground hover:brightness-110 disabled:opacity-60"
        >
          Valider
        </button>
      </div>
      <p
        id="flag-feedback"
        role="status"
        class="min-h-6 text-[15px]"
        [class.text-secure]="feedback()?.tone === 'success'"
        [class.text-vuln]="feedback()?.tone === 'error'"
      >
        {{ feedback()?.text }}
      </p>
    </form>
  `,
})
export class FlagForm {
  private readonly http = inject(HttpClient);

  readonly levelId = input.required<string>();
  /** Émis avec la progression à jour quand le flag est accepté. */
  readonly captured = output<PublicLevel[]>();

  // La page de niveau est réutilisée d'un niveau à l'autre : saisie et message repartent à vide quand le niveau change.
  protected readonly flag = linkedSignal({ source: this.levelId, computation: () => '' });
  protected readonly pending = signal(false);
  protected readonly feedback = linkedSignal<string, Feedback | null>({ source: this.levelId, computation: () => null });

  protected submit(event: Event): void {
    event.preventDefault();
    const flag = this.flag().trim();
    if (!flag || this.pending()) return;

    this.pending.set(true);
    this.http.post<FlagSubmissionResponse>(`/api/levels/${this.levelId()}/flag`, { flag }).subscribe({
      next: ({ result, levels }) => {
        this.pending.set(false);
        if (result === 'captured') {
          this.feedback.set({ tone: 'success', text: 'Flag capturé ! Niveau validé.' });
          this.captured.emit(levels);
        } else {
          this.feedback.set({ tone: 'error', text: 'Flag incorrect. Vérifiez votre saisie et réessayez.' });
        }
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.feedback.set({ tone: 'error', text: errorMessage(error) });
      },
    });
  }
}

function errorMessage(error: HttpErrorResponse): string {
  switch (error.status) {
    case 429:
      return `Trop de tentatives. Réessayez dans ${error.headers.get('Retry-After') ?? '60'} s.`;
    case 400:
      return 'Flag invalide : 200 caractères au maximum.';
    case 403:
      return 'Ce niveau est encore verrouillé.';
    default:
      return 'Impossible de vérifier le flag pour le moment. Réessayez.';
  }
}
