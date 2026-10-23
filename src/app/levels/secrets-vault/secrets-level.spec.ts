import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { LevelMode, PublicLevel } from '../../../shared/level';
import type { GitHistoryResponse, VaultConfigResponse } from '../../../shared/secrets-vault';
import { SecretsLevel } from './secrets-level';

const FLAG = 'BREACH{coffre}';

const vulnerableConfig: VaultConfigResponse = {
  config: { appName: 'Breach Academy', apiBaseUrl: '/api', features: { leaderboard: true, push: true }, analyticsKey: FLAG },
  leaked: true,
};
const secureConfig: VaultConfigResponse = {
  config: { appName: 'Breach Academy', apiBaseUrl: '/api', features: { leaderboard: true, push: true } },
  leaked: false,
};
const vulnerableHistory: GitHistoryResponse = {
  commits: [{ hash: 'a1b2c3d', author: 'dev', date: '2026-01-12', subject: 'Ajout clé', diff: [`+  analyticsKey: '${FLAG}',`] }],
  gitleaks: { rule: 'generic-api-key', commit: 'a1b2c3d', file: 'src/environments/environment.ts', secret: FLAG },
  leaked: true,
};
const secureHistory: GitHistoryResponse = {
  commits: [{ hash: '7c0ffee', author: 'dev', date: '2026-01-12', subject: 'Via env', diff: ["+export const analyticsKey = process.env['ANALYTICS_KEY'];"] }],
  gitleaks: null,
  leaked: false,
};

async function setup(mode: LevelMode, config: VaultConfigResponse, history: GitHistoryResponse) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SecretsLevel);
  fixture.componentRef.setInput('level', { id: 'coffre-qui-fuit' } as PublicLevel);
  fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();

  const backend = TestBed.inject(HttpTestingController);
  TestBed.tick();
  backend.expectOne((r) => r.url === '/api/coffre-qui-fuit/config').flush(config);
  backend.expectOne((r) => r.url === '/api/coffre-qui-fuit/historique-git').flush(history);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, backend, el: fixture.nativeElement as HTMLElement };
}

describe('SecretsLevel', () => {
  it('en mode vulnérable, affiche la clé fuitée du bundle et le secret retrouvé par gitleaks', async () => {
    const { el } = await setup('vulnerable', vulnerableConfig, vulnerableHistory);

    expect(el.textContent).toContain(FLAG);
    expect(el.textContent).toContain('generic-api-key');
  });

  it('en mode sécurisé, n\'affiche aucun flag et signale que le coffre est fermé', async () => {
    const { el } = await setup('secure', secureConfig, secureHistory);

    expect(el.textContent).not.toContain('BREACH{');
    expect(el.textContent).toContain('aucune clé');
  });

  it('recharge les deux fuites quand le joueur bascule de mode, sans recharger la page', async () => {
    const { fixture, backend, el } = await setup('vulnerable', vulnerableConfig, vulnerableHistory);

    fixture.componentRef.setInput('mode', 'secure');
    TestBed.tick();
    backend.expectOne((r) => r.url === '/api/coffre-qui-fuit/config').flush(secureConfig);
    backend.expectOne((r) => r.url === '/api/coffre-qui-fuit/historique-git').flush(secureHistory);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).not.toContain('BREACH{');
  });
});
