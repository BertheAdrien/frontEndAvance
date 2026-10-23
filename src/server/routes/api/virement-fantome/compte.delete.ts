import { createAccountResetHandler, useBankStore } from '../../../levels/bank';
import { useLevels } from '../../../levels/catalog';
import { isVulnerableModeEnabled } from '../../../mode';

export default createAccountResetHandler({ store: useBankStore(), levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
