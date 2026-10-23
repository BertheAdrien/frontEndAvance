import { defineEventHandler } from 'h3';

import type { PushPublicKeyResponse } from '../../../../shared/push';
import { readVapidConfig } from '../../../push';

// Seule la clé publique VAPID quitte le serveur : le navigateur s'en sert pour s'abonner.
export default defineEventHandler((): PushPublicKeyResponse => ({
  publicKey: readVapidConfig(process.env)?.publicKey ?? null,
}));
