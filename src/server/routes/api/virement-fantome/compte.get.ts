import { createAccountHandler, useBankStore } from '../../../levels/bank';
import { useLevels } from '../../../levels/catalog';
import { isVulnerableModeEnabled } from '../../../mode';

export default createAccountHandler({ store: useBankStore(), levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
