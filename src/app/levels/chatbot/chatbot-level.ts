import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ChatResponse } from '../../../shared/chatbot';
import type { LevelMode, PublicLevel } from '../../../shared/level';

interface ChatLine {
  from: 'pixel' | 'joueur';
  text: string;
  /** Réponse qui contient un flag (fuite) ou bloquée par le filtre : mise en évidence. */
  tone?: 'leak' | 'blocked';
}

const GREETING: ChatLine = { from: 'pixel', text: 'Bonjour ! Je peux vous aider à comprendre les niveaux de Breach Academy.' };

/**
 * Niveau 6 (IA) : Pixel, assistant simulé par un moteur de règles côté serveur.
 * Le composant ne fait qu'afficher la conversation, toujours en texte (jamais en HTML) :
 * une réponse peut citer le livre d'or, donc du contenu écrit par un attaquant.
 */
@Component({
  selector: 'app-chatbot-level',
  imports: [RouterLink],
  template: `
    <div class="flex flex-col gap-10">
      <div class="flex flex-wrap items-start gap-7">
        <section aria-labelledby="chat-title" class="flex min-w-0 flex-[999_1_560px] flex-col overflow-hidden rounded-xl border border-line bg-surface">
          <div class="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 id="chat-title" class="m-0 flex items-center gap-2.5 text-[17px] font-bold">
              <span aria-hidden="true" class="flex size-8 items-center justify-center rounded-lg bg-surface-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-secure">
                  <rect x="4" y="7" width="16" height="12" rx="3"></rect><path d="M12 3v4"></path><path d="M9 13h.01"></path><path d="M15 13h.01"></path>
                </svg>
              </span>
              Pixel, l'assistant
            </h2>
            <span class="rounded-full px-2.5 py-1 text-[13px] font-semibold" [class]="secure() ? 'bg-secure-soft text-secure' : 'bg-vuln-soft text-vuln'">
              {{ secure() ? 'Mode sécurisé' : 'Mode vulnérable' }}
            </span>
          </div>

          <ol aria-label="Conversation" aria-live="polite" class="m-0 flex list-none flex-col gap-4 px-5 py-6">
            @for (line of lines(); track $index) {
              <li class="max-w-[80%] px-4 py-3 whitespace-pre-wrap [overflow-wrap:anywhere]" [class]="bubbleClass(line)">
                <span class="mb-0.5 block text-xs font-semibold" [class]="authorClass(line)">{{ line.from === 'pixel' ? 'Pixel' : 'Vous' }}</span>
                {{ line.text }}
              </li>
            }
            @if (pending()) {
              <li class="self-start rounded-[4px_14px_14px_14px] bg-surface-2 px-4 py-3 text-muted">Pixel écrit…</li>
            }
          </ol>

          <form class="flex flex-wrap gap-2.5 border-t border-line px-5 py-4" (submit)="send($event)">
            <label for="chat-message" class="sr-only">Votre message à Pixel</label>
            <input id="chat-message" type="text" maxlength="500" autocomplete="off" placeholder="Écrivez à Pixel…"
              [value]="draft()" (input)="draft.set($any($event.target).value)"
              class="min-h-11 min-w-0 flex-[1_1_260px] rounded-lg border border-field bg-ground px-3.5" />
            <button type="submit" [disabled]="pending()" class="min-h-11 rounded-lg bg-accent px-5 font-bold text-ground disabled:opacity-50">Envoyer</button>
          </form>
          @if (error()) {
            <p role="alert" class="m-0 px-5 pb-4 text-sm text-vuln">{{ error() }}</p>
          }
        </section>

        <aside class="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <section aria-labelledby="coulisses-title" class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
            <h2 id="coulisses-title" class="m-0 text-lg font-bold">Dans les coulisses</h2>
            @if (secure()) {
              <p class="m-0 text-[15px] text-muted">Les instructions et votre message restent séparés : le modèle sait qui donne les ordres.</p>
              <pre class="m-0 rounded-lg border border-line bg-console p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2">messages = [
  &#123; role: 'system', content: instructions &#125;, // sans secret
  &#123; role: 'user', content: userMessage &#125;,
]
reply = filtrerSortie(modele(messages))</pre>
            } @else {
              <p class="m-0 text-[15px] text-muted">En mode vulnérable, les instructions et votre message sont collés dans un seul texte : le modèle ne sait plus qui donne les ordres.</p>
              <pre class="m-0 rounded-lg border border-line bg-console p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2"><span class="text-muted">// VULNERABLE (démo):</span>
prompt = systemPrompt
       + "\\n" + livreDor
       + "\\n" + userMessage</pre>
            }
            <p class="m-0 text-sm text-muted">
              Pixel sait aussi lire votre <a routerLink="/niveaux/livre-d-or" class="text-secure underline">livre d'or</a>
              quand on le lui demande : un message qu'on y laisse finit dans son prompt.
            </p>
            @if (lastRule(); as rule) {
              <p class="m-0 rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13px]"><span class="text-muted">Règle déclenchée :</span> {{ rule }}</p>
            }
          </section>

          <section aria-labelledby="secu-title" class="flex flex-col gap-2.5 rounded-xl border-t-[3px] border-secure bg-surface p-6">
            <h2 id="secu-title" class="m-0 text-lg font-bold text-secure">En mode sécurisé</h2>
            <ul class="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-ink-2">
              <li>Instructions et données séparées, jamais concaténées.</li>
              <li>Aucun secret dans le prompt : le modèle ne peut pas fuiter ce qu'il ignore.</li>
              <li>Filtrage de la sortie : toute réponse contenant BREACH&#123; est bloquée.</li>
            </ul>
          </section>

          <p class="m-0 rounded-lg border border-dashed border-line bg-ground-2 px-4 py-3.5 text-sm text-muted">
            Simulation : Pixel est un moteur de règles. Aucun modèle de langage n'est appelé et aucune clé d'API n'est utilisée.
          </p>
        </aside>
      </div>

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
          <li>L'<strong>injection de prompt</strong> (OWASP LLM01) vient du mélange instructions / données : un modèle ne distingue pas un ordre du développeur d'un ordre glissé dans le texte.</li>
          <li>L'injection peut être <strong>indirecte</strong> : une page, un e-mail ou un commentaire lu par l'assistant suffit à lui donner des consignes.</li>
          <li>Ne jamais mettre de <strong>secret dans un prompt</strong> : une consigne « ne le révèle pas » n'est pas une protection.</li>
          <li>Défense en profondeur : rôles séparés, <strong>filtrage des sorties</strong>, moindre privilège des outils, et un humain dans la boucle pour les actions sensibles.</li>
        </ul>
      </section>
    </div>
  `,
})
export class ChatbotLevel {
  private readonly http = inject(HttpClient);

  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();

