# Auri — Design System

> **Auri** é o copiloto de consulta para pediatras. Escuta a consulta, transcreve o que importa, e organiza o prontuário automaticamente — para que o médico possa olhar nos olhos do paciente, não na tela.

## What is Auri?

Auri é um assistente clínico para pediatras brasileiros. Durante a consulta, Auri ouve em segundo plano e transforma a conversa em informações estruturadas: histórico, queixas, exame físico, hipóteses, plano terapêutico. Fora da consulta, Auri ajuda na rotina diária: agenda, acompanhamento de pacientes, lembretes de retorno, curvas de crescimento, esquema vacinal.

**Nome.** *Auri* vem de **auris** (latim para *orelha / ouvir*) + **aura** (a presença sutil que acompanha o médico). É curto, fácil de pronunciar em português, e funciona como nome próprio — quase como uma colega de trabalho silenciosa.

**Posicionamento.** Premium, clínico, calmo. Não é um app "fofo de pediatra" cheio de mascotes — é uma ferramenta de trabalho séria, mas com calor humano suficiente para refletir o público que atende (crianças e famílias).

## Sources

This design system was created from scratch — there was no prior codebase, Figma, or existing brand. All visual decisions documented here are the **proposed identity** for Auri, designed to be premium-clinical with the warmth pediatric care deserves.

---

## Index

- `README.md` — this file (brand, content, visual, iconography fundamentals)
- `colors_and_type.css` — design tokens (CSS custom properties) for color, type, spacing
- `SKILL.md` — Agent Skill manifest for use with Claude Code
- `assets/` — logos, icons, brand imagery
- `fonts/` — webfont files (or Google Fonts substitutions)
- `preview/` — design-system preview cards (registered for the Design System tab)
- `ui_kits/` — high-fidelity UI recreations
  - `consultation/` — live consultation view (recording + transcript)
  - `prontuario/` — patient record dashboard
  - `agenda/` — appointments
  - `marketing/` — landing page
  - `mobile/` — mobile app

---

## CONTENT FUNDAMENTALS

### Voice

Auri fala como uma **colega clínica experiente** — calma, precisa, gentil. Nunca infantiliza o médico, nunca usa jargão de marketing.

- **Tratamento:** **você** — informal-respeitoso, padrão brasileiro moderno. Nunca "senhor/senhora" no produto (parece distante e velho); nunca "tu" (regional).
- **Pessoa:** Auri se refere a si mesma em terceira pessoa quando útil ("Auri identificou…"), mas usa primeira pessoa quando age em nome do médico ("Vou registrar isso no prontuário").
- **Português:** PT-BR, sem estrangeirismos desnecessários. "Prontuário" e não "record"; "agenda" e não "schedule"; "consulta" e não "appointment". Termos clínicos em latim/inglês quando padrão da medicina (ex: *follow-up*, *intake*).

### Tom por contexto

| Contexto | Tom | Exemplo |
|---|---|---|
| Onboarding, marketing | Convidativo, confiante | "Foque no paciente. Auri cuida do prontuário." |
| Durante consulta | Discreto, ausente | "Ouvindo…" / "Transcrição pausada" |
| Resumo gerado | Clínico, estruturado | "Queixa principal: tosse seca há 3 dias. Sem febre." |
| Erro / falha | Honesto, breve, com saída | "Não consegui salvar. Tentar de novo?" |
| Confirmação | Direto, sem exagero | "Salvo no prontuário de Lara." (não: "Salvo com sucesso! ✨") |

### Casing

- **Sentence case** em **tudo**: títulos de tela, botões, labels, menus.
  - ✅ "Nova consulta" · ❌ "Nova Consulta" · ❌ "NOVA CONSULTA"
- Exceções: nomes próprios (Auri, nomes de pacientes, nomes de medicamentos comerciais), siglas estabelecidas (CID, SUS, BCG, IMC).

### Microcopy patterns

- **Botões primários:** verbos no infinitivo curtos. "Iniciar consulta", "Salvar", "Adicionar paciente". Não "Clique aqui".
- **Estados vazios:** uma linha factual + uma ação. "Nenhuma consulta hoje. **Ver agenda da semana →**"
- **Carregamento:** "Transcrevendo…" / "Salvando…" — gerúndio, sem pontos de exclamação.
- **Confirmações destrutivas:** explícitas. "Apagar consulta de Lara? Esta ação não pode ser desfeita."
- **Lista de campos:** label acima do campo, em sentence case, sem dois-pontos. "Peso (kg)" não "Peso:"

### Emoji & exclamações

**Não.** Sem emoji em produto. Sem exclamações em texto de UI (exceto raríssimos momentos de celebração genuína — ex: primeira consulta concluída no onboarding). Símbolos clínicos (♂ ♀ °C kg/m²) sim, quando carregam significado.

### Examples

✅ **Bom**
> "Lara, 4 anos, retorna em 2 semanas. Auri vai te lembrar."
> "Transcrição pausada. Retomar quando quiser."
> "3 pacientes aguardando. Próximo: Theo, 6 meses."

