# BuildFlow User Journeys

Data: 2026-08-06
Base: auditoria de UI, inventario de rotas e Product Blueprint existente.

## Premissas

- O produto atual tem RBAC simples no frontend: `gerente` e `auxiliar_administrativo`.
- Os perfis abaixo representam jornadas de produto, nao necessariamente cargos/permissoes ja implementados.
- Onde a permissao ainda nao existe no backend/frontend, o documento marca como decisao pendente.
- O foco e BuildFlow como SaaS B2B tecnico para obras rodoviarias, com uso em escritorio, canteiro, tablet e celular.

## Perfis Operacionais

### 1. Gerente da Construtora

Objetivo principal: enxergar a saude dos projetos da empresa e decidir onde intervir.

Informacoes necessarias:

- Projetos ativos, pausados e concluidos.
- Avanco previsto vs. realizado por projeto.
- Projetos sem RDO recente.
- Custo total, ociosidade, desvios e RNCs criticas.
- Medicoes pendentes e valores a aprovar.

Tarefas frequentes:

- Comparar projetos.
- Abrir projeto com alerta.
- Revisar custos e ociosidade.
- Acompanhar RNCs de prazo excedido.
- Priorizar cobrancas para gerente de obra.

Decisoes tomadas:

- Onde alocar equipe, maquina ou atencao gerencial.
- Qual projeto precisa de reuniao de alinhamento.
- Quais desvios justificam plano de recuperacao.
- Se uma medicao deve seguir para aprovacao ou revisao.

Erros possiveis:

- Interpretar verde como "sem risco" quando ha atraso oculto.
- Ignorar projeto com nome truncado ou alerta pouco saliente.
- Tomar decisao por dado incompleto ou RDO atrasado.
- Comparar periodos diferentes entre projetos.

Pontos de espera:

- Atualizacao de RDOs do campo.
- Aprovacao de medicoes.
- Fechamento de RNC.
- Reprocessamento de indicadores depois de importacao EAP ou edicao de pesos.

Notificacoes necessarias:

- Projeto sem RDO ha X dias.
- Atividade critica atrasada.
- Peso da EAP diferente de 100%.
- Medicao aguardando decisao.
- RNC com prazo excedido ou reincidente.

Acoes mobile essenciais:

- Consultar alertas.
- Abrir resumo de projeto.
- Aprovar ou rejeitar medicao quando autorizado.
- Compartilhar/encaminhar status em reuniao.

Metricas de sucesso:

- Tempo para identificar projeto em risco.
- Percentual de alertas tratados no prazo.
- Reducao de dias sem RDO.
- Reducao de custo ocioso.
- Reducao de RNCs reincidentes.

### 2. Gerente de Obra

Objetivo principal: controlar a execucao diaria do projeto e agir antes que desvios virem atraso caro.

Informacoes necessarias:

- EAP, cronograma, caminho critico e frentes de servico.
- Avanco fisico previsto e realizado.
- RDOs aguardando revisao.
- Maquinas ociosas, faltas e ocorrencias.
- RNCs abertas e medicoes em preparacao.

Tarefas frequentes:

- Revisar RDOs do dia anterior.
- Conferir atividades atrasadas ou em risco.
- Ajustar planejamento fisico.
- Cobrar responsaveis por frentes de servico.
- Preparar reuniao semanal.

Decisoes tomadas:

- Repriorizar frente de servico.
- Solicitar reforco de equipe ou maquina.
- Abrir RNC ou acao corretiva.
- Validar se a medicao esta coerente com producao.

Erros possiveis:

- Alterar peso sem perceber por input sempre ativo.
- Nao notar que a soma dos pesos nao fecha.
- Confundir avanco realizado com previsto.
- Perder relacao entre atraso, RDO e medicao.

Pontos de espera:

- RDO enviado pelo campo.
- Consolidacao da producao.
- Resposta do fiscal/aprovador.
- Importacao ou ajuste de EAP.

Notificacoes necessarias:

- RDO pendente de revisao.
- Atividade critica com desvio.
- Frente sem producao registrada.
- Peso ou cronograma inconsistente.
- Medicao bloqueada por pendencia.

Acoes mobile essenciais:

- Consultar cronograma resumido.
- Aprovar/rejeitar RDO quando for fiscal.
- Ver atividade atrasada e responsavel.
- Registrar comentario ou orientacao.

Metricas de sucesso:

