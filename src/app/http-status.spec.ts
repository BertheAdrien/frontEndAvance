import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RESPONSE } from '@analogjs/router/tokens';

import { injectHttpStatus } from './http-status';

function setup(response?: { statusCode: number; setHeader: ReturnType<typeof vi.fn> }) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), ...(response ? [{ provide: RESPONSE, useValue: response }] : [])],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  return { status: TestBed.runInInjectionContext(injectHttpStatus), navigate };
}

describe('injectHttpStatus', () => {
  it('renvoie un vrai code 404 pendant le rendu serveur', () => {
    const response = { statusCode: 200, setHeader: vi.fn() };

    setup(response).status.notFound();

    expect(response.statusCode).toBe(404);
  });

  it('redirige par une réponse HTTP 302 pendant le rendu serveur', () => {
    const response = { statusCode: 200, setHeader: vi.fn() };
    const { status, navigate } = setup(response);

    status.redirect('/');

    expect(response.statusCode).toBe(302);
    expect(response.setHeader).toHaveBeenCalledWith('Location', '/');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirige par le routeur dans le navigateur, sans garder la page dans l’historique', () => {
    const { status, navigate } = setup();

    status.redirect('/');

    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
