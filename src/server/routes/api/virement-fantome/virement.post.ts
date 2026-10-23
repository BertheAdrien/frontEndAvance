import { createTransferHandler, useBankStore } from '../../../levels/bank';
import { useLevels } from '../../../levels/catalog';
import { isVulnerableModeEnabled } from '../../../mode';

export default createTransferHandler({ store: useBankStore(), levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
