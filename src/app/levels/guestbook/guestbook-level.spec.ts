import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { GuestbookMessage } from '../../../shared/guestbook';
import type { LevelMode, PublicLevel } from '../../../shared/level';
import { GuestbookLevel } from './guestbook-level';

/** Message piégé : une balise, sans ressource réelle, suffit à prouver l'interprétation HTML. */
const payload = '<img src="x">';
const message = (body: string): GuestbookMessage => ({ id: 1, author: 'agent_42', body, createdAt: '' });

async function setup(mode: LevelMode, messages: GuestbookMessage[]) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(GuestbookLevel);
  fixture.componentRef.setInput('level', { id: 'livre-d-or' } as PublicLevel);
  fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();

  const backend = TestBed.inject(HttpTestingController);
  const el = fixture.nativeElement as HTMLElement;
  TestBed.tick();
  backend.expectOne((r) => r.url === '/api/livre-d-or/messages').flush({ messages });
  await fixture.whenStable();
  fixture.detectChanges();

  const clickBot = () => (el.querySelector('[aria-labelledby="bot-title"] button') as HTMLButtonElement).click();
  const botView = () => el.querySelector('[aria-live="polite"]') as HTMLElement;
  return { fixture, el, backend, clickBot, botView };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('GuestbookLevel', () => {
  it('en mode vulnérable, le bot relit le message en HTML brut : la balise piégée devient un vrai élément', async () => {
    const { fixture, backend, clickBot, botView } = await setup('vulnerable', [message(payload)]);

    clickBot();
    // Chaque relecture repart d'une console vide : le butin des relectures précédentes est effacé.
    backend.expectOne({ method: 'DELETE', url: '/api/evil/collect' }).flush({ loot: [] });
    const session = backend.expectOne({ method: 'POST', url: '/api/livre-d-or/bot-session' });
    expect(session.request.body).toEqual({ level: 'livre-d-or' });
    session.flush({ session: 'ba_admin=BREACH{x}' });
    await fixture.whenStable();

    expect(botView().querySelector('img[src="x"]')).not.toBeNull();
  });

  it('en mode sécurisé, le bot affiche le même message comme du texte, sans créer de balise', async () => {
    const { backend, clickBot, botView } = await setup('secure', [message(payload)]);

    clickBot();
    backend.expectOne({ method: 'DELETE', url: '/api/evil/collect' }).flush({ loot: [] });

    expect(botView().querySelector('img')).toBeNull();
    expect(botView().textContent).toContain(payload);
  });

  it('publie un message puis recharge la liste du livre d\'or', async () => {
    const { fixture, el, backend } = await setup('vulnerable', []);

    const textarea = el.querySelector('#gb-body') as HTMLTextAreaElement;
    textarea.value = 'Bonjour';
    textarea.dispatchEvent(new Event('input'));
    el.querySelector('[aria-labelledby="form-title"] form')?.dispatchEvent(new Event('submit'));

    const post = backend.expectOne({ method: 'POST', url: '/api/livre-d-or/messages' });
    expect(post.request.body).toEqual({ author: 'agent_42', body: 'Bonjour' });
    post.flush({ messages: [message('Bonjour')] });

    // La publication incrémente le compteur de rechargement : un nouveau GET est émis.
    TestBed.tick();
    backend.expectOne((r) => r.url === '/api/livre-d-or/messages' && r.method === 'GET').flush({ messages: [message('Bonjour')] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[aria-labelledby="messages-title"]')?.textContent).toContain('Bonjour');
  });
});
