# Importação de EAP via CSV/XLSX — Design

## Contexto

A EAP hoje só é populada manualmente, disciplina por disciplina, serviço por serviço, pela UI. Times que migram de planilha (ex.: `MODELO IMPORT SOFT (1).xlsx`, aba `BASE_QTD_L2`) hoje dependem de um comando de management one-off (`seed_legacy_data.py`) rodado por alguém com acesso ao servidor — não é um fluxo que o Gerente do projeto consegue usar sozinho.

Este é o último item do backlog "EAP completa". A hierarquia N-níveis (Disciplina → Subdisciplina → ... → Serviço) já está em produção, mas a inspeção da planilha real (`BASE_QTD_L2` e `BASE_EAP`) mostrou que o dado real quase não usa profundidade além de 2 níveis — então esta importação **não** usa o código hierárquico (`CHAVE`/`EAP`) para criar subdisciplinas. Fica em 2 níveis: DISCIPLINA → Serviço, igual ao script existente.

## Escopo

**Dentro do escopo:**
- Import de planilha (.csv ou .xlsx) via UI, populando a EAP do projeto atual.
- Import só permitido quando a EAP do projeto está vazia (nenhuma disciplina raiz).
- Colunas obrigatórias: DISCIPLINA, ATIVIDADE, UN/UNIDADE, TOTAL/QUANTIDADE.
- Validação atômica: tudo-ou-nada, com lista de erros por linha.

**Fora do escopo (não-objetivos):**
- Export (o backlog original mencionava "importação/exportação", mas todas as decisões desta rodada foram import-only; export fica para uma rodada futura caso vire necessidade real).
- Uso do código hierárquico (CHAVE/EAP) para criar subdisciplinas — colunas lidas e ignoradas.
- Import incremental/merge em EAP já populada.
- `peso_percentual` via planilha — não existe no formato de origem, fica `null` (Gerente ajusta manualmente depois).
- Substituir o comando `seed_legacy_data.py` (ele continua existindo para seed de demonstração).

## Fluxo do usuário

1. Gerente abre a aba EAP de um projeto sem nenhuma disciplina cadastrada — vê o `EmptyState` atual mais um botão **"Importar planilha"**.
2. Clica, escolhe um arquivo `.csv` ou `.xlsx` no seletor nativo do SO.
3. Upload dispara automaticamente ao selecionar o arquivo (sem passo de preview/confirmação — mantém o fluxo curto).
4. **Sucesso:** toast "X disciplinas e Y serviços importados.", aba EAP recarrega e mostra a árvore populada.
5. **Erro de validação:** painel inline abaixo do botão lista cada problema encontrado ("Linha 8: TOTAL inválido.", ...); nada é criado; usuário corrige a planilha e tenta de novo.
6. Se a EAP não estiver mais vazia (outra pessoa já criou uma disciplina, ou o usuário tenta de novo após sucesso), o botão continua visível mas o backend rejeita com uma mensagem clara — não escondemos o botão no frontend para evitar duplicar a regra de negócio no cliente.

## Formato do arquivo aceito

**Cabeçalho:** localizado por conteúdo, não por posição fixa. Varre as primeiras 20 linhas do arquivo procurando a primeira linha que contenha, entre suas células (comparação case-insensitive, com espaços removidos), tanto `DISCIPLINA` quanto `ATIVIDADE`. Essa é a linha de cabeçalho; todas as linhas não-vazias depois dela são dados. Isso cobre o caso real da planilha (`BASE_QTD_L2` tem 3 linhas de título antes do cabeçalho, na linha 4).

**Colunas reconhecidas** (por nome de cabeçalho, case-insensitive):
| Campo | Nomes aceitos | Obrigatória |
|---|---|---|
| Disciplina | `DISCIPLINA` | sim |
| Atividade | `ATIVIDADE` | sim |
| Unidade | `UN`, `UNIDADE` | sim |
| Quantidade | `TOTAL`, `QUANTIDADE` | sim |
| — | `CHAVE`, `EAP` | ignoradas |

Se o cabeçalho não for localizado nas primeiras 20 linhas, ou se alguma coluna obrigatória não for encontrada nele, o import é rejeitado antes de processar qualquer linha de dados: `{"detail": "Cabeçalho não encontrado ou incompleto. Colunas obrigatórias: DISCIPLINA, ATIVIDADE, UN/UNIDADE, TOTAL/QUANTIDADE."}`.

**Formatos de arquivo:**
- `.xlsx`: lido com `openpyxl` (já é dependência do backend, usado por `seed_legacy_data.py`).
- `.csv`: lido com o módulo `csv` padrão do Python. Tenta decodificar como `utf-8-sig` (cobre BOM de exports do Excel) primeiro; se falhar, tenta `cp1252` (cobre a mangling de acentuação observada na inspeção da planilha real — export de ferramentas legadas no padrão Windows-1252/Latin-1).
- Qualquer outra extensão é rejeitada: `{"detail": "Formato não suportado. Envie um arquivo .csv ou .xlsx."}`.

## Validação e regras de negócio

**Pré-condição (antes de ler o arquivo):** se o projeto já tem alguma disciplina raiz (`pai__isnull=True`), rejeita com `{"detail": "Este projeto já possui uma EAP. Import só é permitido em projetos sem disciplinas cadastradas."}` (400).

