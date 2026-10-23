import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { PublicLevel } from '../../shared/level';
import { FlagForm } from './flag-form';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(FlagForm);
  fixture.componentRef.setInput('levelId', 'recherche-bavarde');
  const captured: PublicLevel[][] = [];
  fixture.componentInstance.captured.subscribe((levels) => captured.push(levels));
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  const submit = (flag: string) => {
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = flag;
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const message = () => {
    fixture.detectChanges();
    return el.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  };

  const changeLevel = (levelId: string) => {
    fixture.componentRef.setInput('levelId', levelId);
    fixture.detectChanges();
  };
  const inputValue = () => (el.querySelector('input') as HTMLInputElement).value;

  return { backend: TestBed.inject(HttpTestingController), submit, message, captured, changeLevel, inputValue };
}

describe('FlagForm', () => {
  it('envoie le flag au niveau courant et transmet la progression mise à jour une fois capturé', () => {
    const { backend, submit, message, captured } = setup();
    const levels = [{ id: 'recherche-bavarde', status: 'captured' }] as PublicLevel[];

    submit('BREACH{abc}');
    const request = backend.expectOne('/api/levels/recherche-bavarde/flag');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ flag: 'BREACH{abc}' });
    request.flush({ result: 'captured', levels });

    expect(message()).toContain('Flag capturé');
    expect(captured).toEqual([levels]);
  });

  it('annonce un flag incorrect sans signaler de capture', () => {
    const { backend, submit, message, captured } = setup();

    submit('BREACH{faux}');
    backend.expectOne('/api/levels/recherche-bavarde/flag').flush({ result: 'wrong', levels: [] });

    expect(message()).toContain('Flag incorrect');
    expect(captured).toEqual([]);
  });

  it('indique combien de temps attendre quand le serveur limite les tentatives', () => {
    const { backend, submit, message } = setup();

    submit('BREACH{x}');
    backend
      .expectOne('/api/levels/recherche-bavarde/flag')
      .flush(null, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '42' } });

    expect(message()).toContain('42 s');
  });

  it('repart d\'un champ et d\'un message vides quand on passe au niveau suivant', () => {
    const { backend, submit, message, changeLevel, inputValue } = setup();
    submit('BREACH{abc}');
    backend.expectOne('/api/levels/recherche-bavarde/flag').flush({ result: 'captured', levels: [] });

    changeLevel('livre-d-or');

    expect(inputValue()).toBe('');
    expect(message()).toBe('');
  });

  it("n'envoie rien quand le champ est vide", () => {
    const { backend, submit } = setup();

    submit('   ');

    backend.expectNone('/api/levels/recherche-bavarde/flag');
  });
});