❌ **Evitar**
> "🎉 Sua consulta foi salva com sucesso!" *(emoji + exclamação + "com sucesso" redundante)*
> "Olá Doutor! Bem-vindo ao seu painel mágico ✨" *(infantiliza, jargão de marketing)*
> "ERRO: Não foi possível processar a requisição." *(caps, técnico, sem saída)*

---

## VISUAL FOUNDATIONS

### Color

Paleta **calma, premium, clínica** com calor pediátrico — sem cair em pastéis infantis.

- **Primary — Deep Teal `#0F4C5C`.** Cor de marca. Profunda, médica, confiável. Usada em logo, botões primários, headers.
- **Secondary — Warm Cream `#F7F3EC`.** Background. Não branco puro — um bege quente quase imperceptível que reduz fadiga ocular em uso prolongado.
- **Accent — Coral `#E8825B`.** Uso pontual: notificações importantes, gráficos, ações destacadas. Carrega o "calor" pediátrico sem ser doce.
- **Soft Sage `#A9C2A1`.** Estados positivos (saúde normal, vacinas em dia, salvamento confirmado).
- **Warm Sand `#E6D5B8`.** Highlights sutis, cards de destaque secundário.
- **Ink `#1C2A2E`.** Texto primário — quase preto, com matiz teal para harmonizar.

Neutros graduados em escala oklch para superfícies, bordas, e texto secundário. Ver `colors_and_type.css`.

### Typography

**Editorial mix** — serif refinado para títulos (calor + premium), sans humanista para UI.

- **Display / Headlines: Fraunces** (serif, opsz variable). Usado para H1 grandes e momentos editoriais (marketing, splash, títulos de seções importantes). Peso 400–500, opsz alto em tamanhos grandes.
  - *Substituição:* Fraunces (Google Fonts). ⚠️ Considerar alternativa proprietária no futuro — Fraunces é overused. Recomendo avaliar **GT Sectra** ou **Tiempos Headline** em produção.
- **UI / Body: Inter** (sans-serif). Sistema, pesos 400/500/600. Para tudo: labels, body, navegação, dados.
  - *Substituição:* Inter (Google Fonts). ⚠️ Inter é overused. Recomendo **Söhne** ou **General Sans** em produção; ambos têm a precisão clínica que Auri pede.
- **Mono: JetBrains Mono.** Para dados numéricos tabulares (peso, altura, dosagens, horários).

Escala fluida tipo-major em `colors_and_type.css`.

### Spacing

Escala 4-pt: `4 8 12 16 20 24 32 40 56 72 96 128`. Use múltiplos de 4 sempre. Densidade clínica > densidade de marketing — interfaces devem caber muito dado em pouco espaço, sem se sentirem apertadas.

### Backgrounds

- **Sem gradientes saturados.** Auri não é fintech.
- **Background base:** `--cream` (warm off-white). Páginas inteiras, cards primários.
- **Surface elevation:** branco puro `#FFFFFF` para cards/modais sobre cream. Cria hierarquia sutil sem sombras agressivas.
- **Imagens:** quando usadas (marketing, onboarding), **fotografia documental editorial** — luz natural, mãos, instrumentos, crianças (nunca posadas tipo banco-de-imagens). Tom **quente**, levemente desaturado, **sem grão pesado**. Crop generoso, respiração.
- **Ilustração:** mínima. Quando necessária, geometria simples (círculos, ondas) na paleta da marca, nunca personagens cartoon.
- **Sem padrões repetidos** ou texturas. O calor vem da cor de fundo (cream) e da tipografia serif, não de decoração.

### Animation