**Validação por linha** (linhas em branco — todas as células vazias — são ignoradas silenciosamente, não geram erro nem contam como importadas):
- `DISCIPLINA` em branco → `"Linha N: DISCIPLINA em branco."`
- `ATIVIDADE` em branco → `"Linha N: ATIVIDADE em branco."`
- `UNIDADE` em branco → `"Linha N: UNIDADE em branco."`
- `TOTAL`/`QUANTIDADE` em branco ou não-numérico → `"Linha N: TOTAL/QUANTIDADE inválido."`
- Combinação `DISCIPLINA` + `ATIVIDADE` repetida dentro do mesmo arquivo → `"Linha N: ATIVIDADE duplicada para esta DISCIPLINA."` (evita sobrescrita silenciosa; não há semântica natural de merge dentro de um único import).

`N` é o número da linha no arquivo original (1-indexado), não um índice relativo aos dados — facilita o usuário localizar a linha na planilha.

**Normalização:** `DISCIPLINA` e `ATIVIDADE` são comparados (para agrupamento e para a checagem de duplicata) após `strip()` e case-insensitive — mesmo texto com espaços extras ou capitalização diferente ("Fundação" vs "fundação ") cai no mesmo grupo/é tratado como duplicata, evitando disciplinas quase-idênticas. O nome persistido é o da primeira ocorrência (já com `strip()`, mantendo a capitalização original).

**Tudo-ou-nada:** todas as linhas são validadas antes de qualquer escrita no banco. Se houver qualquer erro, a resposta é 400 com a lista completa de erros e nada é criado. Só ao final da validação limpa é que o import roda dentro de `transaction.atomic()`.

**Criação:** para cada linha válida — agrupadas por `DISCIPLINA`, na ordem de primeira aparição no arquivo — cria uma `Disciplina` raiz (`pai=None`) por grupo, e um `CatalogoServico` por linha dentro dela, com `unidade` resolvida via `Unidade.objects.get_or_create(sigla=...)` (tabela global, mesmo comportamento do `seed_legacy_data.py`), `quantidade_planejada=TOTAL`, `peso_percentual=None`.

## API

**Endpoint:** `POST /api/projetos/{projeto_pk}/configuracoes/eap/importar/`

Nova view (`EapImportView`, `APIView` com `mixins.CreateModelMixin`-like `create`, seguindo o padrão de `FotoUploadView` em `registros_diarios/views.py`): `parser_classes = (MultiPartParser, FormParser)`, permissão `IsAuthenticatedWithEmpresa` + `IsGerente` (mesma exigida para criar disciplina).

**Request:** `multipart/form-data`, campo `arquivo`.

**Response — sucesso (201):**
```json
{"disciplinas_criadas": 6, "servicos_criados": 42}
```

**Response — erro de validação de arquivo/linhas (400):**
```json
{"erros": ["Linha 8: TOTAL/QUANTIDADE inválido.", "Linha 12: ATIVIDADE em branco."]}
```

**Response — EAP não vazia ou arquivo com formato/cabeçalho inválido (400):**
```json
{"detail": "Este projeto já possui uma EAP. Import só é permitido em projetos sem disciplinas cadastradas."}
```

A lógica de parsing/validação/criação fica em `configuracoes/services.py` (`importar_eap_de_arquivo(projeto, arquivo) -> ImportResultado`), a view só orquestra request/response — mesma separação view/services já usada no resto do módulo.

## UI

Novo componente `ImportarEapButton.tsx` em `features/configuracoes/`, renderizado na aba EAP (`ConfiguracaoPage.tsx`) junto ao `EmptyState` existente quando `disciplinas.length === 0`. Contém: botão que abre um `<input type="file" accept=".csv,.xlsx" hidden>`; ao selecionar arquivo, dispara upload imediatamente (sem preview); estado de carregamento no botão durante o upload; painel de erro inline (lista) quando a resposta traz `erros` ou `detail`.

Novo hook `useImportarEap(projetoId)` em `configuracaoApi.ts` — mutation que faz `POST` multipart e, no sucesso, invalida a query de `useConfiguracaoProjeto` (mesma chave já usada por `useCriarDisciplina` etc.) para a aba recarregar com os dados importados.

Sem gate de permissão no frontend (nenhum botão existente na página faz isso — ex. "Adicionar disciplina" também não esconde para não-Gerente); o backend responde 403 e a mutation mostra o erro genérico de permissão via toast, igual ao padrão já usado nos outros formulários da página.

## Testes esperados

**Backend (`configuracoes/tests/test_services.py`, `test_api.py`):**
- Cabeçalho na primeira linha (CSV simples) importa corretamente.
- Cabeçalho a partir da linha 4 (replica `BASE_QTD_L2`) é localizado e importado.
- XLSX com o mesmo conteúdo do CSV produz o mesmo resultado.
- CSV em `cp1252` com acentuação (ex. "Preparação") decodifica corretamente.
- Linha com `DISCIPLINA` em branco gera erro e nenhum dado é criado.
- Linha com `TOTAL` não-numérico gera erro e nenhum dado é criado.
- `ATIVIDADE` duplicada na mesma `DISCIPLINA` dentro do arquivo gera erro.
- Múltiplas linhas com mesma `DISCIPLINA` agrupam num único `Disciplina` com vários `CatalogoServico`.
- Import rejeitado quando o projeto já tem disciplina raiz.
- Import rejeitado (403) para usuário não-Gerente.
- Arquivo com extensão não suportada (`.txt`) rejeitado.
- Isolamento multi-tenant: usuário de outra empresa não consegue importar no projeto.

**Frontend (`tests/e2e/config.spec.ts`):**
- Botão "Importar planilha" visível quando a EAP está vazia.
- Upload de CSV válido popula a árvore da EAP e mostra o toast de sucesso.
- Upload de arquivo com linha inválida mostra a lista de erros e não altera a EAP.
