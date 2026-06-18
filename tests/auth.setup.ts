import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/doctor.json');

setup('doctor login', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_EMAIL e TEST_PASSWORD devem estar definidos.\n' +
      'Copie .env.test.example para .env.test e preencha as credenciais.'
    );
  }

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Clica em "Entrar" na landing page
  const enterBtn = page.locator('button', { hasText: /^Entrar$/ }).first();
  if (await enterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enterBtn.click();
    await page.waitForTimeout(300);
  }

  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Aguarda o dashboard (greeting personalizado)
  await expect(
    page.getByText(/Bom dia|Boa tarde|Boa noite/i)
  ).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
