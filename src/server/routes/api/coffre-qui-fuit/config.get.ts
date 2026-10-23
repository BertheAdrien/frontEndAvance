import { useLevels } from '../../../levels/catalog';
import { createVaultConfigHandler } from '../../../levels/secrets-vault';
import { isVulnerableModeEnabled } from '../../../mode';

export default createVaultConfigHandler({ levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
