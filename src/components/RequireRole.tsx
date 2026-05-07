import React from 'react';
import { useAuthProfile } from '../contexts/AuthProfileContext';
import * as db from '../lib/db';

// ── AccessDenied — tela padrão quando role não autorizado ────────────────────

function AccessDenied({ onBack }: { onBack?: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 320, padding: 40, textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: '#FEF2F2', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 26, marginBottom: 20,
      }}>
        🔒
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1A1D1C' }}>
        Acesso restrito
      </h3>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6B7280', maxWidth: 320, lineHeight: 1.6 }}>
        Esta seção é exclusiva para médicos.
        Entre em contato com o Dr. responsável caso precise de acesso.
      </p>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: '#0F4C5C', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Voltar
        </button>
      )}
    </div>
  );
}

// ── RequireRole — wrapper de autorização por papel ───────────────────────────

interface RequireRoleProps {
  roles: Array<'medico' | 'secretaria'>;
  children: React.ReactNode;
  /** Conteúdo alternativo. Se omitido, renderiza <AccessDenied /> */
  fallback?: React.ReactNode;
  /** Callback do botão Voltar em <AccessDenied />. Opcional. */
  onBack?: () => void;
}

export function RequireRole({ roles, children, fallback, onBack }: RequireRoleProps) {
  const { role, isLoading } = useAuthProfile();

  // Durante carregamento não bloqueia — evita flash de "acesso restrito"
  if (isLoading) return null;

  // Se role não está na lista autorizada → fallback ou AccessDenied padrão
  if (!role || !roles.includes(role)) {
    return fallback !== undefined
      ? <>{fallback}</>
      : <AccessDenied onBack={onBack} />;
  }

  return <>{children}</>;
}

// ── useRequireRole — hook para lógica condicional fora do JSX ─────────────────

export function useRequireRole(roles: Array<'medico' | 'secretaria'>): boolean {
  const { role, isLoading } = useAuthProfile();
  if (isLoading || !role) return false;
  return roles.includes(role);
}
