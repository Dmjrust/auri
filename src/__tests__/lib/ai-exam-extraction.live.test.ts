/**
 * Teste de integração REAL (não mockado) — só roda quando VITE_OPENAI_API_KEY
 * está disponível e o PDF de teste existe em tmp-live-test/exame-real.pdf
 * (arquivo local, não versionado). Usa o laudo real que falhou em produção
 * para confirmar que a extração agora funciona de ponta a ponta contra a
 * API de verdade da OpenAI — não um mock.
 *
 * Pula automaticamente (sem falhar) quando a chave/arquivo não estão presentes,
 * então é seguro deixar este arquivo no repositório e rodar `npm test` normalmente.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { extractExamData } from '@/lib/ai';

const KEY = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const PDF_PATH = resolve(__dirname, '../../../tmp-live-test/exame-real.pdf');
const hasFixture = !!KEY && existsSync(PDF_PATH);

describe.skipIf(!hasFixture)('extractExamData — teste real contra o PDF do exame (Daniel Moreira Junior)', () => {
  it('extrai um número grande e plausível de marcadores, cobrindo múltiplas seções, com summary curto', async () => {
    vi.stubEnv('VITE_OPENAI_API_KEY', KEY!);

    const base64 = readFileSync(PDF_PATH).toString('base64');
    const result = await extractExamData(base64, 'application/pdf');

    console.log('\n=== RESULTADO DA EXTRAÇÃO REAL ===');
    console.log('lab_name:', result.lab_name);
    console.log('result_date:', result.result_date);
    console.log('summary:', result.summary);
    console.log('total de marcadores extraídos:', result.markers.length);
    console.log('marcadores:', JSON.stringify(result.markers, null, 2));

    // O laudo real tem ~65 marcadores numéricos distintos espalhados em 18 páginas
    // (hemograma, ferro, vitaminas, função renal, eletrólitos, glicemia, lipidograma,
    // função hepática, hormônios tireoidianos e sexuais, PSA, oligoelementos).
    expect(result.markers.length).toBeGreaterThanOrEqual(40);

    const names = result.markers.map(m => m.marker_name.toLowerCase());
    // Marcadores de seções bem distantes entre si no documento (pág. 1 vs pág. 17-18)
    // — confirma que a IA não parou nas primeiras tabelas.
    expect(names.some(n => n.includes('hemoglobina'))).toBe(true); // pág. 1 (hemograma)
    expect(names.some(n => n.includes('colesterol'))).toBe(true); // pág. 7-8 (lipidograma)
    expect(names.some(n => n.includes('tsh') || n.includes('tireoestimulante'))).toBe(true); // pág. 11
    expect(names.some(n => n.includes('psa'))).toBe(true); // pág. 16-17
    expect(names.some(n => n.includes('zinco') || n.includes('cobre'))).toBe(true); // pág. 17 (últimas)

    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.summary.split('.').length).toBeLessThanOrEqual(6); // resumo breve, não lista genérica
  }, 120_000);
});
