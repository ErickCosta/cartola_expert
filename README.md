# Cartola Expert

Ferramenta de linha de comando para sugerir escalações no fantasy game **Cartola FC**, combinando dados públicos de atletas e partidas, estimativas de desempenho e otimização heurística sob restrições de orçamento e formação.

O projeto gera duas sugestões independentes:

- **Pontuação:** prioriza uma função de score estimado dos atletas.
- **Valorização:** prioriza uma função de score voltada à valorização dos atletas.

> **Aviso:** as sugestões são estimativas, não garantias de pontuação ou valorização. O projeto é independente e não é afiliado ao Cartola ou à Globo.

## Tecnologias

- Node.js e TypeScript
- `tsx` para execução local
- `axios` para chamadas HTTP
- `dotenv` para configuração de ambiente
- `zod` e `javascript-lp-solver` entre as dependências declaradas

## Requisitos

- Node.js e npm instalados
- Conexão com a internet para consultar a API pública do Cartola
- Mercado e endpoints da API disponíveis

O projeto não define uma versão mínima de Node.js no `package.json`. Recomenda-se utilizar uma versão LTS compatível com as dependências instaladas.

## Instalação

```bash
git clone https://github.com/ErickCosta/cartola_expert.git
cd cartola_expert
npm install
```

## Como executar

```bash
npm run dev -- 100 4-3-3
```

Argumentos:

| Argumento | Exemplo | Descrição |
| --- | --- | --- |
| Orçamento | `100` | Quantidade de cartoletas disponível |
| Formação | `4-3-3` | Esquema tático utilizado para montar a escalação |

O comando executa `tsx src/index.ts` com os argumentos fornecidos. A formação inclui um técnico além dos onze jogadores.

### Saída

A execução exibe informações de diagnóstico, como rodada, quantidade de atletas elegíveis, candidatos por posição e custo mínimo estimado, seguidas de duas escalações:

```text
TIME PARA PONTUAÇÃO (4-3-3)
Custo: C$ ... | Score: ...
...
TIME PARA VALORIZAÇÃO (4-3-3)
Custo: C$ ... | Score: ...
```

Os nomes, preços e resultados variam conforme a rodada e os dados retornados pela API.

## Como funciona

1. **Coleta:** consulta dados públicos de mercado, partidas e clubes do Cartola.
2. **Normalização:** converte os dados de atletas para estruturas usadas internamente.
3. **Filtragem:** seleciona atletas conforme o status definido na aplicação.
4. **Pontuação:** calcula estimativas com base em scouts, médias, contexto do confronto e mando de campo.
5. **Seleção:** organiza candidatos elegíveis por posição e objetivo.
6. **Otimização:** utiliza uma busca heurística do tipo *Beam Search* para construir escalações respeitando formação e orçamento.
7. **Apresentação:** imprime os times sugeridos para pontuação e valorização.

O Beam Search mantém apenas um subconjunto das melhores soluções parciais a cada etapa; portanto, **não garante ótimo global**.

## Estrutura do projeto

```text
src/
├── cartola/       # Cliente HTTP, endpoints, normalização e tipos
├── config/        # Configurações de pontuação
├── optimizer/     # Formação e otimização de escalações
├── scoring/       # Scouts, confronto, clubes e estimativas
├── selection/     # Seleção de candidatos
└── index.ts       # Orquestração e execução via CLI
```

## Desenvolvimento e testes

Para iniciar o projeto durante o desenvolvimento:

```bash
npm run dev -- 100 4-3-3
```

**Estado atual dos testes:** o script `npm test` do pacote ainda é um placeholder e encerra com erro. Não há suíte automatizada configurada no material analisado.

### Segurança

O `package.json` contém um script `dev:tls` que desabilita a validação de certificados TLS. **Não utilize esse script em ambientes normais ou de produção**, pois isso enfraquece a segurança das conexões HTTPS. Prefira `npm run dev`.

Antes de distribuir o projeto, verifique as dependências com `npm audit` e não inclua arquivos `.env` com credenciais, `node_modules` ou dados sensíveis.

## Limitações conhecidas

- Depende da disponibilidade e da estrutura da API pública do Cartola.
- As estimativas são heurísticas e podem divergir da pontuação real.
- A calibração e os pesos de pontuação estão definidos no código e podem exigir ajustes ao longo da temporada.
- Não há garantia de ótimo global na otimização.
- Ainda não há testes automatizados configurados.

## Licença

Distribuído sob a **ISC License**. Consulte o arquivo [`LICENSE`](LICENSE) para o texto integral.

## Testes automatizados

A suíte utiliza o test runner nativo do Node.js com TypeScript executado pelo `tsx` (já presente nas dependências de desenvolvimento). Não depende da API externa do Cartola.

```bash
npm ci
npm test
```

Para executar em modo de observação: `npm run test:watch`.

Os testes cobrem interpretação de formações, normalização e filtro de atletas, contexto de partidas, funções de pontuação/valorização e seleção de candidatos. Ainda não cobrem o fluxo completo da CLI nem o otimizador Beam Search.
