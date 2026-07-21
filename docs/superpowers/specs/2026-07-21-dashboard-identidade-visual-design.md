# Dashboard — Piloto de Identidade Visual (Design)

## Contexto

Auditoria de "perfumaria" pré-produção (lente `frontend-design`) identificou que a identidade
visual forte já presente na `LoginPage`/`Sidebar` — textura de blueprint, marcadores mono-caps
estilo dado técnico, cor de destaque `signal` usada como indicador "ao vivo" — não continua nas
telas de trabalho diário (Dashboard, Calendário, Configurações). O Dashboard é o primeiro contato
do usuário logado com o produto, então vira o piloto: valida a direção antes de estender às outras
4 telas.

Escopo confirmado com o usuário: só o Dashboard por agora; leva os 4 elementos de assinatura
disponíveis (mono-caps, marcadores tipo dado técnico, textura de blueprint, acento `signal`).

## Princípio-guia

Gastar a "ousadia" num lugar só (frontend-design: "spend your boldness in one place") — as tiles de
resumo, primeira coisa lida na tela, recebem o tratamento mais forte. Os outros 3 elementos
(eyebrows, blueprint, acento) ficam discretos, de apoio — nada nas listas de Alertas/Projetos
ativos, que já carregam ícone + cor + progress bar da rodada anterior de trabalho.

## Mudanças

### 1. Tiles de resumo (elemento principal)

Hoje: `Card` com ícone + `<p className="text-3xl font-bold">{numero}</p>`.

Novo: reaproveita o padrão exato das "facts" do `HeroMock` da `LoginPage`
(`rounded-md border border-dashed border-border p-2` + label mono-caps em cima, valor embaixo) —
mesma estrutura visual que o usuário já viu na tela de login, agora nas 4 tiles
(Projetos ativos / Pausados / Concluídos / Execução média). Ícone mantém, reposicionado ao lado do
valor.

### 2. Eyebrows mono-caps nos cards de gráfico

Acima do título de cada `Card` de gráfico ("RDOs por dia", "Distribuição de status"), um label
mono-caps pequeno (`font-mono text-[11px] uppercase tracking-widest text-signal`), mesmo padrão dos
eyebrows das seções da `LoginPage` ("Recursos", "Fluxo operacional"):
- Acima de "RDOs por dia": "Últimos 7 dias"
- Acima de "Distribuição de status": "Projetos"

### 3. Blueprint sutil

Textura de fundo (`grid-blueprint`, utility CSS já existente, zero custo de implementação) atrás do
cabeçalho da página (`PageHeader`), opacidade baixa (10–15%, bem mais discreta que os 70%/20% usados
na hero/footer do login, já que o Dashboard é uma tela de trabalho densa, não uma hero page).

### 4. Acento `signal`

Um ponto (`size-1.5 rounded-full bg-signal`) ao lado do eyebrow "Últimos 7 dias", mesmo padrão do
indicador "ao vivo" usado no badge "KM 0+000 · MVP em produção" da `LoginPage` — sinaliza que o dado
do gráfico é corrente/atualizado.

## Fora de escopo

- Alertas de RDO e lista de Projetos ativos — mantêm exatamente como estão (ícone + cor + progress
  bar já implementados na rodada de gráficos/cores).
- Calendário, Configurações, Projetos, Wizard de RDO — ficam para uma iniciativa futura, só depois
  de validar a direção aqui.
- Nenhuma mudança de dado, hook, ou lógica de negócio — puramente apresentação.

## Testes

Convenção já estabelecida: E2E (Playwright) é a única camada de teste. `dashboard.spec.ts` precisa
apenas de ajustes pontuais se algum seletor de texto mudar (ex: se o texto de algum tile mudar de
posição no DOM) — os testes já existentes continuam validando os mesmos dados, só a apresentação
muda.
