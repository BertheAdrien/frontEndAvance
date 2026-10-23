import { Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectLoad, type RouteMeta } from '@analogjs/router';

import { LeaderboardView } from '../../leaderboard/leaderboard-view';
import type { load } from './ssg.server';

// Pré-rendue au build (`prerender.routes` de vite.config.ts) : le classement est celui de la base au moment du build.

export const routeMeta = {
  title: 'Breach Academy — Classement (SSG)',
} satisfies RouteMeta;

@Component({
  selector: 'app-leaderboard-ssg',
  imports: [LeaderboardView],
  template: `<app-leaderboard-view rendering="ssg" [data]="data()" />`,
})
export default class LeaderboardSSG {
  protected readonly data = toSignal(injectLoad<typeof load>(), { requireSync: true });
}
