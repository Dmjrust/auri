import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Baby, Stethoscope, User, UsersThree, ShieldCheck, CheckCircle, Sparkle,
} from '@phosphor-icons/react';
import * as db from '../lib/db';
import { Card, Btn, Badge } from './auri-ui';
import { P, PL, INK, MU, BO, BG, SEC, SUC, SUCL } from '../lib/design';

// Renderizado antes do MobileCtx.Provider (telas de bloqueio em App.tsx), por
// isso usa detecção própria em vez de consumir o contexto.
function useLocalIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

const ESPECIALIDADES = ['Pediatria', 'Clínica Geral'] as const;
type Specialty = typeof ESPECIALIDADES[number];

const SPECIALTY_INFO: Record<Specialty, { icon: React.ElementType; features: string[] }> = {
  'Pediatria': {
    icon: Baby,
    features: ['Curvas de crescimento (OMS)', 'Vacinação (PNI)', 'Acompanhamento do desenvolvimento', 'SOAP Pediátrico'],
  },
  'Clínica Geral': {
    icon: Stethoscope,
    features: ['Prontuário adulto', 'Medicações', 'Exames', 'Acompanhamento longitudinal'],
  },
};

const STEP_LABELS = ['Especialidade', 'Dados profissionais', 'Configuração', 'Pronto'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff', color: INK,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: 0.5,
};

