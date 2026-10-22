import { Component } from '@angular/core';
import type { RouteMeta } from '@analogjs/router';

import { NotFoundView } from '../layout/not-found-view';

export const routeMeta = {
  title: 'Breach Academy — Page introuvable',
} satisfies RouteMeta;

@Component({
  selector: 'app-not-found',
  imports: [NotFoundView],
  template: `<app-not-found-view />`,
})
export default class NotFound {}
