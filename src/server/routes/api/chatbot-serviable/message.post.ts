import { useDatabase } from '../../../db';
import { useLevels } from '../../../levels/catalog';
import { createChatHandler } from '../../../levels/chatbot';
import { isVulnerableModeEnabled } from '../../../mode';

export default createChatHandler({ db: useDatabase, levels: useLevels, vulnerableModeEnabled: isVulnerableModeEnabled });
