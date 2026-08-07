# BuildFlow Information Architecture

Data: 2026-08-06
Base: `docs/route-inventory.md`, `docs/user-journeys.md` e auditoria visual.

## Objetivo da IA

Transformar o BuildFlow de uma ferramenta organizada por cadastros para uma ferramenta organizada por trabalho real:

- Ver o que precisa de atencao.
- Registrar o que aconteceu.
- Planejar o que deve acontecer.
- Medir, aprovar e auditar.
- Controlar custo, prazo e qualidade.

## Principios

1. **Projeto como contexto central**

   Depois que um projeto e selecionado, a navegacao deve deixar claro que todas as telas pertencem a esse projeto.

2. **Excecoes antes de listas completas**

   Para gerente de obra e gerente da construtora, a IA deve expor atrasos, pendencias, RNCs e bloqueios antes de informacao normal.

3. **Operacao separada de administracao**

   EAP, RDO, medicoes, RNCs e custos sao trabalho recorrente. Equipes, valores e permissoes sao configuracao ou suporte.

4. **Mesma linguagem em escalas diferentes**

   Dashboard da empresa e dashboard do projeto devem usar padroes semelhantes de indicadores, alertas e drill-down.

5. **Mobile por tarefa, nao por paridade visual**

   Mobile deve priorizar criar RDO, anexar foto, consultar alerta, aprovar/rejeitar e ver pendencias.

## IA Atual

```text
Login
Dashboard
Projetos
Projeto
  Registros diarios
  Historico & Aprovacoes
  Medicoes
  RNCs
  Custos & Ociosidade
  Configuracoes
    Disciplinas
    EAP
    Equipes
    Valores
```

Problemas:

- EAP foi promovida para Planejamento, separando planejamento fisico dos cadastros auxiliares.
- Disciplinas, equipes e valores permanecem em Configuracoes.
- Nao ha Dashboard do Projeto.
- Aprovações estao misturadas ao historico.
- RDO, medicao, RNC e custos nao compartilham uma estrutura comum de filtros/status.
- O contexto de projeto na sidebar pode truncar o nome.

## IA Proposta para o Produto

```text
Empresa
  Dashboard
  Projetos
  Alertas
  Relatorios executivos

Projeto
  Visao geral
  Planejamento
    EAP e Cronograma
      Cronograma
      Estrutura da EAP
      Pesos
      Dependencias
    Baseline e replanejamentos
  Operacao
    Registros diarios
      Calendario
      Novo RDO
      Detalhe do RDO
    Aprovacoes
      RDOs
      Medicoes
  Contrato
    Medicoes
      Lista
      Detalhe
      Nova medicao
  Qualidade
    RNCs
      Lista
      Nova RNC
      Detalhe/edicao
  Custos
    Custos & Ociosidade
    Mao de obra
    Maquinas
  Cadastros do projeto
    Equipes
    Pessoas
    Maquinas
    Valores de custo
    Unidades e parametros
  Configuracoes
    Permissoes
    Integracoes
    Preferencias
```

## Navegacao Recomendada

### Nivel Empresa

| Item | Objetivo | Perfil principal |
|---|---|---|
| Dashboard | Comparar projetos e alertas da empresa | Gerente da construtora |
| Projetos | Encontrar, criar e abrir projeto | Todos |
| Alertas | Pendencias cross-projeto | Gerente da construtora |
| Relatorios | Exportacoes e visoes executivas | Gerente da construtora |

### Nivel Projeto

| Grupo | Item | Objetivo | Perfil principal |
|---|---|---|---|
| Visao | Visao geral | Saude do projeto, indicadores e excecoes | Gerente de obra |
| Planejamento | EAP e Cronograma | Estrutura, pesos, prazo e dependencias | Gerente de obra |
| Operacao | Registros diarios | Criar e consultar RDOs | Campo/RDO |
| Operacao | Aprovacoes | Decidir RDOs e medicoes pendentes | Aprovador |
| Contrato | Medicoes | Gerar e acompanhar medicoes | Responsavel por medicoes |
| Qualidade | RNCs | Registrar e resolver nao conformidades | Gerente de obra |
| Custos | Custos & Ociosidade | Entender custo produtivo/ocioso | Gerente |
| Cadastros | Equipes, pessoas, maquinas, valores | Preparar dados operacionais | Administrador |
| Configuracoes | Permissoes e parametros | Administrar projeto | Administrador |

## Reorganizacao da EAP

EAP deve sair de:

```text
Projeto > Configuracoes > EAP
```

E passar para:

```text
Projeto > Planejamento > EAP e Cronograma
```

Subviews:

| Subview | Funcao |
|---|---|
| Cronograma | Gantt, filtros, zoom, Hoje, baseline, caminho critico e desvio. |
| Estrutura da EAP | Tabela hierarquica com disciplinas, subdisciplinas e servicos. |
| Pesos | Distribuicao, validacao de soma, modo de edicao e salvar/cancelar. |
| Dependencias | Relacoes entre atividades, predecessoras e sucessoras. |

Indicadores fixos da tela:

- Avanco realizado.
- Avanco previsto.
- Desvio.
- Peso distribuido.
- Atividades criticas.
- Atividades bloqueadas ou sem responsavel.

## Modelo de App Shell

### Topbar

Deve responder:

- Em qual empresa estou?
- Quem sou eu?
- Como encontro outro projeto rapidamente?
- Existem notificacoes criticas?
- Como saio ou altero preferencias?

### Sidebar

Deve responder:

- Estou no nivel Empresa ou Projeto?
- Qual projeto esta aberto?
- Quais grupos de trabalho existem?
- O que exige minha atencao?

Recomendacoes:

