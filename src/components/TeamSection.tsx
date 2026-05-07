import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, EnvelopeSimple, CheckCircle, X, Warning, UsersThree, UserMinus, ArrowCounterClockwise } from '@phosphor-icons/react';
import * as db from '../lib/db';
import type { TeamMember } from '../lib/db';
import { useAuthProfile } from '../contexts/AuthProfileContext';

// ── Design tokens (espelho de App.tsx) ────────────────────────────────────────
const P    = '#0F4C5C';
const PL   = '#E6F2F4';
const INK  = '#1A1D1C';
const MU   = '#6B7280';
const BO   = '#E5E7EB';
const SEC  = '#F4F1EC';
const SUC  = '#5B8A6F';
const SUCL = '#ECFDF5';
const WARN = '#C68B3E';
const WARNL = '#FFF8EC';
const DES  = '#D1646F';
const DESL = '#FEF2F2';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${BO}`,
  borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: INK,
};

// ── Badges ────────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: 'medico' | 'secretaria' }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: role === 'medico' ? PL : SEC,
      color: role === 'medico' ? P : MU,
      textTransform: 'uppercase' as const, letterSpacing: 0.4,
    }}>
      {role === 'medico' ? 'Médico' : 'Secretária'}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: active ? SUC : MU }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? SUC : BO, display: 'inline-block' }} />
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

// ── Modal de convite ──────────────────────────────────────────────────────────
function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (email: string) => void }) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleInvite() {
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('E-mail inválido.'); return;
    }
    setLoading(true); setError('');
    try {
      await db.inviteSecretary(email.trim(), name.trim());
      onSuccess(email.trim());
    } catch (e: any) {
      setError(e.message ?? 'Erro ao enviar convite.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: INK }}>Convidar secretária</div>
            <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>Ela receberá um e-mail para criar a senha</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, padding: 4 }}><X size={18} /></button>
        </div>

        {/* Form */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>Nome completo *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome da secretária"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>E-mail *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
          </div>

          {error && (
            <div style={{ background: DESL, color: DES, borderRadius: 8, padding: '10px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Warning size={15} weight="fill" />{error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px 0', background: SEC, color: INK, border: `1px solid ${BO}`,
              borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}>Cancelar</button>
            <button onClick={handleInvite} disabled={loading} style={{
              flex: 1, padding: '10px 0', background: P, color: '#fff', border: 'none',
              borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {loading ? 'Enviando…' : <><EnvelopeSimple size={15} /> Enviar convite</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de confirmação de desativação ───────────────────────────────────────
function ConfirmModal({
  member, onConfirm, onClose, loading,
}: {
  member: TeamMember; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  const action = member.active ? 'Desativar' : 'Reativar';
  const actionColor = member.active ? DES : SUC;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 380, padding: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: INK, marginBottom: 10 }}>
          {action} acesso?
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: MU, lineHeight: 1.6 }}>
          {member.active
            ? `${member.fullName} não conseguirá mais acessar o sistema após a desativação.`
            : `${member.fullName} voltará a ter acesso ao sistema.`}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', background: SEC, color: INK, border: `1px solid ${BO}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: '10px 0', background: actionColor, color: '#fff', border: 'none',
            borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}>
            {loading ? 'Aguarde…' : action}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TeamSection — componente principal ────────────────────────────────────────
export function TeamSection() {
  const { profile } = useAuthProfile();
  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showInvite, setShowInvite]     = useState(false);
  const [confirmMember, setConfirmMember] = useState<TeamMember | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg]     = useState('');
  const [errorMsg, setErrorMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setMembers(await db.fetchTeamMembers()); }
    catch (e: any) { setErrorMsg(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string, isError = false) {
    if (isError) { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 5000); }
    else { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); }
  }

  async function handleToggleActive(member: TeamMember) {
    setActionLoading(true);
    try {
      if (member.active) await db.deactivateMember(member.userId);
      else await db.reactivateMember(member.userId);
      flash(member.active ? `Acesso de ${member.fullName} desativado.` : `${member.fullName} reativado com sucesso.`);
      await load();
    } catch (e: any) {
      flash(e.message ?? 'Erro ao atualizar acesso.', true);
    } finally {
      setActionLoading(false);
      setConfirmMember(null);
    }
  }

  return (
    <div>
      {/* Modais */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={(email) => {
            setShowInvite(false);
            flash(`Convite enviado para ${email} ✓`);
            load();
          }}
        />
      )}
      {confirmMember && (
        <ConfirmModal
          member={confirmMember}
          loading={actionLoading}
          onClose={() => setConfirmMember(null)}
          onConfirm={() => handleToggleActive(confirmMember)}
        />
      )}

      {/* Header da seção */}
      <div style={{
        background: '#fff', border: `1px solid ${BO}`, borderRadius: 10,
        overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UsersThree size={20} color={P} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: INK }}>Equipe e Acessos</div>
              <div style={{ fontSize: 12, color: MU, marginTop: 1 }}>Gerencie quem tem acesso ao consultório</div>
            </div>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', background: P, color: '#fff',
              border: 'none', borderRadius: 7, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            <UserPlus size={15} /> Adicionar secretária
          </button>
        </div>

        {/* Feedback global */}
        {successMsg && (
          <div style={{ margin: '12px 24px 0', background: SUCL, color: SUC, borderRadius: 7, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={15} weight="fill" />{successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ margin: '12px 24px 0', background: DESL, color: DES, borderRadius: 7, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Warning size={15} weight="fill" />{errorMsg}
          </div>
        )}

        {/* Lista de membros */}
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: MU, fontSize: 14 }}>Carregando equipe…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: MU, fontSize: 14 }}>
            Nenhum membro cadastrado. Convide a sua secretária.
          </div>
        ) : (
          <div>
            {members.map((m, i) => {
              const isSelf = m.userId === profile?.userId;
              return (
                <div
                  key={m.id}
                  style={{
                    padding: '16px 24px',
                    borderBottom: i < members.length - 1 ? `1px solid ${BO}` : 'none',
                    display: 'flex', alignItems: 'center', gap: 14,
                    opacity: m.active ? 1 : 0.6,
                    background: m.active ? '#fff' : SEC,
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: m.role === 'medico' ? PL : '#F0EDE8',
                    color: m.role === 'medico' ? P : MU,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {m.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {m.fullName}
                      {isSelf && <span style={{ fontSize: 11, color: MU, fontWeight: 400 }}>(você)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{m.email}</div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <RoleBadge role={m.role} />
                    <StatusBadge active={m.active} />
                  </div>

                  {/* Ação (só para secretárias, nunca para si mesmo) */}
                  {!isSelf && m.role === 'secretaria' && (
                    <button
                      onClick={() => setConfirmMember(m)}
                      title={m.active ? 'Desativar acesso' : 'Reativar acesso'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        border: `1px solid ${m.active ? DES + '40' : SUC + '40'}`,
                        background: m.active ? DESL : SUCL,
                        color: m.active ? DES : SUC,
                        flexShrink: 0,
                      }}
                    >
                      {m.active
                        ? <><UserMinus size={13} /> Desativar</>
                        : <><ArrowCounterClockwise size={13} /> Reativar</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nota informativa */}
      <div style={{ marginTop: 14, background: WARNL, border: `1px solid ${WARN}30`, borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Warning size={15} color={WARN} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: WARN, lineHeight: 1.6 }}>
          A secretária recebe acesso à agenda e cadastro de pacientes. Prontuários clínicos e dados sensíveis são exclusivos do médico.
          Desativar bloqueia o acesso imediatamente sem apagar dados.
        </div>
      </div>
    </div>
  );
}
