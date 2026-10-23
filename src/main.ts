import { bootstrapApplication } from '@angular/platform-browser';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig);

// PWA : fiches hors ligne et notifications push (service worker généré au build).
registerSW({ immediate: true });
