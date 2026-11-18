import { expect, test } from '@playwright/test';

import { exploitLevel1, LEVEL_1, LEVEL_2, submitFlag } from './helpers';

test.describe('Parcours joueur', () => {
  test("un nouveau joueur ne peut ouvrir que le premier niveau", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Le moteur de recherche bavard/ })).toBeVisible();

    // Niveau 2 encore verrouillé : accès direct refusé, retour à l'accueil.
    await page.goto(LEVEL_2);
    await expect(page).not.toHaveURL(new RegExp(`${LEVEL_2}$`));
  });

  test('capturer le flag du niveau 1 déverrouille le niveau 2', async ({ page }) => {
    const flag = await exploitLevel1(page);
    expect(flag).toMatch(/^BREACH\{recherche_bavarde_[0-9a-f]+\}$/);

    await submitFlag(page, flag);
    await expect(page.getByText('Flag capturé ! Niveau validé.')).toBeVisible();

    await page.getByRole('link', { name: "Le livre d'or" }).click();
    await expect(page).toHaveURL(new RegExp(`${LEVEL_2}$`));
    await expect(page.getByRole('heading', { name: 'Laisser un message' })).toBeVisible();
  });

  test('un faux flag est refusé et ne déverrouille rien', async ({ page }) => {
    await page.goto(LEVEL_1);
    await submitFlag(page, 'BREACH{recherche_bavarde_0000}');
    await expect(page.getByText('Flag incorrect. Vérifiez votre saisie et réessayez.')).toBeVisible();

    await page.goto(LEVEL_2);
    await expect(page).not.toHaveURL(new RegExp(`${LEVEL_2}$`));
  });
});
