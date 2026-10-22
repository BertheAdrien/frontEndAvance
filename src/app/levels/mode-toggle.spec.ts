import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { LevelMode } from '../../shared/level';
import { ModeToggle } from './mode-toggle';

function setup(mode: LevelMode) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(ModeToggle);
  fixture.componentRef.setInput('mode', mode);
  const changes: LevelMode[] = [];
  fixture.componentInstance.modeChange.subscribe((m) => changes.push(m));
  fixture.detectChanges();

  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

  return { fixture, el, button, changes, backend: TestBed.inject(HttpTestingController) };
}

describe('ModeToggle', () => {
  it('indique le mode actif aux technologies d’assistance', () => {
    const { button } = setup('vulnerable');

    expect(button('Vulnérable').getAttribute('aria-pressed')).toBe('true');
    expect(button('Sécurisé').getAttribute('aria-pressed')).toBe('false');
  });

  it('mémorise le nouveau mode côté serveur avant de le signaler à la page', () => {
    const { button, backend, changes } = setup('vulnerable');

    button('Sécurisé').click();
    const request = backend.expectOne('/api/mode');
    expect(request.request.body).toEqual({ mode: 'secure' });
    expect(changes).toEqual([]);

    request.flush({ mode: 'secure' });
    expect(changes).toEqual(['secure']);
  });

  it('conserve le mode courant et le signale si le serveur refuse le changement', () => {
    const { fixture, el, button, backend, changes } = setup('secure');

    button('Vulnérable').click();
    backend.expectOne('/api/mode').flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(changes).toEqual([]);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Impossible');
  });
});
