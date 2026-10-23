import { Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { injectLoad, type RouteMeta } from '@analogjs/router';

import { LeaderboardView } from '../../leaderboard/leaderboard-view';
import type { load } from './ssr.server';

// Rendue par le serveur à chaque requête : le classement est toujours à jour.

export const routeMeta = {
  title: 'Breach Academy — Classement (SSR)',
} satisfies RouteMeta;

@Component({
  selector: 'app-leaderboard-ssr',
  imports: [LeaderboardView],
  template: `<app-leaderboard-view rendering="ssr" [data]="data()" />`,
})
export default class LeaderboardSSR {
  protected readonly data = toSignal(injectLoad<typeof load>(), { requireSync: true });
}
