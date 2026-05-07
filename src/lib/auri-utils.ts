import type { Patient } from '../data/mock';

export function calcAge(bd: string): string {
  const b = new Date(bd), n = new Date();
  let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth();
  if (m < 0) { y--; m += 12; }
  if (n.getDate() < b.getDate()) m = Math.max(0, m - 1);
  if (y === 0) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  if (y === 1) return m === 0 ? '1 ano' : `1 ano e ${m}m`;
  return m === 0 ? `${y} anos` : `${y} anos e ${m}m`;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  // Parse date portion directly to avoid UTC-midnight → local-day-shift
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtTimer(s: number): string {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

export function primaryGuardian(p: Patient) {
  return p.guardians.find(g => g.is_primary) || p.guardians[0];
}
