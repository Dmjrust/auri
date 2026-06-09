import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { calcAge, fmtDate, fmtTimer, primaryGuardian } from '@/lib/auri-utils';
import type { Patient } from '@/data/mock';

// ── Utilitário: data relativa ao "hoje" do teste ─────────────────────────────
function dateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}
function dateYearsAgo(years: number, extraMonths = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - extraMonths);
  return d.toISOString().split('T')[0];
}

describe('calcAge', () => {
  it('recém-nascido (0 meses) → "0 meses"', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(calcAge(today)).toBe('0 meses');
  });

  it('1 mês exato → "1 mês"', () => {
    expect(calcAge(dateMonthsAgo(1))).toBe('1 mês');
  });

  it('6 meses → "6 meses"', () => {
    expect(calcAge(dateMonthsAgo(6))).toBe('6 meses');
  });

  it('12 meses exatos → "1 ano"', () => {
    expect(calcAge(dateYearsAgo(1, 0))).toBe('1 ano');
  });

  it('14 meses → "1 ano e 2m"', () => {
    expect(calcAge(dateYearsAgo(1, 2))).toBe('1 ano e 2m');
  });

  it('24 meses exatos → "2 anos"', () => {
    expect(calcAge(dateYearsAgo(2, 0))).toBe('2 anos');
  });

  it('3 anos e 5 meses → "3 anos e 5m"', () => {
    expect(calcAge(dateYearsAgo(3, 5))).toBe('3 anos e 5m');
  });
});

describe('fmtDate', () => {
  it('null → "—"', () => {
    expect(fmtDate(null)).toBe('—');
  });

  it('"2026-01-15" → "15/01/2026"', () => {
    expect(fmtDate('2026-01-15')).toBe('15/01/2026');
  });

  it('"2025-12-31" → "31/12/2025"', () => {
    expect(fmtDate('2025-12-31')).toBe('31/12/2025');
  });

  it('não deslocar dia para UTC (sem midnight shift)', () => {
    // ISO "2026-03-01" deve ser 01, não 28/Fev por UTC shift
    expect(fmtDate('2026-03-01')).toBe('01/03/2026');
  });
});

describe('fmtTimer', () => {
  it('0s → "00:00"', () => {
    expect(fmtTimer(0)).toBe('00:00');
  });

  it('65s → "01:05"', () => {
    expect(fmtTimer(65)).toBe('01:05');
  });

  it('3600s → "60:00"', () => {
    expect(fmtTimer(3600)).toBe('60:00');
  });
});

describe('primaryGuardian', () => {
  const base: Patient = {
    id: 'p1',
    full_name: 'Criança Teste',
    birth_date: '2023-01-01',
    gender: 'M',
    guardians: [],
    is_active: true,
    doctor_id: 'doc1',
    created_at: '',
  } as unknown as Patient;

  it('retorna guardian com is_primary=true quando existe', () => {
    const patient = {
      ...base,
      guardians: [
        { id: 'g1', is_primary: false, name: 'Pai' },
        { id: 'g2', is_primary: true, name: 'Mãe' },
      ],
    } as unknown as Patient;
    expect(primaryGuardian(patient).name).toBe('Mãe');
  });

  it('retorna [0] quando nenhum is_primary', () => {
    const patient = {
      ...base,
      guardians: [
        { id: 'g1', is_primary: false, name: 'Pai' },
        { id: 'g2', is_primary: false, name: 'Avó' },
      ],
    } as unknown as Patient;
    expect(primaryGuardian(patient).name).toBe('Pai');
  });
});
