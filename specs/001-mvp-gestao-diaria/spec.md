# Feature Specification: MVP Gestão Diária de Obras (Multitenant)

**Feature Branch**: `001-mvp-gestao-diaria`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Aplicação web multitenant para gerenciamento de projetos, configurações e registros
diários de obras rodoviárias. Empresa como fronteira de isolamento de dados. Login exclusivo via Google, sem
cadastro público — usuários criados pelo Django Admin, vinculados a uma empresa e a um perfil (Gerente ou
Auxiliar administrativo). Após login: listar/criar projetos da própria empresa, criar/visualizar registros
diários de obra (RDO) de um projeto, criar/visualizar configurações de um projeto. Nenhum dado de uma empresa
pode ser visto, alterado ou inferido por usuário de outra empresa. Campos de RDO e configurações derivados do
protótipo funcional EPR_Daily_Completo.html (rascunho de referência); a planilha MODELO IMPORT SOFT é dado
legado de uma obra real, usada só para carga inicial (seed), não para definir o schema."

## Clarifications

### Session 2026-07-16

- Q: O MVP deve incluir workflow de aprovação do RDO (rascunho → aguardando aprovação → aprovado/rejeitado pelo fiscal)? → A: Não — sem workflow de aprovação no MVP; RDO é criado e permanece visível, sem estado de aprovação (fica para spec futura).
- Q: Upload de fotos no RDO entra no MVP? → A: Sim — incluído no MVP (anexo de foto com km opcional).
- Q: Presença/máquina no RDO exige cadastro prévio na Configuração do projeto? → A: Não — aceita tanto vínculo com Pessoa/Máquina já cadastrada quanto lançamento avulso (nome/código digitado na hora), sem exigir cadastro prévio.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provisionamento de empresas e usuários (Priority: P1)

Um administrador do sistema cria, pelo Django Admin, uma empresa e os usuários que trabalham nela (Gerente
ou Auxiliar administrativo), cada um com e-mail, perfil e status ativo/inativo. Sem isso, ninguém consegue
usar o sistema — é o pré-requisito de tudo.

**Why this priority**: É a fundação: nenhuma outra história é testável sem uma empresa e ao menos um usuário
ativo vinculado a ela.

**Independent Test**: Pelo Django Admin, criar uma empresa "Empresa A" e um usuário Gerente ativo vinculado a
ela; confirmar que o usuário aparece corretamente associado e que o registro é persistido sem exigir nenhuma
outra funcionalidade do sistema.

**Acceptance Scenarios**:

1. **Given** o Django Admin está acessível a um administrador, **When** ele cria uma empresa com nome e status
   ativo, **Then** a empresa é salva e pode ser localizada por nome.
2. **Given** uma empresa já existe, **When** o administrador cria um usuário com e-mail, perfil (Gerente ou
   Auxiliar administrativo) e vincula essa empresa, **Then** o usuário é salvo e não pode ser salvo sem uma
   empresa vinculada.
3. **Given** um usuário existente, **When** o administrador o marca como inativo, **Then** esse usuário deixa
   de conseguir autenticar-se (validado na História 2).

---

### User Story 2 - Login com Google restrito à própria empresa (Priority: P1)

Um usuário previamente cadastrado e ativo acessa o frontend, escolhe "Entrar com Google", autentica-se, e o
sistema o reconhece como pertencente a uma empresa específica, iniciando uma sessão que só enxerga dados
dessa empresa.

**Why this priority**: É o portão de entrada de todo o sistema e o ponto onde o isolamento multitenant começa
a ser aplicado; sem login funcionando corretamente (aceitando quem deve e rejeitando quem não deve) nenhuma
outra funcionalidade pode ser considerada segura.

**Independent Test**: Com um usuário ativo e vinculado a uma empresa (da História 1), completar o fluxo de
login com uma conta Google correspondente ao e-mail cadastrado e confirmar acesso à área interna; testar
separadamente que um e-mail não cadastrado, um usuário inativo, ou um usuário sem empresa são recusados.

**Acceptance Scenarios**:

1. **Given** um usuário ativo e vinculado a uma empresa, **When** ele autentica com a conta Google
   correspondente ao e-mail cadastrado, **Then** ele acessa a listagem de projetos da sua empresa.
