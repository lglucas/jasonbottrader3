# Changelog

Todas as alterações relevantes neste projeto serão documentadas aqui.

## [0.1.0] - 2025-11-05
### Added (Sprint 0.1 - Fundação)
- ✅ Provider blockchain multi-rede (`src/blockchain/provider.js`)
  - Suporte a Arbitrum, Base, Polygon (testnet + mainnet)
  - Gestão de providers com cache
  - Validação de conexão e troca dinâmica de redes
- ✅ Wallet Manager (`src/blockchain/wallet.js`)
  - Gerenciamento de signer para transações
  - Verificação de saldo nativo e ERC20
  - Sistema de aprovação de tokens com retry
- ✅ Gas Manager (`src/blockchain/gas.js`)
  - Estimativa dinâmica de gas
  - Cálculo de gas máximo baseado no valor do trade
  - Verificação se gas está aceitável (cancela trades quando alto)
  - Histórico de preços de gas e análise de tendência
- ✅ Storage Manager (`src/data/storage.js`)
  - Persistência de ciclos em JSON
  - Salvamento de trades e eventos
  - Cálculo automático de métricas (win rate, profit factor, etc)
  - Dados de mercado em JSONL
  - Rotação automática de dados antigos
- ✅ CI/CD com GitHub Actions (`.github/workflows/ci.yml`)
  - Lint e format check
  - Testes automatizados
  - Build check
- ✅ Configuração de testes (Jest)
  - Testes unitários para config e storage
  - Setup de ambiente de testes
  - Coverage configurado (target > 50%)
- ✅ ESLint e Prettier configurados

## [0.0.2] - 2025-11-05
### Added
- Documento completo de projeto e arquitetura (`docs/2. projeto-arquitetura.md`)
- Especificações técnicas detalhadas do bot trader
- Definição de estratégias de trading (Grid Trading + Momentum)
- Sistema de gestão de risco completo (stop-loss trailing, take-profit níveis, drawdown 3 níveis)
- Stack tecnológica com versões STABLE e compatíveis
- Roadmap detalhado com 5 sprints (0.1 a 0.5)
- Glossário técnico de termos de trading e blockchain
- Critérios de análise semanal de tokens (whitelist/blacklist)
- Arquitetura Event-Driven completa
- Estrutura de diretórios definitiva do projeto

## [0.0.1] - 2025-11-05
### Added
- Configuração inicial do repositório
- Inclusão de `README.md`, `CHANGELOG.md` e `.gitignore`
- Documentação de estrutura e práticas de commit/push