import { describe, it, expect } from 'vitest';
import { calcZScore, zToPercentile, _getLms } from '@/lib/zscore';
import type { LmsPoint } from '@/data/mock';

// ── Dados de referência OMS ───────────────────────────────────────────────────
// Menino 12 meses: mediana peso = 9.6 kg, altura = 75.7 cm, PC = 46.3 cm
// Menina 12 meses: mediana peso = 8.9 kg, altura = 74.0 cm, PC = 45.0 cm

describe('_getLms', () => {
  const table: LmsPoint[] = [
    { month: 0,  L: 0.3487, M: 3.3464, S: 0.14602 },
    { month: 6,  L: 0.2376, M: 7.934,  S: 0.11140 },
    { month: 12, L: 0.1714, M: 9.6007, S: 0.10941 },
  ];

  it('retorna o ponto exato quando month bate', () => {
    const lms = _getLms(table, 12);
    expect(lms).not.toBeNull();
    expect(lms!.M).toBeCloseTo(9.6007, 3);
  });

  it('interpola corretamente entre 0 e 6 meses', () => {
    const lms = _getLms(table, 3); // ponto médio entre 0 e 6
    expect(lms).not.toBeNull();
    // M interpolado deve estar entre 3.3464 e 7.934
    expect(lms!.M).toBeGreaterThan(3.3464);
    expect(lms!.M).toBeLessThan(7.934);
    expect(lms!.M).toBeCloseTo((3.3464 + 7.934) / 2, 1);
  });

  it('retorna primeiro ponto para age_months abaixo do menor', () => {
    const lms = _getLms(table, -1);
    expect(lms!.M).toBeCloseTo(3.3464, 3);
  });

  it('retorna null para tabela vazia', () => {
    expect(_getLms([], 6)).toBeNull();
  });
});

describe('calcZScore', () => {
  it('peso na faixa normal (7–11 kg) para menino 12m → Z entre -2 e +2', () => {
    // Qualquer peso entre ~7-11 kg deve estar na faixa "normal" (Z entre -2 e 2)
    const z = calcZScore(9.0, 12, 'M', 'weight');
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(-2);
    expect(z!).toBeLessThan(2);
  });

  it('peso acima da mediana retorna Z positivo', () => {
    // 11.0 kg fica acima da mediana OMS para menino 12m (mediana real ~9.9-10.1 kg) → Z > 0
    const z = calcZScore(11.0, 12, 'M', 'weight');
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(0);
    expect(z!).toBeLessThan(3); // Z esperado ~1-2 (sobrepeso leve / limite superior normal)
  });

  it('valor abaixo de P3 retorna Z < -2 (desnutrição)', () => {
    // Peso muito baixo para menino de 12m → Z negativo extremo
    const z = calcZScore(5.5, 12, 'M', 'weight');
    expect(z).not.toBeNull();
    expect(z!).toBeLessThan(-2);
  });

  it('valor acima de P97 retorna Z > 2 (sobrepeso/obesidade)', () => {
    // Peso muito alto para menino de 12m → Z positivo extremo
    const z = calcZScore(14.0, 12, 'M', 'weight');
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(2);
  });

  it('valor impossível (negativo) → null', () => {
    expect(calcZScore(-1, 12, 'M', 'weight')).toBeNull();
  });

  it('valor zero → null', () => {
    expect(calcZScore(0, 12, 'M', 'weight')).toBeNull();
  });

  it('ageMonths negativo → null', () => {
    expect(calcZScore(8, -1, 'M', 'weight')).toBeNull();
  });

  it('funciona para sexo feminino — retorna valor não nulo', () => {
    const z = calcZScore(8.5, 12, 'F', 'weight');
    expect(z).not.toBeNull();
    // 8.5 kg menina 12m → faixa normal
    expect(z!).toBeGreaterThan(-2);
    expect(z!).toBeLessThan(2);
  });

  it('funciona para altura masculina', () => {
    const z = calcZScore(75.0, 12, 'M', 'height');
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(-2);
    expect(z!).toBeLessThan(2);
  });
});

describe('zToPercentile', () => {
  it('Z=0 → 50º percentil', () => {
    expect(zToPercentile(0)).toBe(50);
  });

  it('Z=1.645 → aproximadamente 95º percentil', () => {
    const p = zToPercentile(1.645);
    expect(p).toBeGreaterThanOrEqual(94);
    expect(p).toBeLessThanOrEqual(96);
  });

  it('Z=-1.645 → aproximadamente 5º percentil', () => {
    const p = zToPercentile(-1.645);
    expect(p).toBeGreaterThanOrEqual(4);
    expect(p).toBeLessThanOrEqual(6);
  });

  it('Z=2.576 → aproximadamente 99.5º percentil', () => {
    const p = zToPercentile(2.576);
    expect(p).toBeGreaterThanOrEqual(99);
  });

  it('Z negativo retorna percentil < 50', () => {
    expect(zToPercentile(-2)).toBeLessThan(10);
  });

  it('retorna valor entre 0 e 100', () => {
    [-4, -2, 0, 2, 4].forEach(z => {
      const p = zToPercentile(z);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    });
  });
});