- Tempo para encontrar atividade atrasada.
- Tempo medio de revisao de RDO.
- Aderencia do avanco realizado ao previsto.
- Quantidade de ajustes manuais de producao.
- Prazo medio de resolucao de impedimentos.

### 3. Engenheiro de Campo

Objetivo principal: registrar producao e ocorrencias com rapidez e confiabilidade no canteiro.

Informacoes necessarias:

- Projeto e frente corretos.
- RDO anterior ou dados recorrentes.
- Equipe, maquinas, clima, turno e fiscal.
- Disciplinas, servicos, unidades e km.
- Pendencias ou rejeicoes a corrigir.

Tarefas frequentes:

- Criar RDO diario.
- Registrar producao por disciplina/servico.
- Registrar presencas, maquinas e paradas.
- Adicionar fotos e ocorrencias.
- Consultar ultimo RDO para continuidade de km.

Decisoes tomadas:

- Qual equipe/frente registrar.
- Se houve parada, falta, atestado ou ocorrencia.
- Que foto comprova a producao.
- Se o RDO esta pronto para envio.

Erros possiveis:

- Escolher servico ou unidade errada.
- Digitar quantidade ou km fora de faixa plausivel.
- Esquecer maquina, pessoa ou foto.
- Enviar RDO incompleto por pressa.

Pontos de espera:

- Conexao instavel em campo.
- Upload de fotos.
- Carregamento de listas longas de pessoas/maquinas.
- Resposta de rejeicao/correcao.

Notificacoes necessarias:

- RDO rejeitado com motivo claro.
- Campo obrigatorio faltando.
- Quantidade fora de faixa esperada.
- Upload de foto falhou ou ficou pendente.
- RDO do dia ainda nao enviado.

Acoes mobile essenciais:

- Criar RDO.
- Duplicar dados do RDO anterior.
- Tirar/enviar foto.
- Preencher producao, presenca e maquinas.
- Salvar rascunho ou retomar depois.

Metricas de sucesso:

- Tempo para concluir um RDO.
- Taxa de RDO rejeitado.
- Campos corrigidos apos envio.
- Uploads de foto bem-sucedidos.
- RDOs enviados no mesmo dia.

### 4. Responsavel pelo RDO

Objetivo principal: garantir que todos os registros diarios estejam completos, consistentes e rastreaveis.

Informacoes necessarias:

- Calendario de RDOs.
- Dias sem registro.
- Status por dia: aguardando, aprovado, rejeitado.
- Motivos de rejeicao.
- Autor, fiscal, equipe e turno.

Tarefas frequentes:

- Verificar se o RDO do dia foi criado.
- Corrigir RDO rejeitado.
- Criar novo registro para data especifica.
- Abrir historico e detalhe.
- Conferir anexos e producoes vinculadas.

Decisoes tomadas:

- Se um RDO deve ser corrigido ou recriado.
- Se dados do dia anterior podem ser reaproveitados.
- Se uma divergencia deve virar ocorrencia/RNC.

Erros possiveis:

- Criar RDO em data errada.
- Duplicar registro sem perceber.
- Nao entender por que foi rejeitado.
- Nao perceber que ha mais de um RDO no mesmo dia.

Pontos de espera:

- Aprovacao pelo fiscal.
- Carregamento do calendario mensal.
- Upload de fotos.
- Disponibilidade de listas de configuracao.

Notificacoes necessarias:

- RDO pendente de envio hoje.
- RDO rejeitado.
- Dia com multiplos RDOs.
- Falha ao salvar ou enviar foto.

Acoes mobile essenciais:

- Abrir calendario.
- Criar RDO em um toque.
- Ver rejeicao.
- Reenviar/corrigir registro.

Metricas de sucesso:

- Percentual de dias com RDO no prazo.
- Tempo ate correcao de rejeicao.
- Numero de RDOs duplicados por engano.
- Taxa de completude por secao do wizard.

### 5. Responsavel por Medicoes

Objetivo principal: transformar producao aprovada em medicao contratual correta.

Informacoes necessarias:

- EAP e servicos mediveis.
- Quantidade acumulada, anterior e do periodo.
- Preco unitario ou servicos sem preco.
- Data de corte e fiscal.
- Status da medicao.

Tarefas frequentes:

- Criar medicao com data de corte.
- Verificar itens e valores.
- Corrigir servicos sem preco.
- Acompanhar aprovacao/rejeicao.
- Cancelar medicao pendente quando necessario.

