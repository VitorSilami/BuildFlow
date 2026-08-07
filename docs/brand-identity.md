# BuildFlow Brand Identity

Data: 2026-08-07
Escopo: identidade visual proposta para produto B2B premium de operacao de obras.

## 3. Nova identidade visual proposta

### Direcao recomendada: Command Infrastructure

**Command Infrastructure** e uma direcao visual industrial, precisa e calma. Ela combina superficie clara, contraste tecnico, detalhes de engenharia e hierarquia de dados. O produto deve parecer uma central de controle operacional, nao uma landing page.

Principios visuais:

- Superficies claras e robustas, com baixa saturacao.
- Azul profundo como cor de autoridade e foco.
- Ciano tecnico como sinal de inteligencia operacional.
- Verde, amarelo, vermelho e roxo apenas para semantica.
- Linhas, grids e divisores funcionais, nao decorativos.
- Cards compactos, tabelas densas e graficos objetivos.
- Tipografia precisa, sem drama visual.

### Paleta principal

| Token | Papel | Hex sugerido | Uso |
|---|---|---:|---|
| `brand-navy` | Autoridade e navegacao | `#0B1F3A` | Sidebar, texto forte, header institucional |
| `brand-blue` | Acao primaria | `#124C8F` | Botoes primarios, foco, links importantes |
| `brand-cyan` | Inteligencia operacional | `#19A7CE` | Indicadores, highlights, dados em progresso |
| `brand-steel` | Base tecnica | `#5D6B7A` | Icones, labels, linhas de apoio |
| `brand-slate` | Texto e estrutura | `#1D2733` | Titulos e informacao principal |

Racional: a paleta evita azul generico brilhante e cria uma linguagem de engenharia mais madura. O ciano entra como sinal de sistema vivo, sem dominar a interface.

### Paleta secundaria

| Token | Hex sugerido | Uso |
|---|---:|---|
| `road-graphite` | `#2B3036` | Superficies escuras pontuais, mapas, eixos |
| `concrete` | `#EEF2F5` | Fundo de areas operacionais |
| `survey-yellow` | `#D99A2B` | Atencao moderada, pendencia, alerta nao critico |
| `field-green` | `#12805C` | Concluido, aprovado, dentro do prazo |
| `signal-red` | `#C93636` | Rejeicao, atraso critico, erro |
| `control-purple` | `#6F5AA7` | Bloqueio, dependencia, permissao ou restricao |

### Cores semanticas

| Semantica | Cor | Uso |
|---|---|---|
| Sucesso | `field-green` | Aprovado, concluido, no prazo |
| Atencao | `survey-yellow` | Aguardando, risco, pendencia |
| Perigo | `signal-red` | Rejeitado, atraso, falha |
| Informacao | `brand-cyan` | Dado contextual, progresso, leitura auxiliar |
| Bloqueio | `control-purple` | Dependencia, restricao, impedimento |
| Planejado | azul medio | Cronograma planejado |
| Realizado | verde | Execucao real |
| Baseline | cinza tecnico | Linha base |
| Critico | vermelho profundo | Caminho critico, perda relevante |

Regra: todo status deve combinar cor, texto e iconografia. Cor nunca deve ser o unico canal.

### Neutral palette

| Token | Hex sugerido | Uso |
|---|---:|---|
| `neutral-0` | `#FFFFFF` | Cards e popovers |
| `neutral-25` | `#FAFBFC` | Fundo principal claro |
| `neutral-50` | `#F3F6F8` | Superficies secundarias |
| `neutral-100` | `#E6EBF0` | Divisores suaves |
| `neutral-200` | `#CCD5DE` | Bordas padrao |
| `neutral-400` | `#7A8794` | Texto secundario |
| `neutral-700` | `#34404D` | Texto forte auxiliar |
| `neutral-900` | `#111827` | Texto principal |

### Tipografia

Fonte principal: **Inter**.
Fonte de destaque: **Space Grotesk**.
Fonte tecnica: **JetBrains Mono**.

| Papel | Fonte | Peso | Uso |
|---|---|---|---|
| UI / corpo | Inter | 400-600 | Labels, paragrafos, tabelas |
| Titulos de pagina | Space Grotesk | 600-700 | PageHeader, KPIs principais |
| Numeros e codigos | JetBrains Mono | 500-700 | Valores, datas, percentuais, IDs |
| Microcopy | Inter | 500 | Estados, hints, helper text |

Regras:

- Sem letter spacing negativo.
- Uppercase com parcimonia, apenas para labels curtos.
- Numeros importantes devem usar fonte mono ou tabular.
- Titulos dentro de cards devem ser compactos, nao heroicos.

### Linguagem de icones

Usar **Lucide Icons** como biblioteca principal. Estilo: outline, 16-20px, stroke consistente.

Regras:

- Icones sao funcionais, nao decorativos.
- Botoes iconicos precisam de tooltip e `aria-label`.
- Estados criticos podem usar icone + texto + cor.
- Evitar icones diferentes para o mesmo conceito em modulos distintos.

### Ilustracoes e imagens

Produto operacional nao deve depender de ilustracoes. Quando usadas:

