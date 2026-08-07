# Route Inventory

Data: 2026-08-06
Arquivo de rotas: `frontend/src/App.tsx`

## Arquitetura de Rotas

O app usa `BrowserRouter` com uma rota publica (`/login`) e rotas autenticadas dentro de `ProtectedRoute` + `DashboardLayout`.

## Rotas Publicas

| Rota | Componente | Jornada |
|---|---|---|
| `/login` | `LoginPage` | Login Google OAuth via allauth. |
| `/` | `Navigate` | Redireciona para `/dashboard`. |

## Rotas Autenticadas

| Rota | Componente | Jornada | Observacoes |
|---|---|---|---|
| `/dashboard` | `DashboardPage` | Visao executiva da empresa | KPIs, alertas de RDO, graficos e projetos ativos. |
| `/projetos` | `ProjetosListPage` | Lista/criacao/edicao de projetos | Cards com filtro por status e busca textual. |
| `/projetos/:projetoId/registros-diarios` | `RegistrosDiariosListPage` | Calendario de RDOs | Fluxo operacional frequente; calendario mensal. |
| `/projetos/:projetoId/registros-diarios/novo` | `RdoPage` | Criacao de RDO | Wizard com dados gerais, equipe, maquinas, producao, ocorrencias, fotos e revisao. |
| `/projetos/:projetoId/registros-diarios/:registroId` | `RegistroDiarioDetailPage` | Detalhe do RDO | Consulta de producoes, equipe, maquinas, ocorrencias e fotos. |
| `/projetos/:projetoId/historico-aprovacoes` | `HistoricoAprovacoesPage` | Aprovacao/rejeicao de RDOs | Filtros por data/status e decisoes do fiscal. |
| `/projetos/:projetoId/medicoes` | `MedicoesListPage` | Lista e criacao de medicoes | Gerente pode criar; bloqueia se houver pendente. |
| `/projetos/:projetoId/medicoes/:medicaoId` | `MedicaoDetailPage` | Detalhe/aprovacao/rejeicao de medicao | Itens de medicao, valores e status. |
| `/projetos/:projetoId/rncs` | `RncListPage` | Lista de RNCs | Restrita ao perfil gerente. |
| `/projetos/:projetoId/rncs/novo` | `RncFormPage` | Criacao de RNC | Formulario de nao conformidade. |
| `/projetos/:projetoId/rncs/:rncId` | `RncFormPage` | Edicao/conclusao de RNC | Reusa o formulario. |
| `/projetos/:projetoId/custos-ociosidade` | `CustosOciosidadePage` | Custos e ociosidade | Restrita ao perfil gerente. |
| `/projetos/:projetoId/planejamento/eap` | `EapPage` | EAP, cronograma, pesos e editor detalhado | Rota propria de Planejamento. |
| `/projetos/:projetoId/configuracoes` | `ConfiguracaoPage` | Disciplinas, equipes e valores | Query antiga `?tab=eap` redireciona para Planejamento > EAP. |

## Navegacao Lateral

Arquivo: `frontend/src/layouts/Sidebar.tsx`

- Nivel Empresa:
  - Dashboard
  - Projetos
- Contexto de projeto:
  - Planejamento: EAP (`/planejamento/eap`)
  - Operacao: Registros diarios, Historico & Aprovacoes, Medicoes
  - Gestao: RNCs, Custos & Ociosidade, apenas gerente
  - Administracao: Configuracoes

Problema anterior: EAP compartilhava rota com Configuracoes, o que dificultava titulo, analytics e permissoes especificas. Corrigido com `/planejamento/eap`.

## APIs Consumidas por Jornada

| Jornada | Hooks/API |
|---|---|
| Auth | `/_allauth/browser/v1/auth/session`, `/_allauth/browser/v1/auth/provider/token` |
| Dashboard | `/api/v1/dashboard/` |
| Projetos | `/api/v1/projetos/`, `/api/v1/projetos/:id/` |
| Configuracoes/EAP | `/api/v1/projetos/:id/configuracao/`, `/api/v1/projetos/:id/configuracao-rdo/`, endpoints de disciplinas, servicos, equipes, pessoas, maquinas, valores e importacao EAP |
| RDO | `/api/v1/projetos/:id/registros-diarios/`, `/api/v1/registros-diarios/:id/`, upload de fotos, aprovar/rejeitar |
| Medicoes | `/api/v1/projetos/:id/medicoes/`, aprovar, rejeitar, deletar |
| RNCs | `/api/v1/projetos/:id/rncs/`, `/api/v1/rncs/:id/`, concluir e acoes corretivas |
| Custos | `/api/v1/projetos/:id/custos-ociosidade/?mes=YYYY-MM` |

## Jornadas Principais Mapeadas

1. Entrar no app e ver saude da empresa no dashboard.
2. Encontrar ou criar projeto.
3. Abrir projeto e navegar pelo contexto lateral.
4. Criar/importar disciplinas e servicos da EAP.
5. Definir pesos, quantidades e datas planejadas.
6. Criar RDO diario no campo.
7. Acompanhar e aprovar RDOs.
8. Gerar e aprovar medicoes.
9. Registrar e resolver RNCs.
10. Monitorar custo e ociosidade.

## Lacunas de Arquitetura de Informacao

- EAP deveria ser rota propria ou pagina propria dentro de Planejamento, nao apenas aba de Configuracoes.
- Dependencias, pesos e cronograma deveriam ser subviews da EAP, nao concorrer com Disciplinas/Equipes/Valores.
- Dashboard deveria ser consolidacao, nao primeira tela a receber a migracao visual completa.
- O seletor/troca de projeto e a busca global precisam aparecer como padrao de app shell documentado.
- Rotas restritas por perfil existem, mas falta padrao visual dedicado para `forbidden`.
