# Auri — Prontuário Eletrônico com IA (Pediatria + Clínica Geral)

## O que é este projeto

**Auri** é um sistema de EMR (Electronic Medical Record) inteligente + CRM longitudinal para médicos em consultório privado, com suporte a duas especialidades — **Pediatria** e **Clínica Geral** (escolhida no onboarding, persistida em `profiles.specialty`). Combina prontuário clínico estruturado com um **AI Ambient Scribe**: o médico grava a consulta, a IA transcreve, estrutura e preenche o prontuário automaticamente.

**Status atual:** MVP funcional com backend real (Supabase). Autenticação via email + password. Dados 100% persistidos. Pronto para validação clínica com médico.

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (utilitários estáticos) + **estilos inline** (dinâmicos)
- **Recharts** (curvas de crescimento OMS + gráficos)
- **Supabase** (PostgreSQL + auth real)
- **@phosphor-icons/react** (ícones — regular weight, sem fills)

## Rodar localmente

```bash
npm install
npm run dev
# Abre em http://localhost:5173
```

Para gerar o arquivo HTML único (deploy sem servidor):
```bash
# Instalar parcel globalmente se necessário
npm install -g parcel
parcel build bundle.html --no-optimize --dist-dir dist-bundle
# Resultado em dist-bundle/bundle.html (~800KB, self-contained)
```

## Estrutura de arquivos

```
src/
  App.tsx              # Toda a aplicação (screens, components, state) — ~3500 linhas
  index.css            # Design tokens Auri + animações (wave, pulse)
  main.tsx             # Entry point React
  lib/
    supabase.ts        # Cliente Supabase + authContext
    db.ts              # Funções de acesso a dados (CRUD, queries)
    ai.ts              # Placeholder para Whisper + GPT-4o (não implementado)
  data/
    mock.ts            # Tipos TypeScript + constantes OMS (não dados mockados)
```

## Arquitetura do App.tsx

O app é uma **máquina de estados simples** com `useState`:

```typescript
type Screen = 'login' | 'dashboard' | 'patients' | 'patient-detail' | 'agenda' | 'settings'
type Flow = 'consent' | 'recording' | 'processing' | 'done' | null
```

### Componentes principais (em App.tsx)

| Componente | Descrição |
|---|---|
| `LoginScreen` | Autenticação real via Supabase (email + password) |
| `DashboardPage` | Painel de decisão clínica: Prioridades → Consultas hoje → Alertas → Pacientes. Lado direito: Iniciar consulta rápida, Pontos de atenção, Atividade recente |
| `PatientsPage` | Lista pesquisável com filtros de alerta (vacinas, retorno). Clicável para detalhe |
| `PatientDetailPage` | Header do paciente + 5 abas: Resumo (health dashboard), Consultas, Crescimento, Vacinas, Medicações |
| `ConsultationDetail` | Prontuário SOAP completo: QP, HDA, EF (com regex de sinais vitais), HD, CT, RX, Vacinas, Retorno |
| `AgendaPage` | Grid semanal (desktop) / lista (mobile). Clicável → AppointmentDetailModal com CRUD |
| `AppointmentDetailModal` | Ver/Editar/Cancelar agendamento. Ações: Confirmar, Marcar realizada, Iniciar consulta |
| `ConsentScreen` | Consentimento LGPD para gravação (stub) |
| `RecordingScreen` | Microfone animado + timer (stub) |
| `ProcessingScreen` | Animação de processamento por etapas (stub) |
| `SummaryDoneScreen` | Revisão do resumo estruturado + toggle de transcrição (stub) |

## Design tokens

```css
--primary: 177 83% 26%        /* #0B7A75 — teal principal */
--secondary: 37 27% 94%       /* #F4F1EC — bege claro */
--background: 60 20% 98%      /* #FAFAF8 — off-white */
--foreground: 160 6% 11%      /* #1A1D1C — quase preto */
--accent: 36 79% 57%          /* amarelo âmbar — alertas */
```

## Template do prontuário (ConsultationDetail)

O prontuário segue o padrão SOAP adaptado para pediatria brasileira:

| Seção | Significado |
|---|---|
| **QP** | Queixa Principal |
| **HDA** | História da Doença Atual |
| **EF** | Exame Físico (com chips de sinais vitais extraídos via regex) |
| **HD** | Hipóteses Diagnósticas (numeradas) |
| **CT** | Conduta |
| **RX** | Receituário (fonte monospace, estilo formulário) |
| **VAC** | Vacinas mencionadas na consulta |
| **Retorno** | Data de retorno (card teal) |

## Dados (src/data/mock.ts)

Não há dados mockados. Apenas tipos TypeScript + constantes:

