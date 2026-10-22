import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import type { LevelMode, PublicLevel } from '../../../shared/level';
import { type RevealWindow, SearchLevel } from './search-level';

const revealWindow = window as RevealWindow;

const payload = '<img src="x" onerror="revealFlag()">';

function setup(mode: LevelMode, q: string | null) {
  const queryParamMap = new BehaviorSubject(convertToParamMap(q === null ? {} : { q }));
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap } },
    ],
  });
  const fixture = TestBed.createComponent(SearchLevel);
  fixture.componentRef.setInput('level', { id: 'recherche-bavarde' } as PublicLevel);
  fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();

  const backend = TestBed.inject(HttpTestingController);
  const el = fixture.nativeElement as HTMLElement;
  /** Répond à la recherche en cours comme le serveur : le terme est renvoyé tel quel. */
  const answerSearch = async () => {
    TestBed.tick();
    const request = backend.expectOne((r) => r.url === '/api/recherche-bavarde/articles');
    request.flush({ query: request.request.params.get('q') ?? '', articles: [] });
    await fixture.whenStable();
  };
  return { fixture, el, backend, answerSearch };
}

afterEach(() => delete revealWindow.revealFlag);

describe('SearchLevel', () => {
  it('en mode vulnérable, réinjecte le terme cherché comme du HTML : le payload crée une vraie balise', async () => {
    const { el, answerSearch } = setup('vulnerable', payload);
    await answerSearch();

    expect(el.querySelector('img[src="x"]')).not.toBeNull();
  });

  it('en mode sécurisé, affiche le même payload comme du texte, sans créer de balise', async () => {
    const { el, answerSearch } = setup('secure', payload);
    await answerSearch();

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain(payload);
  });

  it('expose window.revealFlag en mode vulnérable seulement, et affiche le flag renvoyé par le serveur', () => {
    const { fixture, el, backend } = setup('vulnerable', null);

    revealWindow.revealFlag?.();
    backend.expectOne({ method: 'POST', url: '/api/recherche-bavarde/reveal' }).flush({ flag: 'BREACH{un}' });
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('BREACH{un}');

    fixture.componentRef.setInput('mode', 'secure');
    fixture.detectChanges();
    expect(revealWindow.revealFlag).toBeUndefined();
  });

  it("place le terme cherché dans l'URL, ce qui rend le lien piégé partageable", () => {
    const { el } = setup('vulnerable', null);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const input = el.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = payload;
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { q: payload } }));
  });
});
