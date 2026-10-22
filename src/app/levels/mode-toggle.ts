import { HttpClient } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';

import type { LevelMode } from '../../shared/level';

/** Bascule vulnérable / sécurisé, affichée seulement si le serveur autorise le mode vulnérable. */
@Component({
  selector: 'app-mode-toggle',
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <span id="mode-label" class="text-sm text-muted">Mode du niveau</span>
      <div role="group" aria-labelledby="mode-label" class="inline-flex rounded-lg border border-line bg-surface p-1">
        @for (option of options; track option.value) {
          <button
            type="button"
            [attr.aria-pressed]="mode() === option.value"
            [disabled]="pending()"
            (click)="select(option.value)"
            class="min-h-10 rounded-md px-4 font-semibold text-muted"
            [class]="mode() === option.value ? option.active : 'hover:text-ink'"
          >
            {{ option.label }}
          </button>
        }
      </div>
      <p role="status" class="text-sm text-vuln">{{ error() }}</p>
    </div>
  `,
})
export class ModeToggle {
  private readonly http = inject(HttpClient);

  readonly mode = input.required<LevelMode>();
  readonly modeChange = output<LevelMode>();

  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly options = [
    { value: 'vulnerable', label: 'Vulnérable', active: 'bg-vuln-soft !text-vuln' },
    { value: 'secure', label: 'Sécurisé', active: 'bg-secure-soft !text-secure' },
  ] as const;

  protected select(mode: LevelMode): void {
    if (mode === this.mode() || this.pending()) return;

    this.pending.set(true);
    this.error.set('');
    this.http.post<{ mode: LevelMode }>('/api/mode', { mode }).subscribe({
      next: (response) => {
        this.pending.set(false);
        this.modeChange.emit(response.mode);
      },
      error: () => {
        this.pending.set(false);
        this.error.set('Impossible de changer de mode pour le moment.');
      },
    });
  }
}
