import type { PageServerLoad } from '@analogjs/router';

import { useDatabase } from '../../../server/db';
import { getPseudonym } from '../../../server/leaderboard';
import { getPlayerId } from '../../../server/player';

export const load = async ({ event }: PageServerLoad) => ({ pseudonym: getPseudonym(useDatabase(), getPlayerId(event)) });
