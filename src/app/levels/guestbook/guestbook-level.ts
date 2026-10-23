import { Component, computed, input } from '@angular/core';

import type { LevelMode, PublicLevel } from '../../../shared/level';
import { GuestbookBoard } from './guestbook-board';

/** Niveau 2 : livre d'or où un faux bot admin relit chaque message dans le navigateur du joueur. */
@Component({
  selector: 'app-guestbook-level',
  imports: [GuestbookBoard],
  template: `
    <div class="flex flex-col gap-10">
      <div
        role="status"
        class="flex items-start gap-3 rounded-xl border p-5"
        [class]="mode() === 'vulnerable' ? 'border-vuln bg-vuln-soft' : 'border-secure bg-secure-soft'"
      >
        <span class="min-w-0">
          <strong [class]="mode() === 'vulnerable' ? 'text-vuln' : 'text-secure'">{{ banner().title }}</strong>
          <span class="mt-1 block text-ink-2">{{ banner().text }}</span>
        </span>
      </div>

      <app-guestbook-board [mode]="mode()">
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
            Une <strong>XSS stockée</strong> se déclenche chez <em>une autre victime</em> (ici le bot admin) qui relit un
            contenu piégé enregistré par le serveur.
          </li>
          <li>
            Le vol de cookie fonctionne parce que la session du bot n'est <strong>pas <code>HttpOnly</code></strong> :
            <code>document.cookie</code> la rend lisible par le payload, qui l'exfiltre vers son collecteur.
          </li>
          <li>
            Défenses : rendu <strong>texte</strong> côté client (<code ngNonBindable>{{ }}</code>), validation serveur
            (Zod, rejet du HTML) et cookies de session <code>HttpOnly</code>.
          </li>
        </ul>
      </section>
    </div>
  `,
})
export class GuestbookLevel {
  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();

  protected readonly banner = computed(() =>
    this.mode() === 'vulnerable'
      ? {
          title: 'Mode vulnérable',
          text: "Le bot relit les messages en HTML brut. Un message piégé exécute du code dans sa session et vole son cookie.",
        }
      : {
          title: 'Attaque neutralisée',
          text: 'Les messages sont affichés comme du texte, validés côté serveur, et la session du bot est HttpOnly.',
        },
  );

  protected readonly tests = computed(() => {
    const secure = this.mode() === 'secure';
    return [
      { kind: 'Unitaire', name: 'le message est rendu comme du texte, pas comme du HTML', ok: secure },
      { kind: 'Intégration', name: 'POST /api/livre-d-or/messages rejette tout HTML', ok: secure },
      { kind: 'Intégration', name: 'la session du bot admin reste HttpOnly', ok: secure },
      { kind: 'E2E', name: "aucun cookie n'est exfiltré vers le collecteur", ok: secure },
    ];
  });
}