2. **Given** um e-mail autenticado pelo Google que não existe na base de usuários, **When** o login é
   tentado, **Then** o acesso é recusado com mensagem compreensível, sem expor detalhes internos.
3. **Given** um usuário cadastrado mas inativo, **When** ele tenta autenticar-se, **Then** o acesso é
   recusado.
4. **Given** um usuário autenticado, **When** ele seleciona "Sair", **Then** a sessão é encerrada e ele é
   redirecionado para a tela de login; tentativas subsequentes de acessar área interna são recusadas até novo
   login.
5. **Given** um usuário já autenticado, **When** ele tenta abrir novamente a tela de login, **Then** é
   redirecionado diretamente para a área interna.

---

### User Story 3 - Gestão de projetos da empresa (Priority: P2)

Um Gerente ou Auxiliar administrativo, já autenticado, lista os projetos da sua empresa e cria novos projetos
informando nome e breve descrição.

**Why this priority**: É o objeto central ao qual registros diários e configurações se vinculam; sem projeto
não há RDO nem configuração possível.

**Independent Test**: Com um usuário autenticado (História 2), criar um projeto informando nome e descrição,
confirmar que ele aparece na listagem da própria empresa, e confirmar que um usuário de outra empresa não o
vê.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado sem projetos ainda, **When** ele acessa a listagem, **Then** vê um estado
   vazio com opção clara de criar o primeiro projeto.
2. **Given** um usuário autenticado, **When** ele preenche nome e breve descrição e confirma a criação,
   **Then** o projeto é criado vinculado automaticamente à empresa e ao usuário autenticado, sem que ele
   escolha a empresa manualmente.
3. **Given** um usuário tenta criar um projeto com nome vazio ou só espaços, **When** ele confirma, **Then** a
   criação é recusada com erro próximo ao campo.
4. **Given** dois usuários de empresas diferentes, **When** cada um lista projetos, **Then** cada um vê
   somente os projetos da própria empresa, mesmo que os nomes sejam iguais.
5. **Given** um usuário de uma empresa, **When** ele tenta acessar diretamente a URL de um projeto de outra
   empresa, **Then** o acesso é recusado como se o projeto não existisse.

---

### User Story 4 - Registro diário de obra (RDO) (Priority: P3)

Um Gerente ou Auxiliar administrativo, dentro de um projeto da sua empresa, cria um registro diário
descrevendo produção do dia, presença da equipe, uso de máquinas, ocorrências e fotos do dia, e consulta
registros já criados.

**Why this priority**: É o valor operacional principal do sistema (uso diário), mas depende de projeto e
login já funcionando.

**Independent Test**: Dentro de um projeto existente (História 3), criar um registro diário completo (data,
turno, clima, produção, presença, máquinas, ocorrências) e confirmar que ele aparece na listagem e nos
detalhes do projeto; confirmar que um usuário de outra empresa não consegue criar nem visualizar esse
registro.

**Acceptance Scenarios**:

1. **Given** um projeto existente da empresa do usuário, **When** ele preenche um registro diário com os
   campos obrigatórios (data de referência, turno, clima, equipe, ao menos uma produção do dia), **Then** o
   registro é criado vinculado ao projeto, com autor e data/hora de criação registrados automaticamente.
2. **Given** um registro diário sendo criado, **When** o usuário adiciona presença de pessoas (nome, função,
   status: presente/falta/atestado), **Then** essas informações ficam associadas ao registro.
3. **Given** um registro diário sendo criado, **When** o usuário lança horas produtivas e paradas de uma
   máquina, **Then** o sistema associa o motivo da parada apenas quando há horas paradas informadas.
4. **Given** registros diários já existentes em um projeto, **When** o usuário acessa a seção "Registros
   diários", **Then** vê a listagem ordenada por data com acesso aos detalhes de cada um.
5. **Given** um registro diário sendo criado, **When** o usuário anexa uma ou mais fotos, **Then** as fotos
   ficam associadas ao registro e visíveis nos detalhes, com o km informado quando disponível.
6. **Given** um usuário de outra empresa, **When** ele tenta criar ou visualizar um registro diário de um
   projeto que não é da sua empresa (por manipulação direta de URL/ID), **Then** o acesso é recusado.

---

### User Story 5 - Configurações do projeto (Priority: P3)