Decisoes tomadas:

- Se ja ha producao suficiente para medir.
- Qual data de corte usar.
- Se a medicao pode ser enviada.
- Se divergencias exigem ajuste na EAP ou RDO.

Erros possiveis:

- Criar medicao antes de aprovar RDOs relevantes.
- Medir servico sem preco.
- Escolher fiscal errado.
- Repetir periodo ja medido.

Pontos de espera:

- RDOs aprovados.
- Precificacao de servicos.
- Aprovacao do fiscal.
- Correcao de itens rejeitados.

Notificacoes necessarias:

- Medicao pendente bloqueando nova medicao.
- Servicos sem preco.
- Medicao aprovada ou rejeitada.
- Divergencia entre producao e medicao.

Acoes mobile essenciais:

- Consultar status e valor.
- Aprovar/rejeitar quando autorizado.
- Ver itens criticos.

Metricas de sucesso:

- Tempo para gerar medicao.
- Numero de itens sem preco.
- Taxa de medicoes rejeitadas.
- Tempo medio ate aprovacao.
- Valor medido sem retrabalho.

### 6. Aprovador

Objetivo principal: validar formalmente RDOs e medicoes com evidencia suficiente.

Informacoes necessarias:

- Fila de itens aguardando aprovacao.
- Autor, data, turno, fiscal, evidencias e historico.
- Motivo de rejeicoes anteriores.
- Impacto contratual da aprovacao.
- Alteracoes feitas apos rejeicao.

Tarefas frequentes:

- Revisar RDO.
- Aprovar ou rejeitar com motivo.
- Revisar medicao.
- Conferir fotos e quantidades.
- Registrar decisao auditavel.

Decisoes tomadas:

- Se a evidencia comprova o registro.
- Se a medicao esta correta.
- Se deve pedir correcao ou aprovar.

Erros possiveis:

- Aprovar sem ver evidencia relevante.
- Rejeitar com motivo vago.
- Perder item pendente por falta de fila clara.
- Misturar papel de fiscal com gerente interno.

Pontos de espera:

- Correcoes do responsavel.
- Carregamento de anexos.
- Dados agregados de producao.

Notificacoes necessarias:

- Novo item aguardando aprovacao.
- Item corrigido apos rejeicao.
- Prazo de aprovacao vencendo.
- Medicao pronta para decisao.

Acoes mobile essenciais:

- Ver fila.
- Abrir detalhe.
- Aprovar.
- Rejeitar com motivo.

Metricas de sucesso:

- Tempo medio de decisao.
- Percentual de rejeicoes com motivo claro.
- Reaberturas por decisao incompleta.
- Itens pendentes por aprovador.

### 7. Administrador da Empresa

Objetivo principal: configurar base operacional para que a obra rode sem bloqueios.

Informacoes necessarias:

- Usuarios e perfis.
- Projetos ativos.
- Equipes, pessoas e maquinas.
- Valores de custo.
- Estrutura EAP inicial.

Tarefas frequentes:

- Criar ou editar projeto.
- Cadastrar equipes, pessoas e maquinas.
- Configurar valores de custo.
- Importar EAP.
- Gerenciar acesso de usuarios.

Decisoes tomadas:

- Quem pode acessar quais projetos.
- Que cadastros sao obrigatorios antes do RDO.
- Quando importar nova versao da EAP.
- Se uma configuracao deve ser alterada em obra ativa.

Erros possiveis:

- Cadastrar pessoa/maquina duplicada.
- Deixar valor de custo ausente.
- Alterar EAP com medicoes em andamento.
- Dar permissao excessiva.

Pontos de espera:

- Provisionamento de usuarios.
- Validacao de planilha importada.
- Confirmacao de alteracoes sensiveis.

Notificacoes necessarias:

- Importacao EAP com erros.
- Configuracao incompleta bloqueando RDO/medicao.
- Usuario sem acesso necessario.
- Alteracao sensivel concluida.

Acoes mobile essenciais:

- Consultar projeto e configuracao basica.
- Aprovar ajuste simples quando urgente.
- Ver erro de importacao ou bloqueio.

Metricas de sucesso:

- Tempo para preparar projeto novo.
- Quantidade de cadastros incompletos.
- Erros de importacao EAP.
- Chamados de suporte por permissao/configuracao.

## Jornadas Chave

