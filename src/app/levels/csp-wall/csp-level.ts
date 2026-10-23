import { isPlatformBrowser } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { Component, PLATFORM_ID, afterNextRender, computed, effect, inject, input, signal } from '@angular/core';

import type { CspMode, CspStateResponse, ViolationsResponse } from '../../../shared/csp-wall';
import type { LevelMode, PublicLevel } from '../../../shared/level';
import { GuestbookBoard } from '../guestbook/guestbook-board';

/**
 * Niveau 3 : le livre d'or du niveau 2, toujours vulnérable, rejoué sous une CSP
 * (aucune / rapport / bloquante) posée par le middleware Nitro sur cette page.
 */
@Component({
  selector: 'app-csp-level',
  imports: [GuestbookBoard],
  template: `
    <div class="flex flex-col gap-10">
      @if (banner(); as b) {
        <div role="status" class="flex items-start gap-3 rounded-xl border p-5" [class]="b.secure ? 'border-secure bg-secure-soft' : 'border-vuln bg-vuln-soft'">
          <span class="min-w-0">
            <strong [class]="b.secure ? 'text-secure' : 'text-vuln'">{{ b.title }}</strong>
            <span class="mt-1 block text-ink-2">{{ b.text }}</span>
          </span>
        </div>
      }

      <section aria-labelledby="csp-title" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <h2 id="csp-title" class="text-xl font-bold">La CSP de cette page</h2>
        <div class="flex flex-wrap items-center gap-3">
          <span id="csp-choice-label" class="text-sm text-muted">Politique appliquée</span>
          <div role="group" aria-labelledby="csp-choice-label" class="inline-flex flex-wrap rounded-lg border border-line bg-ground p-1">
            @for (option of options; track option.value) {
              <button
                type="button"
                [attr.aria-pressed]="csp() === option.value"
                [disabled]="pending() || mode() === 'secure'"
                (click)="select(option.value)"
                class="min-h-10 rounded-md px-4 font-semibold text-muted"
                [class]="csp() === option.value ? 'bg-accent-soft !text-accent' : 'hover:text-ink'"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>
        @if (mode() === 'secure') {
          <p class="text-sm text-muted">En mode sécurisé, la CSP bloquante est imposée et le bot relit les messages comme du texte.</p>
        }
        @if (state.value(); as s) {
          @if (s.header; as header) {
            <pre class="m-0 rounded-lg bg-console p-4 font-mono text-[13px] break-words whitespace-pre-wrap"><span class="text-accent">{{ header.name }}:</span> {{ header.value }}</pre>
          } @else {
            <p class="text-sm text-ink-2">Aucun en-tête CSP : le navigateur exécute tout ce que la page contient.</p>
          }
        }
        <p role="status" class="text-sm text-vuln empty:hidden">{{ error() }}</p>
      </section>

      <app-guestbook-board [mode]="mode()" (botFinished)="refreshViolationsSoon()">
        <section aria-labelledby="violations-title" class="overflow-hidden rounded-xl border border-line bg-console">
          <div class="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
            <h2 id="violations-title" class="font-mono text-sm text-muted">Console CSP (report-uri)</h2>
            <button type="button" (click)="refreshViolations()" class="min-h-9 rounded-md px-2 text-sm text-muted hover:text-ink">Rafraîchir</button>
          </div>
          <div aria-live="polite" class="flex flex-col gap-2 p-4 font-mono text-[13px] break-words">
            @for (v of violationList(); track $index) {
              <div [class]="v.disposition === 'enforce' ? 'text-secure' : 'text-vuln'">
                {{ v.disposition === 'enforce' ? '⛔ bloquée' : '⚠ signalée' }} · {{ v.directive }} ← {{ v.blockedUri || '?' }}
              </div>
            } @empty {
              <div class="text-muted">Aucune violation signalée.</div>
            }
            @if (violations.value()?.flag; as flag) {
              <div class="mt-2 text-accent">Script bloqué, flag débloqué : <span class="select-all">{{ flag }}</span></div>
            }
          </div>
        </section>

        <section aria-labelledby="tests-title" class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
          <h2 id="tests-title" class="text-lg font-bold">La preuve par les tests</h2>
          <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
            @for (t of tests(); track t.name) {
              <li class="flex items-start gap-2.5 text-sm">
                <span
                  class="min-w-[52px] shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-xs font-bold"
                  [class]="t.ok ? 'bg-accent-soft text-accent' : 'bg-vuln-soft text-vuln'"
                  >{{ t.ok ? 'PASS' : 'FAIL' }}</span
                >
                <span><span class="text-muted">{{ t.kind }} ·</span> {{ t.name }}</span>
              </li>
            }
          </ul>
        </section>
      </app-guestbook-board>

      <section aria-labelledby="takeaways-title" class="rounded-xl border-l-[3px] border-secure bg-surface p-6">
        <h2 id="takeaways-title" class="mb-3 text-xl font-bold">Ce qu'il faut retenir</h2>
        <ul class="flex list-disc flex-col gap-2 pl-5">
          <li>
            La CSP est un <strong>filet</strong>, pas un correctif : le livre d'or reste vulnérable, c'est le navigateur
            qui refuse d'exécuter le script injecté.
          </li>
          <li>
            <code>Content-Security-Policy-Report-Only</code> permet de tester une politique sans rien casser : on observe
            les violations, puis on passe en mode bloquant.
          </li>
          <li>
            Sans <code>'unsafe-inline'</code> dans <code>script-src</code>, les attributs <code>onerror</code> et les
            scripts inline sont bloqués. Le site lui-même ne doit donc contenir aucun script inline.
          </li>
          <li>
            Un rapport de violation peut être forgé par n'importe qui : le serveur le valide, en borne la taille et ne
            lui fait jamais confiance.
          </li>
        </ul>
      </section>
    </div>
  `,
})
export class CspLevel {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();