Um Gerente ou Auxiliar administrativo, dentro de um projeto da sua empresa, cria e visualiza as configurações
do projeto (metas por disciplina, equipes/frentes de trabalho, valores de mão de obra e equipamentos, perfis
de permissão).

**Why this priority**: Dá suporte às outras funcionalidades (ex.: metas usadas para acompanhar avanço,
equipes usadas ao criar RDOs), mas o sistema é utilizável sem configurações completas desde o primeiro dia.

**Independent Test**: Dentro de um projeto existente, criar uma configuração com ao menos uma meta por
disciplina e uma equipe, e confirmar que ela aparece na seção "Configurações" do projeto; confirmar isolamento
por empresa.

**Acceptance Scenarios**:

1. **Given** um projeto sem configuração ainda, **When** o usuário acessa "Configurações", **Then** vê um
   estado vazio com opção de criar a configuração inicial.
2. **Given** um projeto, **When** o usuário cadastra metas por disciplina (com unidade e valores-alvo) e uma
   ou mais equipes/frentes, **Then** essas informações ficam vinculadas ao projeto e disponíveis para consulta.
3. **Given** uma configuração existente, **When** o usuário edita um valor (ex.: meta de uma disciplina),
   **Then** a alteração é salva e refletida na próxima visualização.
4. **Given** um usuário de outra empresa, **When** ele tenta visualizar ou editar a configuração de um projeto
   que não é da sua empresa, **Then** o acesso é recusado.

### Edge Cases

- O que acontece quando o token do Google é válido mas destinado a outro client ID (audiência incorreta)? →
  Login recusado, tratado como falha de autenticação genérica.
- O que acontece quando a sessão expira no meio do preenchimento de um RDO longo? → O usuário é avisado antes
  de perder dados preenchidos e redirecionado ao login ao tentar salvar.
- O que acontece se dois registros diários forem criados para o mesmo projeto na mesma data? → Ver
  Assumptions (é permitido, mas a UI deve deixar claro que já existe ao menos um registro naquela data).
- O que acontece quando um usuário tenta acessar um projeto por ID/URL direta sem que esse projeto pertença à
  sua empresa? → Resposta idêntica à de "não encontrado", sem revelar que o projeto existe em outra empresa.
- O que acontece quando a empresa de um usuário é desativada enquanto ele está com sessão ativa? → Próximo
  acesso a qualquer dado é recusado (tratado como se o usuário estivesse inativo).
- O que acontece quando não há máquinas ou pessoas cadastradas na equipe ao criar um RDO? → O usuário pode
  registrar pessoa/máquina avulsa diretamente no formulário do RDO.

## Requirements *(mandatory)*

### Functional Requirements

**Empresas e usuários (Django Admin)**

- **FR-001**: O sistema MUST permitir que um administrador crie, edite, ative e desative empresas, com nome,
  identificador interno e datas de criação/atualização.
- **FR-002**: O sistema MUST permitir localizar empresas por nome no Django Admin.
- **FR-003**: O sistema MUST exigir que todo usuário comum esteja vinculado a exatamente uma empresa; a
  criação de usuário sem empresa MUST ser bloqueada.
- **FR-004**: O sistema MUST restringir o perfil do usuário a um conjunto controlado (Gerente, Auxiliar
  administrativo).
- **FR-005**: O sistema MUST impedir autenticação de usuários marcados como inativos.

**Autenticação**

- **FR-006**: O sistema MUST oferecer login exclusivamente via Google (OAuth 2.0/OpenID Connect); não MUST
  existir fluxo de cadastro público de conta.
- **FR-007**: O sistema MUST validar emissor, audiência e expiração do token do Google antes de autorizar
  acesso.
- **FR-008**: O sistema MUST recusar o login quando o e-mail autenticado não corresponder a um usuário
  cadastrado, ativo e vinculado a uma empresa.
- **FR-009**: O sistema MUST permitir encerrar a sessão (logout) de forma que acessos subsequentes a rotas
  internas exijam nova autenticação.
- **FR-010**: O sistema MUST redirecionar usuário já autenticado que tente acessar a tela de login para a
  área interna, e usuário não autenticado que tente acessar área interna para a tela de login.

**Isolamento multitenant**

- **FR-011**: O sistema MUST garantir que toda listagem, consulta, criação, atualização e exclusão de
  projeto, registro diário ou configuração seja restrita à empresa do usuário autenticado, independentemente
  de parâmetros informados pelo cliente.
