# BuildFlow UI Migration Roadmap

Data: 2026-08-07
Escopo: plano tecnico para implementar a nova identidade sem quebrar produto.

## 6. Roadmap de implementacao

### Direcao recomendada principal

**Command Infrastructure**: um sistema visual tecnico, premium e operacional, com superficies claras, azul profundo, ciano de inteligencia, semantica forte para status e composicao orientada a excecoes.

Justificativa: essa direcao equilibra confianca executiva e rotina de campo. Ela diferencia o BuildFlow de templates genericos sem cair em visual futurista ou decorativo.

### Direcoes alternativas resumidas

1. **Field Ledger**

   Mais documental e auditavel. Forte para historico, evidencias, medicoes e conformidade. Menos dinamica para dashboard e planejamento visual.

2. **Operations Radar**

   Mais analitica e orientada a alertas. Forte para dashboards, risco e produtividade. Pode parecer fria demais para registro de campo se exagerada.

Recomendacao final: seguir com **Command Infrastructure** e absorver elementos de Field Ledger nos modulos de historico, aprovacoes e medicoes.

## Etapas tecnicas

### Etapa 1 - Auditoria de estilos existentes

Objetivo: mapear divergencias antes de mexer no tema.

Atividades:

- Listar cores hardcoded.
- Listar componentes duplicados.
- Mapear variantes de status por modulo.
- Levantar tabelas, forms, badges, cards e filtros.
- Identificar telas com maior risco de regressao.

Entregaveis:

- Atualizacao de `docs/component-inventory.md`.
- Backlog de tokens e componentes.
- Lista de quick wins.

Checklist:

- [ ] Cores locais catalogadas.
- [ ] Componentes duplicados priorizados.
- [ ] Status mapeados por dominio.

### Etapa 2 - Criacao dos tokens

Objetivo: consolidar tema visual em `frontend/src/app.css`.

Atividades:

- Adicionar tokens de marca.
- Ajustar neutral palette.
- Revisar tema dark.
- Garantir contraste.
- Remover dependencias de cores Tailwind locais para status.

Entregaveis:

- Tokens CSS.
- Tabela de mapeamento antigo > novo.
- Captura visual antes/depois.

Checklist:

- [ ] Light e dark consistentes.
- [ ] Contraste minimo atendido.
- [ ] Tokens documentados.

### Etapa 3 - Criacao do tema

Objetivo: transformar tokens em linguagem de produto.

Atividades:

- Definir classes base para superficie, borda, foco e texto.
- Padronizar `font-display` e `font-mono`.
- Criar utilitarios para status.
- Revisar shadows e radii.

Entregaveis:

- Tema base aplicado.
- Guia de uso em `docs/design-system-foundation.md`.

### Etapa 4 - Refatoracao dos componentes base

Prioridade:

1. Button
2. IconButton
3. Input / Select / Textarea
4. Badge / StatusBadge
5. Card / StatCard
6. Table / DataTable
7. PageHeader
8. EmptyState / ErrorState / Skeleton
9. Dialog / Drawer / Toast
10. FilterBar

Regras:

- Nao refatorar pagina junto com componente base se o risco for alto.
- Cada componente deve ter estados documentados.
- Criar testes quando houver logica ou acessibilidade relevante.

### Etapa 5 - Criacao do app shell

Objetivo: estabilizar a moldura do produto.

Atividades:

- Sidebar final.
- Topbar final.
- Breadcrumb final.
- Layout responsivo.
- Padrao de page header.
- Busca global e contexto de projeto.

Validacao:

- E2E de navegacao.
- Teste mobile do sheet.
- Teclado e foco.

### Etapa 6 - Migracao das paginas prioritarias

Ordem recomendada:

1. Dashboard
2. Projetos
3. EAP / Cronograma
4. Registros Diarios
5. Historico & Aprovacoes
6. Medicoes
7. Custos & Ociosidade
8. RNCs
9. Configuracoes

Racional:

