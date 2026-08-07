# BuildFlow Design System Foundation

Data: 2026-08-07
Escopo: fundacao implementavel da nova identidade visual e UX do BuildFlow.

## 5. Design system e fundacao tecnica

### Avaliacao da base atual

A base atual esta adequada e deve ser mantida. O projeto ja usa React, Vite, TypeScript, Tailwind CSS 4, Radix UI, Lucide Icons, Recharts, TanStack Query, Zod em pontos especificos e Playwright. Isso e suficiente para construir um design system premium sem trocar bibliotecas agora.

Recomendacoes:

- Manter Tailwind CSS 4 como camada de tokens e utilitarios.
- Manter Radix UI para primitives acessiveis.
- Manter Lucide Icons como linguagem iconografica.
- Manter Recharts no curto prazo, mas criar regras visuais para graficos.
- Adotar TanStack Table quando tabelas precisarem de sorting, filtros, pinning e virtualizacao.
- Adotar Storybook para documentar estados e reduzir regressao visual.
- Avaliar React Hook Form em formularios complexos, especialmente RDO, RNC e configuracoes.

### Design tokens

#### Brand tokens

| Token | Valor sugerido | Uso |
|---|---:|---|
| `--brand-navy` | `#0B1F3A` | Navegacao, autoridade, texto institucional |
| `--brand-blue` | `#124C8F` | Acao primaria, foco, links |
| `--brand-cyan` | `#19A7CE` | Inteligencia operacional, progresso |
| `--brand-steel` | `#5D6B7A` | Icones e labels secundarios |
| `--road-graphite` | `#2B3036` | Superficie tecnica escura pontual |

#### Semantic tokens

| Token | Uso |
|---|---|
| `--success` | Aprovado, concluido, no prazo |
| `--warning` | Pendente, atencao, risco moderado |
| `--danger` | Rejeitado, atraso, falha |
| `--info` | Informacao contextual |
| `--blocked` | Bloqueio, dependencia, restricao |
| `--planned` | Planejado no cronograma |
| `--actual` | Executado/realizado |
| `--baseline` | Linha base |
| `--critical` | Caminho critico, impacto alto |

#### Neutral tokens

| Token | Uso |
|---|---|
| `--background` | Fundo geral |
| `--surface` | Areas de pagina |
| `--surface-strong` | Areas destacadas |
| `--card` | Cards, tabelas e paineis |
| `--popover` | Menus, dropdowns e overlays |
| `--border` | Divisores e contornos |
| `--muted` | Fundos neutros |
| `--muted-foreground` | Texto secundario |
| `--ink` | Texto principal forte |

### Typography tokens

| Token | Fonte | Uso |
|---|---|---|
| `--font-sans` | Inter | UI principal |
| `--font-display` | Space Grotesk | Titulos e KPIs |
| `--font-mono` | JetBrains Mono | Numeros, datas, codigos |

Escala recomendada:

| Papel | Tamanho | Line-height | Peso |
|---|---:|---:|---:|
| Page title | 24-28px | 1.15 | 700 |
| Section title | 18-20px | 1.25 | 650 |
| Card title | 14-16px | 1.35 | 650 |
| Body | 14px | 1.5 | 400 |
| Table | 13-14px | 1.4 | 400-600 |
| Label | 12px | 1.3 | 600 |
| Meta | 11-12px | 1.3 | 500 |

### Spacing scale

Usar escala de 4px:

| Token | Valor | Uso |
|---|---:|---|
| `space-1` | 4px | Gaps pequenos |
| `space-2` | 8px | Padding compacto |
| `space-3` | 12px | Campos e listas |
| `space-4` | 16px | Cards e secoes |
| `space-5` | 20px | Blocos maiores |
| `space-6` | 24px | Separacao de secoes |
| `space-8` | 32px | Page rhythm |

### Radius scale

| Token | Valor | Uso |
|---|---:|---|
| `radius-sm` | 4px | Badges, cells |
| `radius-md` | 6px | Inputs, buttons |
| `radius-lg` | 8px | Cards, tables, toolbars |
| `radius-xl` | 10px | Dialogs pontuais |

Evitar radius acima de 10px em produto operacional.

### Elevation scale

| Token | Uso |
|---|---|
| `shadow-none` | Superficies comuns |
| `shadow-sm` | Cards interativos |
| `shadow-md` | Popovers, menus |
| `shadow-lg` | Dialogs e drawers |

Bordas devem fazer mais trabalho que sombras.

### Border rules

- Borda padrao em cards/tabelas: 1px `border`.
- Borda ativa: `primary` com fundo semantico leve.
- Borda de erro: `danger`.
- Divisores internos devem ser sutis.
- Evitar bordas pontilhadas fora de dropzones ou empty states.

### States

| Estado | Regra |
|---|---|
| Hover | `surface` + borda levemente mais forte |
| Focus | ring 2px visivel |
| Selected | fundo semantico leve + marcador textual/icone |
| Disabled | opacidade + texto ainda legivel |
| Loading | skeleton sem deslocamento |
| Error | texto claro + acao de retry quando aplicavel |

