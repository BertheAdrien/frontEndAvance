import { useDatabase } from '../../../db';
import { createPseudonymGetHandler } from '../../../leaderboard';

export default createPseudonymGetHandler({ db: useDatabase });
