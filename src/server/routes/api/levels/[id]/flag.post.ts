import { useDatabase } from '../../../../db';
import { createFlagHandler } from '../../../../levels/flag.handler';
import { useLevels } from '../../../../levels/catalog';
import { createRateLimiter } from '../../../../rate-limit';

// Anti-force brute : 10 tentatives par minute et par joueur. Changer de cookie
// remet le compteur à zéro, mais un flag (48 bits d'aléa) reste hors de portée.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export default createFlagHandler({ db: useDatabase, levels: useLevels, limiter });
