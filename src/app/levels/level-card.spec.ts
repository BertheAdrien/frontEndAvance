import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PublicLevel } from '../../shared/level';
import { LevelCard } from './level-card';

const level = (status: PublicLevel['status']): PublicLevel => ({
  id: 'virement-fantome',
  order: 4,
  theme: 'CSRF',
  title: 'Le virement fantôme',
  summary: 'Résumé',
  story: '',
  status,
});

function render(status: PublicLevel['status']): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LevelCard);
  fixture.componentRef.setInput('level', level(status));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('LevelCard', () => {
  it("n'offre aucun lien vers un niveau verrouillé et explique comment le débloquer", () => {
    const el = render('locked');

    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('Capturez le flag du niveau 3 pour déverrouiller');
  });

  it('propose un lien vers la page du niveau quand il est disponible', () => {
    const el = render('available');

    expect(el.querySelector('a')?.getAttribute('href')).toBe('/niveaux/virement-fantome');
  });
});
