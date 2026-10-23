import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PseudonymForm } from './pseudonym-form';

function setup(current: string | null = null) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(PseudonymForm);
  fixture.componentRef.setInput('current', current);
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  const submit = (value: string) => {
    const input = el.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const message = () => {
    fixture.detectChanges();
    return el.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  };
  return { backend: TestBed.inject(HttpTestingController), submit, message, el };
}

describe('PseudonymForm', () => {
  it('pré-remplit le pseudonyme actuel du joueur', () => {
    const { el } = setup('alice');
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('alice');
  });

  it('envoie le pseudonyme sans espaces autour et confirme', () => {
    const { backend, submit, message } = setup();
    submit('  alice_42 ');

    const request = backend.expectOne('/api/classement/pseudo');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ pseudonym: 'alice_42' });
    request.flush({ pseudonym: 'alice_42' });

    expect(message()).toContain('alice_42');
  });

  it("refuse un pseudonyme invalide sans appeler l'API", () => {
    const { backend, submit, message } = setup();
    submit('<b>x</b>');

    backend.expectNone('/api/classement/pseudo');
    expect(message()).toContain('3 à 20');
  });

  it('signale un pseudonyme déjà pris (409)', () => {
    const { backend, submit, message } = setup();
    submit('alice');
    backend.expectOne('/api/classement/pseudo').flush(null, { status: 409, statusText: 'Conflict' });

    expect(message()).toContain('déjà pris');
  });
});
