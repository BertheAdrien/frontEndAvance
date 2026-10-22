import type { PageServerLoad } from '@analogjs/router';

import { useDatabase } from '../../../server/db';
import { useLevels } from '../../../server/levels/catalog';
import { getLevelsForPlayer } from '../../../server/levels/level.service';
import { getLevelMode, isVulnerableModeEnabled } from '../../../server/mode';
import { getPlayerId } from '../../../server/player';

export const load = async ({ event }: PageServerLoad) => ({
  levels: getLevelsForPlayer(useDatabase(), useLevels(), getPlayerId(event)),
  mode: getLevelMode(event),
  vulnerableModeAvailable: isVulnerableModeEnabled(),
});