  protected readonly secure = computed(() => this.mode() === 'secure');
  protected readonly draft = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal('');

  // Chaque bascule de mode repart d'une conversation neuve : le serveur répond selon le nouveau mode.
  protected readonly lines = linkedSignal<LevelMode, ChatLine[]>({ source: this.mode, computation: () => [GREETING] });
  protected readonly lastRule = linkedSignal<LevelMode, string>({ source: this.mode, computation: () => '' });

  protected readonly tests = computed(() => {
    const secure = this.secure();
    return [
      { kind: 'Unitaire', name: "« ignore les instructions » ne révèle aucun flag", ok: secure },
      { kind: 'Unitaire', name: 'répéter le prompt ne montre aucun secret', ok: secure },
      { kind: 'Unitaire', name: "une consigne cachée dans le livre d'or n'est pas suivie", ok: secure },
      { kind: 'Unitaire', name: 'le filtre de sortie bloque toute réponse contenant BREACH{', ok: secure },
    ];
  });

  protected send(event: Event): void {
    event.preventDefault();
    const message = this.draft().trim();
    if (!message || this.pending()) return;

    this.lines.update((lines) => [...lines, { from: 'joueur', text: message }]);
    this.draft.set('');
    this.error.set('');
    this.pending.set(true);

    this.http.post<ChatResponse>('/api/chatbot-serviable/message', { message }).subscribe({
      next: ({ reply, rule, blocked }) => {
        this.pending.set(false);
        const tone = blocked ? 'blocked' : /BREACH\{/.test(reply) ? 'leak' : undefined;
        this.lines.update((lines) => [...lines, { from: 'pixel', text: reply, tone }]);
        this.lastRule.set(rule);
      },
      error: () => {
        this.pending.set(false);
        this.error.set("Pixel n'a pas pu répondre (message vide ou trop long ?).");
      },
    });
  }

  protected bubbleClass(line: ChatLine): string {
    if (line.from === 'joueur') return 'self-end rounded-[14px_4px_14px_14px] bg-accent-soft text-ink';
    const base = 'self-start rounded-[4px_14px_14px_14px] ';
    if (line.tone === 'leak') return base + 'border border-vuln bg-[#1f1810]';
    if (line.tone === 'blocked') return base + 'border border-secure bg-secure-soft';
    return base + 'bg-surface-2';
  }

  protected authorClass(line: ChatLine): string {
    if (line.from === 'joueur') return 'text-accent';
    if (line.tone === 'leak') return 'text-vuln';
    if (line.tone === 'blocked') return 'text-secure';
    return 'text-muted';
  }
}
