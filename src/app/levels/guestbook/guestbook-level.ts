import { isPlatformBrowser } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { Component, ElementRef, PLATFORM_ID, computed, inject, input, signal, viewChild } from '@angular/core';

import type { GuestbookMessage, GuestbookResponse, LootResponse } from '../../../shared/guestbook';
import type { LevelMode, PublicLevel } from '../../../shared/level';

/** Niveau 2 : livre d'or où un faux bot admin relit chaque message dans le navigateur du joueur. */
@Component({
  selector: 'app-guestbook-level',
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

      <div class="flex flex-col gap-7 lg:flex-row lg:items-start">
        <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <section aria-labelledby="form-title" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
            <h2 id="form-title" class="text-xl font-bold">Laisser un message</h2>
            <form (submit)="publish($event)" class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label for="gb-author" class="text-sm font-semibold">Pseudo</label>
                <input
                  id="gb-author"
                  type="text"
                  maxlength="40"
                  [value]="author()"
                  (input)="author.set($any($event.target).value)"
                  class="min-h-11 rounded-lg border border-field bg-ground px-3"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="gb-body" class="text-sm font-semibold">Message</label>
                <textarea
                  id="gb-body"
                  rows="3"
                  maxlength="500"
                  [value]="body()"
                  (input)="body.set($any($event.target).value)"
                  placeholder="Un mot gentil… ou un payload qui exfiltre document.cookie vers /api/evil/collect"
                  class="resize-y rounded-lg border border-field bg-ground px-3 py-2.5 font-mono text-sm"
                ></textarea>
              </div>
              @if (formError()) {
                <p role="alert" class="text-sm text-vuln">{{ formError() }}</p>
              }
              <button type="submit" [disabled]="pending()" class="min-h-11 self-start rounded-lg bg-accent px-5 font-bold text-ground hover:brightness-110">
                Publier
              </button>
            </form>
          </section>

          <section aria-labelledby="messages-title" class="flex flex-col gap-3">
            <h2 id="messages-title" class="text-xl font-bold">Messages ({{ messageList().length }})</h2>
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              @for (message of messageList(); track message.id) {
                <li class="rounded-xl border border-line bg-surface p-4">
                  <div class="mb-1 text-sm text-muted"><strong class="text-ink">{{ message.author }}</strong></div>
                  <!-- Le livre d'or s'affiche toujours comme du texte : la faille est dans la relecture par le bot. -->
                  <p class="m-0 break-words font-mono text-sm text-ink-2">{{ message.body }}</p>
                </li>
              } @empty {
                <li class="text-muted">Aucun message pour l'instant.</li>
              }
            </ul>
          </section>
        </div>

        <aside class="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-sm">
          <section aria-labelledby="bot-title" class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
            <h2 id="bot-title" class="text-lg font-bold">Le bot administrateur</h2>
            <p class="text-sm text-muted">
              Le bot relit chaque message dans son navigateur, authentifié par un cookie de session non HttpOnly.
            </p>
            <button type="button" (click)="runBot()" [disabled]="botRunning()" class="min-h-11 rounded-lg bg-secure px-4 font-bold text-ground hover:brightness-110">
              {{ botRunning() ? 'Le bot relit…' : 'Faire relire les messages par le bot' }}
            </button>
            <!-- Vue « admin » : le bot rend ici le livre d'or (innerHTML en mode vulnérable). -->
            <div #botView aria-live="polite" class="flex flex-col gap-2 empty:hidden"></div>
          </section>

          <section aria-labelledby="console-title" class="overflow-hidden rounded-xl border border-line bg-console">
            <h2 id="console-title" class="border-b border-line px-4 py-3 font-mono text-sm text-muted">Console du collecteur (evil.localhost)</h2>
            <div class="flex flex-col gap-2 p-4 font-mono text-[13px] break-words">
              @for (line of loot(); track $index) {
                <div class="text-vuln">↙ {{ line }}</div>
              } @empty {
                <div class="text-muted">En attente d'une exfiltration…</div>
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
        </aside>
      </div>

      <section aria-labelledby="takeaways-title" class="rounded-xl border-l-[3px] border-secure bg-surface p-6">
        <h2 id="takeaways-title" class="mb-3 text-xl font-bold">Ce qu'il faut retenir</h2>
        <ul class="flex list-disc flex-col gap-2 pl-5">
          <li>
            Une <strong>XSS stockée</strong> se déclenche chez <em>une autre victime</em> (ici le bot admin) qui relit un
            contenu piégé enregistré par le serveur.
          </li>
          <li>
            Le vol de cookie fonctionne parce que la session du bot n'est <strong>pas</strong> <code>HttpOnly</code> :
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
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();

  private readonly botView = viewChild<ElementRef<HTMLElement>>('botView');

  protected readonly author = signal('agent_42');
  protected readonly body = signal('');
  protected readonly pending = signal(false);
  protected readonly formError = signal('');
  protected readonly botRunning = signal(false);
  protected readonly loot = signal<string[]>([]);

  /** Messages du joueur, rechargés après chaque publication réussie. */
  private readonly reload = signal(0);
  private readonly messages = httpResource<GuestbookResponse>(() =>
    this.isBrowser ? { url: '/api/livre-d-or/messages', params: { v: this.reload() } } : undefined,
  );
  protected readonly messageList = computed<GuestbookMessage[]>(() => this.messages.value()?.messages ?? []);

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

  protected publish(event: Event): void {
    event.preventDefault();
    if (this.pending()) return;
    this.pending.set(true);
    this.formError.set('');
    this.http
      .post<GuestbookResponse>('/api/livre-d-or/messages', { author: this.author(), body: this.body() })
      .subscribe({
        next: () => {
          this.pending.set(false);
          this.body.set('');
          this.reload.update((v) => v + 1);
        },
        error: (err) => {
          this.pending.set(false);
          this.formError.set(
            err?.status === 400
              ? 'Message refusé : en mode sécurisé, le HTML est interdit (pseudo 1–40, message 1–500 caractères).'
              : 'Publication impossible pour le moment.',
          );
        },
      });
  }

  /** Simule la relecture par le bot admin, entièrement dans le navigateur du joueur. */
  protected runBot(): void {
    if (!this.isBrowser || this.botRunning()) return;
    this.botRunning.set(true);
    this.loot.set([]);

    const render = () => {
      this.renderBotView(this.messageList(), this.mode() === 'vulnerable');
      // Laisse le temps aux payloads (onerror asynchrone) d'exfiltrer avant de relever le butin.
      setTimeout(() => this.collectLoot(), 700);
    };

    if (this.mode() === 'vulnerable') {
      this.http.post<{ session: string }>('/api/livre-d-or/bot-session', {}).subscribe({
        next: ({ session }) => {
          // VULNERABLE (démo): la session du bot admin n'est pas HttpOnly, donc lisible
          // par document.cookie — c'est ce que le payload volera.
          document.cookie = `${session}; path=/`;
          render();
        },
        error: () => this.finishBot(),
      });
    } else {
      render();
    }
  }

  private renderBotView(messages: GuestbookMessage[], vulnerable: boolean): void {
    const host = this.botView()?.nativeElement;
    if (!host) return;
    host.replaceChildren();
    for (const message of messages) {
      const card = document.createElement('div');
      card.className = 'rounded-lg border border-line bg-ground-2 p-3 text-sm';
      const who = document.createElement('div');
      who.className = 'mb-1 text-xs text-muted';
      who.textContent = message.author;
      const content = document.createElement('div');
      if (vulnerable) {
        // VULNERABLE (démo): le bot relit le message en HTML brut ; un attribut onerror
        // injecté s'exécute dans sa session.
        content.innerHTML = message.body;
      } else {
        content.textContent = message.body;
      }
      card.append(who, content);
      host.append(card);
    }
  }

  private collectLoot(): void {
    this.http.get<LootResponse>('/api/evil/collect').subscribe({
      next: ({ loot }) => {
        this.loot.set(loot);
        this.finishBot();
      },
      error: () => this.finishBot(),
    });
  }

  private finishBot(): void {
    this.botRunning.set(false);
    // Nettoie la fausse session : elle ne doit pas traîner dans le navigateur du joueur.
    if (this.isBrowser) document.cookie = 'ba_admin=; path=/; max-age=0';
  }
}