- **Discreta.** Auri é uma ferramenta clínica — animação serve à compreensão, nunca à exibição.
- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` (ease-out-quart) para entradas; `cubic-bezier(0.4, 0, 0.2, 1)` (material standard) para transições.
- **Duração:** 150ms (micro), 240ms (UI standard), 400ms (transições de tela). **Nunca mais de 500ms.**
- **Sem bounce.** Sem spring exagerado. Sem confetes.
- **Pulso de gravação:** o único elemento "vivo" — bolinha coral pulsando suavemente quando Auri está ouvindo (2s loop, opacity 0.4→1).
- **Skeleton loaders** em vez de spinners quando possível.

### Hover states

- **Botões primários:** escurece 6% (filter: brightness(0.94)).
- **Botões secundários / ghosts:** background `--ink-04` (4% ink overlay).
- **Links / itens de lista:** background `--ink-02`.
- **Cards clicáveis:** sobe 1px (`translateY(-1px)`) + sombra aumenta sutilmente.
- **Sem mudanças de cor agressivas no hover.** Sem highlight teal em itens de lista — cansa a vista.

### Press states

- **Botões:** filter: brightness(0.88), `transform: scale(0.99)` (quase imperceptível, dá feedback).
- **Sem ripple effect.** Material design não combina com Auri.

### Borders

- **Espessura:** 1px sempre. Hairlines.
- **Cor:** `--border` (`oklch(94% 0.005 200)`) — quase invisível em cream. `--border-strong` para divisores reais.
- **Inputs:** border 1px `--border-strong`; focus ring 2px `--primary` (sem outline preto do browser).

### Shadows

Sistema de elevação suave, com matiz teal no shadow para harmonizar com a paleta:

- `--shadow-sm` — `0 1px 2px oklch(20% 0.02 200 / 0.05)` — cards em repouso
- `--shadow-md` — `0 4px 12px oklch(20% 0.02 200 / 0.08)` — cards hover, popovers
- `--shadow-lg` — `0 16px 40px oklch(20% 0.02 200 / 0.10)` — modais, sheets
- **Sem inner shadows.** Sem neumorfismo. Sem glow.

### Corner radii

- `--radius-sm: 6px` — botões pequenos, badges, inputs
- `--radius-md: 10px` — cards, painéis
- `--radius-lg: 16px` — modais, sheets grandes
- `--radius-pill: 999px` — chips, status pills, pulso de gravação
- **Não usamos radius 0** (square hard) nem radius enormes tipo `2rem+` (parece app de delivery).

### Cards

Cartão padrão Auri:
```
background: white;
border: 1px solid var(--border);
border-radius: var(--radius-md);
box-shadow: var(--shadow-sm);
padding: 20px 24px;
```
Hover: shadow sobe para `--shadow-md`, borda fica `--border-strong`. Cards são **acolhedores mas nítidos** — não flutuam exageradamente, não têm gradiente interno, não têm border colorida na esquerda (anti-padrão).

### Transparency & blur

- **Backdrop blur** apenas em modais sobre conteúdo (12px blur, overlay 40% ink).
- **Glassmorphism:** **não.** Não combina com calmaria clínica.
- **Transparency em UI:** apenas em `--ink-04` / `--ink-08` overlays para hovers.

### Layout rules

- **Conteúdo principal:** max-width 1280px (clinical dashboards), 1120px (marketing).
- **Sidebars:** 240–280px fixas em desktop.
- **Densidade:** clínica. Listas com row-height 44–52px (não 80px de marketing).
- **Sticky elements:** header da consulta (paciente, timer de gravação) sempre visível ao rolar.
- **Mobile:** bottom-nav com 4 ícones máximo. FAB para "Iniciar consulta".

### Imagery vibe

Fotografia: **luz quente natural, levemente desaturada**. Mãos de médico, estetoscópio, mãe segurando bebê, criança brincando. Documental, **nunca stock posado**. Sem filtros B&W. Sem grão visível. Tom unificado: warm, não cool.

---

## ICONOGRAPHY

### Sistema

**Phosphor Icons** (regular weight) é o sistema oficial do Auri.

- **Por quê Phosphor:** rounded sem ser fofo, stroke 1.5px consistente, cobertura clínica completa (estetoscópio, pílula, seringa, calendário), licença permissiva (MIT).
- **Alternativa CDN:** `https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css` — usar a classe `<i class="ph ph-stethoscope"></i>` ou copiar SVGs individuais.
- **Para produção:** instalar `@phosphor-icons/react` e tree-shake.

### Pesos

- **Regular** (1.5px stroke) — padrão em **toda** a UI. Sem exceções em superfícies clínicas.
- **Fill** — apenas em estados ativos (ícone selecionado em sidebar, botão tab ativo).
- **Bold** — não usamos.
- **Duotone** — não usamos.

### Tamanhos

- 16px — inline com texto (ex: ícone em badge)
- 20px — padrão UI (botões, menus, list rows)
- 24px — navegação principal, ações primárias
- 32px+ — empty states, ilustrações funcionais

Sempre alinhado a múltiplo de 4. Cor herda de `currentColor`.

### Emoji

**Não.** Auri não usa emoji em produto, marketing, ou comunicação. Crianças aparecem em fotografia, não em emoji.

### Unicode glyphs

Usados quando carregam significado clínico padrão:
- ♂ ♀ — sexo do paciente
- °C — temperatura
- kg / cm / m² — unidades
- → ← ↑ ↓ — direção em tendências (mas prefira ícone Phosphor `TrendUp` quando possível)

### Logo

Wordmark "Auri" em Fraunces 500 + mark geométrico: três arcos concêntricos representando ondas sonoras / o ato de ouvir. Mark funciona standalone em favicons e contextos pequenos. Cor: `--primary` em fundos claros, `--cream` em fundos escuros. **Nunca aplicar em fundos coloridos vibrantes** (não é uma marca colorida — pede respiração).

Variantes em `assets/`:
- `auri-logo-full.svg` — wordmark + mark, horizontal
- `auri-mark.svg` — mark sozinho (favicon, app icon)
- `auri-logo-mono.svg` — versão monocromática

---

## Iteração

Esta é a **v1**. Próximos passos sugeridos com o time:
1. Validar o nome **Auri** (verificar disponibilidade de domínio e marca registrada no INPI).
2. Substituir Fraunces e Inter por fontes proprietárias (recomendações no VISUAL FOUNDATIONS).
3. Sessão de fotografia documental real com pediatras e famílias.
4. Validar tom de voz com 3–5 pediatras em entrevistas.
