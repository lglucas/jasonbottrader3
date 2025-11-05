'use client';

import React, { useMemo, useState } from 'react';
import fs from 'fs';
import path from 'path';

/**
 * Página de Análise — Jason Bot Trader
 * Lê o índice de relatórios, exibe histórico, permite exportação CSV e toggle claro/escuro.
 * Observação: como esta página roda no cliente, o acesso ao FS do servidor é limitado;
 * em Next real, mova leitura de arquivos para um Server Component ou API route.
 */
type ReportIndexItem = {
  id: string;
  datetime: string;
  networks: string[];
  summary?: {
    winRate?: number;
    dailyProfit?: number;
    weeklyProfit?: number;
    monthlyProfit?: number;
    attemptsFailed?: number;
  };
};

function useTheme() {
  const [dark, setDark] = useState(true);
  return { dark, toggle: () => setDark(d => !d) };
}

export default function AnalysisPage() {
  const { dark, toggle } = useTheme();

  // Caminho do repositório raiz: ../../reports a partir do app
  const reportsDir = useMemo(() => path.resolve(process.cwd(), '../../reports'), []);
  let indexItems: ReportIndexItem[] = [];

  try {
    const indexPath = path.join(reportsDir, 'reports-index.json');
    if (fs.existsSync(indexPath)) {
      const raw = fs.readFileSync(indexPath, 'utf8');
      indexItems = JSON.parse(raw);
    }
  } catch (err: any) {
    // falha silenciosa — exibimos estado "sem dados"
    console.warn('Falha ao ler reports-index.json:', err.message);
  }

  // Gera CSV (snapshot) baseado nos itens do índice
  const handleExportCSV = () => {
    const headers = ['id', 'datetime', 'networks', 'winRate', 'dailyProfit', 'weeklyProfit', 'monthlyProfit', 'attemptsFailed'];
    const rows = indexItems.map(item => [
      item.id,
      item.datetime,
      item.networks?.join('|'),
      item.summary?.winRate ?? '',
      item.summary?.dailyProfit ?? '',
      item.summary?.weeklyProfit ?? '',
      item.summary?.monthlyProfit ?? '',
      item.summary?.attemptsFailed ?? ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: dark ? '#0b0f14' : '#f7f9fc',
      color: dark ? '#e8eef7' : '#0b0f14',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto',
      padding: '24px'
    }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Análise — Jason Bot Trader</h1>
        <div>
          <button onClick={toggle} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid', borderColor: dark ? '#223040' : '#cbd5e1', background: 'transparent', color: 'inherit' }}>
            Tema: {dark ? 'Escuro' : 'Claro'}
          </button>
          <button onClick={handleExportCSV} style={{ marginLeft: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid', borderColor: dark ? '#223040' : '#cbd5e1', background: dark ? '#142131' : '#e2e8f0', color: 'inherit' }}>
            Exportar CSV
          </button>
        </div>
      </header>

      {/* Badges de estado (exemplo simples) */}
      <section style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, background: '#1f2937', color: '#93c5fd' }}>Spread Alto</span>
        <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, background: '#1f2937', color: '#fca5a5' }}>Slippage Elevado</span>
        <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, background: '#1f2937', color: '#fcd34d' }}>Latência Alta</span>
        <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, background: '#1f2937', color: '#86efac' }}>Saúde OK</span>
      </section>

      {/* Histórico de relatórios */}
      <section>
        <h2 style={{ marginTop: 0 }}>Histórico de Relatórios</h2>
        {indexItems.length === 0 ? (
          <p>Sem relatórios no momento. Gere um snapshot pela página ao integrar o backend.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid', borderColor: dark ? '#223040' : '#cbd5e1', paddingBottom: 8 }}>Data/Hora</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid', borderColor: dark ? '#223040' : '#cbd5e1', paddingBottom: 8 }}>Redes</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid', borderColor: dark ? '#223040' : '#cbd5e1', paddingBottom: 8 }}>Win Rate</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid', borderColor: dark ? '#223040' : '#cbd5e1', paddingBottom: 8 }}>Lucro Diário</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid', borderColor: dark ? '#223040' : '#cbd5e1', paddingBottom: 8 }}>Falhas</th>
              </tr>
            </thead>
            <tbody>
              {indexItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: '8px 0' }}>{item.datetime}</td>
                  <td style={{ padding: '8px 0' }}>{item.networks?.join(', ')}</td>
                  <td style={{ padding: '8px 0' }}>{item.summary?.winRate ?? '-'}</td>
                  <td style={{ padding: '8px 0' }}>{item.summary?.dailyProfit ?? '-'}</td>
                  <td style={{ padding: '8px 0' }}>{item.summary?.attemptsFailed ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Gráfico de linha — placeholder */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Lucro no Tempo</h2>
        <div style={{
          height: 240,
          borderRadius: 12,
          border: '1px solid',
          borderColor: dark ? '#223040' : '#cbd5e1',
          display: 'grid',
          placeItems: 'center',
          color: dark ? '#7dd3fc' : '#1f2937'
        }}>
          {/* Em breve: integrar lib de gráfico com dados dos relatórios */}
          Gráfico será exibido aqui (aguardando relatórios com lucro).
        </div>
      </section>
    </div>
  );
}