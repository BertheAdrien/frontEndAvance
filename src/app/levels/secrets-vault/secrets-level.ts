import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, PLATFORM_ID, computed, inject, input } from '@angular/core';

import type { LevelMode, PublicLevel } from '../../../shared/level';
import type { GitHistoryResponse, VaultConfigResponse } from '../../../shared/secrets-vault';

/**
 * Niveau 5 (Secrets) : le coffre qui fuit. Deux démonstrations isolées — une clé livrée
 * dans la config du bundle, et une clé restée dans l'historique Git — qui révèlent le même
 * flag en mode vulnérable. En mode sécurisé, le secret ne quitte jamais le serveur.
 */
@Component({
  selector: 'app-secrets-level',
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

      <section aria-labelledby="bundle-title" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <h2 id="bundle-title" class="text-xl font-bold">Fuite n°1 — Dans le bundle</h2>
        <p class="text-sm text-muted">
          Cette configuration est celle que le navigateur a réellement téléchargée (DevTools →
          <strong>Réseau</strong> → <code>config</code>, ou onglet <strong>Sources</strong>). Tout ce qui part au
          front est public.
        </p>
        @if (config.value(); as c) {
          <pre class="m-0 overflow-x-auto rounded-lg bg-console p-4 font-mono text-[13px] whitespace-pre-wrap">{{ configJson(c) }}</pre>
          @if (c.config.analyticsKey; as key) {
            <div class="rounded-lg border border-accent bg-accent-soft p-4">
              <p class="m-0 text-sm text-ink-2">Clé livrée au navigateur — c'est le flag :</p>
              <code class="mt-1 block select-all font-mono text-accent">{{ key }}</code>
            </div>
          } @else {
            <p class="text-sm text-secure">Aucune clé dans la config : le secret reste côté serveur.</p>
          }
        }
      </section>

      <section aria-labelledby="git-title" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <h2 id="git-title" class="text-xl font-bold">Fuite n°2 — Dans l'historique Git</h2>
        <p class="text-sm text-muted">
          Résultat de <code>git log -p</code> sur le dépôt d'exemple. Un secret « retiré » reste visible dans le
          commit qui l'avait ajouté : supprimer un fichier ne nettoie pas l'historique.
        </p>
        @if (history.value(); as h) {
          <div class="flex flex-col gap-4">
            @for (commit of h.commits; track commit.hash) {
              <div class="overflow-hidden rounded-lg border border-line bg-console">
                <div class="border-b border-line px-4 py-2 font-mono text-[13px]">
                  <span class="text-accent">commit {{ commit.hash }}</span>
                  <span class="ml-2 text-muted">{{ commit.author }} · {{ commit.date }}</span>
                  <div class="text-ink-2">{{ commit.subject }}</div>
                </div>
                <pre class="m-0 overflow-x-auto p-4 font-mono text-[13px]">@for (line of commit.diff; track $index) {<span [class]="diffClass(line)">{{ line }}</span>}</pre>
              </div>
            }
          </div>

          @if (h.gitleaks; as finding) {
            <div class="rounded-lg border border-accent bg-accent-soft p-4">
              <p class="m-0 font-mono text-sm text-ink-2">
                <span class="text-accent">gitleaks</span> · règle <strong>{{ finding.rule }}</strong> ·
                {{ finding.file }} @ {{ finding.commit }}
              </p>
              <p class="m-0 mt-2 text-sm text-ink-2">Secret retrouvé — c'est le flag :</p>
              <code class="mt-1 block select-all font-mono text-accent">{{ finding.secret }}</code>
            </div>
          } @else {
            <p class="text-sm text-secure">gitleaks ne trouve aucun secret : l'historique est propre.</p>
          }
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
          <li><strong>Tout ce qui est dans le front est public</strong> : une clé dans un fichier de config part dans le bundle et se lit en quelques secondes dans les DevTools.</li>
          <li>Un secret commité puis « supprimé » reste dans l'<strong>historique Git</strong> : <code>git rm</code> ne l'efface pas, il faut réécrire l'historique (BFG, <code>git filter-repo</code>) <em>et</em> révoquer la clé.</li>
          <li><strong>gitleaks</strong> détecte ces fuites ; on l'exécute en hook pre-commit et en CI pour qu'un secret n'entre jamais dans le dépôt.</li>
          <li>La bonne pratique : les secrets sont lus <strong>à l'exécution côté serveur</strong> depuis l'environnement (ou un coffre comme <strong>Conjur</strong> / CyberArk), jamais écrits dans le code ni envoyés au navigateur.</li>
        </ul>
      </section>
    </div>
  `,
})
export class SecretsLevel {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();

  protected readonly config = httpResource<VaultConfigResponse>(() =>
    this.isBrowser ? '/api/coffre-qui-fuit/config' : undefined,
  );
  protected readonly history = httpResource<GitHistoryResponse>(() =>
    this.isBrowser ? '/api/coffre-qui-fuit/historique-git' : undefined,
  );

  protected readonly banner = computed(() =>
    this.mode() === 'secure'
      ? { secure: true, title: 'Coffre fermé', text: 'Les secrets sont lus côté serveur depuis l\'environnement : rien ne fuit dans le bundle ni dans l\'historique.' }
      : { secure: false, title: 'Coffre ouvert', text: 'Une clé traîne dans la config du front et dans l\'historique Git : retrouvez-la, c\'est le flag.' },
  );

  protected readonly tests = computed(() => {
    const secure = this.mode() === 'secure';
    return [
      { kind: 'Intégration', name: 'la config envoyée au navigateur ne contient aucune clé', ok: secure },
      { kind: 'Intégration', name: 'aucun flag ne transite vers le front en mode sécurisé', ok: secure },
      { kind: 'Sécurité', name: 'gitleaks ne trouve aucun secret dans le dépôt', ok: secure },
    ];
  });

  protected configJson(response: VaultConfigResponse): string {
    return JSON.stringify(response.config, null, 2);
  }

  /** Colore une ligne de diff selon son préfixe (« + » ajout, « - » retrait). */
  protected diffClass(line: string): string {
    if (line.startsWith('+')) return 'block text-secure';
    if (line.startsWith('-')) return 'block text-vuln';
    return 'block text-muted';
  }
}
