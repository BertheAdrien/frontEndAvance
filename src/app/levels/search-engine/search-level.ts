import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { Component, DestroyRef, PLATFORM_ID, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import type { LevelMode, PublicLevel } from '../../../shared/level';
import type { SearchResponse } from '../../../shared/search-engine';

/** `window.revealFlag()` révèle le flag du niveau 1 ; n'existe qu'en mode vulnérable, pour le code injecté. */
export type RevealWindow = Window & { revealFlag?: () => void };

/** Niveau 1 : moteur de recherche d'un faux blog, qui réaffiche le terme cherché. */
@Component({
  selector: 'app-search-level',
  template: `
    <div class="flex flex-col gap-10">
      <section aria-labelledby="blog-title" class="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6">
        <h2 id="blog-title" class="text-2xl font-bold">Le blog de la Breach Academy</h2>

        <form role="search" (submit)="search($event)" class="flex flex-wrap gap-3">
          <label for="search-input" class="sr-only">Rechercher un article</label>
          <input
            id="search-input"
            type="search"
            name="q"
            maxlength="200"
            autocomplete="off"
            placeholder="Rechercher un article…"
            [value]="term()"
            (input)="term.set($any($event.target).value)"
            class="min-h-12 min-w-0 flex-[1_1_260px] rounded-lg border border-line bg-ground px-4"
          />
          <button type="submit" class="min-h-12 rounded-lg bg-accent px-5.5 font-bold text-ground hover:brightness-110">
            Rechercher
          </button>
        </form>

        @if (results.hasValue()) {
          @let response = results.value();
          @if (response.query) {
            <p class="text-lg">
              {{ response.articles.length }} résultat(s) pour «
              @if (mode() === 'vulnerable') {
                <span [innerHTML]="asTrustedHtml(response.query)"></span>
              } @else {
                <span>{{ response.query }}</span>
              }
              »
            </p>
          }
          <ul class="m-0 flex list-none flex-col gap-3 p-0">
            @for (article of response.articles; track article.title) {
              <li class="rounded-lg border border-line bg-ground-2 p-4">
                <h3 class="font-semibold">{{ article.title }}</h3>
                <p class="text-muted">{{ article.excerpt }}</p>
              </li>
            }
          </ul>
        } @else if (results.error()) {
          <p class="text-vuln">La recherche est indisponible pour le moment.</p>
        }

        <p role="status" class="text-lg">
          @if (flag(); as value) {
            JavaScript exécuté ! Flag : <code class="font-mono text-accent">{{ value }}</code>
          }
        </p>
      </section>

      <section aria-labelledby="takeaways-title" class="rounded-xl border-l-[3px] border-secure bg-surface p-6">
        <h2 id="takeaways-title" class="mb-3 text-xl font-bold">Ce qu'il faut retenir</h2>
        <ul class="flex list-disc flex-col gap-2 pl-5">
          <li>
            Une <strong>XSS réfléchie</strong> renvoie la saisie dans la page sans l'échapper : un simple lien piégé
            (<code>?q=…</code>) suffit à exécuter du code chez la victime.
          </li>
          <li>
            Angular échappe <strong>par défaut</strong> l'interpolation <code ngNonBindable>{{ }}</code> et nettoie
            <code>[innerHTML]</code>. La faille vient ici d'un contournement volontaire :
            <code>bypassSecurityTrustHtml</code>.
          </li>
          <li>
            Une balise <code>&lt;script&gt;</code> insérée par <code>innerHTML</code> ne s'exécute pas, mais un
            attribut d'événement (<code>onerror</code>, <code>onload</code>…) si.
          </li>
          <li>
            Défense : interpolation, aucun <code>bypassSecurityTrust*</code> (règle ESLint), et une CSP sans
            <code>'unsafe-inline'</code> comme filet de sécurité.
          </li>
        </ul>
      </section>
    </div>
  `,
})
export class SearchLevel {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();

  /** Terme présent dans l'URL : c'est lui que le serveur réfléchit. */
  private readonly query = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')), {
    initialValue: '',
  });
  protected readonly term = signal('');
  protected readonly flag = signal<string | null>(null);

  // Recherche côté navigateur uniquement : un payload rendu pendant le SSR s'exécuterait
  // avant le chargement de l'application, donc avant que `revealFlag` n'existe.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly results = httpResource<SearchResponse>(() =>
    this.isBrowser ? { url: '/api/recherche-bavarde/articles', params: { q: this.query() } } : undefined,
  );

  private readonly window = inject(DOCUMENT).defaultView as RevealWindow | null;

  constructor() {
    effect(() => this.term.set(this.query()));

    effect(() => {
      if (!this.isBrowser || !this.window) return;
      if (this.mode() === 'vulnerable') this.window.revealFlag = () => this.reveal();
      else delete this.window.revealFlag;
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.isBrowser) delete this.window?.revealFlag;
    });
  }

  protected search(event: Event): void {
    event.preventDefault();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: this.term() } });
  }

  protected asTrustedHtml(query: string): SafeHtml {
    // VULNERABLE (démo): le terme cherché vient de l'URL et est déclaré « sûr » sans
    // nettoyage. Injecté via [innerHTML], un attribut onerror s'exécute dans la page.
    return this.sanitizer.bypassSecurityTrustHtml(query);
  }

  private reveal(): void {
    this.http.post<{ flag: string }>('/api/recherche-bavarde/reveal', {}).subscribe({
      next: ({ flag }) => this.flag.set(flag),
    });
  }
}
