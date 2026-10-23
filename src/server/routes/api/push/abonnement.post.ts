import { useDatabase } from '../../../db';
import { createSubscribeHandler } from '../../../push.handler';

export default createSubscribeHandler({ db: useDatabase });
