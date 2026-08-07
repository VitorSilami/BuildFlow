# BuildFlow Design Principles

Data: 2026-08-07
Escopo: traducao da marca para UX/UI e exemplos por modulo.

## 4. Traducao da marca para UX/UI

### Principios de experiencia

1. **Clareza acima de decoracao**

   Toda decisao visual deve melhorar leitura, decisao ou confianca. Se um elemento nao ajuda o usuario a entender ou agir, ele deve sair.

2. **Excecoes antes de normalidade**

   A interface deve destacar atrasos, rejeicoes, bloqueios, perdas, RNCs e pendencias antes de mostrar listas completas.

3. **Contexto sempre visivel**

   Projeto, periodo, frente, status e responsavel precisam estar acessiveis sem o usuario memorizar onde esta.

4. **Controle sem friccao**

   Acoes recorrentes devem ser rapidas. Acoes sensiveis devem ter confirmacao, historico e reversibilidade quando possivel.

5. **Rastreabilidade como confianca**

   O produto deve deixar claro de onde veio o dado, quem registrou, quando foi aprovado e qual evidencia sustenta a decisao.

6. **Densidade informacional elegante**

   O BuildFlow deve aceitar dados densos sem parecer pesado. Isso exige grids, tabelas, alinhamento, truncamento controlado e hierarquia.

7. **Feedback claro de acoes**

   Salvar, aprovar, rejeitar, importar, anexar foto e editar pesos precisam de resposta imediata e mensagens objetivas.

8. **Acessibilidade operacional**

   Contraste, foco, teclado, labels e textos alternativos sao parte da confianca do produto, nao detalhe tecnico.

### Como a identidade influencia a jornada

- O usuario entra no produto e entende rapidamente se precisa olhar empresa, projeto ou modulo.
- Em cada modulo, o topo mostra excecoes e proximas decisoes.
- A navegacao usa nomes do trabalho real: Planejamento, Operacao, Gestao, Administracao.
- O visual evita ansiedade: muita informacao, mas organizada.
- Estados e alertas criam linguagem comum entre areas: campo, escritorio e gestao.

### Como melhora confianca

- Consistencia reduz suspeita de erro.
- Rastreabilidade visual reforca que dados nao sao "soltos".
- Semantica de status evita interpretacoes diferentes entre usuarios.
- Tipografia e densidade tecnica comunicam maturidade.
- Componentes previsiveis reduzem risco em tarefas criticas.

### Como melhora percepcao de valor

O produto deixa de parecer uma colecao de telas e passa a parecer uma plataforma de operacao. Isso aumenta valor percebido porque mostra que o BuildFlow entende a rotina de uma obra: planejar, registrar, aprovar, medir, corrigir e controlar.

## Aplicacao pratica por modulo

### Dashboard

- Funcao principal: mostrar saude operacional da empresa e prioridades entre projetos.
- Clima visual: centro de controle executivo.
- Destaques: alertas, atrasos, pendencias de aprovacao, projetos em risco.
- Densidade: alta, mas em blocos claros.
- Navegacao: drill-down para projeto/modulo.
- Leitura: primeiro excecoes, depois tendencia, depois distribuicao.
- Mais atencao: fila critica, custo/ociosidade, RDOs pendentes.

### Projetos

- Funcao principal: encontrar, comparar e abrir projetos.
- Clima visual: portfolio operacional.
- Destaques: status, progresso, ultimo RDO, risco ou pendencia.
- Densidade: media; cards bons para poucos projetos, tabela para muitos.
- Navegacao: card inteiro selecionavel e acoes secundarias discretas.
- Leitura: nome, status, progresso, proxima acao.
- Mais atencao: projetos sem RDO recente ou com alerta.

### EAP / Cronograma

