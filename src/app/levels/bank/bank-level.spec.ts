import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { AccountResponse } from '../../../shared/bank';
import type { LevelMode, PublicLevel } from '../../../shared/level';
import { BankLevel } from './bank-level';

async function setup(mode: LevelMode, account: AccountResponse = { solde: 1000, historique: [] }) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(BankLevel);
  fixture.componentRef.setInput('level', { id: 'virement-fantome' } as PublicLevel);
  fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();

  const backend = TestBed.inject(HttpTestingController);
  TestBed.tick();
  backend.expectOne((r) => r.url === '/api/virement-fantome/compte').flush(account);
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, el: fixture.nativeElement as HTMLElement, backend };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('BankLevel', () => {
  it('affiche le flag quand le compte a subi un virement frauduleux', async () => {
    const { el } = await setup('vulnerable', {
      solde: 500,
      historique: [{ beneficiaire: 'PIRATE_CSRF', montant: 500, date: '2026-01-01T00:00:00Z', frauduleux: true }],
      flag: 'BREACH{virement}',
    });

    expect(el.textContent).toContain('BREACH{virement}');
    expect(el.textContent).toContain('⚠ frauduleux');
  });

  it('envoie un virement légitime en POST puis rafraîchit le compte', async () => {
    const { el, backend } = await setup('vulnerable');

    (el.querySelector('#virement-title ~ * input') as HTMLInputElement).value = 'Alice';
    el.querySelector('#virement-title ~ * input')!.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    const post = backend.expectOne({ method: 'POST', url: '/api/virement-fantome/virement' });
    expect(post.request.body).toMatchObject({ beneficiaire: 'Alice' });
    post.flush({ recu: { beneficiaire: 'Alice', montant: 100, date: '', frauduleux: false }, solde: 900 });
    TestBed.tick();

    // Le rafraîchissement relance une lecture du compte.
    backend.expectOne((r) => r.url === '/api/virement-fantome/compte').flush({ solde: 900, historique: [] });
  });

  it('en mode sécurisé, la fiche des tests passe au vert', async () => {
    const { el } = await setup('secure');

    expect(el.querySelector('[aria-labelledby="tests-title"]')?.textContent).not.toContain('FAIL');
  });
});
