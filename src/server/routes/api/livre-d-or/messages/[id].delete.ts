import { createGuestbookDeleteHandler } from '../../../../levels/guestbook';
import { useDatabase } from '../../../../db';

export default createGuestbookDeleteHandler({ db: useDatabase });
