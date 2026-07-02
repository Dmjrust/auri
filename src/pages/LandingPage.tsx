import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import './LandingPage.css';
import {
  Microphone, FileText, ShieldCheck, TrendUp, CalendarBlank, Baby,
  CheckCircle, Check, PlayCircle, List, X, ArrowRight,
} from '@phosphor-icons/react';
import { P, ACCENT, INK, MU, BO, BG, SUC, SUCL } from '../lib/design';

// ── Tokens exclusivos da Landing Page ─────────────────────────────────────
const HERO_BG    = '#0B1A1C';
const HERO_TEXT  = '#F7F3EC';
const HERO_MUTED = 'rgba(247,243,236,0.60)';
const DS_INK2    = '#4A5862';
const DS_INK3    = '#6F7C84';
const DS_SAND    = '#E6D5B8';

// ── Dados ──────────────────────────────────────────────────────────────────
const STATS = [
  { v: '1h',   l: 'Economizadas por dia, por pediatra ativo' },
  { v: '97%',  l: 'Precisão em transcrição clínica em PT-BR' },
  { v: '+12k', l: 'Consultas registradas com Auri este mês' },
  { v: '5min', l: 'Para configurar e iniciar a primeira consulta' },
];

const FEATURES = [
  {
    icon: <Microphone size={22} weight="duotone" color="#E8825B" />,
    title: 'Escuta inteligente',
    desc: 'Distingue médico, paciente e acompanhante. Reconhece termos clínicos em PT-BR com 97% de precisão.',
  },
  {
    icon: <FileText size={22} weight="duotone" color="#E8825B" />,
    title: 'Prontuário automático',
    desc: 'Auri estrutura a consulta em QP, HDA, Exame Físico, Hipóteses e Conduta. Você revisa e salva em 2 minutos.',
  },
  {
    icon: <ShieldCheck size={22} weight="duotone" color="#E8825B" />,
    title: 'Privacidade em primeiro lugar',
    desc: 'LGPD + CFM 2.454/2026. Áudio descartado após a transcrição, consentimento registrado a cada consulta. Você é o dono dos dados.',
  },
  {
    icon: <TrendUp size={22} weight="duotone" color="#E8825B" />,
    title: 'Curvas e vacinas OMS/PNI',
    desc: 'Z-score, percentis e calendário vacinal calculados automaticamente. Alertas para doses e retornos.',
  },
  {
    icon: <CalendarBlank size={22} weight="duotone" color="#E8825B" />,
    title: 'Agenda integrada',
    desc: 'Agendamentos, confirmações e início de consulta com um clique. Do calendário ao prontuário sem atrito.',
  },
  {
    icon: <Baby size={22} weight="duotone" color="#E8825B" />,
    title: 'Feito para pediatria',
    desc: 'Vocabulário, protocolos e fluxos específicos. Não é uma ferramenta genérica adaptada — é um copiloto pediátrico.',
  },
];

const PRIVACY_ITEMS = [
  { title: 'Conforme LGPD e CFM 2.454/2026', desc: 'Resol. CFM nº 2.454/2026 normaliza IA como apoio clínico — Auri já nasce em compliance.' },
  { title: 'Áudio nunca é armazenado',        desc: 'A gravação é processada e descartada no ato. Nenhum arquivo de voz fica nos servidores.' },
  { title: 'Servidores no Brasil',             desc: 'Dados de pacientes não saem do território nacional.' },
  { title: 'Você é o dono dos dados',          desc: 'Exporte tudo a qualquer momento. Cancele e os dados são apagados em 30 dias.' },
];

const ESSENTIAL_FEATURES = [
  'Até 50 consultas por mês',
  'Prontuário SOAP automático',
  'Curvas OMS + Calendário PNI',
  'Exportação em PDF e CSV',
  'Suporte por email',
];
const PRO_FEATURES = [
  { text: 'Consultas ilimitadas', bold: true },
  { text: 'Tudo do plano Essencial', bold: false },
  { text: 'Modelos de prontuário customizados', bold: false },
  { text: 'Agenda integrada com Google Calendar', bold: false },
  { text: 'Secretaria com acesso dedicado', bold: false },
  { text: 'Suporte prioritário em até 4h', bold: false },
];

