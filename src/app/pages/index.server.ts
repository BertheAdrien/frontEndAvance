import type { PageServerLoad } from '@analogjs/router';

import { useDatabase } from '../../server/db';
import { useLevels } from '../../server/levels/catalog';
import { getLevelsForPlayer } from '../../server/levels/level.service';
import { getPlayerId } from '../../server/player';

export const load = async ({ event }: PageServerLoad) => {
  const levels = getLevelsForPlayer(useDatabase(), useLevels(), getPlayerId(event));
  return { levels };
};
