import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { PushPublicKeyResponse } from '../../shared/push';

/** Clé VAPID (base64url sans remplissage) au format attendu par `pushManager.subscribe`. */
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

type PushState = 'hidden' | 'off' | 'on' | 'denied' | 'pending' | 'error';

/** Bouton « Être prévenu des nouveaux niveaux » : abonnement Web Push du navigateur. */
@Component({
  selector: 'app-push-toggle',
  template: `
    @if (state() !== 'hidden') {
      <section aria-labelledby="push-title" class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-6">
        <div class="flex flex-col gap-1">
          <h2 id="push-title" class="text-lg font-bold">Notifications</h2>
          <p role="status" class="text-muted">
            @switch (state()) {
              @case ('on') { Notifications activées : vous serez prévenu à chaque niveau débloqué. }
              @case ('denied') { Notifications bloquées par le navigateur. Autorisez-les dans les réglages du site. }
              @case ('error') { Impossible de modifier l'abonnement pour le moment. Réessayez. }
              @default { Soyez prévenu quand un nouveau niveau se débloque. }
            }
          </p>
        </div>
        @if (state() !== 'denied') {
          <button
            type="button"
            [disabled]="state() === 'pending'"
            (click)="toggle()"
            class="min-h-12 rounded-lg border border-line bg-surface-2 px-5 font-semibold hover:border-accent disabled:opacity-60"
          >
            {{ subscribed() ? 'Désactiver les notifications' : 'Activer les notifications' }}
          </button>
        }
      </section>
    }
  `,
})
export class PushToggle {
  private readonly http = inject(HttpClient);

  protected readonly state = signal<PushState>('hidden');
  protected readonly subscribed = signal(false);
  private publicKey = '';

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) void this.init();
  }

  private async init(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    const { publicKey } = await firstValueFrom(this.http.get<PushPublicKeyResponse>('/api/push/cle-publique'));
    if (!publicKey) return;
    this.publicKey = publicKey;

    const existing = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (existing) {
      // Réenregistré à chaque visite : l'abonnement suit le joueur courant (cookie).
      await firstValueFrom(this.http.post('/api/push/abonnement', existing.toJSON())).catch(() => undefined);
      this.subscribed.set(true);
    }
    this.state.set(Notification.permission === 'denied' ? 'denied' : existing ? 'on' : 'off');
  }

  protected async toggle(): Promise<void> {
    this.state.set('pending');
    try {
      if (this.subscribed()) await this.unsubscribe();
      else await this.subscribe();
    } catch {
      this.state.set('error');
    }
  }

  private async subscribe(): Promise<void> {
    if ((await Notification.requestPermission()) !== 'granted') {
      this.state.set('denied');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(this.publicKey),
    });
    await firstValueFrom(this.http.post('/api/push/abonnement', subscription.toJSON()));
    this.subscribed.set(true);
    this.state.set('on');
  }

  private async unsubscribe(): Promise<void> {
    const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (subscription) {
      await firstValueFrom(this.http.delete('/api/push/abonnement', { body: { endpoint: subscription.endpoint } }));
      await subscription.unsubscribe();
    }
    this.subscribed.set(false);
    this.state.set('off');
  }
}
