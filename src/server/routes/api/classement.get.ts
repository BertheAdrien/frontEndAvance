import { useDatabase } from '../../db';
import { createLeaderboardHandler } from '../../leaderboard';
import { useLevels } from '../../levels/catalog';

export default createLeaderboardHandler({ db: useDatabase, levels: useLevels });