- Devem representar engenharia, campo, infraestrutura, mapas, linhas de controle ou equipamentos reais.
- Evitar personagens, mascotes, blobs, gradients abstratos e desenhos genericos.
- Empty states podem usar pictogramas lineares simples, nao ilustracoes grandes.

### Graficos

Graficos devem responder perguntas operacionais:

- O que esta atrasado?
- O que mudou?
- Onde ha perda?
- O que precisa de aprovacao?
- Qual frente concentra risco?

Padroes:

- Usar legenda sempre que houver mais de uma serie.
- Eixos e labels legiveis; nao esconder escala.
- Cores semanticas consistentes com tokens.
- Donut apenas para distribuicoes simples; evitar graficos decorativos grandes.
- Gantt e cronograma precisam de hoje, baseline, planejado, realizado e caminho critico.

### Estados

| Estado | Visual |
|---|---|
| Hover | Alteracao sutil de superficie e borda |
| Focus | Ring visivel de 2px com cor de foco |
| Active | Fundo semantico leve + marcador |
| Disabled | Opacidade e cursor, mantendo legibilidade |
| Loading | Skeleton estrutural, sem layout shift |
| Empty | Texto objetivo + acao contextual quando existir |
| Error | Mensagem clara + causa provavel + proxima acao |
| Success | Confirmacao discreta, sem excesso visual |

### Radius, sombras, bordas e superficies

- Radius padrao: 8px.
- Componentes compactos: 6px.
- Tabelas e toolbars: 8px.
- Dialogs: 8px ou 10px no maximo.
- Sombras devem ser raras e funcionais: popover, sidebar elevada, dialog.
- Bordas sao o principal mecanismo de estrutura.
- Superficies devem comunicar hierarquia: background, surface, card, elevated.

### Composicao

- Priorizar informacao critica no topo.
- Evitar cards dentro de cards.
- Usar bandas e secoes full-width quando a tela for operacional.
- Em paginas densas, preferir tabela ou lista estruturada a grid de cards.
- Manter acoes primarias no canto superior direito ou barra contextual.
- Filtros devem ficar perto dos dados que afetam.

### Densidade visual

Desktop: denso e escaneavel.
Tablet: denso com agrupamento mais claro.
Mobile: orientado a tarefa, nao paridade total.

Regra pratica: se a tela e usada todos os dias, ela deve ser mais compacta e previsivel; se e usada raramente, pode explicar mais.

### Cards

Cards devem ser usados para:

- KPIs
- Itens repetidos em listas curtas
- Estados resumidos
- Dialogs e blocos de detalhe

Cards nao devem substituir tabelas quando o usuario precisa comparar muitos dados.

### Tabelas

- Cabecalho sticky em telas longas.
- Densidade ajustada para operacao.
- Colunas numericas alinhadas a direita.
- Status perto da entidade principal.
- Acoes por linha alinhadas a direita.
- Empty e loading padronizados.
- Filtros e ordenacao devem ser previsiveis.

### Inputs, filtros e barras de acao

- Inputs com altura padrao de 36-40px.
- Labels sempre visiveis em formularios criticos.
- Placeholder nao substitui label.
- Filtros em barra compacta com limpar filtros.
- Acoes destrutivas devem pedir confirmacao.

### Sidebar e header

Sidebar:

- Deve ser compacta e orientada por modulo.
- Nao deve repetir contexto que ja aparece no header/breadcrumb.
- Estado ativo precisa ser claro.
- Agrupamentos devem ser colapsaveis quando houver muitas secoes.

Header:

- Deve mostrar contexto da empresa, usuario, busca e acoes globais.
- Em tela de projeto, breadcrumb deve carregar o contexto do projeto.

### Dashboard

Dashboard deve parecer sala de controle:

- Excecoes primeiro.
- KPIs com tendencia e impacto.
- Projetos priorizados por risco.
- Graficos pequenos e acionaveis.
- Nada de visual decorativo sem proxima decisao.

### Paginas operacionais

Padrao recomendado:

1. Header com contexto e acoes.
2. Resumo de excecoes/KPIs.
3. Filtros.
4. Lista/tabela principal.
5. Detalhe lateral, modal ou drawer quando necessario.

## Do's

- Usar grids, linhas e bordas como linguagem tecnica.
- Usar cores com semantica fixa.
- Fazer dados criticos saltarem pela combinacao de posicao, texto, cor e icone.
- Manter densidade consistente entre modulos.

## Don'ts

- Nao usar gradientes roxos/azuis como tema dominante.
- Nao usar bokeh, blobs ou ornamentos abstratos.
- Nao usar cards gigantes para dados simples.
- Nao misturar estilos de status por modulo.
- Nao depender de hover para acoes essenciais em mobile.

## Checklist de consistencia visual

- [ ] A tela usa os tokens de marca, nao cores locais aleatorias?
- [ ] O estado ativo e evidente sem depender apenas de cor?
- [ ] KPIs, cards e tabelas seguem a mesma densidade?
- [ ] Graficos respondem uma pergunta operacional?
- [ ] A composicao evita card dentro de card?
- [ ] O mobile preserva a tarefa principal?
- [ ] A interface parece B2B premium, nao template generico?
