# EAP — Integração automática com Produção Diária

## Contexto

A fatia inicial da EAP (`docs/superpowers/specs/2026-07-23-eap-estrutura-peso-quantidade-design.md`)
implementou peso/quantidade planejada/executada por Disciplina → Serviço, mas deixou
`quantidade_executada` como um valor **digitado manualmente** pelo Gerente. Essa spec cobre a
primeira peça do backlog que ficou "fora de escopo" naquela rodada: ligar a produção lançada no RDO
diretamente ao serviço da EAP, para que a quantidade executada some sozinha.

Isso é viável com baixo esforço porque `ProducaoDiaria` (`registros_diarios/models.py:159`) já tem
FK direto para `CatalogoServico` — não depende de nenhuma das outras peças do backlog (hierarquia
N-níveis, Gantt, importação CSV), que continuam adiadas para specs futuras próprias.

Motivação adicional: a carga de dados legados (`MODELO IMPORT SOFT`) populou quantidade planejada
de um projeto real em andamento, mas sem nenhum RDO histórico por trás — se a quantidade executada
fosse 100% derivada do RDO sem nenhuma via manual, esse projeto apareceria com 0% de avanço, o que é
falso. Por isso o desenho inclui uma via manual explícita (ajuste), não só a soma automática.

## Escopo desta rodada

- `quantidade_executada` de um `CatalogoServico` passa a ser a soma de duas fontes, sempre
  recalculada (nunca armazenada como total):
  1. Soma de `ProducaoDiaria.quantidade` de todos os lançamentos de RDO vinculados àquele serviço.
  2. Um ajuste manual (`quantidade_executada_manual`) para produção anterior ao uso do sistema ou
     correções pontuais — visível separadamente na UI, nunca escondido dentro do total.
- Lista de rastreabilidade por serviço: quais lançamentos de RDO (data + quantidade) compõem a soma
  automática, exibida via um toggle "Ver lançamentos" na aba EAP.

## Fora de escopo (backlog para specs futuras)

- Hierarquia N-níveis, Gantt/datas previstas/aderência, importação/exportação CSV, "carta de
  controle" completa por item (painel diretor) — continuam adiados, sem relação de dependência com
  esta spec.
- Paginação da lista de lançamentos vinculados (YAGNI na escala atual dos projetos).
- Edição/exclusão de um `ProducaoDiaria` já lançado não é parte desta spec (usa o fluxo existente do
  RDO); esta spec só consome esses dados para o total, não muda como RDOs são criados/editados.

## Modelo de dados (`buildflow/configuracoes/models.py`)

`CatalogoServico.quantidade_executada` (campo hoje editável, `default=Decimal("0")`) é **renomeado**
para `quantidade_executada_manual`, via `RenameField` — sem `RunPython` custom, sem perda de dado:
qualquer valor já digitado manualmente (inclusive o `quantidade_executada=500` do seed de demo) vira
automaticamente o ajuste manual, com efeito idêntico ao comportamento de hoje até que RDOs comecem a
somar em cima.

`quantidade_planejada` e `peso_percentual` (de Disciplina e Serviço) não mudam.

## Cálculo (`buildflow/projetos/services.py`)

Nova função:

```python
def calcular_quantidade_executada_total(servico: CatalogoServico) -> Decimal:
    soma_rdo = (
        ProducaoDiaria.objects.filter(servico=servico)
        .aggregate(total=Sum("quantidade"))["total"]
        or Decimal("0")
    )
    return servico.quantidade_executada_manual + soma_rdo
```

`calcular_avanco_servico` passa a usar `calcular_quantidade_executada_total(servico)` no lugar do
campo bruto `servico.quantidade_executada`. Continua "nunca inventa número": sem `quantidade_planejada`
definida, retorna `None` normalmente — isso não muda.

## API (`buildflow/configuracoes/`)

- `CatalogoServicoSerializer`:
  - `quantidade_executada` vira `SerializerMethodField` (read-only), usando
    `calcular_quantidade_executada_total`.
  - Novo campo `quantidade_executada_manual` (escrita), substitui a semântica antiga do campo.
  - Novo campo `producoes_vinculadas`: lista de `{data_referencia, quantidade}` a partir de
    `ProducaoDiaria.objects.filter(servico=servico).order_by("-data_referencia")`.
- `PATCH configuracoes/servicos/<pk>/` (`ServicoDetailViewSet`) passa a aceitar
  `quantidade_executada_manual` no lugar de `quantidade_executada`. Permissão inalterada
  (`IsAuthenticatedWithEmpresa`, `IsGerente`).

## Frontend

- `EapDisciplinaCard.tsx`: o input inline que hoje edita "quantidade executada" (salva no blur) passa
  a editar `quantidade_executada_manual` — mesma UX.
- Abaixo do input, exibe o total somado (`quantidade_executada`, agora read-only), com o breakdown
  visível (ex.: "Executado: 640 m² — RDO: 140 + ajuste manual: 500").
- Toggle "Ver lançamentos" expande `producoes_vinculadas` (data + quantidade) por serviço.
- `types/configuracao.ts`: `CatalogoServico` ganha `quantidade_executada_manual` (writable) e
  `producoes_vinculadas` (read-only); `quantidade_executada` permanece no tipo, mas como read-only.
- `configuracaoApi.ts`: `useAtualizarServico` passa a enviar `quantidade_executada_manual` no payload
  em vez de `quantidade_executada`.

## Permissões

Sem mudanças: leitura aberta a qualquer perfil autenticado da empresa; escrita (ajuste manual)
restrita a Gerente, mesmo padrão já aplicado em `ServicoDetailViewSet`.

## Migração e compatibilidade

- `seed_demo_data.py`: `quantidade_executada=500` (linha 97) vira `quantidade_executada_manual=500` —
  única mudança necessária, sem alterar o comportamento demonstrado.
- `seed_legacy_data.py`: sem mudanças — ele não popula quantidade executada (planilha legada só tem
  quantidade planejada), então o ajuste manual fica `0` por padrão, e o total passa a ser 100%
  dirigido por RDO assim que a obra começar a lançar diariamente no sistema.
- Projetos com RDOs já lançados anteriormente à introdução desta feature passam a somar
  automaticamente desde o primeiro deploy — nenhuma migração de dado adicional é necessária porque a
  soma é sempre recalculada em tempo de leitura (nunca armazenada), então não há “histórico perdido”.

## Testes

- `buildflow/projetos/tests/test_execucao.py`: casos para `calcular_quantidade_executada_total` —
  soma de múltiplos `ProducaoDiaria` do mesmo serviço; ajuste manual somado corretamente; serviço sem
  nenhum RDO usa só o ajuste manual; editar/excluir um `ProducaoDiaria` já vinculado muda o total na
  próxima leitura (sem precisar re-salvar o serviço).
- `buildflow/configuracoes/tests/test_api.py`: serializer expõe `producoes_vinculadas` ordenado por
  data decrescente; `PATCH` enviando `quantidade_executada` bruto é ignorado silenciosamente (campo
  vira `SerializerMethodField`, comportamento padrão do DRF para campo read-only — não é erro 400);
  `PATCH` aceita `quantidade_executada_manual` e persiste corretamente.
- Frontend: `tests/e2e/config.spec.ts` — estende o teste da aba EAP mockando `ProducaoDiaria`
  vinculada a um serviço, verificando que o total exibido soma RDO + ajuste, e que o toggle "Ver
  lançamentos" mostra a lista mockada.
