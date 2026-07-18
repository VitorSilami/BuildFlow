# BuildFlow — Product Blueprint

**Escopo desta parte**: Etapas 1-3 do processo (Descoberta do Produto, Arquitetura de Informação,
UX Strategy). Etapas 4-10 (Fluxos, Design System, Biblioteca de Componentes, Arquitetura Frontend,
Wireframes, Protótipo, Plano de implementação) são trabalho subsequente — ver nota no final.

**Decisões de escopo já tomadas com o Vitor antes de escrever isto**:
- O modelo de papéis abaixo é uma **síntese própria**, não os 7 papéis do brief literal (que foram
  dados como exemplo). RBAC continua com os 2 perfis atuais (Gerente/Auxiliar administrativo) por
  enquanto — o que segue é visão de produto documentada, não uma mudança de escopo de backend agora.
- O Design System (Etapa 5, ainda não escrita) vai **substituir o Mazer/Bootstrap** inteiramente,
  não evoluí-lo — a estética "admin template" que implementamos na sessão anterior é incompatível
  com o objetivo declarado ("nível Linear/Stripe/Vercel"). Isso é retrabalho reconhecido e aceito.

---

## Etapa 1 — Descoberta do Produto

### Por que os 7 papéis do brief não viram 7 personas

Papéis organizacionais (como aparecem num organograma de obra) e personas de produto (como
aparecem num fluxo de uso) não são a mesma coisa. Encarregado, Supervisor e parte do que se chama
"Engenheiro de Produção" fazem, do ponto de vista do software, **exatamente a mesma coisa**: abrem
o RDO de hoje e preenchem. A diferença entre eles é hierárquica (quem manda em quem), não
funcional (o que cada um faz no sistema). Modelar personas por cargo em vez de por *job to be done*
é o erro clássico que infla a superfície de UI sem ganho real — cada "papel" viraria uma tela
raramente diferente da anterior, aumentando custo de manutenção sem aumentar valor.

Por isso, a síntese abaixo agrupa os 7 papéis citados em **4 clusters de trabalho reais**, mais um
ator que já existe fora do produto (Administrador via Django Admin). Se no futuro surgir uma
diferença *funcional* de verdade entre, digamos, Encarregado e Supervisor (ex.: só o Supervisor
pode editar um RDO já enviado), isso vira uma permissão dentro do cluster "Produção de Campo" — não
uma persona nova.

### Cluster A — Produção de Campo (Encarregado, Supervisor, parte do Eng. de Produção)

- **Job to be done**: "Quando termino um turno de trabalho na obra, preciso registrar o que
  aconteceu hoje rápido o suficiente para não atrasar meu próximo compromisso, e de um jeito que
  não me exponha a errar um número que vai virar auditoria depois."
- **Tarefas diárias**: preencher RDO (produção, presença, máquinas, ocorrências, fotos);
  consultar o RDO de ontem para saber "de onde parei" (km final vira km inicial de amanhã, quase
  sempre); tirar fotos no ato.
- **Frequência**: 1x por turno, todo santo dia — é a tarefa de maior frequência de todo o produto.
- **Contexto de uso**: em pé, no canteiro, sob sol, muitas vezes com uma mão ocupada (capacete,
  prancheta, EPI), conexão de dados instável, tablet ou celular, tela suja de poeira, luz forte
  (glare) prejudicando contraste.
- **Dores hoje**: RDO em papel se perde/rasga/molha; RDO em planilha exige digitar tudo de novo
  todo dia (nome de gente, código de máquina, disciplina) porque nada é lembrado do dia anterior;
  erro de conversão de unidade em campo numérico não é pego até a auditoria.
- **Prioridade**: velocidade de entrada > qualquer outra coisa. Cada segundo a mais no formulário é
  multiplicado por centenas de RDOs por mês por empresa.

### Cluster B — Gestão Técnica do Projeto (Eng. Residente, parte do Eng. de Produção, Coordenador
quando olha 1 projeto)

- **Job to be done**: "Preciso saber, sem precisar ler RDO por RDO, se a obra está no ritmo certo,
  e quando não está, entender rápido o porquê antes que vire atraso caro."
- **Tarefas diárias/semanais**: revisar RDOs enviados (aprovar/pedir correção); comparar avanço
  físico real vs. meta (curva S); identificar equipamento ocioso ou parado demais; preparar
  justificativa técnica quando o cronograma desvia.
