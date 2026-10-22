import { useLevels } from '../../../levels/catalog';
import { createRevealHandler } from '../../../levels/search-engine';
import { isVulnerableModeEnabled } from '../../../mode';

export default createRevealHandler({ levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