- Funcao principal: controlar estrutura, pesos, prazo e avanco fisico.
- Clima visual: engenharia de planejamento.
- Destaques: desvio, baseline, caminho critico, peso distribuido.
- Densidade: alta.
- Navegacao: tabs internas para cronograma, estrutura, pesos e dependencias.
- Leitura: KPIs no topo, Gantt/tabela depois, detalhe por selecao.
- Mais atencao: atividades atrasadas, pesos inconsistentes, dependencias bloqueantes.

### Registros Diarios

- Funcao principal: registrar e consultar realidade do campo.
- Clima visual: rotina de campo confiavel.
- Destaques: dias sem RDO, RDO rejeitado, fotos pendentes, ocorrencias.
- Densidade: media no calendario, alta no detalhe.
- Navegacao: calendario mensal + painel do dia + criacao guiada.
- Leitura: dia, status, producao, equipe, maquinas, evidencias.
- Mais atencao: pendencias e evidencias incompletas.

### Historico & Aprovacoes

- Funcao principal: revisar e decidir.
- Clima visual: fila de decisao.
- Destaques: aguardando aprovacao, rejeitado, evidencias insuficientes.
- Densidade: media-alta.
- Navegacao: filtros por status e cards expansivos/drawer.
- Leitura: status, evidencias, ocorrencias, motivo, decisao.
- Mais atencao: botao de aprovar/rejeitar e justificativas.

### Medicoes

- Funcao principal: acompanhar e fechar medicoes.
- Clima visual: controle contratual.
- Destaques: valor, periodo, status, pendencias.
- Densidade: alta com tabela.
- Navegacao: lista tabular, detalhe financeiro, criacao por modal.
- Leitura: medicao, data de corte, valor, status, itens.
- Mais atencao: proxima medicao pendente e divergencias.

### RNCs

- Funcao principal: registrar, priorizar e resolver nao conformidades.
- Clima visual: qualidade e risco.
- Destaques: prazo, severidade, status efetivo, responsavel.
- Densidade: media-alta.
- Navegacao: lista priorizada, filtros, detalhe/edicao.
- Leitura: codigo, categoria, prazo, responsavel, acao corretiva.
- Mais atencao: vencidas e sem acao corretiva.

### Custos & Ociosidade

- Funcao principal: revelar perdas e improdutividade.
- Clima visual: analise financeira operacional.
- Destaques: custo ocioso, eficiencia, maquinas/equipe com perda.
- Densidade: alta.
- Navegacao: periodo, composicao, rankings, detalhes.
- Leitura: perda total, causas, frente/equipe/maquina, tendencia.
- Mais atencao: variacoes relevantes e itens acionaveis.

### Configuracoes

- Funcao principal: manter base operacional confiavel.
- Clima visual: administracao tecnica limpa.
- Destaques: cadastros incompletos, valores ausentes, permissoes.
- Densidade: media.
- Navegacao: secoes de cadastro, formularios e estados vazios acionaveis.
- Leitura: o que esta configurado, o que falta, proxima acao.
- Mais atencao: dados que bloqueiam RDO, medicao ou custo.

## Do's

- Mostrar prioridade antes de volume.
- Usar labels claros para dados tecnicos.
- Manter acoes principais previsiveis entre modulos.
- Adaptar mobile para tarefa real.
- Preservar historico e contexto em decisoes sensiveis.

## Don'ts

- Nao usar graficos como ornamento.
- Nao esconder acoes essenciais atras de hover.
- Nao misturar termos para o mesmo estado.
- Nao criar fluxos com salvamento implicito em campos criticos.
- Nao fazer o usuario procurar manualmente o que esta errado.

## Checklist de UX

- [ ] A primeira dobra responde "o que precisa de atencao?"
- [ ] O usuario sabe qual projeto/periodo/frente esta vendo?
- [ ] Existe uma proxima acao clara?
- [ ] Erros e vazios explicam como resolver?
- [ ] A tela funciona para uso repetido?
- [ ] O mobile prioriza captura, aprovacao ou consulta rapida?
- [ ] Dados criticos sao legiveis sem depender de cor?