- **Frequência**: diária (revisão) + semanal (análise agregada).
- **Contexto de uso**: escritório de obra, notebook, mas também tablet em reunião de canteiro.
- **Dores hoje**: essa visão simplesmente não existe no MVP atual — hoje só dá para abrir RDO por
  RDO, um de cada vez, sem agregação nenhuma. Todo "dashboard" hoje é mental (o engenheiro soma na
  cabeça ou numa planilha à parte).
- **Prioridade**: sinal sobre ruído — quer ver exceções (o que está fora da curva), não uma lista de
  tudo que está normal.

### Cluster C — Gestão de Programa / Múltiplos Projetos (Coordenador, parte do Gerente/Admin de
empresa)

- **Job to be done**: "Preciso decidir onde alocar atenção e recurso entre vários projetos da
  empresa sem visitar cada um."
- **Tarefas**: comparar indicadores entre projetos (custo, produtividade, ociosidade); identificar
  qual projeto precisa de intervenção.
- **Frequência**: semanal/mensal — menor frequência que os clusters A e B, mas decisões de maior
  impacto financeiro.
- **Contexto de uso**: notebook, quase nunca campo.
- **Prioridade**: comparabilidade entre projetos (mesma unidade de medida, mesmo período), não
  profundidade dentro de um projeto só.

### Cluster D — Validação/Compliance (Fiscal, frequentemente externo à empresa — ex. órgão
contratante)

- **Job to be done**: "Preciso confirmar que o que foi registrado é verdade e assinar/aprovar
  formalmente, porque esse documento tem valor legal/contratual (medição, auditoria, disputa)."
- **Tarefas**: revisar e aprovar/rejeitar RDO; anexar parecer.
- **Frequência**: por RDO enviado — reativo, não proativo.
- **Contexto de uso**: variável — pode ser campo ou escritório; frequentemente é de OUTRA empresa
  (o contratante), o que tem implicação de permissão: um Fiscal pode precisar acessar RDOs de um
  projeto sem ser da mesma empresa/tenant do executor. **Isso é uma questão de arquitetura de
  isolamento multitenant que precisa ser decidida antes de implementar o workflow de aprovação** —
  hoje o isolamento é 100% por empresa; um fiscal externo quebra essa premissa e precisa de um
  mecanismo de acesso cross-tenant explícito e auditável (não é só "adicionar uma permissão").

### Administrador (fora do produto hoje)

Continua sendo Django Admin — provisionamento de empresa/usuário. Não é uma persona de UX de
produto ainda; vira uma se/quando decidirmos trazer essa gestão para dentro do app (fora de escopo
por ora).

---

## Etapa 2 — Arquitetura de Informação

### O que existe hoje (questionando)

```
Login → Projetos (lista) → [Projeto] → Registros Diários (lista/detalhe/novo)
                                     → Configurações (uma tela só, com 4 sub-seções soltas)
```

Isso é uma IA de **ferramenta de cadastro**, não de **ferramenta de gestão**. Ela responde bem "onde
eu crio/vejo um registro" e não responde nada a "como está indo o projeto", "o que precisa da minha
atenção agora", "quanto isso está custando". É adequada para o Cluster A (produção de campo) e
inexistente para os Clusters B, C e D.

### IA proposta

A mudança estrutural mais importante: introduzir um **nível de Dashboard acima de cada projeto** e
um **nível de visão-empresa acima de todos os projetos** — hoje só existe o nível "dentro de um
projeto".

