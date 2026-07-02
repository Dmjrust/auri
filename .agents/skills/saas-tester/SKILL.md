---
name: saas-tester
description: SaaS E2E Testing Expert — simula a jornada real de um assinante do SaaS usando Playwright (padrão) ou Cypress. Use esta skill SEMPRE que o usuário quiser: escrever testes E2E, testar fluxo de signup/login/upgrade/pagamento, simular assinantes, testar multi-tenancy, testar RBAC por plano, configurar CI para testes, criar suíte de testes para SaaS, ou qualquer tarefa envolvendo Playwright, Cypress, testes de assinatura Stripe, ou validação de fluxos de usuário em produtos SaaS. Ativa também para: "quero testar meu SaaS", "como garantir que o fluxo de pagamento funciona", "testar como admin vs membro", "smoke test antes de deploy".
---

# SaaS Tester — Simulando a Realidade do Assinante

Você é um Engenheiro de Qualidade especialista em E2E Testing para produtos SaaS. Seu objetivo é simular o que um assinante real experimenta — desde o primeiro clique até o uso diário, pagamento e cancelamento.

**Stack padrão:** Playwright (Node.js + CDP, multi-browser, parallelização gratuita, 33M downloads/semana)
**Alternativa:** Cypress (melhor DX local, debugging visual, ideal para Chrome-only)

---

## Quando usar cada um

| Situação | Use |
|---|---|
| Novo projeto, CI/CD, multi-browser | **Playwright** |
| Debugging visual local, time-travel | **Cypress** |
| Projeto já usa Cypress | **Cypress** |
| Next.js + Vercel + GitHub Actions | **Playwright** |
| Equipe prefere DX simples | **Cypress** |

---

## A Jornada do Assinante (O que testar)

Todo SaaS tem estes momentos críticos na vida do assinante. Cubra-os nesta ordem:

```
1. DESCOBERTA    → Landing page, pricing, CTA
2. ONBOARDING    → Signup, confirmação de email, primeiro acesso
3. ATIVAÇÃO      → Completar primeira ação de valor (o "aha moment")
4. UPGRADE       → Checkout, pagamento Stripe, ativação do plano
5. USO DIÁRIO    → Login recorrente, features por plano, RBAC
6. MULTI-TENANT  → Convidar membros, troca de org, isolamento de dados
7. RETENÇÃO      → Segundo acesso, notificações, valor entregue
8. OFFBOARDING   → Cancelamento, downgrade, exportação de dados
```

---

## Setup Inicial

### Playwright (Recomendado)

```bash
# Instalar no projeto
npm init playwright@latest

# Instala browsers
npx playwright install --with-deps

# Estrutura gerada
playwright.config.ts
tests/
  auth.setup.ts      # Login compartilhado
  e2e/               # Testes por jornada
playwright/.auth/    # Sessions salvas (adicionar ao .gitignore)
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : '50%',
  timeout: 30_000,

  reporter: [
    ['html'],
    ...(process.env.CI ? [['github'] as any] : []),
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Setup: roda login antes dos testes
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // Testes com usuário free (sem assinatura)
    {
      name: 'free-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/free-user.json',
      },
      dependencies: ['setup'],
    },

    // Testes com assinante ativo
    {
      name: 'subscriber',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/subscriber.json',
      },
      dependencies: ['setup'],
    },

    // Testes com admin da organização
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Cypress (Alternativa)

```bash
npm install --save-dev cypress
npx cypress open
```

```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    defaultCommandTimeout: 8000,
    viewportWidth: 1280,
    viewportHeight: 720,
    env: {
      FREE_USER_EMAIL: 'free@test.com',
      FREE_USER_PASSWORD: 'password123',
      SUBSCRIBER_EMAIL: 'subscriber@test.com',
      SUBSCRIBER_PASSWORD: 'password123',
    },
  },
});
```

---

## Padrão de Auth Compartilhada (Setup uma vez, reutiliza em todos os testes)

### Playwright

```typescript
// tests/auth.setup.ts
import { test as setup } from '@playwright/test';
import path from 'path';

const authDir = path.join(__dirname, '../playwright/.auth');

// Usuário free (sem assinatura)
setup('free user auth', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.FREE_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.FREE_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: `${authDir}/free-user.json` });
});

// Assinante ativo (plano pago)
setup('subscriber auth', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.SUBSCRIBER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.SUBSCRIBER_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: `${authDir}/subscriber.json` });
});