### Icon sizing

| Contexto | Tamanho |
|---|---:|
| Nav item | 18px |
| Button icon | 16px |
| IconButton | 16-18px |
| Empty/Error state | 24-32px |
| KPI icon | 18-20px |

### Grid e containers

- Desktop operacional: max-width flexivel, usar largura total quando ha tabela/Gantt.
- Conteudo comum: `max-w-screen-2xl`.
- Tabelas: ocupar largura disponivel.
- Cards: grid responsivo, minmax para evitar quebra.
- Side panels/drawers: 360-480px.

### Breakpoints

| Breakpoint | Tratamento |
|---|---|
| Mobile | tarefa principal, stacks, acoes fixas quando necessario |
| Tablet | duas colunas quando possivel |
| Desktop | densidade completa, sidebar persistente |
| Wide | evitar linhas longas; usar paineis laterais e tabelas |

### Motion principles

- Duracao: 120-200ms.
- Movimento deve confirmar relacao espacial: expandir, abrir drawer, selecionar.
- Evitar animacoes decorativas.
- Hover pode elevar 1px apenas em cards selecionaveis.

## Component principles

### Button

- Primario para acao principal da tela.
- Secondary/outline para acoes auxiliares.
- Destructive apenas para acoes destrutivas.
- Texto deve ser verbo + objeto: "Criar RDO", "Aprovar medicao".

### IconButton

- Usar para acoes familiares: editar, baixar, filtrar, fechar, expandir.
- `aria-label` obrigatorio.
- Tooltip obrigatorio em desktop.

### Input, Select, DatePicker, Textarea

- Label sempre visivel em formulario critico.
- Helper text para regra operacional.
- Erro abaixo do campo com mensagem objetiva.
- DatePicker pode iniciar com input nativo; criar wrapper `DateField`.

### Card / StatCard

- Card e uma unidade de informacao, nao um container decorativo universal.
- StatCard precisa mostrar valor, label, tendencia/contexto e estado quando aplicavel.
- Evitar card dentro de card.

### Table

- Usar quando ha comparacao, volume ou dados financeiros.
- Alinhamento numerico a direita.
- Status perto da entidade principal.
- Acoes no fim da linha.
- Adotar TanStack Table quando houver sorting/filter/pinning.

### Badge

- Badge operacional deve ter contrato unico de tones.
- Texto curto e especifico.
- Icone opcional para estados criticos.

### Tabs

- Usar para subviews no mesmo contexto.
- Nao usar tabs para navegacao principal entre modulos.
- Estado ativo precisa ser claro.

### Breadcrumb

- Deve comunicar contexto: Empresa > Projeto > Modulo > Item.
- Projeto deve ser linkavel.
- Evitar breadcrumbs longos no mobile; truncar com criterio.

### Sidebar

- Agrupar por trabalho real.
- Nao repetir contexto de projeto se breadcrumb/header ja resolvem.
- Colapsavel por grupo quando necessario.
- Estado ativo forte e legivel.

### Topbar

- Busca global de projeto.
- Usuario/empresa.
- Tema e saida.
- Futuro: notificacoes e alertas globais.

### EmptyState / ErrorState / Skeleton

- EmptyState deve explicar o que falta e oferecer acao.
- ErrorState deve separar rede, permissao, API e dado indisponivel.
- Skeleton deve preservar dimensoes reais.

### Dialog / Drawer

- Dialog para confirmacao ou criacao curta.
- Drawer para detalhe contextual sem sair da lista.
- Formularios longos devem ser pagina dedicada.

### Toast

- Confirmacoes curtas.
- Nao usar toast como unica prova de erro em acao critica.

### FilterBar

- Filtros compactos perto da lista.
- Deve ter "limpar filtros".
- Filtros salvos podem vir depois.

### KPI blocks

- Devem ser acionaveis quando possivel.
- Mostrar unidade, periodo e comparacao.
- Evitar KPIs sem implicacao operacional.

### Chart cards

- Titulo deve ser pergunta ou assunto claro.
- Legenda e periodo visiveis.
- Cores sempre semanticas.

### Timeline / Gantt wrappers

- Linha de hoje.
- Baseline.
- Planejado vs realizado.
- Zoom e legenda.
- Alternativa tabular acessivel.

### Step forms

- Um stepper unico.
- Progresso visivel.
- Validacao por etapa.
- Revisao final com pendencias.

### Approval components

- Decisao explicita.
- Evidencias proximas da acao.
- Campo de motivo quando rejeitar.
- Historico visivel.

## Checklist tecnico

- [ ] Token semantico existe antes de criar cor local?
- [ ] Componente tem estado loading, empty, error e disabled?
- [ ] Acessibilidade por teclado foi validada?
- [ ] Texto nao depende de placeholder?
- [ ] Teste Playwright cobre fluxo critico?
- [ ] Componentes novos entram no Storybook?
- [ ] O componente resolve um padrao recorrente, nao um caso isolado?
