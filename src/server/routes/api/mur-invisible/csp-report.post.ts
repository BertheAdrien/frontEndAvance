import { createCspReportHandler, useViolationLog } from '../../../levels/csp-wall';

export default createCspReportHandler({ log: useViolationLog() });
