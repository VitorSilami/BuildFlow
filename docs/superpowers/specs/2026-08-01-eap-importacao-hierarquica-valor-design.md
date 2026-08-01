# Importação de EAP — formato hierárquico com peso, datas e valor — Design

## Contexto

O import de EAP via CSV/XLSX (`docs/superpowers/specs/2026-08-01-eap-importacao-csv-xlsx-design.md`) está em produção e só lê o formato de 2 níveis `DISCIPLINA | ATIVIDADE | UN | TOTAL` — decisão daquela rodada porque a planilha real disponível na época (`MODELO IMPORT SOFT`) quase não usava profundidade maior.

O usuário trouxe uma planilha nova, `MODELO IMPORTAÇÃO_rev01.xlsx`, com um formato bem diferente: código hierárquico com pontos (`003`, `003.001`, `003.001.001`...), profundidade real de até 3 níveis, e peso/datas/preço/valor embutidos — exatamente o cenário que a rodada anterior deixou de fora de propósito. Esta spec estende o importer existente para também ler esse formato, sem quebrar o formato antigo.

## Escopo

**Dentro do escopo:**
- Detecção automática de qual dos dois formatos o arquivo usa (pelo cabeçalho, mesma varredura de 20 linhas já existente).
- Novo parser para o formato hierárquico: constrói a árvore de `Disciplina`/subdisciplina a partir do código, usando o `pai` FK que a feature de hierarquia N-níveis já expõe.
- Import de `peso_percentual` (Disciplina e CatalogoServico) e de `data_inicio_prevista`/`data_fim_prevista` (CatalogoServico) a partir desse formato — campos que já existem no model, nunca preenchidos pelo import até agora.
- Dois campos novos: `CatalogoServico.preco_unitario` e `Disciplina.valor_base`, preenchidos por cross-reference com duas abas de referência do mesmo workbook (`BASE_CUSTOS_SICRO`, `RESUMO_VALORES`), quando presentes.

**Fora do escopo:**
- Qualquer validação de coerência entre as abas (ex.: conferir se `quantidade × preço` bate com o valor base da disciplina) — cada aba é lida e transcrita de forma independente.
- Formato hierárquico via CSV — como as abas de referência de valor só existem num workbook xlsx, esse formato completo (código + peso + data + valor) é exclusivo de `.xlsx`. CSV continua servindo só o formato antigo.
- Alterar o formato antigo (`DISCIPLINA/ATIVIDADE/UN/TOTAL`) — continua funcionando exatamente como está, incluindo pelo CSV.
- Mudar o shape da resposta da API (`disciplinas_criadas`/`servicos_criados` continuam contando todos os nós, sem distinguir por nível ou por formato).

## Detecção de formato

Mesma varredura de até 20 linhas em cada aba do arquivo (xlsx: todas as abas; csv: a única "aba"). Cada aba candidata é testada contra as duas "receitas" de cabeçalho, nesta ordem:

1. **Formato hierárquico**: célula `CÓDIGO` e célula `TASK NAME` presentes (case-insensitive, trimmed) → exige também `UNIDADE` e `QUANTIDADE` na mesma linha; `PESO PERCENTUAL`, `DATA INICIO PREVISTA`, `DATA FIM PREVISTA` são colunas opcionais e independentes entre si — cada uma que estiver ausente do cabeçalho faz seu campo correspondente ficar sempre `null` pra todas as linhas, sem afetar a leitura das outras duas nem gerar erro. Ex.: se só `DATA INICIO PREVISTA` existir no arquivo, ela é importada normalmente e `data_fim_prevista` fica `null` em todo mundo (a checagem `fim >= início` nunca dispara, porque nunca há as duas datas na mesma linha).
2. **Formato de 2 níveis** (já existente): célula `DISCIPLINA` e célula `ATIVIDADE` presentes → exige também `UN`/`UNIDADE` e `TOTAL`/`QUANTIDADE`.

A primeira aba (na ordem do workbook) que resolver completamente qualquer uma das duas receitas define o formato do arquivo inteiro. Se nenhuma aba resolver nenhuma das duas, mesma mensagem de erro genérica de hoje: "Cabeçalho não encontrado ou incompleto."

`Outline Level`, quando presente no formato hierárquico, nunca é lido — a árvore é construída inteiramente a partir da estrutura do `CÓDIGO` (número de segmentos separados por ponto = profundidade; prefixo até o penúltimo ponto = código do pai).

## Construção da árvore (formato hierárquico)

Uma linha é **folha** (vira `CatalogoServico`) quando nenhuma outra linha do arquivo tem um `CÓDIGO` que a estende com mais um segmento (ex.: `003.001` só é folha se nenhuma linha começar com `003.001.`); caso contrário vira `Disciplina`/subdisciplina, com `pai` apontando para o nó cujo código é o prefixo (removendo o último segmento).

**Regras de integridade da árvore:**
- `CÓDIGO` duplicado no arquivo → erro, `"Linha N: código {codigo} duplicado."`.
- `CÓDIGO` "órfão" — o prefixo-pai implícito não existe como linha no arquivo → erro, `"Linha N: código {codigo} não tem uma linha pai {codigo_pai} no arquivo."`.
- Linhas de código com um único segmento (ex.: `003`) são sempre candidatas a disciplina raiz (`pai=None`).

## Validação por linha

