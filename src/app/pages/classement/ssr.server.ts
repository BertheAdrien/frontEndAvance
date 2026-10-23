import type { PageServerLoad } from '@analogjs/router';

import { useDatabase } from '../../../server/db';
import { getLeaderboard } from '../../../server/leaderboard';
import { useLevels } from '../../../server/levels/catalog';
import type { LeaderboardResponse } from '../../../shared/leaderboard';

export const load = async (_context: PageServerLoad): Promise<LeaderboardResponse> => ({
  entries: getLeaderboard(useDatabase(), useLevels()),
  generatedAt: new Date().toISOString(),
});
