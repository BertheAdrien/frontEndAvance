import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { PushToggle, urlBase64ToBytes } from './push-toggle';

// Clé publique VAPID factice (base64url, sans remplissage), comme la renvoie le serveur.
const publicKey = 'BAEC_-8';
const browserSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p', auth: 'a' },
};

function fakeBrowser(permission: NotificationPermission) {
  const subscribe = vi.fn().mockResolvedValue({ ...browserSubscription, toJSON: () => browserSubscription });
  const pushManager = { getSubscription: vi.fn().mockResolvedValue(null), subscribe };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue(permission) });
  return { subscribe };
}

// Les promesses natives du navigateur (permission, service worker) ne sont pas suivies par Angular.
async function settle(fixture: ComponentFixture<unknown>) {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

async function setup(serverKey: string | null) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(PushToggle);
  const backend = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  backend.expectOne('/api/push/cle-publique').flush({ publicKey: serverKey });
  await settle(fixture);
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  return { fixture, backend, el, button: () => el.querySelector('button') };
}

describe('urlBase64ToBytes', () => {
  it('décode une clé base64url sans remplissage (caractères - et _)', () => {
    expect([...urlBase64ToBytes('BAEC_-8')]).toEqual([0x04, 0x01, 0x02, 0xff, 0xef]);
  });
});

describe('PushToggle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('abonne le navigateur avec la clé du serveur, puis lui envoie l’abonnement', async () => {
    const { subscribe } = fakeBrowser('granted');
    const { fixture, backend, el, button } = await setup(publicKey);

    button()?.click();
    await settle(fixture);

    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) });
    const request = backend.expectOne('/api/push/abonnement');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(browserSubscription);
    request.flush(null, { status: 201, statusText: 'Created' });
    await settle(fixture);
    fixture.detectChanges();

    expect(el.textContent).toContain('Notifications activées');
  });

  it('n’abonne pas le navigateur quand le joueur refuse les notifications', async () => {
    const { subscribe } = fakeBrowser('denied');
    const { fixture, backend, el, button } = await setup(publicKey);

    button()?.click();
    await settle(fixture);
    fixture.detectChanges();

    expect(subscribe).not.toHaveBeenCalled();
    backend.expectNone('/api/push/abonnement');
    expect(el.textContent).toContain('bloquées');
  });

  it('ne propose rien quand le serveur n’a pas de clés VAPID', async () => {
    fakeBrowser('granted');
    const { button } = await setup(null);

    expect(button()).toBeNull();
  });
});
