import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteHeader } from './layout/site-header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader],
  host: { class: 'flex min-h-screen flex-col' },
  template: `
    <a href="#contenu" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-surface focus:p-3">
      Aller au contenu
    </a>
    <app-site-header />
    <main id="contenu" class="mx-auto w-full max-w-[1200px] flex-1 px-8 pb-16 pt-14">
      <router-outlet />
    </main>
    <footer class="flex flex-wrap justify-between gap-3 border-t border-line px-8 py-6 text-sm text-muted">
      <span>Breach Academy — projet pédagogique.</span>
      <span>Le mode vulnérable n'existe qu'en local ; il est désactivé en production.</span>
    </footer>
  `,
})
export class App {}