- `CÓDIGO` e `TASK NAME` (nome) em branco → erro, mesma mensagem padrão de hoje (`"Linha N: CÓDIGO em branco."` / `"... TASK NAME em branco."`). `TASK NAME` segue o mesmo teto de 255 caracteres já validado no formato antigo.
- `UNIDADE`/`QUANTIDADE` só são exigidos em linhas **folha** (mesmas mensagens e mesmos limites — 16 caracteres, `Decimal` finito, não-negativo, até `999999999.999` — já usados no formato antigo). Linha intermediária pode vir sem essas duas colunas preenchidas; se vierem preenchidas mesmo assim, são ignoradas (a linha ainda vira `Disciplina`, não `CatalogoServico`).
- `PESO PERCENTUAL`, quando a coluna existe e a célula não está em branco, é validado só como número que cabe no campo `peso_percentual` (`max_digits=5, decimal_places=2` — já existente em `Disciplina` e `CatalogoServico`); valor inválido → erro (`"Linha N: PESO PERCENTUAL inválido."`). Sem checagem de soma-100% entre irmãos — mesma filosofia "avisa na UI, não trava no import" que já vale hoje pra peso digitado manualmente.
- Datas (só relevantes em linha-folha): se as duas vierem preenchidas, valida `fim >= início` (senão erro, `"Linha N: data fim prevista anterior à data início prevista."`); se só uma vier, importa só essa, a outra fica `null`.
- Linha "em branco" (nota de rodapé etc.) é ignorada silenciosamente: critério considera só as colunas obrigatórias da receita que casou (`CÓDIGO`+`TASK NAME` no formato hierárquico), igual à correção já aplicada ao formato antigo.

## Schema

Dois campos novos, ambos `null=True, blank=True`, mesma precisão já usada em `ValorCusto.valor` (`DecimalField(max_digits=12, decimal_places=2)`):

- `CatalogoServico.preco_unitario` — preço unitário (R$/unidade).
- `Disciplina.valor_base` — valor total fictício da disciplina. Só é preenchido em disciplinas **raiz** (nível em que a aba de referência trabalha); subdisciplinas ficam sempre `null` nesse campo.

Duas migrations (`AddField`), sem dado a migrar. Ambos os campos entram nos serializers correspondentes (`CatalogoServicoSerializer`, `DisciplinaSerializer`) como campos read/write comuns, editáveis manualmente depois — mesmo tratamento que `peso_percentual` já tem.

`peso_percentual` (Disciplina e CatalogoServico) e `data_inicio_prevista`/`data_fim_prevista` (CatalogoServico) **não são campos novos** — já existem no model, só nunca tinham sido preenchidos por um import antes.

## Cross-reference de valor

Só entra em jogo quando o formato hierárquico é detectado. As duas abas de referência são localizadas **por nome exato de aba** (case-insensitive), não por conteúdo de cabeçalho:

- **`BASE_CUSTOS_SICRO`** (colunas `CÓDIGO`, `PREÇO UNITÁRIO BASE (R$)`): cada linha casa por `CÓDIGO` com um serviço-folha da aba principal → preenche `preco_unitario`. Código sem match, ou aba inteira ausente do workbook → fica `null`, sem erro.
- **`RESUMO_VALORES`** (colunas `CÓDIGO`, `VALOR BASE (R$)`): cada linha casa por `CÓDIGO` com uma disciplina **raiz** da aba principal → preenche `valor_base`. Mesmo tratamento de ausência (linha ou aba inteira) → `null`, sem erro.

Nenhuma validação cruzada entre as três abas — cada uma é lida e transcrita de forma independente, sem recálculo nem auditoria de coerência.

## API

Endpoint, permissão, pré-condição (EAP vazia) e response shape de sucesso/erro continuam idênticos à spec anterior — `disciplinas_criadas`/`servicos_criados` passam a contar todos os nós de cada tipo (raiz + subdisciplinas juntos), sem novo campo na resposta. Erros de linha continuam em `{"erros": [...]}`; erros de formato/pré-condição em `{"detail": "..."}"`.

## UI

Sem mudança visível: o mesmo botão "Importar planilha" na aba EAP vazia aceita os dois formatos, com o mesmo `accept=".csv,.xlsx"`. Projetos importados com o formato hierárquico e datas passam a mostrar o Gantt automaticamente (o toggle já existe e só depende de algum serviço ter `data_inicio_prevista`/`data_fim_prevista` preenchidos — nenhuma mudança de código de UI necessária).

## Testes esperados

**Nível serviço (`eap_import.py`):**
- Detecção do formato hierárquico coexistindo com o antigo (arquivo com cabeçalho antigo continua indo pro parser antigo, sem regressão).
- Árvore de 2 e 3 níveis a partir do código, replicando a estrutura do `MODELO IMPORTAÇÃO_rev01.xlsx` real.
- Código órfão rejeitado; código duplicado rejeitado.
- `UNIDADE`/`QUANTIDADE` exigidos só em linha-folha.
- `PESO PERCENTUAL` e datas opcionais quando a coluna nem existe no arquivo; peso inválido rejeitado; data fim anterior ao início rejeitada.
- `preco_unitario`/`valor_base` preenchidos quando o código bate nas abas de referência; `null` quando não bate ou quando a aba de referência está ausente do workbook.
- Linha de nota em coluna não mapeada tratada como branco (mesmo caso já corrigido no formato antigo).

**Nível API:** teste end-to-end com as 3 abas reais (ou uma versão reduzida) confirmando 201 com os contadores certos, incluindo `preco_unitario`/`valor_base` no corpo da disciplina/serviço retornado.

**Antes do merge:** repetir o teste manual já feito com o `MODELO IMPORT SOFT` — importar o `MODELO IMPORTAÇÃO_rev01.xlsx` de verdade num projeto vazio e conferir visualmente no browser (peso, datas, Gantt e preço/valor aparecendo corretamente).
