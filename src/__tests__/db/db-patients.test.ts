/**
 * Fluxo: Cadastro de paciente pediátrico
 *
 * Cobre:
 *  - createPatient: insere paciente + responsável principal em sequência
 *  - createPatient: seta doctor_id do usuário autenticado
 *  - createPatient: lança erro quando não autenticado
 *  - fetchPatients: retorna lista mapeada corretamente
 *  - fetchPatients: retorna [] quando não há pacientes
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

// ── Tipos mínimos para simular rows do banco ─────────────────────────────────
const makePatientRow = (overrides = {}) => ({
  id: 'patient-001',
  doctor_id: 'doctor-uuid',
  full_name: 'João da Silva',
  birth_date: '2023-06-01',
  gender: 'M',
  blood_type: null,
  delivery_type: 'normal',
  gestational_age_weeks: null,
  birth_weight_g: null,
  notes: '',
  insurance_plan: null,
  insurance_card_number: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  patient_guardians: [{
    name: 'Maria Silva',
    relationship: 'Mãe',
    phone: '11999990000',
    email: null,
    is_primary: true,
  }],
  ...overrides,
});

describe('createPatient — cadastro pediátrico', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('insere paciente e responsável em duas queries sequenciais', async () => {
    const capturedPatient: Record<string, unknown>[] = [];
    const capturedGuardian: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patients') {
        return {
          insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            capturedPatient.push(data);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: makePatientRow(), error: null }),
              }),
            };
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'patient_guardians') {
        return {
          insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            capturedGuardian.push(data);
            return Promise.resolve({ error: null });
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {} as unknown as ReturnType<typeof supabase.from>;
    });

    const patient = await db.createPatient({
      full_name: 'João da Silva',
      birth_date: '2023-06-01',
      gender: 'M',
      guardian_name: 'Maria Silva',
      guardian_relationship: 'Mãe',
      guardian_phone: '11999990000',
    });

    // Verificar paciente
    expect(capturedPatient).toHaveLength(1);
    expect(capturedPatient[0].full_name).toBe('João da Silva');
    expect(capturedPatient[0].doctor_id).toBe('doctor-uuid');
    expect(capturedPatient[0].gender).toBe('M');

    // Verificar responsável
    expect(capturedGuardian).toHaveLength(1);
    expect(capturedGuardian[0].name).toBe('Maria Silva');
    expect(capturedGuardian[0].relationship).toBe('Mãe');
    expect(capturedGuardian[0].is_primary).toBe(true);
    expect(capturedGuardian[0].patient_id).toBe('patient-001');

    // Verificar retorno
    expect(patient.id).toBe('patient-001');
    expect(patient.full_name).toBe('João da Silva');
  });

  it('seta doctor_id do usuário autenticado no insert', async () => {
    const capturedInsert: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patients') {
        return {
          insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            capturedInsert.push(data);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: makePatientRow(), error: null }),
              }),
            };
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.createPatient({
      full_name: 'Maria Souza',
      birth_date: '2022-01-15',
      gender: 'F',
      guardian_name: 'Ana Souza',
      guardian_relationship: 'Mãe',
      guardian_phone: '11988880000',
    });

    expect(capturedInsert[0].doctor_id).toBe('doctor-uuid');
  });

  it('lança erro quando usuário não autenticado', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    await expect(db.createPatient({
      full_name: 'Teste',
      birth_date: '2020-01-01',
      gender: 'M',
      guardian_name: 'Responsável',
      guardian_relationship: 'Pai',
      guardian_phone: '11000000000',
    })).rejects.toThrow('Não autenticado');
  });

  it('propaga erro do banco quando insert de paciente falha', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unique violation' } }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(db.createPatient({
      full_name: 'Duplicado',
      birth_date: '2021-05-10',
      gender: 'M',
      guardian_name: 'Pai',
      guardian_relationship: 'Pai',
      guardian_phone: '11111111111',
    })).rejects.toMatchObject({ message: 'unique violation' });
  });
});

describe('fetchPatients', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('retorna lista de pacientes mapeados', async () => {
    const rows = [
      makePatientRow({ id: 'p1', full_name: 'Lucas Oliveira' }),
      makePatientRow({ id: 'p2', full_name: 'Ana Costa', gender: 'F' }),
    ];

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const patients = await db.fetchPatients();
    expect(patients).toHaveLength(2);
    expect(patients[0].id).toBe('p1');
    expect(patients[1].full_name).toBe('Ana Costa');
  });

  it('retorna [] quando não há pacientes', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const patients = await db.fetchPatients();
    expect(patients).toEqual([]);
  });
});
