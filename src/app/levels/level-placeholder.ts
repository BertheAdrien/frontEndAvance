import { Component, input } from '@angular/core';

import type { LevelMode, PublicLevel } from '../../shared/level';

/** Affiché tant que le composant d'un niveau n'existe pas encore. */
@Component({
  selector: 'app-level-placeholder',
  template: `
    <div class="rounded-xl border border-dashed border-line bg-ground-2 p-8 text-muted">
      Le terrain de jeu de « {{ level().title }} » est en construction.
    </div>
  `,
})
export class LevelPlaceholder {
  readonly level = input.required<PublicLevel>();
  readonly mode = input.required<LevelMode>();
}