**Exports:**
- `Patient`, `Consultation`, `Guardian`, `Appointment` — tipos TS
- `StructuredSummary`, `ScannableSummary` — tipos SOAP
- `PNI_SCHEDULE` — calendário vacinal brasileiro (33 vacinas por faixa etária)
- `OMS_WEIGHT_BOY/GIRL`, `OMS_HEIGHT_BOY/GIRL` — curvas de referência OMS (P3/P15/P50/P85/P97)

Todos os dados (pacientes, consultas, vacinas, etc.) vêm 100% do Supabase via `src/lib/db.ts`.

## Backend (Supabase)

✅ **Já implementado:**
- PostgreSQL com 7 tabelas: `patients`, `consultations`, `growth_records`, `patient_vaccines`, `doctors`, `patient_guardians`, `medical_events`
- Auth real: email + password (Supabase Auth)
- RLS (Row-Level Security) por `doctor_id`
- Funções em `src/lib/db.ts`: CRUD para pacientes, consultas, vacinas, etc.

**Credenciais (em `.env`):**
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## Transcrição com IA (não implementado)

Pipeline desenhado (stub em `src/lib/ai.ts`):
```
Gravação (Web Audio API) → Blob MP3
  → Envio para endpoint da IA
  → OpenAI Whisper (transcrição em PT-BR)
  → GPT-4o (structured output JSON via function_calling)
  → Preenche ConsultationDetail
  → Salva em db.consultations
```

Esperado do endpoint (`/api/transcribe`):
```json
{
  "transcript": "...",
  "summary": {
    "queixa_principal": "...",
    "hda": "...",
    "exame_fisico": "...",
    "hipoteses": ["...", "..."],
    "conduta": "...",
    "receituario": "...",
    "vacinas_mencionadas": ["..."],
    "retorno": "DD/MM/AAAA"
  }
}
```

## Design System — Auri

**Cores:**
```css
--primary: #0F4C5C (teal — ações primárias)
--accent: #E8825B (coral — alertas + atenção)
--success: #5B8A6F (verde — confirmar)
--warning: #C68B3E (âmbar — pendências)
--danger: #D1646F (vermelho — crítico)
--sand: #E6D5B8 (bege — informacional)
```

**Tipografia:**
- **Fraunces** (serif): headlines, seções (font-weight: 500-700)
- **Inter** (sans): corpo de texto
- **JetBrains Mono**: números, horários (tabular figures: `"tnum"`)

**Spacing:** 4-pt scale (4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96, 128)

**Ícones:** @phosphor-icons/react (regular weight, nunca fills)

## Roadmap

✅ **Feito:**
- [ x ] Autenticação real (Supabase)
- [ x ] CRUD de pacientes (via db.ts)
- [ x ] Dashboard painel de decisão clínica
- [ x ] Agenda com grid semanal + CRUD de agendamentos
- [ x ] PatientDetailPage com 5 abas (Resumo, Consultas, Crescimento, Vacinas, Medicações)
- [ x ] Prontuário SOAP completo (não gravado automaticamente ainda)
- [ x ] Responsividade (mobile + desktop)
- [ x ] Deploy em Vercel

❌ **Não implementado:**
- [ ] Gravação real (Web Audio API)
- [ ] Integração Whisper + GPT-4o (endpoint IA)
- [ ] PDF exportável com assinatura digital
- [ ] Compartilhamento de prontuário com familiares (WhatsApp, email)
- [ ] Notificações em tempo real (vacinas, retornos)
- [ ] Integração Google Calendar / iCal

## Convenções de código

- **Estrutura:** Todos os componentes em `App.tsx` (arquivo único, ~3500 linhas)
- **Estilos:** Inline com objetos JS para dinâmicos; Tailwind para estáticos
- **Cores:** Constantes no topo do App.tsx (`const P = '#0F4C5C'`, `const ACCENT = '#E8825B'`, etc.)
- **Ícones:** @phosphor-icons/react regular weight (nunca fills)
- **Responsividade:** Hook `useIsMobile()` (960px breakpoint)
- **State:** React hooks + Context API (ProntuarioFormatCtx)

## Contexto do produto

- **Usuário primário**: Pediatra em consultório privado (Dr. Lucas Mendes)
- **Problema**: Prontuário manual leva 30-40min por consulta → reduz tempo de qualidade com paciente
- **Solução**: Auri = Prontuário eletrônico + AI ambient scribe
  - Médico grava a consulta durante o atendimento (presente)
  - IA transcreve, estrutura e preenche o prontuário
  - Médico revisa e confirma em 2-3 min
- **Diferencial**: Longitudinalidade — a IA vê histórico completo do paciente e gera pontos de atenção clínicos
- **Compliance**: CFM 2.454/2026 (IA auxiliar, nunca diagnóstica) + LGPD (consentimento, gravação não armazenada)

## Deploy

- **Vercel:** https://auri-coral.vercel.app (auto-redeploy em push)
- **Branch:** main no GitHub (Dmjrust/auri)
- **Variáveis:** .env.local (Supabase URL + anon key)
