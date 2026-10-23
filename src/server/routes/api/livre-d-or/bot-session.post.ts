import { useLevels } from '../../../levels/catalog';
import { createBotSessionHandler } from '../../../levels/guestbook';
import { isVulnerableModeEnabled } from '../../../mode';

export default createBotSessionHandler({ levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