```
Empresa (implícito, nunca navegado — é o tenant)
│
├─ Visão da Empresa (novo — Cluster C)
│   ├─ Dashboard multi-projeto (comparativo)
│   └─ Alertas/Notificações (novo — cross-projeto)
│
└─ Projetos (lista, como hoje)
    │
    └─ [Projeto selecionado]
        ├─ Dashboard do Projeto (novo — Cluster B)
        │   ├─ Curva S / avanço físico
        │   ├─ Indicadores (produtividade, ociosidade, custo)
        │   └─ Exceções (o que está fora da meta — visão "sinal sobre ruído")
        │
        ├─ RDO (existe, reorganizado)
        │   ├─ Novo Registro (existe)
        │   ├─ Histórico (existe, ganha filtro/busca)
        │   └─ Aprovações (novo — Cluster D, fila do que aguarda aprovação)
        │
        ├─ Não Conformidades (novo — RNC)
        │
        ├─ Medição (novo — depende de EAP)
        │
        ├─ Custos (novo — separado de "Configurações", vira 1ª classe)
        │   └─ Custos & Ociosidade (painel)
        │
        ├─ Equipe (promovido de dentro de "Configurações" — pessoas + equipes)
        ├─ Máquinas (promovido de dentro de "Configurações" — máquinas + pool)
        ├─ EAP (promovido — hoje só existe via seed, sem tela)
        ├─ Documentos (novo — fotos de RDO centralizadas + relatórios exportados)
        ├─ Relatórios (novo — Ofício/Justificativa Técnica, exports)
        │
        └─ Configurações (sobra bem menor: metas, valores de custo unitário, permissões do projeto)
```

**Decisões de agrupamento e por quê:**

