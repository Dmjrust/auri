import {
  LMS_WEIGHT_BOY, LMS_WEIGHT_GIRL,
  LMS_HEIGHT_BOY, LMS_HEIGHT_GIRL,
  LMS_HC_BOY,    LMS_HC_GIRL,
  LMS_BMI_BOY,   LMS_BMI_GIRL,
  type LmsPoint,
} from '../data/mock';

// Interpola L, M, S entre os pontos mais próximos da tabela
export function _getLms(table: LmsPoint[], ageMonths: number): { L: number; M: number; S: number } | null {
  if (!table || table.length === 0) return null;
  const sorted = [...table].sort((a, b) => a.month - b.month);
  if (ageMonths <= sorted[0].month) return sorted[0];
  if (ageMonths >= sorted[sorted.length - 1].month) return sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i], hi = sorted[i + 1];
    if (lo.month <= ageMonths && ageMonths <= hi.month) {
      const t = (ageMonths - lo.month) / (hi.month - lo.month);
      return { L: lo.L + t * (hi.L - lo.L), M: lo.M + t * (hi.M - lo.M), S: lo.S + t * (hi.S - lo.S) };
    }
  }
  return null;
}

// Calcula Z-escore usando método Box-Cox da OMS
export function calcZScore(value: number, ageMonths: number, sex: 'M' | 'F', measure: 'weight' | 'height' | 'hc' | 'bmi'): number | null {
  if (!value || value <= 0 || ageMonths < 0) return null;
  const tableMap = {
    weight: sex === 'M' ? LMS_WEIGHT_BOY : LMS_WEIGHT_GIRL,
    height: sex === 'M' ? LMS_HEIGHT_BOY : LMS_HEIGHT_GIRL,
    hc:     sex === 'M' ? LMS_HC_BOY     : LMS_HC_GIRL,
    bmi:    sex === 'M' ? LMS_BMI_BOY    : LMS_BMI_GIRL,
  };
  const lms = _getLms(tableMap[measure], ageMonths);
  if (!lms) return null;
  const { L, M, S } = lms;
  if (Math.abs(L) < 0.0001) return Math.log(value / M) / S;
  return (Math.pow(value / M, L) - 1) / (L * S);
}

// Converte Z → percentil (approximação da CDF normal)
export function zToPercentile(z: number): number {
  const abs = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * abs);
  const d = 0.3989423 * Math.exp(-abs * abs / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return Math.round(z >= 0 ? (1 - p) * 100 : p * 100);
}