// Admin da organização
setup('admin auth', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL!);
  await page.getByLabel('Password').fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: `${authDir}/admin.json` });
});
```

### Cypress

```javascript
// cypress/support/commands.js
Cypress.Commands.add('loginAs', (role = 'free') => {
  const credentials = {
    free:       { email: Cypress.env('FREE_USER_EMAIL'),       password: Cypress.env('FREE_USER_PASSWORD') },
    subscriber: { email: Cypress.env('SUBSCRIBER_EMAIL'),      password: Cypress.env('SUBSCRIBER_PASSWORD') },
    admin:      { email: Cypress.env('ADMIN_EMAIL'),           password: Cypress.env('ADMIN_PASSWORD') },
  };

  const { email, password } = credentials[role];

  cy.session(`login-${role}`, () => {
    cy.visit('/login');
    cy.get('[name="email"]').type(email);
    cy.get('[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

---

## Testes por Jornada

### 1. ONBOARDING — Signup e Primeiro Acesso

```typescript
// tests/e2e/onboarding.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test('signup completo — novo usuário chega ao dashboard', async ({ page }) => {
    const email = `test+${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('SecurePass123!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Após signup, deve ir para dashboard ou confirmação
    await expect(page).toHaveURL(/dashboard|verify-email/);
  });

  test('usuário sem assinatura vê CTA de upgrade', async ({ page }) => {
    // Usa storageState do free-user (configurado no playwright.config.ts)
    await page.goto('/dashboard');
    await expect(page.getByText(/upgrade|plano free|limite/i)).toBeVisible();
  });
});
```

```javascript
// cypress/e2e/onboarding.cy.js
describe('Onboarding', () => {
  it('novo usuário consegue fazer signup', () => {
    const email = `test+${Date.now()}@example.com`;

    cy.visit('/signup');
    cy.get('[name="name"]').type('Test User');
    cy.get('[name="email"]').type(email);
    cy.get('[name="password"]').type('SecurePass123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('match', /dashboard|verify-email/);
  });
});
```

---

### 2. UPGRADE — Checkout e Ativação do Plano

```typescript
// tests/e2e/upgrade.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Upgrade Flow', () => {
  // Este teste roda como free-user (sem assinatura)
  test.use({ storageState: 'playwright/.auth/free-user.json' });

  test('free user consegue iniciar checkout', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('button', { name: /upgrade|assinar|subscribe/i }).first().click();
    // Verifica redirecionamento para checkout (Stripe ou interno)
    await expect(page).toHaveURL(/checkout|stripe\.com/);
  });

  test('checkout com cartão de teste Stripe', async ({ page }) => {
    await page.goto('/checkout');

    // Preenche dados básicos
    await page.getByLabel('Email').fill('test@example.com');

    // Stripe Elements roda em iframe — aguarda carregar
    const stripeFrame = page.frameLocator('iframe[name*="privateStripeFrame"], iframe[title*="Secure card"]').first();
    await stripeFrame.getByPlaceholder('Card number').fill('4242424242424242');
    await stripeFrame.getByPlaceholder('MM / YY').fill('12/28');
    await stripeFrame.getByPlaceholder('CVC').fill('123');

    await page.getByRole('button', { name: /pay|assinar|subscribe/i }).click();

    // Aguarda confirmação
    await page.waitForURL(/success|dashboard/, { timeout: 15_000 });
    await expect(page.getByText(/ativo|activated|subscribed/i)).toBeVisible();
  });

  test('cartão recusado exibe erro claro', async ({ page }) => {
    await page.goto('/checkout');

    const stripeFrame = page.frameLocator('iframe[title*="Secure card"]').first();
    // Stripe test card que sempre declina
    await stripeFrame.getByPlaceholder('Card number').fill('4000000000000002');
    await stripeFrame.getByPlaceholder('MM / YY').fill('12/28');
    await stripeFrame.getByPlaceholder('CVC').fill('123');

    await page.getByRole('button', { name: /pay|assinar/i }).click();

    await expect(page.getByText(/declined|recusado|falhou/i)).toBeVisible();
    // Não redirecionou
    await expect(page).toHaveURL(/checkout/);
  });
});
```

```javascript
// cypress/e2e/upgrade.cy.js
describe('Upgrade Flow', () => {
  beforeEach(() => {
    cy.loginAs('free');
  });

  it('free user vê pricing e inicia upgrade', () => {
    cy.visit('/pricing');
    cy.get('button').contains(/upgrade|assinar/i).first().click();
    cy.url().should('match', /checkout|stripe/);
  });

  it('mock Stripe — simula pagamento aprovado', () => {
    // Intercepta API do backend antes de chamar Stripe
    cy.intercept('POST', '/api/create-checkout-session', {
      statusCode: 200,
      body: { url: '/checkout/success?session_id=test_session_123' },
    }).as('createSession');

    cy.visit('/pricing');
    cy.get('button').contains(/upgrade/i).first().click();
    cy.wait('@createSession');
    cy.url().should('include', '/checkout/success');
    cy.get('body').should('contain.text', /ativo|activated/i);
  });

  it('mock Stripe — simula pagamento recusado', () => {
    cy.intercept('POST', '/api/process-payment', {
      statusCode: 402,
      body: { error: 'card_declined', message: 'Your card was declined.' },
    }).as('failPayment');

    cy.visit('/checkout');
    cy.get('button[type="submit"]').click();
    cy.wait('@failPayment');
    cy.get('.error-message, [data-testid="payment-error"]')
      .should('contain.text', /declined|recusado/i);
  });
});
```

---

### 3. USO DIÁRIO — Features por Plano (RBAC)

```typescript
// tests/e2e/feature-gating.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

// Free user — funcionalidades limitadas
test.describe('Free User — Limitações', () => {
  test.use({ storageState: 'playwright/.auth/free-user.json' });

  test('não acessa features premium', async ({ page }) => {
    await page.goto('/features/premium-report');
    // Deve redirecionar ou mostrar paywall
    await expect(page.getByText(/upgrade|premium|assine/i)).toBeVisible();
  });

  test('vê limite de uso (ex: máx 5 registros)', async ({ page }) => {
    await page.goto('/dashboard');
    const limitBanner = page.getByTestId('usage-limit-banner');
    // Depende da lógica do SaaS — adapte ao seu caso
    if (await limitBanner.isVisible()) {
      await expect(limitBanner).toContainText(/limite|limit/i);
    }
  });
});

// Assinante ativo — acesso completo
test.describe('Subscriber — Acesso Completo', () => {
  test.use({ storageState: 'playwright/.auth/subscriber.json' });

  test('acessa features premium sem bloqueio', async ({ page }) => {
    await page.goto('/features/premium-report');
    await expect(page).toHaveURL('/features/premium-report');
    await expect(page.getByText(/upgrade|paywall/i)).not.toBeVisible();
  });

  test('não vê banner de limite', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('usage-limit-banner')).not.toBeVisible();
  });
});
```

```javascript
// cypress/e2e/feature-gating.cy.js
describe('Feature Gating por Plano', () => {
  it('free user é bloqueado de features premium', () => {
    cy.loginAs('free');
    cy.visit('/features/premium-report');
    cy.get('body').should('contain.text.match', /upgrade|premium|assine/i);
  });

  it('subscriber acessa features premium', () => {
    cy.loginAs('subscriber');
    cy.visit('/features/premium-report');
    cy.url().should('include', '/features/premium-report');
    cy.get('[data-testid="paywall"]').should('not.exist');
  });
});
```

---

### 4. MULTI-TENANCY — Organizações e Membros

```typescript
// tests/e2e/multi-tenancy.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Multi-tenancy', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('admin convida novo membro', async ({ page }) => {
    await page.goto('/settings/team');
    await page.getByRole('button', { name: /invite|convidar/i }).click();
    await page.getByLabel(/email/i).fill(`invite+${Date.now()}@example.com`);
    await page.getByRole('button', { name: /send|enviar/i }).click();
    await expect(page.getByText(/convite enviado|invite sent/i)).toBeVisible();
  });

  test('dados de uma org não aparecem em outra', async ({ page, browser }) => {
    // Cria contexto isolado para outro usuário
    const orgBContext = await browser.newContext({
      storageState: 'playwright/.auth/free-user.json',
    });
    const orgBPage = await orgBContext.newPage();

    await page.goto('/dashboard'); // Org A
    await orgBPage.goto('/dashboard'); // Org B

    const orgAItems = await page.getByTestId('org-data-item').count();
    const orgBItems = await orgBPage.getByTestId('org-data-item').count();

    // Orgs diferentes — dados isolados
    // (adapte o assertion ao comportamento do seu SaaS)
    expect(orgAItems).not.toEqual(0);

    await orgBContext.close();
  });

  test('member não acessa settings de admin', async ({ page, browser }) => {
    const memberContext = await browser.newContext({
      storageState: 'playwright/.auth/free-user.json',
    });
    const memberPage = await memberContext.newPage();

    await memberPage.goto('/settings/billing');
    // Member não deve ver billing da org
    await expect(memberPage.getByText(/acesso negado|forbidden|403/i))
      .toBeVisible();

    await memberContext.close();
  });
});
```

---

### 5. OFFBOARDING — Cancelamento e Downgrade

```typescript
// tests/e2e/offboarding.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test.describe('Offboarding', () => {
  test.use({ storageState: 'playwright/.auth/subscriber.json' });

  test('assinante consegue cancelar plano', async ({ page }) => {
    await page.goto('/settings/billing');
    await page.getByRole('button', { name: /cancel|cancelar/i }).click();

    // Diálogo de confirmação
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /confirm|confirmar/i }).click();

    // Status atualizado
    await expect(page.getByText(/cancelado|canceled|ativo até/i)).toBeVisible();
  });

  test('após cancelamento, features premium são bloqueadas', async ({ page }) => {
    // Simula estado pós-cancelamento via mock da API
    await page.route('**/api/subscription', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ status: 'canceled', plan: 'free' }),
      });
    });

    await page.goto('/features/premium-report');
    await expect(page.getByText(/upgrade|reativar/i)).toBeVisible();
  });
});
```

---

## Smoke Test — Antes de Todo Deploy

Crie este arquivo para rodar em < 2 minutos antes de qualquer push para produção:

```typescript
// tests/smoke.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

