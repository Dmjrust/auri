/**
 * Testes do AuthProfileContext — derivação de flags por role
 *
 * Verifica que o contexto de auth deriva corretamente isAdmin, isDoctor, isSecretary
 * a partir do campo `role` em user_profiles. Um erro aqui quebraria todo o
 * roteamento condicional da aplicação.
 *
 * Usa renderHook do @testing-library/react.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProfileProvider, useAuthProfile } from '@/contexts/AuthProfileContext';
import { supabase } from '@/lib/supabase';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockUserProfileRow(role: 'medico' | 'secretaria' | 'admin') {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'profile-uuid',
              user_id: 'doctor-uuid-123',
              doctor_id: 'doctor-uuid-123',
              role,
              full_name: role === 'admin' ? 'Admin Auri' : 'Dr. Daniel',
              email: role === 'admin' ? 'admin@auri.app' : 'dr@test.com',
              active: true,
            },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof supabase.from>);
}

function mockAuthSession(userId = 'doctor-uuid-123') {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: {
      session: {
        user: { id: userId, email: 'dr@test.com' },
      } as unknown as NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>,
    },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

  // onAuthStateChange não dispara no teste — retorna unsubscribe vazio
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>);
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProfileProvider, null, children);

// ── Testes ───────────────────────────────────────────────────────────────────

describe('AuthProfileContext — derivação de flags por role', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession();
  });

  it('role=admin → isAdmin=true, isDoctor=false, isSecretary=false', async () => {
    mockUserProfileRow('admin');
    const { result } = renderHook(() => useAuthProfile(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isDoctor).toBe(false);
    expect(result.current.isSecretary).toBe(false);
    expect(result.current.role).toBe('admin');
  });

  it('role=medico → isDoctor=true, isAdmin=false, isSecretary=false', async () => {
    mockUserProfileRow('medico');
    const { result } = renderHook(() => useAuthProfile(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDoctor).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isSecretary).toBe(false);
    expect(result.current.role).toBe('medico');
  });

  it('role=secretaria → isSecretary=true, isAdmin=false, isDoctor=false', async () => {
    mockUserProfileRow('secretaria');
    const { result } = renderHook(() => useAuthProfile(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSecretary).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isDoctor).toBe(false);
    expect(result.current.role).toBe('secretaria');
  });

  it('isLoading=true no estado inicial (antes de resolver)', () => {
    // Simula query lenta — nunca resolve neste teste
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue(new Promise(() => {})), // nunca resolve
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const { result } = renderHook(() => useAuthProfile(), { wrapper });

    // Antes de resolver: isLoading=true, isAdmin=false (não deve ser true prematuramente)
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isDoctor).toBe(false);
  });

  it('sem sessão → role=null, todos os flags false', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    const { result } = renderHook(() => useAuthProfile(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.role).toBe(null);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isDoctor).toBe(false);
    expect(result.current.isSecretary).toBe(false);
  });
});