- **FR-012**: O sistema MUST ignorar/rejeitar qualquer identificador de empresa informado diretamente pelo
  cliente ao criar ou atualizar um recurso; a empresa MUST ser sempre derivada do usuário autenticado.
- **FR-013**: O sistema MUST responder a tentativas de acesso cruzado entre empresas (por manipulação de
  identificador/URL) de forma que não revele a existência do recurso em outra empresa.

**Projetos**

- **FR-014**: Usuários autenticados MUST poder listar somente os projetos da própria empresa.
- **FR-015**: Usuários autenticados MUST poder criar um projeto informando nome (obrigatório) e breve
  descrição (opcional).
- **FR-016**: O sistema MUST rejeitar nome de projeto vazio ou composto somente por espaços.
- **FR-017**: O sistema MUST registrar automaticamente a empresa, o criador e as datas de criação/atualização
  de um projeto, sem que o usuário os informe manualmente.
- **FR-018**: Usuários autenticados MUST poder acessar os detalhes de um projeto da própria empresa.

**Registros diários (RDO)**

- **FR-019**: Usuários autenticados MUST poder criar um registro diário vinculado a um projeto da própria
  empresa, contendo ao menos: data de referência, turno, condição climática, equipe responsável, fiscal
  responsável, e uma ou mais produções do dia (rodovia, sentido, disciplina, serviço, km inicial/final,
  quantidade, unidade).
- **FR-020**: O sistema MUST permitir registrar, dentro de um registro diário, a presença de pessoas (nome,
  função, status: presente/falta/atestado), apontamento de máquinas (horas produtivas, horas paradas, motivo
  da parada quando houver horas paradas) e ocorrências do dia (tipo, recurso afetado, descrição). Cada pessoa
  ou máquina MUST poder ser vinculada a um cadastro já existente na Configuração do projeto (equipe/pool de
  máquinas) OU lançada de forma avulsa (nome/código digitado na hora), sem exigir cadastro prévio.
- **FR-021**: O sistema MUST registrar automaticamente o autor e a data/hora de criação de cada registro
  diário.
- **FR-022**: O sistema MUST permitir anexar uma ou mais fotos a um registro diário, associando a cada foto,
  quando disponível, a localização (km) do ponto fotografado.
- **FR-023**: Usuários autenticados MUST poder listar e visualizar os detalhes dos registros diários de um
  projeto da própria empresa, incluindo as fotos anexadas.

**Configurações do projeto**

- **FR-024**: Usuários autenticados MUST poder criar e visualizar a configuração de um projeto da própria
  empresa, incluindo metas por disciplina (com unidade), frentes/equipes de trabalho, e valores de mão de
  obra/equipamento.
- **FR-025**: Usuários autenticados MUST poder editar uma configuração de projeto já existente.
- **FR-026**: O sistema MUST vincular toda configuração obrigatoriamente a um projeto (e, por consequência, a
  uma empresa).

**Experiência**

- **FR-027**: O sistema MUST apresentar estados de carregamento, vazio e de erro em toda listagem (projetos,
  registros diários, configurações).
- **FR-028**: O sistema MUST exibir mensagens de erro de validação próximas ao campo correspondente nos
  formulários.
- **FR-029**: O sistema MUST confirmar visualmente o sucesso de uma criação/edição (projeto, registro diário,
  configuração).

### Key Entities

- **Empresa**: unidade de isolamento multitenant. Atributos: nome, identificador interno, status
  ativo/inativo, datas de criação/atualização.
- **Usuário**: pessoa que acessa o sistema. Atributos: nome, e-mail (usado no login Google), empresa
  (obrigatória), perfil (Gerente | Auxiliar administrativo), status ativo/inativo.
- **Projeto**: obra gerenciada por uma empresa. Atributos: nome, breve descrição, empresa, criador, datas de
  criação/atualização.
- **Registro Diário (RDO)**: relato de um dia de trabalho em um projeto. Atributos: data de referência,
  turno, clima, equipe, fiscal responsável, autor, data/hora de criação/atualização; contém sub-registros de
  produção do dia, presença de pessoas, apontamento de máquinas e ocorrências.
- **Produção do Dia**: item de produção dentro de um RDO. Atributos: rodovia, sentido, disciplina, serviço,
  km inicial/final, quantidade, unidade.
