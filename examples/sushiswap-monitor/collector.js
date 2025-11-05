/**
 * Coletor de Oportunidades — Jason Bot Trader
 * Objetivo: coletar dados a cada 30s em redes Arbitrum/Base/Polygon (SushiSwap V3),
 * persistir em JSONL, manter índice diário, e preparar dados para relatórios do dashboard.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
// Opcional: caso use Graph, pode instalar `graphql-request` e usar aqui.
// const { request, gql } = require('graphql-request');

// Configurações básicas
const NETWORKS = [
  { key: 'arbitrum', chainId: 42161, rpcEnv: 'ARBITRUM_RPC_URL' },
  { key: 'base', chainId: 8453, rpcEnv: 'BASE_RPC_URL' },
  { key: 'polygon', chainId: 137, rpcEnv: 'POLYGON_RPC_URL' },
];

// Pares a monitorar (ajuste conforme necessidade e disponibilidade nas redes)
const PAIRS = ['WETH/USDC', 'USDC/USDT'];

// Pastas de dados e relatórios (no repositório raiz)
const DATA_DIR = path.resolve(__dirname, '../../data');
const REPORTS_DIR = path.resolve(__dirname, '../../reports');

// Parâmetros operacionais
const CYCLE_MS = 30_000; // 30 segundos
const RPC_TIMEOUT_MS = 10_000; // timeout por chamada
const MAX_ERRORS_BEFORE_PAUSE = 5; // circuit-breaker simples
const PAUSE_AFTER_ERRORS_MS = 60_000; // pausa após erros consecutivos

/**
 * Garante que diretórios base existam.
 */
function ensureBaseDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Retorna o caminho do diretório diário para uma rede.
 * Exemplo: data/arbitrum/2025-11-04/
 */
function getDailyDir(networkKey) {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(DATA_DIR, networkKey, day);
}

/**
 * Garante diretórios diários e arquivos-base (index) para a rede.
 */
function ensureDailyFiles(networkKey) {
  const dailyDir = getDailyDir(networkKey);
  if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });
  const indexPath = path.join(dailyDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, JSON.stringify({ date: new Date().toISOString().slice(0, 10), entries: 0, errors: 0, avgSpread: 0, avgLatencyMs: 0, gasEstAvg: 0 }, null, 2));
  }
}

/**
 * Escreve uma linha JSON em <pair>.jsonl.
 */
function appendJsonl(networkKey, pair, item) {
  const dailyDir = getDailyDir(networkKey);
  const filePath = path.join(dailyDir, `${pair.replace('/', '-')}.jsonl`);
  fs.appendFileSync(filePath, JSON.stringify(item) + '\n', 'utf8');
}

/**
 * Atualiza o index.json do dia com agregados simples.
 */
function updateDailyIndex(networkKey, item) {
  const indexPath = path.join(getDailyDir(networkKey), 'index.json');
  try {
    const indexRaw = fs.readFileSync(indexPath, 'utf8');
    const index = JSON.parse(indexRaw);
    index.entries = (index.entries || 0) + 1;

    // Média incremental (simples)
    const n = index.entries;
    index.avgSpread = ((index.avgSpread || 0) * (n - 1) + (item.spread || 0)) / n;
    index.avgLatencyMs = ((index.avgLatencyMs || 0) * (n - 1) + (item.latencyMs || 0)) / n;
    index.gasEstAvg = ((index.gasEstAvg || 0) * (n - 1) + (item.gasEst || 0)) / n;

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  } catch (err) {
    console.error(`[index] Falha ao atualizar índice diário: ${err.message}`);
  }
}

/**
 * Incrementa contador de erros no index.json.
 */
function bumpIndexError(networkKey) {
  const indexPath = path.join(getDailyDir(networkKey), 'index.json');
  try {
    const indexRaw = fs.readFileSync(indexPath, 'utf8');
    const index = JSON.parse(indexRaw);
    index.errors = (index.errors || 0) + 1;
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  } catch (err) {
    console.error(`[index] Falha ao incrementar erros: ${err.message}`);
  }
}

/**
 * Remove diretórios com mais de 10 dias de idade em data/<networkKey>/.
 */