- Dashboard e Projetos definem primeira percepcao.
- EAP e RDO sao nucleos de valor operacional.
- Historico, Medicoes e Custos consolidam confianca e valor financeiro.
- RNCs e Configuracoes fecham consistencia do sistema.

### Etapa 7 - Validacao visual

Atividades:

- Screenshots Playwright desktop, tablet e mobile.
- Comparacao por modulo.
- Checklist de tokens.
- Revisao manual de overflow, truncamento e contraste.

Ferramentas:

- Playwright.
- Futuro: Storybook + Chromatic ou alternativa local gratuita.

### Etapa 8 - Acessibilidade

Atividades:

- Validar navegacao por teclado.
- Garantir labels em forms.
- Confirmar foco visivel.
- Revisar contraste.
- Criar alternativa tabular para graficos complexos.

Rotas prioritarias:

- Login
- Dashboard
- Projetos
- EAP
- Novo RDO
- Aprovar RDO
- Medicoes
- Custos

### Etapa 9 - Testes de regressao

Atividades:

- Rodar build, lint e e2e.
- Criar testes para componentes de alto uso.
- Adicionar smoke visual para rotas principais.
- Verificar permissoes por perfil.

Comandos:

- `npm.cmd run build`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run test:e2e`

### Etapa 10 - Rollout gradual

Estrategia:

- Migrar componentes base primeiro.
- Migrar uma tela por vez.
- Usar feature flag apenas em mudancas de alto risco.
- Manter rotas e contratos de API.
- Validar com screenshots antes/depois.

## Plano por onda

### Onda 1 - Fundacao

- Tokens.
- Componentes base.
- StatusBadge unico.
- PageHeader.
- FilterBar.
- Storybook inicial.

### Onda 2 - Percepcao de marca

- Sidebar e Topbar.
- Dashboard.
- Projetos.
- Empty/Error states.

### Onda 3 - Operacao central

- EAP/Cronograma.
- RDO lista/detalhe.
- Wizard RDO.
- Historico & Aprovacoes.

### Onda 4 - Valor financeiro e governanca

- Medicoes.
- Custos & Ociosidade.
- RNCs.
- Configuracoes.

### Onda 5 - Maturidade

- TanStack Table em telas densas.
- Storybook completo.
- Testes visuais.
- A11y automatizado.
- Guia para novas telas.

## Riscos e mitigacoes

| Risco | Mitigacao |
|---|---|
| Refatorar visual demais e perder eficiencia | Validar fluxos recorrentes com Playwright e screenshots |
| Criar tokens sem migrar componentes | Planejar tokens + componentes juntos |
| Trocar biblioteca sem necessidade | Manter stack atual ate haver dor concreta |
| Quebrar contratos de API | Refatoracao visual sem alterar modelos |
| Mobile virar versao comprimida do desktop | Desenhar mobile por tarefa |

## Do's

- Migrar com evidencia visual.
- Criar componentes antes de repetir padroes.
- Manter nomes de dominio.
- Priorizar telas que aumentam valor percebido.
- Documentar decisoes no mesmo dia da implementacao.

## Don'ts

- Nao redesenhar tudo em um unico PR.
- Nao trocar biblioteca por preferencia estetica.
- Nao criar tema sem checklist de contraste.
- Nao usar componente novo sem estados.
- Nao transformar produto operacional em landing page.

## Checklist de pronto para migrar uma tela

- [ ] Tokens necessarios existem.
- [ ] Componentes base estao prontos.
- [ ] Estados loading/empty/error definidos.
- [ ] Acoes criticas mapeadas.
- [ ] E2E principal existe.
- [ ] Screenshot antes/depois sera gerado.
- [ ] Mobile tem tarefa principal definida.

## Recomendacao final

Implementar **Command Infrastructure** em rollout gradual. A prioridade deve ser consolidar tokens, status, app shell e componentes base antes de novas telas. O maior ganho de marca nao vira de uma mudanca cosmetica unica, mas de repeticao consistente: a mesma semantica de risco, a mesma densidade, a mesma clareza de acao e a mesma confianca visual em todos os modulos.
