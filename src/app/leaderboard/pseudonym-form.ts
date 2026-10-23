import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, linkedSignal, signal } from '@angular/core';

import { PSEUDONYM_PATTERN, type PseudonymResponse } from '../../shared/leaderboard';

type Feedback = { tone: 'success' | 'error'; text: string };

const RULE = '3 à 20 caractères : lettres, chiffres, « _ » ou « - »';

/** Choix du pseudonyme affiché au classement (validé ici puis par le serveur). */
@Component({
  selector: 'app-pseudonym-form',
  template: `
    <form (submit)="submit($event)" class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
      <label for="pseudonym-input" class="font-semibold">Votre pseudonyme au classement</label>
      <p id="pseudonym-rule" class="text-sm text-muted">{{ rule }}.</p>
      <div class="flex flex-wrap gap-3">
        <input
          id="pseudonym-input"
          name="pseudonym"
          autocomplete="nickname"
          maxlength="20"
          aria-describedby="pseudonym-rule pseudonym-feedback"
          [value]="pseudonym()"
          (input)="pseudonym.set($any($event.target).value)"
          class="min-h-12 min-w-0 flex-[1_1_240px] rounded-lg border border-line bg-ground px-4"
        />
        <button
          type="submit"
          [disabled]="pending()"
          class="min-h-12 rounded-lg bg-accent px-5.5 font-bold text-ground hover:brightness-110 disabled:opacity-60"
        >
          Enregistrer
        </button>
      </div>
      <p
        id="pseudonym-feedback"
        role="status"
        class="min-h-6 text-[15px]"
        [class.text-accent]="feedback()?.tone === 'success'"
        [class.text-vuln]="feedback()?.tone === 'error'"
      >
        {{ feedback()?.text }}
      </p>
    </form>
  `,
})
export class PseudonymForm {
  private readonly http = inject(HttpClient);

  readonly current = input<string | null>(null);

  protected readonly rule = RULE;
  protected readonly pseudonym = linkedSignal(() => this.current() ?? '');
  protected readonly pending = signal(false);
  protected readonly feedback = signal<Feedback | null>(null);

  protected submit(event: Event): void {
    event.preventDefault();
    const pseudonym = this.pseudonym().trim();
    if (this.pending()) return;
    if (!PSEUDONYM_PATTERN.test(pseudonym)) {
      this.feedback.set({ tone: 'error', text: `Pseudonyme invalide : ${RULE}.` });
      return;
    }

    this.pending.set(true);
    this.http.post<PseudonymResponse>('/api/classement/pseudo', { pseudonym }).subscribe({
      next: (response) => {
        this.pending.set(false);
        this.feedback.set({ tone: 'success', text: `Vous apparaissez au classement sous le nom ${response.pseudonym}.` });
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.feedback.set({
          tone: 'error',
          text:
            error.status === 409
              ? 'Ce pseudonyme est déjà pris, choisissez-en un autre.'
              : "Impossible d'enregistrer le pseudonyme pour le moment. Réessayez.",
        });
      },
    });
  }
}
