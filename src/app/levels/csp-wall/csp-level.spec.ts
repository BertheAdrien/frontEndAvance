import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { CspStateResponse, ViolationsResponse } from '../../../shared/csp-wall';
import type { LevelMode, PublicLevel } from '../../../shared/level';
import { CspLevel } from './csp-level';

const state: CspStateResponse = { csp: 'none', header: null };

async function setup(mode: LevelMode, violations: ViolationsResponse = { violations: [] }) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(CspLevel);
  // La CSP ne s'applique qu'au chargement de la page : on intercepte le rechargement.
  const reload = vi.spyOn(fixture.componentInstance as unknown as { reloadPage(): void }, 'reloadPage').mockImplementation(() => {});
  fixture.componentRef.setInput('level', { id: 'mur-invisible' } as PublicLevel);
  fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();

  const backend = TestBed.inject(HttpTestingController);
  TestBed.tick();
  backend.expectOne('/api/mur-invisible/csp').flush(state);
  backend.expectOne((r) => r.url === '/api/mur-invisible/violations').flush(violations);
  backend.expectOne((r) => r.url === '/api/livre-d-or/messages').flush({ messages: [] });
  await fixture.whenStable();
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  const cspButton = (label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[aria-labelledby="csp-choice-label"] button')].find((b) =>
      b.textContent?.includes(label),
    )!;
  return { fixture, el, backend, reload, cspButton };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('CspLevel', () => {
  it('enregistre la CSP choisie puis recharge la page pour que le nouvel en-tête s\'applique', async () => {
    const { fixture, backend, reload, cspButton } = await setup('vulnerable');

    cspButton('Bloquante').click();
    const post = backend.expectOne({ method: 'POST', url: '/api/mur-invisible/csp' });
    expect(post.request.body).toEqual({ csp: 'enforce' });
    expect(reload).not.toHaveBeenCalled();

    post.flush({ csp: 'enforce' });
    await fixture.whenStable();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('affiche les violations reçues par le serveur et le flag débloqué', async () => {
    const { el } = await setup('vulnerable', {
      violations: [{ disposition: 'enforce', directive: 'script-src-attr', blockedUri: 'inline' }],
      flag: 'BREACH{mur}',
    });

    const console = el.querySelector('[aria-labelledby="violations-title"]')?.textContent ?? '';
    expect(console).toContain('script-src-attr');
    expect(console).toContain('BREACH{mur}');
  });

  it('en mode sécurisé, la CSP est imposée : le joueur ne peut pas la désactiver', async () => {
    const { cspButton } = await setup('secure');

    expect(cspButton('Aucune').disabled).toBe(true);
  });
});
