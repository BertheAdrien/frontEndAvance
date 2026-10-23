import { useDatabase } from '../../../db';
import { createGuestbookListHandler } from '../../../levels/guestbook';

export default createGuestbookListHandler({ db: useDatabase });
