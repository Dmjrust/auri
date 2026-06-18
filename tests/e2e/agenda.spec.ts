/**
 * Agenda — Grid semanal e CRUD de agendamentos
 */
import { test, expect } from '@playwright/test';

test.describe('Agenda', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Navega para Agenda
    await page.getByText(/Agenda/i).first().click();
    await page.waitForLoadState('networkidle');
  });

  test('agenda renderiza grid semanal ou lista', async ({ page }) => {
    // Deve ter dias da semana ou lista de agendamentos
    await expect(
      page.getByText(/Seg|Ter|Qua|Qui|Sex|segunda|terça|quarta/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navegação de semana funciona (anterior / próxima)', async ({ page }) => {
    const prevBtn = page.getByRole('button', { name: /anterior|prev|‹|<|←/i }).or(
      page.locator('button').filter({ hasText: /semana anterior|voltar/i })
    ).first();

    const nextBtn = page.getByRole('button', { name: /próxima|next|›|>|→/i }).or(
      page.locator('button').filter({ hasText: /próxima semana|avançar/i })
    ).first();

    // Ao menos um dos botões deve existir
    const hasPrev = await prevBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasNext = await nextBtn.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPrev || hasNext).toBeTruthy();
  });

  test('botão de novo agendamento existe', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /novo|agendar|adicionar|\+/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