### Jornada 1: Entrada na empresa e selecao do projeto

Inicio: usuario faz login ou abre o app autenticado.
Fim: usuario esta em um projeto com contexto correto.

Etapas:

1. Login Google.
2. Dashboard da empresa.
3. Busca ou lista de projetos.
4. Abertura de projeto.
5. Sidebar passa a mostrar contexto do projeto.

Pontos criticos:

- Nome do projeto nao pode ficar truncado sem alternativa.
- Busca global deve navegar para o modulo correto.
- Usuario precisa entender empresa, projeto e perfil atual.

Oportunidades:

- Melhorar project switcher.
- Mostrar projeto recente.
- Diferenciar "visao empresa" de "contexto projeto".

### Jornada 2: Criacao ou importacao da EAP

Inicio: projeto sem ou com EAP incompleta.
Fim: EAP valida com disciplinas, servicos, pesos e unidades.

Etapas:

1. Abrir Planejamento > EAP.
2. Importar planilha ou criar disciplina.
3. Validar linhas e erros.
4. Revisar hierarquia.
5. Ajustar pesos e quantidades.

Pontos criticos:

- EAP hoje esta dentro de Configuracoes.
- Erro de importacao precisa mostrar linha, campo e acao.
- Soma de pesos precisa orientar correcao, nao apenas alertar.

Oportunidades:

- Wizard de importacao.
- Previa antes de aplicar.
- Validacao de pesos por nivel.

### Jornada 3: Planejamento do cronograma

Inicio: EAP existe com atividades mediveis.
Fim: cronograma planejado com datas, baseline e responsaveis.

Etapas:

1. Abrir aba Cronograma.
2. Definir datas planejadas.
3. Visualizar Gantt.
4. Ajustar dependencias e responsaveis.
5. Conferir caminho critico e baseline.

Pontos criticos:

- Gantt atual nao possui zoom, filtros, dependencias nem baseline.
- Datas ficam misturadas em linhas de servico, sem edicao orientada.
- Mobile precisa de visual alternativo.

Oportunidades:

- Toolbar com Hoje, zoom e filtros.
- Tooltip com datas, responsavel, desvio e status.
- Comparacao planejado vs realizado.

### Jornada 4: Criacao do registro diario

Inicio: responsavel cria RDO do dia ou abre data no calendario.
Fim: RDO enviado com producao, presencas, maquinas, ocorrencias e fotos.

Etapas:

1. Selecionar data/turno.
2. Selecionar equipe e fiscal.
3. Registrar presencas.
4. Registrar maquinas e paradas.
5. Registrar producao por EAP.
6. Registrar ocorrencias.
7. Anexar fotos.
8. Revisar e enviar.

Pontos criticos:

- Tarefa de maior frequencia precisa ser a mais rapida.
- Reaproveitamento do RDO anterior deve reduzir digitacao.
- Validacoes precisam acontecer antes do envio.

Oportunidades:

- Salvar rascunho/offline.
- Duplicar RDO anterior.
- Campos com faixa plausivel e calculos assistidos.

### Jornada 5: Atualizacao do avanco fisico

Inicio: RDOs aprovados ou ajustes manuais existem.
Fim: avanco realizado fica atualizado na EAP e nos indicadores.

Etapas:

1. RDO aprovado gera producao vinculada.
2. EAP calcula quantidade executada.
3. Usuario revisa servico/disciplina.
4. Ajuste manual e registrado quando necessario.
5. Indicadores sao atualizados.

Pontos criticos:

- Ajuste manual precisa ficar auditavel.
- Avanco real e previsto nao podem parecer a mesma coisa.
- Quantidade executada deve explicar origem: RDO + ajuste.

Oportunidades:

- Linha de detalhe por servico.
- Historico de lancamentos.
- Separar edicao de estrutura de leitura de progresso.

### Jornada 6: Deteccao de atraso

Inicio: sistema calcula desvio ou usuario abre cronograma.
Fim: responsavel identifica causa e proxima acao.

Etapas:

1. Sistema compara planejado, baseline e realizado.
2. Atividade em risco/critica aparece em alerta.
3. Usuario filtra por status/responsavel/frente.
4. Abre detalhe da atividade.
5. Decide acao: cobrar, ajustar, abrir RNC ou replanejar.

Pontos criticos:

- Hoje nao ha caminho critico, filtros nem lista de excecoes.
- Verde pode mascarar risco se representar apenas progresso parcial.
- Alertas devem indicar severidade e impacto.

Oportunidades:

- Painel de excecoes na EAP.
- Status semantico consistente.
- Acao contextual por atraso.

### Jornada 7: Geracao de medicao

Inicio: producao aprovada e precos configurados.
Fim: medicao criada e enviada para decisao.

Etapas:

1. Abrir Medicoes.
2. Criar nova medicao.
3. Definir data de corte e fiscal.
4. Sistema calcula itens e valores.
5. Usuario revisa pendencias.
6. Medicao fica aguardando aprovacao.

Pontos criticos:

- Nova medicao bloqueia se ja ha pendente.
- Servicos sem preco devem ser destacados antes do envio.
- Periodo medido precisa ser evidente.

Oportunidades:

- Previa antes de criar.
- Checklist de bloqueios.
- Relacao clara com EAP/RDO.

### Jornada 8: Aprovacao

Inicio: RDO ou medicao aguarda decisao.
Fim: item aprovado ou rejeitado com motivo.

Etapas:

1. Aprovador abre fila.
2. Revisa dados e evidencias.
3. Aprova ou inicia rejeicao.
4. Informa motivo quando rejeita.
5. Sistema notifica responsavel.

Pontos criticos:

- Motivo de rejeicao deve ser especifico e visivel.
- Aprovador precisa ver impacto e evidencias sem navegar demais.
- Decisao deve ser auditavel.

Oportunidades:

- Fila unificada de aprovacoes.
- Templates de motivo.
- Historico de decisoes.

### Jornada 9: Registro e resolucao de RNC

Inicio: usuario identifica nao conformidade.
Fim: RNC concluida com eficacia registrada.

Etapas:

1. Criar RNC.
2. Informar categoria, origem, gravidade e requisito.
3. Definir prazo, responsavel e acoes corretivas.
4. Acompanhar status.
5. Concluir e avaliar eficacia.

Pontos criticos:

- Prazo excedido e reincidencia devem ser muito visiveis.
- Formulario longo precisa de agrupamento e salvamento seguro.
- Resolucao deve preservar historico.

Oportunidades:

- Filtros por gravidade, prazo e responsavel.
- Cards/lista com prioridade real.
- Alertas para prazo vencendo.

### Jornada 10: Acompanhamento de custos

Inicio: gerente abre custos do mes.
Fim: entende custo produtivo, ocioso, deficit e causas.

Etapas:

1. Selecionar mes.
2. Ver KPIs de custo.
3. Comparar mao de obra e maquinas.
4. Identificar causas de ociosidade.
5. Ver pessoas/equipamentos reincidentes.
6. Decidir acao gerencial.

Pontos criticos:

- Custo e ociosidade dependem de RDO consistente.
- Dados sem valor cadastrado precisam bloquear conclusoes falsas.
- Tabelas precisam permitir comparacao e ordenacao.

Oportunidades:

- Drill-down por equipe/frente.
- Alertas de ociosidade evitavel.
- Padrao de tabela operacional.

## Prioridades de Design por Perfil

| Perfil | Prioridade 1 | Prioridade 2 | Prioridade 3 |
|---|---|---|---|
| Gerente da construtora | Comparar projetos | Ver excecoes | Decidir intervencao |
| Gerente de obra | Controlar desvio | Revisar RDO | Replanejar frente |
| Engenheiro de campo | Preencher rapido | Evitar erro | Anexar evidencia |
| Responsavel pelo RDO | Garantir completude | Corrigir rejeicao | Monitorar calendario |
| Responsavel por medicoes | Gerar medicao correta | Resolver bloqueios | Acompanhar aprovacao |
| Aprovador | Decidir com evidencia | Registrar motivo | Reduzir pendencia |
| Administrador | Preparar cadastros | Gerir acessos | Evitar bloqueios |

## Implicacoes para a Tela-Piloto EAP

- A EAP precisa ser promovida para jornada de Planejamento.
- A tela deve separar leitura operacional de edicao estrutural.
- Cronograma, estrutura, pesos e dependencias devem ser subviews da EAP.
- Pesos devem ter modo explicito de edicao e validacao por soma.
- O Gantt deve priorizar atraso, risco e caminho critico, nao apenas barras.
- Mobile deve oferecer leitura resumida e acoes essenciais, nao tentar replicar o desktop inteiro.
