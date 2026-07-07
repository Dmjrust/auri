import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { P, PL, ACCENT, INK, MU, BO } from '../lib/design';
import { Btn } from './auri-ui';
import { useIsMobile } from '../contexts/MobileContext';

export interface TourStep {
  target?: string;          // valor do atributo data-tour; ausente = modal centralizado
  title: string;
  text: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Bem-vindo(a) ao Auri!',
    text: 'O Auri é seu prontuário eletrônico com IA: você grava a consulta, a IA transcreve e preenche o prontuário — e você revisa em minutos. Vamos fazer um tour rápido de 1 minuto pelas principais áreas?',
  },
  {
    target: 'nav',
    title: 'Navegação',
    text: 'Por aqui você acessa o Dashboard, a lista de Pacientes, a Agenda da semana e as Configurações do consultório.',
  },
  {
    target: 'kpis',
    title: 'Visão do dia',
    text: 'Estes indicadores resumem o seu dia: consultas agendadas, realizadas, prioridades pendentes e o próximo atendimento.',
  },
  {
    target: 'consultas-hoje',
    title: 'Consultas de hoje',
    text: 'Acompanhe os atendimentos do dia. Daqui você confirma presença, marca como realizada ou inicia a consulta diretamente.',
  },
  {
    target: 'prioridades',
    title: 'Prioridades',
    text: 'O Auri gera alertas automáticos: retornos vencidos, vacinas em atraso e pacientes que precisam de atenção. Nada passa despercebido.',
  },
  {
    target: 'iniciar-consulta',
    title: 'Iniciar consulta com IA',
    text: 'A ação principal do Auri: selecione o paciente, grave a consulta e a IA transcreve e estrutura o prontuário SOAP para você revisar em 2-3 minutos.',
  },
  {
    title: 'Como funciona a gravação',
    text: 'O fluxo tem 4 passos: 1) você registra o consentimento do paciente (LGPD); 2) grava a consulta normalmente enquanto atende; 3) a IA transcreve e preenche o prontuário; 4) você revisa, ajusta o que quiser e salva. Se a transcrição falhar, dá para tentar de novo sem regravar — e o áudio é descartado após o uso.',
  },
  {
    target: 'notificacoes',
    title: 'Notificações',
    text: 'O sino avisa sobre vacinas em atraso e consultas não realizadas. Clique em uma notificação para abrir o paciente.',
  },
  {
    title: 'Tudo pronto!',
    text: 'Comece cadastrando seu primeiro paciente. Se quiser rever este tour depois, ele fica disponível em Configurações.',
  },
];

const Z = 1100; // acima dos modais do app (zIndex 1000)

export function GuidedTour({ onClose, onGoToPatients }: {
  onClose: () => void;              // grava tour_completed e fecha
  onGoToPatients?: () => void;      // CTA do passo final
}) {
  const isMobile = useIsMobile();

  // Mantém apenas passos cujo alvo existe na tela atual (ex.: sino não existe no mobile)
  const steps = useMemo(
    () => STEPS.filter(s => !s.target || document.querySelector(`[data-tour="${s.target}"]`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMobile]
  );

  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[Math.min(idx, steps.length - 1)];
  const isLast = idx === steps.length - 1;

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    if (step?.target) {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const finish = () => { onClose(); if (onGoToPatients) onGoToPatients(); };

  // ── Tooltip / card ──
  const cardBody = (
    <>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: ACCENT, letterSpacing: 0.5, marginBottom: 8 }}>
        PASSO {idx + 1} DE {steps.length}
      </div>
      <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 18, fontWeight: 600, color: INK, marginBottom: 8 }}>
        {step.title}
      </div>
      <div style={{ fontSize: 13, color: MU, lineHeight: 1.55, marginBottom: 16 }}>{step.text}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!isLast && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: MU, padding: '6px 4px', fontFamily: 'inherit' }}>
            Pular tour
          </button>
        )}
        <div style={{ flex: 1 }} />
        {idx > 0 && <Btn variant="secondary" size="sm" onClick={() => setIdx(i => i - 1)}>Voltar</Btn>}
        {isLast
          ? <Btn size="sm" onClick={finish}>{onGoToPatients ? 'Cadastrar paciente' : 'Começar a usar'}</Btn>
          : <Btn size="sm" onClick={() => setIdx(i => i + 1)}>{idx === 0 ? 'Fazer tour' : 'Próximo'}</Btn>}
      </div>
      {/* Pontos de progresso */}
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 14 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === idx ? P : BO, transition: 'background 0.2s' }} />
        ))}
      </div>
    </>
  );

  const cardBase: React.CSSProperties = {
    background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    border: `1px solid ${BO}`, boxSizing: 'border-box',
  };

  // Passo sem alvo (boas-vindas / final) → modal centralizado
  if (!step.target || !rect) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ ...cardBase, width: 400, maxWidth: '100%', textAlign: 'left' as const }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, fontSize: 22 }}>
            {isLast ? '🎉' : '👋'}
          </div>
          {cardBody}
        </div>
      </div>
    );
  }

  // Posição do tooltip (desktop): direita → esquerda → abaixo → acima
  const W = 340, GAP = 14;
  const vw = window.innerWidth, vh = window.innerHeight;
  let tipStyle: React.CSSProperties;
  if (isMobile) {
    tipStyle = { position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: Z + 2 };
  } else if (rect.right + GAP + W < vw) {
    tipStyle = { position: 'fixed', left: rect.right + GAP, top: Math.max(12, Math.min(rect.top, vh - 300)), width: W, zIndex: Z + 2 };
  } else if (rect.left - GAP - W > 0) {
    tipStyle = { position: 'fixed', left: rect.left - GAP - W, top: Math.max(12, Math.min(rect.top, vh - 300)), width: W, zIndex: Z + 2 };
  } else if (rect.bottom + GAP + 220 < vh) {
    tipStyle = { position: 'fixed', left: Math.max(12, Math.min(rect.left, vw - W - 12)), top: rect.bottom + GAP, width: W, zIndex: Z + 2 };
  } else {
    tipStyle = { position: 'fixed', left: Math.max(12, Math.min(rect.left, vw - W - 12)), bottom: vh - rect.top + GAP, width: W, zIndex: Z + 2 };
  }

  const PAD = 6;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z }}>
      {/* Spotlight: recorte claro sobre o alvo, escurece o resto via box-shadow gigante */}
      <div style={{
        position: 'fixed',
        left: rect.left - PAD, top: rect.top - PAD,
        width: rect.width + PAD * 2, height: rect.height + PAD * 2,
        borderRadius: 12, border: `2px solid ${ACCENT}`,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
        transition: 'all 0.25s ease', pointerEvents: 'none', zIndex: Z + 1,
        boxSizing: 'border-box',
      }} />
      <div style={{ ...cardBase, ...tipStyle }}>{cardBody}</div>
    </div>
  );
}