  protected readonly options = [
    { value: 'none', label: 'Aucune' },
    { value: 'report-only', label: 'Rapport seul' },
    { value: 'enforce', label: 'Bloquante' },
  ] as const;

  protected readonly pending = signal(false);
  protected readonly error = signal('');

  protected readonly state = httpResource<CspStateResponse>(() => (this.isBrowser ? '/api/mur-invisible/csp' : undefined));
  protected readonly csp = computed(() => this.state.value()?.csp);

  private readonly violationsVersion = signal(0);
  protected readonly violations = httpResource<ViolationsResponse>(() =>
    this.isBrowser ? { url: '/api/mur-invisible/violations', params: { v: this.violationsVersion() } } : undefined,
  );
  protected readonly violationList = computed(() => this.violations.value()?.violations ?? []);

  protected readonly banner = computed(() => {
    switch (this.csp()) {
      case 'none':
        return { secure: false, title: 'Aucune CSP', text: "Le bot relit les messages en HTML brut et rien ne l'arrête : le payload s'exécute." };
      case 'report-only':
        return { secure: false, title: 'CSP en mode rapport', text: 'Le payload s\'exécute encore, mais chaque violation est signalée au serveur.' };
      case 'enforce':
        return { secure: true, title: 'CSP bloquante', text: 'Le code est toujours vulnérable, mais le navigateur refuse d\'exécuter le script injecté.' };
      default:
        return undefined;
    }
  });

  protected readonly tests = computed(() => {
    const csp = this.csp();
    return [
      { kind: 'Intégration', name: 'la page du niveau porte l\'en-tête Content-Security-Policy', ok: csp === 'enforce' },
      { kind: 'Intégration', name: "script-src n'autorise ni 'unsafe-inline' ni 'unsafe-eval'", ok: csp === 'enforce' },
      { kind: 'Intégration', name: 'report-uri valide et journalise les violations', ok: csp !== 'none' },
      { kind: 'E2E', name: "le payload du livre d'or ne s'exécute pas", ok: csp === 'enforce' },
    ];
  });

  constructor() {
    if (!this.isBrowser) return;

    // La CSP vient de l'en-tête du document : arrivé par une navigation interne, le document
    // courant n'a pas celle du niveau. On recharge pour que le serveur la pose.
    afterNextRender(() => {
      if (!this.documentLoadedHere()) this.reloadPage();
    });

    // Changer de mode vulnérable / sécurisé change la CSP imposée : même remède.
    let previous: LevelMode | undefined;
    effect(() => {
      const mode = this.mode();
      if (previous !== undefined && previous !== mode) this.reloadPage();
      previous = mode;
    });
  }

  protected select(csp: CspMode): void {
    if (this.pending() || csp === this.csp()) return;
    this.pending.set(true);
    this.error.set('');
    this.http.post<{ csp: CspMode }>('/api/mur-invisible/csp', { csp }).subscribe({
      next: () => this.reloadPage(),
      error: () => {
        this.pending.set(false);
        this.error.set('Impossible de changer la CSP pour le moment.');
      },
    });
  }

  protected refreshViolations(): void {
    this.violationsVersion.update((v) => v + 1);
  }

  /** Le navigateur envoie les rapports de façon asynchrone : on lui laisse un instant. */
  protected refreshViolationsSoon(): void {
    setTimeout(() => this.refreshViolations(), 500);
  }

  protected reloadPage(): void {
    location.reload();
  }

  private documentLoadedHere(): boolean {
    const entry = performance.getEntriesByType?.('navigation')[0];
    return !entry || new URL(entry.name).pathname === location.pathname;
  }
}
