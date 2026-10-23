import { createCollectHandler, useEvilCollector } from '../../../levels/guestbook';

export default createCollectHandler({ collector: useEvilCollector() });