- **Presença**: registro de uma pessoa em um RDO. Atributos: nome, função, status (presente/falta/atestado),
  origem (vinculada a uma Pessoa cadastrada na equipe do projeto, ou avulsa).
- **Apontamento de Máquina**: uso de uma máquina em um RDO. Atributos: máquina, horas produtivas, horas
  paradas, motivo da parada (quando aplicável), origem (vinculada a uma Máquina cadastrada no pool do
  projeto, ou avulsa).
- **Ocorrência**: evento relatado em um RDO. Atributos: tipo, recurso afetado, descrição.
- **Foto**: evidência visual anexada a um RDO. Atributos: arquivo, km (opcional), data/hora de criação.
- **Configuração do Projeto**: parâmetros operacionais de um projeto. Contém: Metas (disciplina, unidade,
  valor-alvo), Equipes/Frentes (nome, Pessoas cadastradas com função, Máquinas cadastradas com código/nome),
  Valores (função de mão de obra ou equipamento, custo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um administrador consegue provisionar uma empresa e um usuário ativo, pronto para login, em
  menos de 5 minutos pelo Django Admin.
- **SC-002**: 100% das tentativas de login de usuários não cadastrados, inativos ou sem empresa são recusadas
  com mensagem compreensível, sem exceção.
- **SC-003**: 100% das tentativas de acesso, criação ou edição de dado de outra empresa (projeto, registro
  diário, configuração) são bloqueadas, comprovado por teste automatizado dedicado a isolamento multitenant.
- **SC-004**: Um usuário autenticado consegue criar um novo projeto em menos de 1 minuto, do clique em "Novo
  Projeto" até a confirmação de sucesso.
- **SC-005**: Um usuário autenticado consegue criar um registro diário completo (produção, presença, máquinas,
  ocorrências) em uma única sessão de preenchimento, sem perda de dados por erro de validação não sinalizado.
- **SC-006**: Um usuário consegue localizar e abrir qualquer registro diário ou configuração já criado do seu
  projeto em até 3 cliques a partir da listagem de projetos.
- **SC-007**: Todas as telas principais (login, listagem de projetos, RDO, configurações) exibem
  corretamente estado de carregamento, estado vazio e estado de erro quando aplicável, validado
  manualmente/por teste E2E.

## Assumptions

- **Escopo desta spec**: cobre apenas o núcleo do sistema (empresas/usuários, autenticação, projetos,
  registros diários, configurações), conforme delimitado nas seções 2 e 12 do brief original. Não
  conformidades (RNC), medição de contratos e painéis de custo/ociosidade — presentes no protótipo HTML mas
  fora da lista de ações do MVP — ficam no backlog para specs futuras.
- **Sem workflow de aprovação do RDO nesta versão** (ver Clarifications): o registro diário é criado e
  permanece visível assim que salvo, sem estado de aprovação por um fiscal. Fica no backlog.
- **Um projeto pode ter múltiplos registros diários na mesma data**: não há indicação de que deva ser único;
  a UI deve apenas deixar isso visível ao usuário (permite, por exemplo, registrar turnos diferentes no mesmo
  dia).
- **Configuração de projeto é única e editável in-place** (não versionada) nesta primeira versão; se
  histórico de alterações for necessário, será tratado em spec futura.
- **Nome de projeto não precisa ser único dentro da empresa** nesta primeira versão — não há indicação
  contrária nos arquivos de referência.
- **Diferenças entre perfis (Gerente vs. Auxiliar administrativo) não são funcionais nesta versão**: ambos
  têm acesso às mesmas ações (autenticar, listar/criar projeto, criar/ver RDO, criar/ver configuração),
  conforme especificado no brief original; a estrutura de permissões deve permitir diferenciação futura sem
  grande retrabalho.
- **Dados legados da planilha `MODELO IMPORT SOFT`** (obra Lote 2 – Patrocínio) servem apenas para popular o
  ambiente de desenvolvimento/demonstração (EAP e quantidades de um projeto de exemplo) — não definem
  obrigatoriedade de schema desta spec.
- **"Polo" (Uberlândia/Patrocínio) do protótipo HTML** é tratado, nesta spec, como um atributo textual livre
  do projeto (não uma entidade própria) até que uma necessidade real de múltiplos polos por projeto seja
  confirmada.
