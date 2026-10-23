import { useDatabase } from '../../../db';
import { createPseudonymPostHandler } from '../../../leaderboard';

export default createPseudonymPostHandler({ db: useDatabase });