// ── Componente principal ───────────────────────────────────────────────────
export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [mobile, setMobile]     = useState(window.innerWidth < 900);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900);
    const onScroll = () => setScrolled(window.scrollY > 72);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll); };
  }, []);

  // Scroll reveal (Intersection Observer)
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.lp-reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Fechar menu ao clicar em link
  const handleNavLink = (href: string) => {
    setMenuOpen(false);
    setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }, 350);
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: '"Inter", system-ui, sans-serif', color: INK, WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' }}>

      {/* ══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className={`lp-nav ${scrolled ? 'on-body' : 'on-hero'}`}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', gap: 24 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8825B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Microphone size={18} color="#fff" weight="fill" />
            </div>
            <span style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: scrolled ? INK : HERO_TEXT,
              transition: 'color 0.3s ease',
            }}>Auri</span>
          </div>

          {/* Desktop links */}
          {!mobile && (
            <div style={{ marginLeft: 24, display: 'flex', gap: 28 }}>
              {[['Produto', '#produto'], ['Privacidade', '#privacidade'], ['Preços', '#precos']].map(([l, href]) => (
                <a key={l} href={href}
                  style={{ color: scrolled ? DS_INK2 : HERO_MUTED, fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.color = scrolled ? INK : HERO_TEXT)}
                  onMouseLeave={e => (e.currentTarget.style.color = scrolled ? DS_INK2 : HERO_MUTED)}
                >{l}</a>
              ))}
            </div>
          )}

          {/* Right side */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {!mobile && (
              <button
                onClick={onEnter}
                style={{
                  background: 'transparent',
                  border: `1px solid ${scrolled ? BO : 'rgba(247,243,236,0.25)'}`,
                  color: scrolled ? DS_INK2 : HERO_MUTED,
                  borderRadius: 8, fontSize: 13, fontWeight: 500, padding: '7px 16px',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = scrolled ? BG : 'rgba(247,243,236,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                Entrar
              </button>
            )}
            {!mobile && (
              <button className="lp-btn-coral" onClick={onEnter} style={{ fontSize: 13, padding: '7px 16px', boxShadow: 'none' }}>
                Testar 14 dias grátis
              </button>
            )}
            {/* Hamburger */}
            {mobile && (
              <button
                className={`lp-hamburger ${menuOpen ? 'open' : ''}`}
                onClick={() => setMenuOpen(o => !o)}
                aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                style={{ color: scrolled ? INK : HERO_TEXT }}
              >
                <span /><span /><span />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ══ MOBILE MENU ══════════════════════════════════════════════════ */}
      <div className={`lp-mobile-menu ${menuOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['Produto', '#produto'], ['Privacidade', '#privacidade'], ['Preços', '#precos']].map(([l, href]) => (
            <a key={l} href={href} onClick={() => handleNavLink(href)}
              style={{ fontSize: 28, fontFamily: '"Fraunces", Georgia, serif', color: HERO_TEXT, textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid rgba(247,243,236,0.08)' }}>
              {l}
            </a>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="lp-btn-coral" onClick={() => { setMenuOpen(false); onEnter(); }} style={{ width: '100%', justifyContent: 'center', padding: '14px 0' }}>
            Testar 14 dias grátis
          </button>
          <button className="lp-btn-ghost-dark" onClick={() => { setMenuOpen(false); onEnter(); }} style={{ width: '100%', justifyContent: 'center', padding: '14px 0' }}>
            Entrar
          </button>
        </div>
      </div>

      {/* ══ HERO (ESCURO) ════════════════════════════════════════════════ */}
      <section style={{ background: HERO_BG, position: 'relative', overflow: 'hidden', paddingTop: 0 }}>
        <div className="hero-grain" />

        {/* Glow decorativo */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,130,91,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '-5%',
          width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(15,76,92,0.3) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: mobile ? '72px 24px 80px' : '96px 32px 100px',
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: mobile ? 56 : 48,
          alignItems: 'center',
        }}>

          {/* ── Coluna esquerda: Texto ── */}
          <div>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '5px 12px',
              borderRadius: 999,
              border: '1px solid rgba(232,130,91,0.30)',
              background: 'rgba(232,130,91,0.08)',
              marginBottom: 28,
            }}>
              <span className="lp-live-dot" />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#E8825B' }}>
                Para pediatras
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: 'clamp(44px, 6vw, 80px)',
              fontWeight: 400,
              lineHeight: 1.0,
              letterSpacing: '-0.025em',
              color: HERO_TEXT,
              margin: '0 0 24px',
              maxWidth: '13ch',
              fontVariationSettings: '"opsz" 144',
            }}>
              Foque no paciente.{' '}
              <em style={{ fontStyle: 'italic', color: '#E8825B' }}>Auri</em>{' '}
              cuida do prontuário.
            </h1>

            {/* Subtítulo */}
            <p style={{ fontSize: 18, lineHeight: 1.6, color: HERO_MUTED, maxWidth: '46ch', margin: '0 0 36px' }}>
              Grave a consulta. A IA transcreve e estrutura o prontuário automaticamente.{' '}
              <strong style={{ color: HERO_TEXT, fontWeight: 600 }}>Economize até 1 hora por dia</strong>{' '}
              — sem mudar como você atende.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="lp-btn-coral" onClick={onEnter}>
                Testar grátis por 14 dias <ArrowRight size={16} />
              </button>
              <a href="#produto" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: HERO_MUTED, fontSize: 14, textDecoration: 'none', transition: 'color 0.18s' }}
                onMouseEnter={e => (e.currentTarget.style.color = HERO_TEXT)}
                onMouseLeave={e => (e.currentTarget.style.color = HERO_MUTED)}>
                <PlayCircle size={20} /> Ver demo de 90s
              </a>
            </div>

            {/* Microcopy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
              {['Sem cartão', 'Cancele quando quiser', 'Setup em 5 min'].map((item, i) => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(247,243,236,0.40)' }}>
                  {i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(247,243,236,0.20)' }} />}
                  <Check size={12} color="rgba(247,243,236,0.40)" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* ── Coluna direita: Produto vivo ── */}
          <div className="lp-device-float" style={{ position: 'relative' }}>
            {/* Browser frame */}
            <div style={{
              background: '#1a2f35',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(247,243,236,0.07)',
            }}>
              {/* Browser chrome */}
              <div style={{ padding: '10px 14px', background: '#122027', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <div style={{ flex: 1, background: '#1e3540', borderRadius: 6, padding: '4px 10px', marginLeft: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(247,243,236,0.35)', fontFamily: '"JetBrains Mono", monospace' }}>
                    app.auri.com.br
                  </span>
                </div>
              </div>

              {/* App content mockup */}
              <div style={{ padding: 20, background: '#F7F3EC', minHeight: 280 }}>
                {/* Recording state */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 18, marginBottom: 14, border: '1px solid #E2EBEC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'rgba(232,130,91,0.12)', color: '#d96a40' }}>
                      <span className="lp-live-dot" style={{ width: 6, height: 6 } as React.CSSProperties} /> Auri ouvindo
                    </span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: DS_INK3 }}>04:21</span>
                  </div>
                  <div className="lp-wave" style={{ height: 32 }}>
                    {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: DS_INK3 }}>
                    Lara Mendes · 4 anos · tosse seca há 3 dias
                  </div>
                </div>

                {/* SOAP preview */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #E2EBEC' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#E8825B', textTransform: 'uppercase', marginBottom: 10 }}>
                    ✦ Prontuário gerado pela IA
                  </div>
                  {[
                    { abbr: 'QP', text: 'Tosse seca há 3 dias, piora noturna' },
                    { abbr: 'HDA', text: 'Início gradual. Sem febre. Rinorreia hialina...' },
                    { abbr: 'HD', text: 'Rinofaringite viral aguda' },
                  ].map(row => (
                    <div key={row.abbr} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11 }}>
                      <span style={{ color: '#0F4C5C', fontWeight: 700, minWidth: 28, fontFamily: '"JetBrains Mono", monospace' }}>{row.abbr}</span>
                      <span style={{ color: '#1C2A2E', lineHeight: 1.4 }}>{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reflexo */}
            <div style={{
              position: 'absolute', bottom: -24, left: '10%', right: '10%', height: 24,
              background: 'linear-gradient(to bottom, rgba(11,26,28,0.25), transparent)',
              filter: 'blur(8px)',
              borderRadius: '50%',
            }} />
          </div>
        </div>
      </section>

      {/* ══ DIAGONAL BREAK ══════════════════════════════════════════════ */}
      <div className="lp-diagonal" />

      {/* ══ STATS STRIP ════════════════════════════════════════════════ */}
      <section style={{ background: BG, paddingBottom: 80 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            borderTop: `1px solid ${BO}`,
            borderBottom: `1px solid ${BO}`,
          }}>
            {STATS.map((s, i) => (
              <div
                key={i}
                className={`lp-reveal d${i + 1}`}
                style={{
                  padding: '28px 24px',
                  borderRight: (!mobile && i < 3) || (mobile && i % 2 === 0) ? `1px solid ${BO}` : 'none',
                  borderBottom: mobile && i < 2 ? `1px solid ${BO}` : 'none',
                }}
              >
                <div className="lp-stat-num" style={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: 38,
                  fontWeight: 500,
                  color: '#E8825B',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginBottom: 6,
                }}>
                  {s.v}
                </div>
                <div style={{ fontSize: 13, color: DS_INK2, lineHeight: 1.35 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════ */}
      <section id="produto" style={{ background: BG, paddingBottom: 96 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px' }}>
          <div className="lp-reveal" style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E8825B', marginBottom: 16 }}>
              Funcionalidades
            </div>
            <h2 style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: mobile ? 36 : 52,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: INK,
              lineHeight: 1.05,
              maxWidth: '16ch',
              margin: 0,
            }}>
              Menos digitação.<br />Mais consulta.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 20,
          }}>
            {FEATURES.map((f, i) => (
              <div key={i} className={`lp-feature-card lp-reveal d${(i % 3) + 1}`}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(232,130,91,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18,
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: 20,
                  fontWeight: 500,
                  margin: '0 0 10px',
                  color: INK,
                  letterSpacing: '-0.01em',
                }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: DS_INK2, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ DEPOIMENTO (TEAL ESCURO) ════════════════════════════════════ */}
      <section style={{ background: P, padding: mobile ? '64px 24px' : '80px 32px', overflow: 'hidden', position: 'relative' }}>
        <div className="hero-grain" style={{ opacity: 0.02 }} />
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 72, color: '#E8825B', lineHeight: 0.5, marginBottom: 32, fontFamily: '"Fraunces", Georgia, serif', opacity: 0.6 }}>"</div>
          <blockquote className="lp-reveal" style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: mobile ? 24 : 32,
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.35,
            color: '#F7F3EC',
            margin: '0 0 36px',
            letterSpacing: '-0.01em',
          }}>
            Voltei a olhar nos olhos das mães. O prontuário se escreve sozinho.
          </blockquote>
          <div className="lp-reveal d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: DS_SAND, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>RM</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F7F3EC' }}>Dra. Renata Moraes</div>
              <div style={{ fontSize: 12, color: 'rgba(247,243,236,0.55)' }}>Pediatra · Clínica Vivace, São Paulo</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ PRIVACIDADE ═════════════════════════════════════════════════ */}
      <section id="privacidade" style={{ background: '#EBF5EE', padding: mobile ? '64px 24px' : '80px 32px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '1fr 1.5fr',
            gap: 56,
            alignItems: 'center',
          }}>
            <div className="lp-reveal">
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px',
                background: '#fff',
                color: '#3D7A5A',
                borderRadius: 999,
                fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
                marginBottom: 20,
              }}>
                <ShieldCheck size={14} color="#3D7A5A" weight="fill" /> Dados protegidos
              </span>
              <h2 style={{
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: mobile ? 30 : 40,
                fontWeight: 400,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: INK,
                margin: 0,
                maxWidth: '14ch',
              }}>
                Seus dados, e os do paciente, ficam onde devem.
              </h2>
            </div>

            <div className="lp-reveal d2" style={{ display: 'grid', gap: 20 }}>
              {PRIVACY_ITEMS.map((item, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr',
                  gap: 14,
                  alignItems: 'start',
                  padding: '18px 20px',
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(28,42,46,0.05)',
                }}>
                  <CheckCircle size={20} color="#3D7A5A" weight="fill" style={{ marginTop: 2 } as React.CSSProperties} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 3 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: DS_INK2, lineHeight: 1.45 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ PRICING ════════════════════════════════════════════════════ */}
      <section id="precos" style={{ background: BG, padding: mobile ? '64px 24px 80px' : '80px 32px 96px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>

          {/* Header */}
          <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E8825B', marginBottom: 16 }}>
              Preços
            </div>
            <h2 style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: mobile ? 34 : 52,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              color: INK,
              lineHeight: 1.05,
              margin: '0 0 14px',
            }}>
              Simples. Por médico.
            </h2>
            <p style={{ fontSize: 16, color: DS_INK2, maxWidth: '52ch', margin: '0 auto', lineHeight: 1.5 }}>
              Menos de 2 consultas por mês cobre o custo. Comece com 14 dias grátis, sem cartão.
            </p>
          </div>

          {/* Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0, 400px))',
            gap: 20,
            justifyContent: 'center',
          }}>

            {/* Essencial */}
            <div className="lp-reveal d1" style={{
              padding: '32px 28px',
              background: '#fff',
              border: `1px solid ${BO}`,
              borderRadius: 16,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 2px 8px rgba(28,42,46,0.05)',
            }}>
              <h3 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 24, fontWeight: 500, margin: '0 0 8px', color: INK }}>Essencial</h3>
              <p style={{ fontSize: 13, color: DS_INK2, margin: '0 0 28px', lineHeight: 1.4 }}>
                Para começar com segurança e validar o fluxo de trabalho.
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 16, color: DS_INK2, fontWeight: 500 }}>R$</span>
                <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 60, fontWeight: 500, color: INK, letterSpacing: '-0.04em', lineHeight: 1 }}>149</span>
                <span style={{ fontSize: 14, color: DS_INK3 }}>/mês</span>
              </div>
              <div style={{ fontSize: 12, color: DS_INK3, marginBottom: 28 }}>cobrança mensal · cancele quando quiser</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'grid', gap: 12, flexGrow: 1 }}>
                {ESSENTIAL_FEATURES.map(item => (
                  <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'start', fontSize: 14, color: INK, lineHeight: 1.4 }}>
                    <Check size={15} color="#3D7A5A" style={{ marginTop: 2, flexShrink: 0 } as React.CSSProperties} />
                    {item}
                  </li>
                ))}
              </ul>
              <button className="lp-btn-ghost-light" onClick={onEnter} style={{ width: '100%', padding: '12px 0', textAlign: 'center', justifyContent: 'center' }}>
                Testar grátis por 14 dias
              </button>
              <div style={{ fontSize: 11, color: DS_INK3, textAlign: 'center', marginTop: 10 }}>Sem cartão · sem compromisso</div>
            </div>

            {/* Pro — dark featured */}
            <div className="lp-pricing-dark lp-reveal d2" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div className="hero-grain" style={{ borderRadius: 16, opacity: 0.025 }} />
              {/* Badge */}
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                background: '#E8825B',
                color: '#fff',
                padding: '4px 14px', borderRadius: 999,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(232,130,91,0.4)',
              }}>
                Mais popular
              </div>
              <h3 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 24, fontWeight: 500, margin: '0 0 8px', color: HERO_TEXT }}>Pro</h3>
              <p style={{ fontSize: 13, color: HERO_MUTED, margin: '0 0 28px', lineHeight: 1.4 }}>
                Para quem usa o Auri todos os dias e quer o máximo de produtividade.
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 16, color: HERO_MUTED, fontWeight: 500 }}>R$</span>
                <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 60, fontWeight: 500, color: HERO_TEXT, letterSpacing: '-0.04em', lineHeight: 1 }}>249</span>
                <span style={{ fontSize: 14, color: HERO_MUTED }}>/mês</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(247,243,236,0.40)', marginBottom: 28 }}>
                menos que 2 consultas — ROI imediato
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'grid', gap: 12, flexGrow: 1 }}>
                {PRO_FEATURES.map(item => (
                  <li key={item.text} style={{ display: 'flex', gap: 10, alignItems: 'start', fontSize: 14, color: HERO_TEXT, lineHeight: 1.4 }}>
                    <Check size={15} color="#E8825B" style={{ marginTop: 2, flexShrink: 0 } as React.CSSProperties} />
                    {item.bold ? <strong style={{ fontWeight: 700 }}>{item.text}</strong> : item.text}
                  </li>
                ))}
              </ul>
              <button className="lp-btn-coral" onClick={onEnter} style={{ width: '100%', padding: '12px 0', justifyContent: 'center' }}>
                Testar grátis por 14 dias
              </button>
              <div style={{ fontSize: 11, color: 'rgba(247,243,236,0.35)', textAlign: 'center', marginTop: 10 }}>
                Começa hoje · cancele quando quiser
              </div>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: DS_INK3, marginTop: 28, lineHeight: 1.5 }}>
            Uso dentro de padrões normais de consulta. Sem cobranças inesperadas.
          </p>
        </div>
      </section>

      {/* ══ CTA FINAL (CORAL) ═══════════════════════════════════════════ */}
      <section style={{ background: '#E8825B', padding: mobile ? '56px 24px' : '72px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 320, height: 320,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -20,
          width: 240, height: 240,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)',
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 1120, margin: '0 auto',
          display: 'flex',
          flexDirection: mobile ? 'column' : 'row',
          gap: 40,
          alignItems: mobile ? 'flex-start' : 'center',
        }}>
          <div className="lp-reveal" style={{ flex: 1 }}>
            <h2 style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: mobile ? 36 : 52,
              fontWeight: 400,
              letterSpacing: '-0.025em',
              lineHeight: 1.0,
              color: '#fff',
              margin: '0 0 14px',
              maxWidth: '14ch',
            }}>
              Comece hoje.<br />Sem cartão.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', margin: '0 0 20px', maxWidth: '40ch', lineHeight: 1.5 }}>
              14 dias grátis com sua agenda real. Configure em menos de 5 minutos.
            </p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'rgba(255,255,255,0.70)' }}>
              {['Sem cartão de crédito', 'Cancele quando quiser', 'Exporte todos os dados'].map(item => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={15} color="rgba(255,255,255,0.70)" weight="fill" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="lp-reveal d2" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
            <button onClick={onEnter} style={{
              width: '100%',
              background: '#fff',
              color: '#d96a40',
              border: 'none',
              borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              padding: '14px 20px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.16)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }}
            >
              Testar grátis por 14 dias <ArrowRight size={16} />
            </button>
            <button style={{
              width: '100%',
              background: 'transparent',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.30)',
              borderRadius: 10,
              fontSize: 15, fontWeight: 500,
              padding: '14px 20px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.18s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Falar com a equipe
            </button>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer style={{ background: HERO_BG, padding: mobile ? '32px 24px' : '32px 48px', display: 'flex', gap: 20, fontSize: 12, color: 'rgba(247,243,236,0.35)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: '#E8825B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Microphone size={11} color="#fff" weight="fill" />
          </div>
          <span style={{ color: 'rgba(247,243,236,0.50)', fontWeight: 500 }}>Auri</span>
          <span>· © 2026 Auri Saúde Ltda</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {(['LGPD', 'Termos'] as const).map(l => (
            <a key={l} href="#" style={{ color: 'rgba(247,243,236,0.35)', textDecoration: 'none', transition: 'color 0.18s' }}
              onClick={e => { e.preventDefault(); toast.info('Documento em elaboração. Dúvidas: suporte@auri.com.br'); }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(247,243,236,0.70)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(247,243,236,0.35)')}>
              {l}
            </a>
          ))}
          <a href="mailto:suporte@auri.com.br" style={{ color: 'rgba(247,243,236,0.35)', textDecoration: 'none', transition: 'color 0.18s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(247,243,236,0.70)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(247,243,236,0.35)')}>
            Contato
          </a>
        </div>
      </footer>

    </div>
  );
}
