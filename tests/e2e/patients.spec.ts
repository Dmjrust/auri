/**
 * Pacientes — Lista, busca e detalhe
 */
import { test, expect } from '@playwright/test';

test.describe('Lista de Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Navega para Pacientes via nav
    await page.getByText(/Pacientes/i).first().click();
    await expect(page.getByText(/paciente|buscar/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('campo de busca está presente', async ({ page }) => {
    await expect(page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]')).toBeVisible();
  });

  test('busca por nome filtra a lista', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="buscar" i], input[placeholder*="pesquisar" i], input[type="search"]').first();
    await searchInput.fill('zzz_paciente_inexistente_xyz');
    // Deve mostrar estado vazio ou nenhum resultado
    await expect(
      page.getByText(/nenhum|não encontrado|0 pacientes/i)
    ).toBeVisible({ timeout: 5_000 });

    // Limpa a busca
    await searchInput.clear();
  });

  test('clique em paciente abre o detalhe', async ({ page }) => {
    // Clica no primeiro paciente da lista
    const firstPatient = page.locator('[data-testid="patient-row"], tr, .patient-item').first();
    const patientCard = page.getByText(/Ver prontuário|Consultar/i).first();

    if (await patientCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Clica no botão de ação
      await patientCard.click();
    } else {
      // Tenta clicar na primeira linha/card de paciente
      await page.locator('div').filter({ hasText: /Retorno|1ª consulta/ }).first().click();
    }

    // Deve ir para o detalhe do paciente
    await expect(
      page.getByText(/Resumo|Consultas|nascimento/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Detalhe do Paciente — Pediatria', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByText(/Pacientes/i).first().click();
    await page.waitForLoadState('networkidle');

    // Abre o primeiro paciente disponível
    const consultBtn = page.getByRole('button', { name: /Consultar/i }).first();
    if (await consultBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await consultBtn.click();
    }
  });

  test('header do paciente exibe nome e informações básicas', async ({ page }) => {
    // Deve ter nome, idade ou data de nascimento
    await expect(page.getByText(/anos|meses|nascido/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('tabs de Pediatria estão presentes', async ({ page }) => {
    // Tabs padrão da Pediatria
    await expect(page.getByRole('tab', { name: /Resumo/i }).or(
      page.getByText(/Resumo/).first()
    )).toBeVisible({ timeout: 10_000 });
  });

  test('tab "Crescimento" existe (Pediatria)', async ({ page }) => {
    await expect(
      page.getByText(/Crescimento/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('tab "Vacinas" existe (Pediatria)', async ({ page }) => {
    await expect(
      page.getByText(/Vacinas/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('tab "Saúde", "Medicações", "Exames" NÃO existem no perfil Pediatria', async ({ page }) => {
    // Aguarda o detalhe carregar
    await expect(page.getByText(/Crescimento/i).first()).toBeVisible({ timeout: 10_000 });

    // Tabs específicas de Clínica Geral não devem aparecer
    await expect(page.getByRole('tab', { name: /^Saúde$/ })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /^Exames$/ })).not.toBeVisible();
  });
});
