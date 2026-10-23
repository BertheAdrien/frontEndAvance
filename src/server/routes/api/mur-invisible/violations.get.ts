import { useLevels } from '../../../levels/catalog';
import { createViolationsHandler, useViolationLog } from '../../../levels/csp-wall';
import { isVulnerableModeEnabled } from '../../../mode';

export default createViolationsHandler({ log: useViolationLog(), levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
