import { createCspStateHandler } from '../../../levels/csp-wall';
import { isVulnerableModeEnabled } from '../../../mode';

export default createCspStateHandler({ vulnerableModeEnabled: isVulnerableModeEnabled });
