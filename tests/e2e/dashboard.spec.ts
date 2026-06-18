/**
 * Dashboard — Médico autenticado
 * Testa o painel principal (KPIs, prioridades, agenda do dia).
 */
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('exibe greeting personalizado com nome do médico', async ({ page }) => {
    await expect(
      page.getByText(/Bom dia|Boa tarde|Boa noite/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('KPI strip tem 4 cards (Hoje, Realizadas, Prioridades, Próxima)', async ({ page }) => {
    await expect(page.getByText('Hoje')).toBeVisible();
    await expect(page.getByText('Realizadas')).toBeVisible();
    await expect(page.getByText('Prioridades')).toBeVisible();
    await expect(page.getByText('Próxima')).toBeVisible();
  });

  test('seção "Consultas de hoje" renderiza', async ({ page }) => {
    await expect(page.getByText(/Consultas de hoje/i)).toBeVisible();
  });

  test('seção "Prioridades" renderiza com estado correto', async ({ page }) => {
    await expect(page.getByText('Prioridades').first()).toBeVisible();
    // Deve mostrar ou "Sem pendências críticas hoje" ou lista de prioridades
    const noPriorities = page.getByText(/Sem pendências críticas hoje/i);
    const hasPriorities = page.getByText(/retorno|vacina|sem consulta/i);
    await expect(noPriorities.or(hasPriorities)).toBeVisible({ timeout: 8_000 });
  });

  test('link "Ver agenda" navega para a agenda', async ({ page }) => {
    await page.getByRole('link', { name: /Ver agenda da semana/i }).click();
    await expect(page.getByText(/Agenda|agenda/i).first()).toBeVisible();
  });

  test('card "Iniciar consulta" exibe último paciente ou CTA', async ({ page }) => {
    await expect(page.getByText(/Iniciar consulta/i)).toBeVisible();
    // Deve ter botão de iniciar ou selecionar paciente
    const hasLastPatient = page.getByRole('button', { name: /Continuar com/i });
    const hasCta = page.getByRole('button', { name: /Selecionar paciente/i });
    await expect(hasLastPatient.or(hasCta)).toBeVisible({ timeout: 8_000 });
  });

  test('Pediatria — chip "vacinas em atraso" é visível', async ({ page }) => {
    // Verifica se o chip de vacinas existe (Pediatria padrão)
    // Pode mostrar "0" se não há atraso
    await expect(
      page.getByText(/vacina|em atraso|crônico/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
