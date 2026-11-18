import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { exploitLevel1, LEVEL_1, LEVEL_2, selectMode, submitFlag } from './helpers';

/** Règles axe des niveaux A et AA, jusqu'à WCAG 2.2 (cible du projet). */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  // Message lisible en cas d'échec : règle, gravité et premiers éléments fautifs.
  const summary = violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary).toEqual([]);
}

test.describe('Accessibilité WCAG 2.2 AA (axe-core)', () => {
  for (const route of ['/', '/classement', '/classement/ssr', '/classement/csr', '/fiches', '/fiches/csrf', '/page-inexistante']) {
    test(`page ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await expectNoViolations(page);
    });
  }

  test('niveau 1, dans les deux modes et après une capture', async ({ page }) => {
    await page.goto(LEVEL_1);
    await expectNoViolations(page);

    await selectMode(page, 'Sécurisé');
    await expectNoViolations(page);

    await selectMode(page, 'Vulnérable');
    await submitFlag(page, await exploitLevel1(page));
    await expect(page.getByText('Flag capturé ! Niveau validé.')).toBeVisible();
    // Recharger sans le payload : son `<img src=x>` est le contenu de l'attaquant,
    // pas un défaut du site. On vérifie l'état « niveau réussi ».
    await page.goto(LEVEL_1);
    await expect(page.getByText('Niveau suivant déverrouillé')).toBeVisible();
    await expectNoViolations(page);
  });

  test('niveau 2 (livre d’or)', async ({ page }) => {
    await submitFlag(page, await exploitLevel1(page));
    await expect(page.getByText('Flag capturé ! Niveau validé.')).toBeVisible();

    await page.goto(LEVEL_2);
    await expect(page.getByRole('heading', { name: 'Laisser un message' })).toBeVisible();
    await expectNoViolations(page);
  });
});
