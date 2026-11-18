import { expect, type Page } from '@playwright/test';

export const LEVEL_1 = '/niveaux/recherche-bavarde';
export const LEVEL_2 = '/niveaux/livre-d-or';
export const XSS_PAYLOAD = '<img src=x onerror="revealFlag()">';

/** Bascule le mode du niveau via le sélecteur et attend la confirmation du serveur. */
export async function selectMode(page: Page, mode: 'Vulnérable' | 'Sécurisé'): Promise<void> {
  const button = page.getByRole('group', { name: 'Mode du niveau' }).getByRole('button', { name: mode });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/** Soumet un flag dans le formulaire du niveau. */
export async function submitFlag(page: Page, flag: string): Promise<void> {
  await page.getByLabel('Soumettre le flag').fill(flag);
  await page.getByRole('button', { name: 'Valider' }).click();
}

/** Exploite la XSS réfléchie du niveau 1 et renvoie le flag affiché par la page. */
export async function exploitLevel1(page: Page): Promise<string> {
  await page.goto(`${LEVEL_1}?q=${encodeURIComponent(XSS_PAYLOAD)}`);
  const flag = page.locator('code', { hasText: 'BREACH{' });
  await expect(flag).toBeVisible();
  return (await flag.textContent())!.trim();
}
