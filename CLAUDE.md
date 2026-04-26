# Auri — Prontuário Eletrônico Pediátrico com IA

## O que é este projeto

**Auri** é um sistema de EMR (Electronic Medical Record) inteligente + CRM longitudinal para pediatras em consultório privado. Combina prontuário clínico estruturado com um **AI Ambient Scribe**: o médico grava a consulta, a IA transcreve, estrutura e preenche o prontuário automaticamente.

**Status atual:** Protótipo interativo com dados mockados. Sem backend real. Sem autenticação real. O objetivo é validar o fluxo com um médico (Dr. Lucas Mendes) antes de conectar ao banco.

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS + shadcn/ui** (componentes em `src/components/ui/`)
- **Recharts** (curvas de crescimento OMS)
- **Parcel** (bundler para gerar o arquivo HTML único — ver `bundle.html`)

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
  App.tsx          # Toda a aplicação (screens, components, state)
  index.css        # Design tokens + animações
  main.tsx         # Entry point React
  data/
    mock.ts        # Todos os dados mockados (pacientes, consultas, vacinas, OMS)
  components/ui/   # shadcn/ui components (não editar manualmente)
```

## Arquitetura do App.tsx

O app é uma **máquina de estados simples** com `useState`:

```typescript
type Screen = 'login' | 'dashboard' | 'patients' | 'patient-detail' | 'agenda' | 'settings'
type Flow = 'consent' | 'recording' | 'processing' | 'done' | null
```

### Componentes principais

| Componente | Descrição |
|---|---|
| `LoginScreen` | Tela decorativa de login (sem auth real) |
| `DashboardPage` | 4 cards de stats, agenda do dia, alertas, pacientes recentes |
| `PatientsPage` | Lista pesquisável com badges de alerta (vacinas, retorno) |
| `PatientDetailPage` | Header do paciente + 4 abas |
| `ConsultationDetail` | Prontuário completo no padrão médico brasileiro |
| `GrowthChart` | Recharts com curvas OMS P3/P50/P97 + dados do paciente |
| `VaccinesTab` | PNI brasileiro — cobertura, pendentes, aplicadas |
| `InsightsCard` | Pontos de atenção clínicos gerados por IA (com disclaimer CFM) |
| `ConsentScreen` | Consentimento LGPD para gravação |
| `RecordingScreen` | Microfone animado + timer |
| `ProcessingScreen` | Animação de processamento por etapas |
| `SummaryDoneScreen` | Revisão do resumo estruturado + toggle de transcrição |

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

## Dados mockados (src/data/mock.ts)

**Pacientes:**
- Miguel Santos, 4 anos (masculino)
- Sofia Oliveira, 2a 8m (feminino)
- Pedro Costa, 1a 3m (masculino)
- Laura Mendes, 6 meses (feminino)

**Exports:**
- `PATIENTS` — array de pacientes
- `CONSULTATIONS` — array de consultas por paciente
- `GROWTH_DATA` — dados de peso/altura por paciente
- `VACCINES` — histórico vacinal PNI por paciente
- `TODAY_APPOINTMENTS` — agenda do dia (5 itens)
- `INSIGHTS` — alertas clínicos por paciente
- `OMS_WEIGHT_BOY/GIRL`, `OMS_HEIGHT_BOY/GIRL` — curvas de referência OMS (P3/P15/P50/P85/P97)
- `SIMULATED_TRANSCRIPT` — transcrição simulada de consulta
- `SIMULATED_SUMMARY` — resumo estruturado simulado

## Próximos passos para tornar funcional

### 1. Backend / Banco de dados

**Opção A — Firebase Firestore (gratuita, sem cartão)**
- Collections: `patients`, `consultations`, `growth_records`, `patient_vaccines`
- Auth: Firebase Authentication (Google login)

**Opção B — Supabase (gratuita)**
- Esquema SQL completo em `vinculo_prompt_02_database.md` (pasta pai)
- 7 tabelas com PNI seedado (33 vacinas)

**Opção C — PGlite (Postgres no browser, zero infra)**
- Ideal para MVP offline — tudo roda no navegador
- Dados persistem via IndexedDB

### 2. Transcrição com IA

Pipeline sugerido:
```
Gravação (Web Audio API) → Blob MP3
  → Envio para endpoint
  → OpenAI Whisper (transcrição)
  → GPT-4o (structured output JSON)
  → Preenche ConsultationDetail
```

Prompt para GPT-4o (structured summary):
```json
{
  "queixaPrincipal": "...",
  "historiaDoencaAtual": "...",
  "exameFisico": "...",
  "hipotesesDiagnosticas": ["...", "..."],
  "conduta": "...",
  "receituario": "...",
  "vacinasAplicadas": ["..."],
  "retorno": "DD/MM/AAAA"
}
```

### 3. Regulatório

- **CFM 2.454/2026**: IA deve ser explicitamente auxiliar, nunca diagnóstica
  - Já implementado: disclaimer em todas as InsightsCards e no SummaryDoneScreen
- **LGPD**: Consentimento de gravação já implementado no ConsentScreen
  - Falta: armazenar registro de consentimento com timestamp no banco

### 4. Features do roadmap

- [ ] CRUD real de pacientes (substituir dados mockados)
- [ ] Gravação real (Web Audio API → MediaRecorder)
- [ ] Integração Whisper + GPT-4o
- [ ] Autenticação (médico faz login)
- [ ] Assinatura digital do prontuário (PDF exportável)
- [ ] Compartilhamento do prontuário com familiares
- [ ] Notificações de vacinas em atraso

## Convenções de código

- Todos os componentes em `App.tsx` (arquivo único por enquanto)
- Estilos inline com objetos JS para componentes que precisam de valores dinâmicos
- Tailwind para layout e utilitários estáticos
- Constantes de cor no topo do App.tsx: `const P = '#0B7A75'`, `const MU = '#6B7574'`, etc.

## Contexto do produto

- **Usuário primário**: Pediatra em consultório privado
- **Dor**: Prontuário leva 30-40min por consulta → rouba tempo de qualidade com o paciente
- **Solução**: Gravação da consulta → IA estrutura o prontuário → médico revisa em 2 min
- **Diferencial**: Longitudinalidade — a IA vê o histórico completo e gera insights clínicos
- **Validador atual**: Dr. Lucas Mendes (pediatra)
