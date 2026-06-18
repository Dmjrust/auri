/**
 * Smoke Tests — sem autenticação
 * Verificam que o bundle React carrega e os elementos básicos renderizam.
 * Devem passar em < 30s e não precisam de credenciais.
 */
import { test, expect } from '@playwright/test';

/** Navega para a tela de login a partir da landing page. */
async function goToLogin(page: any) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // A landing page tem múltiplos botões "Entrar" — clica o primeiro do nav
  const enterBtn = page.locator('button', { hasText: /^Entrar$/ }).first();
  if (await enterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enterBtn.click();
    await page.waitForTimeout(300); // aguarda transição de estado React
  }
}

test.describe('Smoke — Carregamento da SPA', () => {
  test('landing page carrega sem erros de JS', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Não deve ter erros críticos de JS (ResizeObserver é inócuo)
    expect(jsErrors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
    await expect(page).toHaveTitle(/.+/);
  });

  test('landing page exibe conteúdo da Auri', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Auri/i).first()).toBeVisible();
  });

  test('formulário de login é acessível após clicar Entrar', async ({ page }) => {
    await goToLogin(page);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Botão de submit dentro do form
    await expect(
      page.locator('button[type="submit"], button').filter({ hasText: /^Entrar$/ }).first()
    ).toBeVisible();
  });

  test('tentativa de login com credenciais inválidas exibe erro', async ({ page }) => {
    await goToLogin(page);
    await page.locator('input[type="email"]').fill('invalido@teste.com');
    await page.locator('input[type="password"]').fill('senhaerrada123');
    // Clica o botão de submit do formulário de login
    await page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /^Entrar$/ }).last()
    ).click();

    // Aguarda o botão de submit re-habilitar (indica que o request terminou)
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 12_000 });
    // A mensagem de erro específica do App.tsx
    await expect(
      page.getByText('E-mail ou senha incorretos.')
        .or(page.getByText(/Erro ao autenticar/i))
    ).toBeVisible({ timeout: 5_000 });

    // NÃO deve navegar para o dashboard
    await expect(
      page.getByText(/Bom dia|Boa tarde|Boa noite/i)
    ).not.toBeVisible();
  });

  test('não há erros de rede críticos no carregamento inicial', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', req => {
      if (!req.url().includes('sentry') && !req.url().includes('analytics')) {
        failedRequests.push(req.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const criticalFailures = failedRequests.filter(url =>
      url.endsWith('.js') || url.endsWith('.css')
    );
    expect(criticalFailures).toHaveLength(0);
  });
});
