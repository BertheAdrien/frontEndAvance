import { createCspHeaderMiddleware } from '../levels/csp-wall';
import { isVulnerableModeEnabled } from '../mode';

// Niveau 3 : CSP statique (aucune / rapport / bloquante) posée sur la page du niveau.
export default createCspHeaderMiddleware({ vulnerableModeEnabled: isVulnerableModeEnabled });
