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

describe('updatePatient', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('atualiza dados cadastrais e o responsável primário existente', async () => {
    const capturedPatientUpdate: Record<string, unknown>[] = [];
    const capturedGuardianUpdate: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patients') {
        return {
          update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            capturedPatientUpdate.push(data);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === 'patient_guardians') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'g1' }, error: null }),
              }),
            }),
          }),
          update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            capturedGuardianUpdate.push(data);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {} as unknown as ReturnType<typeof supabase.from>;
    });

    await db.updatePatient('patient-001', {
      full_name: 'João da Silva Filho',
      birth_date: '2023-06-01',
      gender: 'M',
      blood_type: 'O+',
      guardian_name: 'Maria Silva',
      guardian_phone: '11977770000',
    });

    expect(capturedPatientUpdate[0].full_name).toBe('João da Silva Filho');
    expect(capturedPatientUpdate[0].blood_type).toBe('O+');
    expect(capturedGuardianUpdate[0].phone).toBe('11977770000');
  });

  it('cria responsável primário quando não existe', async () => {
    const capturedGuardianInsert: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patients') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          capturedGuardianInsert.push(data);
          return Promise.resolve({ error: null });
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    await db.updatePatient('patient-002', {
      full_name: 'Ana', birth_date: '1990-01-01', gender: 'F',
      guardian_name: 'Contato', guardian_phone: '11900000000',
    });

    expect(capturedGuardianInsert[0].patient_id).toBe('patient-002');
    expect(capturedGuardianInsert[0].is_primary).toBe(true);
  });

  it('propaga erro do banco (ex.: RLS bloqueou)', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(db.updatePatient('p1', { full_name: 'X', birth_date: '2020-01-01', gender: 'M' }))
      .rejects.toMatchObject({ message: 'permission denied' });
  });
});

describe('archivePatient / deletePatientPermanently', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('archivePatient seta is_active=false no paciente certo', async () => {
    const captured: { data?: Record<string, unknown>; id?: string } = {};
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        captured.data = data;
        return { eq: vi.fn().mockImplementation((_c: string, id: string) => { captured.id = id; return Promise.resolve({ error: null }); }) };
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    await db.archivePatient('patient-009');
    expect(captured.data).toEqual({ is_active: false });
    expect(captured.id).toBe('patient-009');
  });

  it('deletePatientPermanently deleta pelo id', async () => {
    let deletedId = '';
    vi.mocked(supabase.from).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_c: string, id: string) => { deletedId = id; return Promise.resolve({ error: null }); }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    await db.deletePatientPermanently('patient-777');
    expect(deletedId).toBe('patient-777');
  });

  it('deletePatientPermanently propaga erro de RLS', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(db.deletePatientPermanently('p1')).rejects.toMatchObject({ message: 'permission denied' });
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
