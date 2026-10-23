import { useDatabase } from '../../../db';
import { createUnsubscribeHandler } from '../../../push.handler';

export default createUnsubscribeHandler({ db: useDatabase });
