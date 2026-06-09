import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'doctor-123' } },
        error: null,
      }),
    },
  },
}));

import * as db from '@/lib/db';
import { supabase } from '@/lib/supabase';

// Nota: fetchGrowthRecords mapeia month_age → month, weight_kg → weight, height_cm → height, head_circumference_cm → hc
describe('fetchGrowthRecords', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('mapeia campos corretamente: month_age→month, weight_kg→weight, height_cm→height, head_circumference_cm→hc', async () => {
    const rawRows = [
      { id: 'gr1', patient_id: 'p1', month_age: 12, weight_kg: 9.6, height_cm: 75.7, head_circumference_cm: 46.3, created_at: '2026-01-01T00:00:00Z' },
    ];

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rawRows, error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const records = await db.fetchGrowthRecords('p1');
    expect(records).toHaveLength(1);
    expect(records[0].month).toBe(12);
    // A função mapeia weight_kg → weight (field name no GrowthRecord é 'weight')
    expect(records[0].weight).toBe(9.6);
    expect(records[0].height).toBe(75.7);
    expect(records[0].hc).toBe(46.3);
    expect(records[0].date).toBe('2026-01-01');
  });

  it('retorna múltiplos registros preservando ordem (month_age ASC)', async () => {
    const rawRows = [
      { id: 'gr1', patient_id: 'p1', month_age: 0,  weight_kg: 3.2, height_cm: 49.5, head_circumference_cm: 34.1, created_at: '2025-01-01' },
      { id: 'gr2', patient_id: 'p1', month_age: 6,  weight_kg: 7.8, height_cm: 67.0, head_circumference_cm: 43.0, created_at: '2025-07-01' },
      { id: 'gr3', patient_id: 'p1', month_age: 12, weight_kg: 9.6, height_cm: 75.7, head_circumference_cm: 46.3, created_at: '2026-01-01' },
    ];

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rawRows, error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const records = await db.fetchGrowthRecords('p1');
    expect(records).toHaveLength(3);
    expect(records[0].month).toBe(0);
    expect(records[2].month).toBe(12);
  });

  it('retorna array vazio se não há registros', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const records = await db.fetchGrowthRecords('patient-without-records');
    expect(records).toEqual([]);
  });

  it('lança erro se Supabase retornar error', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    } as unknown as ReturnType<typeof supabase.from>);

    await expect(db.fetchGrowthRecords('p-error')).rejects.toMatchObject({ message: 'DB error' });
  });
});
