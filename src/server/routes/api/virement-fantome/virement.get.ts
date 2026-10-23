import { createTransferHandler, useBankStore } from '../../../levels/bank';
import { useLevels } from '../../../levels/catalog';
import { isVulnerableModeEnabled } from '../../../mode';

// VULNERABLE (démo): un virement accepté sur un GET — un changement d'état sur une requête
// « sûre » que n'importe quelle page peut déclencher. Le mode sécurisé le refuse.
export default createTransferHandler({ store: useBankStore(), levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
