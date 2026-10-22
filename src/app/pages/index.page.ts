import { Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { injectLoad, type RouteMeta } from '@analogjs/router';

import { LevelCard } from '../levels/level-card';
import type { load } from './index.server';

export const routeMeta = {
  title: 'Breach Academy — Apprenez à casser le web',
} satisfies RouteMeta;

@Component({
  selector: 'app-home',
  imports: [LevelCard, RouterLink],
  template: `
    <div class="flex flex-col gap-18">
      <section aria-labelledby="hero-title" class="flex flex-wrap items-center gap-12">
        <div class="flex min-w-0 flex-[1_1_480px] flex-col gap-5">
          <p class="font-mono text-sm text-accent">&gt; mission_briefing</p>
          <h1 id="hero-title" class="text-4xl leading-[1.08] font-bold tracking-tight sm:text-[52px]">
            Apprenez à casser le web.<br />Puis à le réparer.
          </h1>
          <p class="max-w-[560px] text-lg text-muted">
            Six niveaux, six failles réelles : XSS, CSP, CSRF, fuite de secrets, injection de prompt. Exploitez
            chaque faille en mode vulnérable, capturez le flag, puis prouvez la correction par les tests.
          </p>
          @if (next(); as level) {
            <div class="flex flex-wrap gap-3 pt-2">
              <a
                [routerLink]="['/niveaux', level.id]"
                class="inline-flex min-h-12 items-center rounded-lg bg-accent px-5.5 font-bold text-ground no-underline hover:text-ground hover:brightness-110"
              >
                {{ captured() === 0 ? 'Commencer' : 'Reprendre' }} au niveau {{ level.order }}
              </a>
            </div>
          }
        </div>

        <div class="min-w-0 flex-[1_1_380px] overflow-hidden rounded-xl border border-line bg-surface font-mono text-sm">
          <div class="flex items-center gap-2 border-b border-line px-4 py-3 text-muted">
            <span aria-hidden="true" class="size-2.5 rounded-full bg-line"></span>
            <span aria-hidden="true" class="size-2.5 rounded-full bg-line"></span>
            <span aria-hidden="true" class="size-2.5 rounded-full bg-line"></span>
            <span class="ml-2">~/progression</span>
          </div>
          <div class="flex flex-col gap-2.5 p-5">
            <div><span class="text-accent">$</span> progress --agent vous</div>
            <div class="flex justify-between gap-4">
              <span class="text-muted">niveaux réussis</span><span>{{ captured() }} / {{ total() }}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Progression"
              aria-valuemin="0"
              [attr.aria-valuemax]="total()"
              [attr.aria-valuenow]="captured()"
              class="h-2.5 overflow-hidden rounded-full bg-ground"
            >
              <div class="h-full bg-accent" [style.width.%]="progress()"></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="niveaux-title" class="flex flex-col gap-6">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="niveaux-title" class="text-3xl font-bold">Les niveaux</h2>
          <p class="text-[15px] text-muted">Chaque flag déverrouille le niveau suivant.</p>
        </div>
        <ol class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-5 p-0">
          @for (level of levels(); track level.id) {
            <li><app-level-card [level]="level" /></li>
          }
        </ol>
      </section>

      <section aria-labelledby="methode-title" class="flex flex-col gap-6">
        <h2 id="methode-title" class="text-3xl font-bold">Comment se joue un niveau</h2>
        <ol class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-5 p-0">
          <li class="flex flex-col gap-2.5 rounded-b-xl border-t-[3px] border-vuln bg-surface p-6">
            <span class="font-mono font-bold text-vuln">01 · Exploiter</span>
            <p class="text-muted">Le niveau démarre en mode vulnérable. Trouvez la faille et exploitez-la.</p>
          </li>
          <li class="flex flex-col gap-2.5 rounded-b-xl border-t-[3px] border-accent bg-surface p-6">
            <span class="font-mono font-bold text-accent">02 · Capturer</span>
            <p class="text-muted">L'exploitation révèle un flag au format BREACH{{ '{' }}…{{ '}' }}. Soumettez-le pour marquer les points.</p>
          </li>
          <li class="flex flex-col gap-2.5 rounded-b-xl border-t-[3px] border-secure bg-surface p-6">
            <span class="font-mono font-bold text-secure">03 · Corriger et prouver</span>
            <p class="text-muted">Passez en mode sécurisé : la même attaque échoue, et les tests automatisés le prouvent.</p>
          </li>
        </ol>
      </section>
    </div>
  `,
})
export default class Home {
  private readonly data = toSignal(injectLoad<typeof load>(), { requireSync: true });

  protected readonly levels = computed(() => this.data().levels);
  protected readonly total = computed(() => this.levels().length);
  protected readonly captured = computed(() => this.levels().filter((l) => l.status === 'captured').length);
  protected readonly progress = computed(() => (this.total() ? (this.captured() / this.total()) * 100 : 0));
  protected readonly next = computed(() => this.levels().find((l) => l.status === 'available'));
}
