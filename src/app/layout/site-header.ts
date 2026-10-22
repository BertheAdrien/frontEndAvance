import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-line px-8 py-4">
      <a routerLink="/" class="flex items-center gap-2.5 font-mono text-lg font-bold text-ink no-underline hover:text-ink">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="text-accent">
          <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        breach_academy
      </a>
      <nav aria-label="Navigation principale">
        <ul class="m-0 flex list-none flex-wrap gap-1 p-0">
          @for (link of links; track link.path) {
            <li>
              <a
                [routerLink]="link.path"
                routerLinkActive="bg-surface-2 !text-ink font-semibold"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: link.path === '/' }"
                class="inline-block rounded-lg px-3.5 py-2.5 font-medium text-muted no-underline hover:text-ink"
              >
                {{ link.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
    </header>
  `,
})
export class SiteHeader {
  protected readonly links = [
    { path: '/', label: 'Niveaux' },
    { path: '/classement', label: 'Classement' },
  ];
}
