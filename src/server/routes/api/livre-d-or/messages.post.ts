import { useDatabase } from '../../../db';
import { createGuestbookPostHandler } from '../../../levels/guestbook';
import { isVulnerableModeEnabled } from '../../../mode';

export default createGuestbookPostHandler({ db: useDatabase, vulnerableModeEnabled: isVulnerableModeEnabled });
