import { isPlatformBrowser } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { Component, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';

import type { AccountResponse, TransferResponse } from '../../../shared/bank';
import type { LevelMode, PublicLevel } from '../../../shared/level';

/**
 * Niveau 4 (CSRF) : une fausse banque. En mode vulnérable, un virement part sur le seul
 * cookie de session ; une page piège servie sur une autre origine en déclenche un à l'insu
 * du titulaire. En mode sécurisé : SameSite=Strict, jeton double-submit et contrôle d'Origin.
 */
@Component({
  selector: 'app-bank-level',
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

      <div class="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="compte-title" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
          <div class="flex items-center justify-between gap-2">
            <h2 id="compte-title" class="text-xl font-bold">Banque Fantôme</h2>
            <div class="flex items-center gap-1">
              <button type="button" (click)="reset()" [disabled]="resetting()" class="min-h-9 rounded-md px-2 text-sm text-muted hover:text-ink disabled:opacity-50">Réinitialiser</button>
              <button type="button" (click)="refresh()" class="min-h-9 rounded-md px-2 text-sm text-muted hover:text-ink">Rafraîchir</button>
            </div>
          </div>
          <p class="text-sm text-muted">Solde du compte</p>
          <p class="font-mono text-3xl font-bold">{{ solde() ?? '—' }} €</p>

          <h3 class="mt-2 text-sm font-semibold text-muted">Derniers virements</h3>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            @for (t of historique(); track $index) {
              <li class="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm" [class]="t.frauduleux ? 'bg-vuln-soft' : 'bg-ground'">
                <span>
                  <span class="font-semibold">{{ t.beneficiaire }}</span>
                  @if (t.frauduleux) { <span class="ml-2 text-xs text-vuln">⚠ frauduleux</span> }
                </span>
                <span class="font-mono">−{{ t.montant }} €</span>
              </li>
            } @empty {
              <li class="text-sm text-muted">Aucun virement.</li>
            }
          </ul>

          @if (flag(); as flag) {
            <div class="mt-2 rounded-lg border border-accent bg-accent-soft p-4">
              <p class="m-0 text-sm text-ink-2">Un virement est parti à votre insu. Reçu frauduleux :</p>
              <code class="mt-1 block select-all font-mono text-accent">{{ flag }}</code>
            </div>
          }
        </section>

        <section aria-labelledby="virement-title" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
          <h2 id="virement-title" class="text-xl font-bold">Virement légitime</h2>
          <p class="text-sm text-muted">Un virement normal, depuis la banque elle-même, reste autorisé dans les deux modes.</p>
          <form class="flex flex-col gap-3" (submit)="submitTransfer($event)">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted">Bénéficiaire</span>
              <input [value]="beneficiaire()" (input)="beneficiaire.set($any($event.target).value)" required maxlength="60"
                class="min-h-10 rounded-md border border-line bg-ground px-3" />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted">Montant (€)</span>
              <input type="number" min="1" [value]="montant()" (input)="montant.set($any($event.target).value)" required
                class="min-h-10 rounded-md border border-line bg-ground px-3" />
            </label>
            <button type="submit" [disabled]="pending()" class="min-h-10 rounded-md bg-accent px-4 font-semibold text-ground disabled:opacity-50">
              Virer
            </button>
            <p role="status" class="text-sm text-vuln empty:hidden">{{ error() }}</p>
            @if (receipt(); as r) {
              <p role="status" class="text-sm text-secure">Virement de {{ r.montant }} € à {{ r.beneficiaire }} enregistré.</p>
            }
          </form>
        </section>
      </div>

      <section aria-labelledby="piege-title" class="flex flex-col gap-3 rounded-xl border border-line bg-console p-6">
        <h2 id="piege-title" class="text-lg font-bold">La page piège</h2>
        @if (trapUrl(); as url) {
          <p class="text-sm text-ink-2">
            Cette page est servie sur <strong>une autre origine</strong> que la banque. En mode vulnérable, l'ouvrir
            suffit à déclencher un virement avec votre session : c'est la CSRF.
          </p>
          <a [href]="url" target="_blank" rel="noopener" class="inline-flex min-h-10 w-fit items-center rounded-md border border-vuln px-4 font-semibold text-vuln hover:bg-vuln-soft">
            Ouvrir la page piège ↗
          </a>
          <p class="font-mono text-xs break-all text-muted">{{ url }}</p>
        } @else {
          <p class="text-sm text-muted">
            La page piège exige le couple <code>localhost</code> / <code>127.0.0.1</code>. Lancez le jeu via l'un de ces
            hôtes (par exemple <code>npm run preview</code>) pour l'essayer.
          </p>
        }
      </section>

      <section aria-labelledby="tests-title" class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
        <h2 id="tests-title" class="text-lg font-bold">La preuve par les tests</h2>
        <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
          @for (t of tests(); track t.name) {
            <li class="flex items-start gap-2.5 text-sm">
              <span class="min-w-[52px] shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-xs font-bold"
                [class]="t.ok ? 'bg-accent-soft text-accent' : 'bg-vuln-soft text-vuln'">{{ t.ok ? 'PASS' : 'FAIL' }}</span>
              <span><span class="text-muted">{{ t.kind }} ·</span> {{ t.name }}</span>
            </li>
          }
        </ul>
      </section>

      <section aria-labelledby="takeaways-title" class="rounded-xl border-l-[3px] border-secure bg-surface p-6">
        <h2 id="takeaways-title" class="mb-3 text-xl font-bold">Ce qu'il faut retenir</h2>
        <ul class="flex list-disc flex-col gap-2 pl-5">
          <li>Un changement d'état (virement) ne doit <strong>jamais</strong> passer par un <code>GET</code> : une simple navigation inter-site le déclencherait.</li>
          <li><code>SameSite=Strict</code> empêche le cookie de session de partir vers une autre origine : le navigateur ne « signe » plus la requête piège.</li>
          <li>Le jeton anti-CSRF <em>double submit</em> (cookie lisible + en-tête recopié par Angular) prouve que la requête vient bien de la page de la banque.</li>
          <li>Le contrôle de l'en-tête <code>Origin</code> côté serveur est une défense supplémentaire, à peu de frais.</li>
        </ul>
      </section>
    </div>
  `,
})
export class BankLevel {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();

  protected readonly beneficiaire = signal('');
  protected readonly montant = signal<number | string>(100);
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly receipt = signal<TransferResponse['recu'] | undefined>(undefined);

  private readonly version = signal(0);
  protected readonly account = httpResource<AccountResponse>(() =>
    // `mode` relance la lecture à chaque bascule : en mode sécurisé, c'est elle qui pose le cookie XSRF.
    this.isBrowser ? { url: '/api/virement-fantome/compte', params: { v: this.version(), mode: this.mode() } } : undefined,
  );
  protected readonly solde = computed(() => this.account.value()?.solde);
  protected readonly historique = computed(() => this.account.value()?.historique ?? []);
  protected readonly flag = computed(() => this.account.value()?.flag);

  /** URL de la page piège sur l'autre origine (localhost ⇆ 127.0.0.1). */
  protected readonly trapUrl = computed(() => {
    if (!this.isBrowser) return undefined;
    const { protocol, hostname, host } = location;
    const trap = '/api/virement-fantome/piege';
    if (hostname === 'localhost') return `${protocol}//${host.replace('localhost', '127.0.0.1')}${trap}`;
    if (hostname === '127.0.0.1') return `${protocol}//${host.replace('127.0.0.1', 'localhost')}${trap}`;
    return undefined;
  });

  protected readonly banner = computed(() =>
    this.mode() === 'secure'
      ? { secure: true, title: 'Banque protégée', text: 'SameSite=Strict, jeton anti-CSRF et contrôle d\'Origin : la page piège ne peut plus signer de virement.' }
      : { secure: false, title: 'Banque vulnérable', text: 'Le virement part sur le seul cookie de session : une autre origine peut le déclencher.' },
  );

  protected readonly tests = computed(() => {
    const secure = this.mode() === 'secure';
    return [
      { kind: 'Intégration', name: 'un GET ne peut plus déclencher de virement', ok: secure },
      { kind: 'Intégration', name: 'un POST sans jeton anti-CSRF est rejeté (403)', ok: secure },
      { kind: 'Intégration', name: "une requête d'une autre origine est rejetée (Origin)", ok: secure },
      { kind: 'E2E', name: 'la page piège ne vide plus le compte', ok: secure },
    ];
  });

  protected readonly resetting = signal(false);

  protected refresh(): void {
    this.version.update((v) => v + 1);
  }

  /** Remet le compte à son état initial sans redémarrer le serveur. */
  protected reset(): void {
    if (this.resetting()) return;
    this.resetting.set(true);
    this.http.delete<AccountResponse>('/api/virement-fantome/compte').subscribe({
      next: () => {
        this.resetting.set(false);
        this.receipt.set(undefined);
        this.refresh();
      },
      error: () => this.resetting.set(false),
    });
  }

  protected submitTransfer(event: Event): void {
    event.preventDefault();
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set('');

    const montant = Number(this.montant());
    this.http.post<TransferResponse>('/api/virement-fantome/virement', { beneficiaire: this.beneficiaire(), montant }).subscribe({
      next: ({ recu }) => {
        this.pending.set(false);
        this.receipt.set(recu);
        this.refresh();
      },
      error: () => {
        this.pending.set(false);
        this.error.set('Virement refusé (solde insuffisant ou requête invalide).');
      },
    });
  }
}