function SectionHeading({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: PL, color: P,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
      }}>{index}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{title}</div>
        <div style={{ fontSize: 12.5, color: MU, marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function SelectCard({
  active, onClick, icon: Icon, title, children,
}: { active: boolean; onClick: () => void; icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, cursor: 'pointer', padding: 16, borderRadius: 10,
        border: `1.5px solid ${active ? P : BO}`,
        background: active ? PL : '#fff',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, background: active ? '#fff' : SEC,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={active ? P : MU} />
        </div>
        <span style={{
          width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${active ? P : BO}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: P }} />}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

export function OnboardingSetup({ user, onComplete }: { user: SupabaseUser; onComplete: (specialty: string) => void }) {
  const isMobile = useLocalIsMobile();

  const [fullName, setFullName] = useState(user.user_metadata?.full_name || '');
  const [crm, setCrm] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [chosenSpecialty, setChosenSpecialty] = useState<Specialty>('Pediatria');
  const [workMode, setWorkMode] = useState<'solo' | 'team'>('solo');
  const [secName, setSecName] = useState('');
  const [secEmail, setSecEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const secPairInvalid =
    (!!secName.trim() && !secEmail.trim()) ||
    (!!secEmail.trim() && !secName.trim()) ||
    (!!secEmail.trim() && !EMAIL_RE.test(secEmail.trim()));

  const requiredOk = !!fullName.trim() && !!crm.trim();
  const canSubmit = requiredOk && !secPairInvalid && !saving;

  // passo "atual" só para a trilha de progresso (todas as seções já estão visíveis)
  const activeStepIndex = !requiredOk ? 1 : workMode === 'team' && secPairInvalid ? 2 : 3;

  async function handleSubmit() {
    if (!requiredOk || secPairInvalid) return;
    setSaving(true);
    try {
      await db.updateProfile({
        full_name: fullName.trim(),
        crm: crm.trim(),
        clinic_name: clinicName.trim(),
        specialty: chosenSpecialty,
        work_mode: workMode,
      });
    } catch {
      setSaving(false);
      toast.error('Erro ao salvar perfil. Tente novamente.');
      return;
    }

    if (workMode === 'team' && secName.trim() && secEmail.trim()) {
      try {
        await db.inviteSecretary(secEmail.trim(), secName.trim());
      } catch {
        toast.error('Perfil salvo, mas o convite à secretária falhou. Você pode reenviar em Configurações → Equipe.');
      }
    }

    onComplete(chosenSpecialty);
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: isMobile ? 16 : 32, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 16 : 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: P, fontFamily: '"Fraunces", serif', letterSpacing: '-0.5px' }}>Auri</div>
        </div>

        {/* Trilha de progresso */}
        {isMobile ? (
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {STEP_LABELS.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i + 1 <= activeStepIndex ? P : BO,
              }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
            {STEP_LABELS.map((label, i) => {
              const done = i + 1 < activeStepIndex;
              const current = i + 1 === activeStepIndex;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {done
                    ? <CheckCircle size={14} weight="fill" color={SUC} />
                    : <span style={{ width: 6, height: 6, borderRadius: '50%', background: current ? P : BO, display: 'inline-block' }} />}
                  <span style={{ fontSize: 12, fontWeight: current ? 700 : 500, color: current ? P : MU }}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        <Card style={{ padding: isMobile ? 20 : 32, borderRadius: 16, boxShadow: '0 4px 24px rgba(15,76,92,0.08)' }}>
          {/* Cabeçalho */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 22, fontWeight: 700, color: INK, fontFamily: '"Fraunces", serif' }}>
              Bem-vindo ao Auri! <Sparkle size={18} color={P} weight="fill" />
            </div>
            <div style={{ fontSize: 13.5, color: MU, marginTop: 6 }}>
              Vamos personalizar sua experiência clínica. Leva menos de 1 minuto.
            </div>
          </div>

          {/* Seção 1 — Especialidade */}
          <SectionHeading index={1} title="Escolha sua especialidade principal" subtitle="Isso nos ajuda a configurar o Auri para a sua prática clínica." />
          <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row', marginBottom: 16 }}>
            {ESPECIALIDADES.map(s => {
              const info = SPECIALTY_INFO[s];
              return (
                <SelectCard key={s} active={chosenSpecialty === s} onClick={() => setChosenSpecialty(s)} icon={info.icon} title={s}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {info.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MU }}>
                        <CheckCircle size={13} color={chosenSpecialty === s ? SUC : BO} weight="fill" />
                        {f}
                      </div>
                    ))}
                  </div>
                </SelectCard>
              );
            })}
          </div>
          <div style={{ background: SEC, borderRadius: 10, padding: '12px 16px', marginBottom: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: MU, fontWeight: 600, marginRight: 4 }}>Seu Auri será configurado com:</span>
            {SPECIALTY_INFO[chosenSpecialty].features.map(f => <Badge key={f}>{f}</Badge>)}
          </div>

          {/* Seção 2 — Dados profissionais */}
          <SectionHeading index={2} title="Dados profissionais" subtitle="Informe seus dados para personalizarmos sua conta." />
          <div style={{ display: 'flex', gap: 16, flexDirection: isMobile ? 'column' : 'row', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nome completo *</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. Nome Sobrenome" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>CRM *</label>
              <input value={crm} onChange={e => setCrm(e.target.value)} placeholder="CRM-SP 123456" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Nome do consultório</label>
            <input value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="Consultório Dr. ..." style={inputStyle} />
          </div>

          {/* Seção 3 — Modo de trabalho */}
          <SectionHeading index={3} title="Como você trabalha?" subtitle="Isso nos ajuda a habilitar os recursos ideais para você." />
          <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row', marginBottom: workMode === 'team' ? 16 : 28 }}>
            <SelectCard active={workMode === 'solo'} onClick={() => setWorkMode('solo')} icon={User} title="Médico sozinho">
              <div style={{ fontSize: 12.5, color: MU }}>Trabalho de forma individual</div>
            </SelectCard>
            <SelectCard active={workMode === 'team'} onClick={() => setWorkMode('team')} icon={UsersThree} title="Com equipe">
              <div style={{ fontSize: 12.5, color: MU }}>Tenho secretária ou equipe de apoio</div>
            </SelectCard>
          </div>

          {workMode === 'team' && (
            <div style={{ background: SEC, borderRadius: 10, padding: 16, marginBottom: 28 }}>
              <div style={{ fontSize: 12.5, color: MU, marginBottom: 12 }}>
                Você pode convidar agora ou fazer isso depois em Configurações → Equipe.
              </div>
              <div style={{ display: 'flex', gap: 16, flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nome da secretária</label>
                  <input value={secName} onChange={e => setSecName(e.target.value)} placeholder="Nome completo" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>E-mail da secretária</label>
                  <input type="email" value={secEmail} onChange={e => setSecEmail(e.target.value)} placeholder="email@exemplo.com" style={inputStyle} />
                </div>
              </div>
              {secPairInvalid && (
                <div style={{ fontSize: 12, color: '#9A3A2A', marginTop: 10 }}>
                  Preencha nome e e-mail válidos para convidar, ou deixe os dois em branco.
                </div>
              )}
            </div>
          )}

          {/* Bloco final */}
          <div style={{ background: PL, borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <CheckCircle size={28} color={P} weight="fill" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 4 }}>Tudo pronto para começar!</div>
            <div style={{ fontSize: 12.5, color: MU, marginBottom: 18 }}>
              Ao clicar no botão abaixo, seu Auri será configurado de acordo com suas preferências.
            </div>
            <Btn onClick={handleSubmit} disabled={!canSubmit} size="lg" style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
              {saving ? 'Salvando…' : 'Começar a usar o Auri →'}
            </Btn>
          </div>
        </Card>

        {/* Nota de segurança */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <ShieldCheck size={15} color={MU} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: MU, textAlign: 'center' }}>
            Seus dados são protegidos com criptografia em trânsito e em repouso.
          </span>
        </div>
      </div>
    </div>
  );
}