- Project switcher com nome completo, tooltip e busca.
- Indicadores discretos de pendencias por item.
- Estado ativo unico por nivel, evitando "Projetos" e "EAP" parecerem ativos ao mesmo tempo.
- Em mobile, menu deve priorizar ultimas rotas e tarefas frequentes.

## Objetos de Navegacao

| Objeto | Rotas atuais | Papel na IA |
|---|---|---|
| Empresa | `/dashboard`, `/projetos` | Tenant e visao multi-projeto. |
| Projeto | `/projetos/:projetoId/*` | Contexto operacional principal. |
| RDO | `/registros-diarios/*` | Registro diario e evidencia de campo. |
| EAP | `/planejamento/eap` | Estrutura de planejamento, cronograma, pesos e editor detalhado. |
| Medicao | `/medicoes/*` | Conversao de producao em cobranca/contrato. |
| RNC | `/rncs/*` | Qualidade e nao conformidade. |
| Custo | `/custos-ociosidade` | Analise gerencial de recurso. |
| Configuracao | `/configuracoes` | Parametros e cadastros auxiliares. |

## Taxonomia de Status

Status devem ser centralizados em um vocabulario comum.

| Dominio | Status atuais | Recomendacao |
|---|---|---|
| Projeto | ativo, pausado, concluido | Manter, com badge semanticamente neutro/success/warning. |
| RDO | aguardando_aprovacao, aprovado, rejeitado | Usar fila, status e motivo visivel. |
| EAP | concluido, no_prazo, atencao, critico, nao_iniciado, planejado | Separar prazo, execucao e bloqueio. |
| Medicao | aguardando_aprovacao, aprovado, rejeitado | Alinhar com RDO para aprovacao. |
| RNC | pendente, concluida, prazo_excedido | Destacar prazo e reincidencia. |

Lacuna: hoje status e cor estao dispersos por feature. A IA precisa de um contrato semantico compartilhado para evitar interpretacoes conflitantes.

## Permissoes e Visibilidade

Modelo atual:

- `gerente`
- `auxiliar_administrativo`

Necessidade de produto:

- Gerente da construtora.
- Gerente de obra.
- Campo/RDO.
- Responsavel por medicao.
- Aprovador/fiscal.
- Administrador.

Recomendacao:

- Nao multiplicar telas antes de decidir o modelo de permissao.
- Separar "persona de produto" de "role tecnico".
- Criar matriz de capacidades por acao:
  - ver
  - criar
  - editar
  - aprovar
  - rejeitar
  - cancelar
  - configurar
  - exportar

## Estados Padrao por Tela

Cada rota principal deve ter:

- Loading.
- Empty.
- Error.
- Forbidden.
- Offline ou reconnecting quando aplicavel.
- Unsaved changes quando houver edicao.
- Success feedback depois de persistir.

Prioridade de aplicacao:

1. EAP e Cronograma.
2. RDO.
3. Aprovacoes.
4. Medicoes.
5. RNCs.
6. Custos.

## Rotas Alvo para a Tela-Piloto EAP

Opcao conservadora:

```text
/projetos/:projetoId/planejamento/eap
```

Usar feature flag para renderizar a nova experiencia dentro da rota atual.

Opcao recomendada a medio prazo:

```text
/projetos/:projetoId/planejamento/eap
/projetos/:projetoId/planejamento/eap?view=cronograma
/projetos/:projetoId/planejamento/eap?view=estrutura
/projetos/:projetoId/planejamento/eap?view=pesos
/projetos/:projetoId/planejamento/eap?view=dependencias
```

Vantagens:

- Breadcrumb correto.
- Analytics por subview.
- Permissoes especificas.
- Feature flag mais clara.
- Reducao da ambiguidade com Configuracoes.

Risco:

- Exige ajuste de links, sidebar, testes e possivelmente redirects.

## Fluxo de Migracao da IA

1. Manter rotas atuais funcionando.
2. Promover a nova EAP como experiencia padrao de Planejamento.
3. Atualizar sidebar para apontar EAP para a rota propria.
4. Manter redirect da rota antiga.
5. Validar com usuarios-chave.
6. Manter redirecionamento da query antiga de Configuracoes para a rota propria da EAP.
7. Depois consolidar Registros diarios, Aprovacoes, Medicoes, RNCs e Custos.

## Sitemap Proposto para MVP de UI Foundation

```text
Empresa
  Dashboard
  Projetos

Projeto
  Planejamento
    EAP e Cronograma
  Operacao
    Registros diarios
    Historico & Aprovacoes
    Medicoes
  Gestao
    RNCs
    Custos & Ociosidade
  Administracao
    Configuracoes
```

Esse sitemap respeita o escopo atual do backend/frontend, mas corrige a principal distorcao: EAP deixa de parecer configuracao auxiliar e vira planejamento.

## Perguntas em Aberto

- O BuildFlow tera Dashboard do Projeto separado do Dashboard da Empresa nesta fase?
- O aprovador/fiscal pode pertencer a outra empresa/tenant?
- EAP ja tem rota propria; falta decidir se Configuracoes ainda deve manter links auxiliares para disciplinas usadas pela EAP.
- Dependencias do cronograma ja existem no backend ou serao apenas preparadas no frontend?
- Medicao deve enxergar apenas RDOs aprovados ou tambem producao pendente?
- Quais acoes precisam funcionar offline no campo?

## Criterios de Pronto para a Proxima Etapa

- Matriz de permissoes por acao definida.
- Decisao sobre rota da EAP tomada.
- Decisao sobre rota propria da EAP documentada.
- Componentes base priorizados para a EAP padrao.
- Wireframe textual da proxima iteracao da EAP aprovado antes de implementar.
