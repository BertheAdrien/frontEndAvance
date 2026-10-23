import { useLevels } from '../../../levels/catalog';
import { createGitHistoryHandler } from '../../../levels/secrets-vault';
import { isVulnerableModeEnabled } from '../../../mode';

export default createGitHistoryHandler({ levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
