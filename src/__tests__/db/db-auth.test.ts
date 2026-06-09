/**
 * Fluxo: Login → fetchProfile → updateProfile (OnboardingPage)
 *
 * Cobre:
 *  - fetchProfile com usuário autenticado → retorna dados do perfil
 *  - fetchProfile quando não autenticado → retorna null
 *  - updateProfile salva specialty='Pediatria' (usado pelo novo OnboardingPage)
 *  - updateProfile lança erro se não autenticado
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'doctor-uuid', email: 'dr@test.com' } },
        error: null,
      }),
    },
  },
}));

import * as db from '@/lib/db';
import { supabase } from '@/lib/supabase';

describe('fetchProfile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('retorna dados do perfil quando autenticado', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              full_name: 'Dr. Daniel',
              crm: 'CRM-SP 123456',
              specialty: 'Pediatria',
              phone: '11999999999',
              clinic_name: 'Clínica Pediátrica',
              clinic_phone: null,
              clinic_email: null,
              clinic_address: null,
              clinic_hours_start: '08:00',
              clinic_hours_end: '18:00',
              prontuario_format: 'narrativo',
            },
            error: null,
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const profile = await db.fetchProfile();

    expect(profile).not.toBeNull();
    expect(profile!.specialty).toBe('Pediatria');
    expect(profile!.full_name).toBe('Dr. Daniel');
    expect(profile!.crm).toBe('CRM-SP 123456');
  });

  it('retorna null quando usuário não está autenticado', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    const profile = await db.fetchProfile();
    expect(profile).toBeNull();
  });

  it('retorna null quando profile não existe no banco (novo usuário)', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const profile = await db.fetchProfile();
    expect(profile).toBeNull();
  });

  it('needsOnboarding = true quando specialty é null (novo médico)', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { full_name: '', crm: '', specialty: null, phone: null,
                    clinic_name: null, clinic_phone: null, clinic_email: null,
                    clinic_address: null, clinic_hours_start: null, clinic_hours_end: null,
                    prontuario_format: null },
            error: null,
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const profile = await db.fetchProfile();
    // Simula a lógica do App.tsx: !profile.specialty → needsOnboarding = true
    const needsOnboarding = !profile || !profile.specialty;
    expect(needsOnboarding).toBe(true);
  });
});

describe('updateProfile — OnboardingPage (specialty fixada em Pediatria)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('salva specialty=Pediatria via upsert na tabela profiles', async () => {
    const capturedUpsert: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockReturnValue({
      upsert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        capturedUpsert.push(data);
        return Promise.resolve({ error: null });
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    await db.updateProfile({
      full_name: 'Dr. Lucas Mendes',
      crm: 'CRM-SP 999999',
      clinic_name: 'Clínica Pediátrica',
      specialty: 'Pediatria',
    });

    expect(capturedUpsert).toHaveLength(1);
    expect(capturedUpsert[0].specialty).toBe('Pediatria');
    expect(capturedUpsert[0].full_name).toBe('Dr. Lucas Mendes');
    expect(capturedUpsert[0].id).toBe('doctor-uuid'); // doctor_id injetado
  });

  it('lança erro quando não autenticado', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    await expect(db.updateProfile({ specialty: 'Pediatria' })).rejects.toThrow('Não autenticado');
  });
});
