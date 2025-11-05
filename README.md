# 🤖 Jason Bot Trader

Bot de trading automatizado para SushiSwap V3, focado em day trading de tokens de alta volatilidade em redes com baixo custo de gas.

**Versão:** 0.1.0 (Sprint 0.1 - Em Desenvolvimento)
**Status:** 🔨 Desenvolvimento Ativo

---

## 🎯 Visão Geral

Jason Bot Trader é um bot automatizado que opera no SushiSwap V3 com:
- ✅ **Multi-Estratégia:** Grid Trading + Momentum (seleção dinâmica)
- ✅ **Gestão de Risco Avançada:** Stop-loss trailing, take-profit em níveis, circuit breaker
- ✅ **Dashboard Web:** Interface moderna em tempo real
- ✅ **Backtesting:** Testa estratégias antes de operar
- ✅ **Multi-Rede:** Arbitrum, Base, Polygon
- ✅ **Gas Otimizado:** Cancela trades quando gas está alto

---

## 📁 Estrutura do Projeto

```
jasonbottrader3/
├── src/                      # Código-fonte principal
│   ├── core/                # Bot principal, config, eventos
│   ├── blockchain/          # Provider, wallet, SushiSwap
│   ├── strategies/          # Grid Trading, Momentum
│   ├── risk/                # Stop-loss, take-profit, drawdown
│   ├── data/                # Coleta e persistência
│   ├── execution/           # Executor de trades
│   └── reporting/           # Logger e relatórios
├── dashboard/               # Dashboard web (Next.js) - [Próximos sprints]
├── scripts/                 # Scripts utilitários (análise semanal)
├── data/                    # Dados persistidos (gitignored)
├── docs/                    # Documentação completa
└── examples/                # Exemplos de bots (legado)
```

---

## 🚀 Quick Start

### 1. Instalação

```bash
# Clone o repositório
git clone https://github.com/lglucas/jasonbottrader3.git
cd jasonbottrader3

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais
```

### 2. Configuração

Edite o arquivo `.env` com suas credenciais:

```env
# Wallet
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=your_wallet_address_here

# RPC (Testnet para começar)
ARBITRUM_TESTNET_RPC_URL=https://arbitrum-sepolia.infura.io/v3/YOUR_KEY

# API Keys
INFURA_API_KEY=your_infura_key

# Configuração do Bot
ACTIVE_NETWORK=arbitrum
NETWORK_MODE=testnet
INITIAL_CAPITAL=50
```

### 3. Execução

```bash
# Iniciar bot em desenvolvimento
npm run dev

# Iniciar bot em produção
npm start

# Rodar testes
npm test

# Análise semanal de tokens
npm run weekly
```

---

## 📚 Documentação

- **[Regras de Desenvolvimento](docs/1.%20regras-de-desenvolvimento.md)** - Padrões e práticas
- **[Projeto e Arquitetura](docs/2.%20projeto-arquitetura.md)** - Documentação completa do sistema
- **[CHANGELOG](CHANGELOG.md)** - Histórico de versões

---

## 🗓️ Roadmap

| Sprint | Versão | Status | Entregável |
|--------|--------|--------|------------|
| 0.1 | 0.1.0 | 🔨 Em Andamento | Fundação + Testnet |
| 0.2 | 0.2.0 | 📋 Planejado | Estratégias + Risco |
| 0.3 | 0.3.0 | 📋 Planejado | Backtesting + Análise |
| 0.4 | 0.4.0 | 📋 Planejado | Dashboard Web |
| 0.5 | 0.5.0 | 📋 Planejado | Otimização + Mainnet |

**Estimativa:** 12 semanas (~3 meses)

---

## 🛡️ Segurança

- ⚠️ **NUNCA** commite seu `.env` ou chaves privadas
- 🧪 **SEMPRE** teste em testnet antes de mainnet
- 💰 **COMECE** com capital pequeno ($30-50)
- 🛑 **CONFIGURE** o drawdown máximo (-15%)

---

## 🧪 Status de Desenvolvimento

### Sprint 0.1 - Fundação ✅ Parcialmente Completo

- [x] Estrutura de diretórios
- [x] Sistema de configuração (.env)
- [x] Logger estruturado (Winston)
- [x] Bot principal (esqueleto)
- [ ] Provider blockchain
- [ ] Interface SushiSwap
- [ ] Coletor de dados real
- [ ] Estimativa de gas
- [ ] Storage JSON
- [ ] Testes em testnet
- [ ] CI/CD GitHub Actions

---

## 🤝 Contribuindo

Este é um projeto pessoal em desenvolvimento ativo. Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças seguindo Conventional Commits
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📝 Licença

MIT License - Uso educacional e experimental.

---

## ⚠️ Disclaimer

Este bot é fornecido "como está" para fins educacionais. Trading de criptomoedas envolve riscos significativos. Use por sua conta e risco.

---

**Desenvolvido com ❤️ por Lucas Galvão**