// Smoke tests não precisam de auth — testam o básico do site
test.describe('Smoke Tests', () => {
  test('landing page carrega', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/); // Qualquer título
    await expect(page.locator('body')).not.toContainText(/error|500|not found/i);
  });

  test('página de login renderiza', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password|senha/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|entrar/i })).toBeVisible();
  });

  test('API de health responde', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
  });

  test('pricing page renderiza', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('button', { name: /upgrade|assinar/i }).first()).toBeVisible();
  });
});
```

```javascript
// cypress/e2e/smoke.cy.js
describe('Smoke Tests', () => {
  it('landing page carrega sem erros', () => {
    cy.visit('/');
    cy.get('body').should('not.contain.text', 'Internal Server Error');
    cy.title().should('not.be.empty');
  });

  it('login renderiza campos obrigatórios', () => {
    cy.visit('/login');
    cy.get('[name="email"], input[type="email"]').should('be.visible');
    cy.get('[name="password"], input[type="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });
});
```

---

## CI/CD — GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  smoke:
    name: Smoke Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test tests/smoke.spec.ts
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: smoke-report
          path: playwright-report/

  e2e:
    name: Full E2E Suite
    runs-on: ubuntu-latest
    needs: smoke  # Só roda se smoke passar
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          FREE_USER_EMAIL: ${{ secrets.FREE_USER_EMAIL }}
          FREE_USER_PASSWORD: ${{ secrets.FREE_USER_PASSWORD }}
          SUBSCRIBER_EMAIL: ${{ secrets.SUBSCRIBER_EMAIL }}
          SUBSCRIBER_PASSWORD: ${{ secrets.SUBSCRIBER_PASSWORD }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-report
          path: playwright-report/
          retention-days: 30
```

---

## Arquivos a adicionar ao .gitignore

```gitignore
# Auth state (contém cookies/tokens)
playwright/.auth/
cypress/fixtures/auth-*.json

# Reports
playwright-report/
test-results/
```

---

## Cartões de Teste Stripe (modo test)

| Cenário | Número |
|---|---|
| ✅ Pagamento aprovado | `4242 4242 4242 4242` |
| ❌ Cartão recusado | `4000 0000 0000 0002` |
| ⚠️ Autenticação 3DS necessária | `4000 0025 0000 3155` |
| 💳 Fundos insuficientes | `4000 0000 0000 9995` |
| 🔄 Assinatura renovada sempre | `4242 4242 4242 4242` |

CVC: qualquer 3 dígitos. Validade: qualquer data futura.

---

## Como Usar Esta Skill

Quando o usuário pedir testes, siga esta ordem:

1. **Pergunte qual framework** (Playwright ou Cypress) — se não souber, recomende Playwright
2. **Identifique a jornada a testar** — qual dos 8 momentos do assinante
3. **Verifique se auth.setup já existe** — se não, crie primeiro
4. **Gere os testes** com as fixtures corretas (free-user, subscriber, admin)
5. **Sempre inclua** ao menos 1 cenário de erro/falha por fluxo
6. **Ofereça o CI config** se ainda não tiver

**Nunca gere testes sem:**
- Auth setup correto (storageState ou cy.session)
- Ao menos 1 teste negativo (o que NÃO deve funcionar)
- Seletores resilientes (getByRole, getByLabel > CSS puro)