function rotateData(networkKey) {
  const networkDir = path.join(DATA_DIR, networkKey);
  if (!fs.existsSync(networkDir)) return;
  const entries = fs.readdirSync(networkDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
  // Mantém os 10 últimos dias
  const cutoff = entries.length - 10;
  if (cutoff > 0) {
    const toRemove = entries.slice(0, cutoff);
    for (const day of toRemove) {
      const dirToRemove = path.join(networkDir, day);
      fs.rmSync(dirToRemove, { recursive: true, force: true });
      console.log(`[rotate] Removido histórico antigo: ${networkKey}/${day}`);
    }
  }
}

/**
 * Cria provider ethers com timeout simples.
 */
function makeProvider(rpcUrl) {
  const transport = new ethers.JsonRpcProvider(rpcUrl, { staticNetwork: undefined });
  // Nota: ethers v6 não tem timeout configurável nativo; usar abort controller se necessário.
  return transport;
}

/**
 * Estima preço buy/sell via fontes (placeholder simples).
 * Em produção: usar Graph para preços e RPC/quoter para estimar slippage e rota.
 */
async function fetchPairSnapshot(provider, networkKey, pair) {
  const start = Date.now();

  // Placeholder simples para demonstração. Em produção, substitua por consultas reais.
  // Ex.: usar Graph para preço médio e volume, e RPC quoter para slippage estimado.
  const priceBuy = Number((Math.random() * 10 + 100).toFixed(2));
  const priceSell = Number((priceBuy + Math.random() * 0.5).toFixed(2));
  const spread = (priceSell - priceBuy) / priceBuy;
  const slippageEst = Math.min(0.005, spread * 0.8); // heurística simples
  const poolTVL = Math.floor(Math.random() * 100000) + 10000; // placeholder
  const volume24h = Math.floor(Math.random() * 50000) + 5000; // placeholder
  const gasEst = Number((Math.random() * 0.002 + 0.0005).toFixed(6)); // moeda nativa
  const latencyMs = Date.now() - start;

  return {
    network: networkKey,
    pair,
    buyDex: 'sushiswap',
    sellDex: 'sushiswap',
    priceBuy,
    priceSell,
    spread,
    slippageEst,
    poolTVL,
    volume24h,
    gasEst,
    latencyMs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Executa um ciclo de coleta para uma rede.
 */
async function runCycleForNetwork(net, state) {
  const rpcUrl = process.env[net.rpcEnv];
  if (!rpcUrl) {
    console.warn(`[config] RPC não definido para ${net.key} (${net.rpcEnv}) — pulando ciclo`);
    return;
  }
  ensureDailyFiles(net.key);
  rotateData(net.key);

  let errors = 0;
  try {
    const provider = makeProvider(rpcUrl);
    for (const pair of PAIRS) {
      const item = await fetchPairSnapshot(provider, net.key, pair);
      appendJsonl(net.key, pair, item);
      updateDailyIndex(net.key, item);
      console.log(`[${net.key}] ${pair} spread=${(item.spread * 100).toFixed(3)}% latency=${item.latencyMs}ms`);
    }
  } catch (err) {
    errors += 1;
    bumpIndexError(net.key);
    console.error(`[${net.key}] Erro no ciclo: ${err.message}`);
    if (errors >= MAX_ERRORS_BEFORE_PAUSE) {
      console.warn(`[${net.key}] Pausando ${PAUSE_AFTER_ERRORS_MS / 1000}s após erros consecutivos`);
      await new Promise(res => setTimeout(res, PAUSE_AFTER_ERRORS_MS));
    }
  }
}

/**
 * Loop principal: dispara ciclos a cada 30s para cada rede, com controle simples.
 */
async function mainLoop() {
  ensureBaseDirs();
  console.log(`[coletor] Iniciado — ciclo a cada ${CYCLE_MS / 1000}s. Redes: ${NETWORKS.map(n => n.key).join(', ')}`);
  while (true) {
    const state = {};
    const tasks = NETWORKS.map(net => runCycleForNetwork(net, state));
    await Promise.all(tasks);
    await new Promise(res => setTimeout(res, CYCLE_MS));
  }
}

// Início
mainLoop().catch(err => {
  console.error(`[fatal] Coletor abortado: ${err.message}`);
  process.exit(1);
});