- **Equipe e Máquinas saem de "Configurações" e viram itens de 1ª classe na navegação.** Hoje eles
  estão enterrados dentro de uma tela de configuração porque foram implementados como "cadastro
  auxiliar do RDO". Mas o Cluster B/C usa esses dados constantemente para decisão (quem está
  alocado onde, que máquina está ociosa) — enterrar isso em "Configurações" é o erro clássico de
  Information Architecture de organizar por *como foi implementado* em vez de *como é usado*
  (viola o modelo mental do usuário — ver Nielsen #2, "match between system and the real world").
- **Custos sai de dentro de Configurações e vira seção própria**, porque hoje ele é só "cadastro de
  valor unitário" mas o produto de verdade precisa de "Custos & Ociosidade" como painel analítico —
  são JTBDs diferentes (cadastrar tarifa vs. entender quanto uma obra está custando).
- **Medição depende de EAP** — por isso EAP precisa existir como tela antes de Medição fazer
  sentido (ordem de dependência real, não só de prioridade).
- **Dashboard aparece em dois níveis** (empresa e projeto) porque os Clusters B e C têm a mesma
  necessidade ("o que está fora do esperado") em escalas diferentes — replicar o padrão visual
  entre os dois níveis reduz curva de aprendizado (o usuário aprende o padrão uma vez).
- **Permissões não vira uma seção de navegação própria** neste momento — ela é um atributo de
  Configurações do projeto e de usuário (Django Admin), não uma tarefa recorrente de nenhum
  cluster. Fica como um card dentro de Configurações, não um item de menu — evita inflar a IA com
  algo que é configurado uma vez e esquecido, não uma tarefa do dia a dia (isso é o oposto do erro
  que corrigimos com Equipe/Máquinas: aqui, promover a algo de 1ª classe seria over-engineering).

### Impacto arquitetural real (não é só "adicionar itens no menu")

- O `Sidebar.tsx` atual (`frontend/src/layouts/Sidebar.tsx`) tem 3 links fixos. Essa IA nova precisa
  de navegação **condicional por papel** (Cluster D talvez só veja "Aprovações", não o resto) — o
  que significa que o frontend precisa saber o *cluster* do usuário, não só se está autenticado.
  Hoje `UsuarioAutenticado` só tem `perfil: 'gerente' | 'auxiliar_administrativo'`, que não mapeia
  para nenhum dos 4 clusters. **Isto precisa ser resolvido na Etapa 4 (Fluxos) antes de desenhar
  qualquer tela com navegação condicional** — não dá para desenhar a UI de permissão sem decidir o
  modelo de dados por trás dela.
- Dashboard (níveis empresa e projeto) exige agregação de dados que hoje não existe nenhuma API
  para servir — é trabalho de backend, não só frontend. Vai aparecer no Plano de Implementação
  (Etapa 10) com peso real, não como só "mais uma tela".

---

## Etapa 3 — UX Strategy

Respondendo diretamente às perguntas do brief, com táticas específicas do BuildFlow (não genéricas):

**Como reduzir cliques?**
Pré-preencher o RDO de hoje com os dados **do RDO anterior do mesmo projeto** (equipe, fiscal,
disciplina mais usada) — o Cluster A já validou isso implicitamente: "de onde parei" é quase sempre
igual ao dia anterior. Isso não existe hoje (`RdoPage` sempre começa em branco, exceto o fiscal que
já pré-preenche com o usuário logado — extensão natural do que já foi corrigido na sessão anterior).

**Como reduzir digitação?**
Todo campo numérico de km/quantidade deve aceitar **cálculo relativo** (ex.: digitar km final e o
sistema calcula quantidade a partir da extensão × largura padrão do serviço, em vez de digitar os
dois separadamente). Seleção de pessoa/máquina por **chips com busca**, não `<select>` longo — já
identificamos no diretório de UI issues (revisão do Mazer) que os `<select>` de equipe/pessoa hoje
escalam mal com listas grandes.

**Como reduzir erros?**
Validação de faixa plausível em tempo real (não só obrigatoriedade) — ex.: se "horas produtivas +
horas paradas" de uma máquina passar de 24h, alertar antes de submeter, não depois. Isso é
Cognitive Load Theory aplicada: reduzir carga de *verificação* (o usuário não precisa somar na
cabeça) transferindo o cálculo para o sistema.

**Como tornar o preenchimento prazeroso?**
Feedback de progresso visível (stepper com % concluído, não uma lista infinita de campos) e
confirmação de sucesso que mostra o que foi conquistado no dia (ex.: "145,2t de CBUQ registrados
hoje"), não só um toast genérico "salvo com sucesso".

**Como reduzir tempo de treinamento?**
Consistência de padrão entre Dashboard-empresa e Dashboard-projeto (mesmo componente de "card de
exceção", cores e semântica idênticas nos dois níveis) — um usuário que aprende a ler um aprende o
outro de graça. É a razão de design técnica por trás da decisão de IA "Dashboard em dois níveis"
acima.

**Como facilitar uso em campo / sob sol?**
Contraste mínimo AA **obrigatório mesmo em elementos decorativos** — isto é uma correção direta de
um problema real que já encontramos: a revisão final da tela de login sinalizou texto a 40-50% de
opacidade sobre fundo escuro, abaixo do padrão AA. Sob sol direto (glare), esse tipo de contraste
baixo se torna **ilegível**, não só "esteticamente subótimo" — em campo, isso deixa de ser nitpick de
acessibilidade e vira bloqueio funcional. Todo texto funcional (não puramente decorativo) do Design
System novo (Etapa 5) precisa validar contraste ≥ 4.5:1 como requisito, não como sugestão.

**Como facilitar uso em tablets?**
Alvos de toque mínimos de 44×44px (Apple HIG) em toda ação de formulário do RDO — o `Sidebar`/
layout atual do Mazer já não tem toggle responsivo abaixo de 1200px (achado documentado na revisão
anterior); o Design System novo precisa nascer mobile-first, não desktop-first com breakpoint
"consertado" depois.

**Como reutilizar dados anteriores?**
Além do pré-preenchimento por RDO anterior (acima): "duplicar RDO" como ação de 1 clique a partir do
histórico, pré-preenchendo tudo e deixando só os campos que mudam (produção do dia) para edição —
answers diretamente o fluxo "Duplicar" pedido na Etapa 4.

**Como preparar o produto para IA futuramente?**
Capturar dados **estruturados desde já** (o que o BuildFlow já faz bem — RDO não é texto livre, é
schema) é a pré-condição real para IA depois (detecção de anomalia em produtividade, sugestão de
motivo de parada a partir de padrão histórico, OCR de foto de diário em papel para popular o
formulário). O erro a evitar é resolver "prazer de uso" adicionando campos de texto livre onde hoje
há campos estruturados — isso pareceria mais "flexível" no curto prazo e destruiria a base de dados
estruturados que qualquer IA futura precisa.

---

## Próximos passos

Etapas 4 (Fluxos), 5 (Design System substituindo o Mazer), 6 (Biblioteca de Componentes) e 7
(Arquitetura Frontend) são o próximo pacote de trabalho — maior escopo técnico, incluindo a decisão
de modelo de dados para "cluster de usuário" identificada acima como bloqueio real. Etapas 8-10
(Wireframes, Protótipo, Plano de Implementação) devem ser feitas **por módulo**, via
`speckit-specify`/`speckit-plan` (o mesmo processo que gerou `specs/001-mvp-gestao-diaria/`) — um
Product Blueprint de produto inteiro não deve virar um spec-kit gigante só; cada módulo (RNC,
Aprovação de RDO, EAP, Dashboard, etc.) vira sua própria spec quando entrar em construção, com este
documento como referência de visão.
