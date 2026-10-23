import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import type { RouteMeta } from '@analogjs/router';

import type { LeaderboardResponse } from '../../../shared/leaderboard';
import { LeaderboardView } from '../../leaderboard/leaderboard-view';

export const routeMeta = {
  title: 'Breach Academy — Classement (CSR)',
} satisfies RouteMeta;

// Route servie sans SSR (`routeRules` de vite.config.ts) : les données arrivent par l'API, dans le navigateur.
@Component({
  selector: 'app-leaderboard-csr',
  imports: [LeaderboardView],
  template: `<app-leaderboard-view rendering="csr" [data]="board.value()" [failed]="!!board.error()" />`,
})
export default class LeaderboardCsr {
  protected readonly board = httpResource<LeaderboardResponse>(() => '/api/classement');
}
