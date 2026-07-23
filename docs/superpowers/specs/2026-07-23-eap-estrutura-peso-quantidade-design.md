# EAP — Estrutura, Peso e Quantidade (fatia inicial)

## Contexto

O protótipo de referência (`EPR_Daily_Completo.html`) descreve uma EAP (Estrutura Analítica do
Trabalho) completa: hierarquia N-níveis com código (001, 001.001...), datas previstas, importação/
exportação CSV, três visualizações (planilha, árvore, Gantt), integração automática com a Produção
diária e uma "carta de controle" por item. Isso é grande demais para uma spec só — várias das
partes (Gantt, importação CSV, integração automática com Produção, hierarquia N-níveis) ficam como
iniciativas futuras, cada uma com seu próprio spec/plano quando priorizada (mesmo padrão já usado
para RNC, Custos & Ociosidade e Histórico & Aprovações).

Esta spec cobre a fatia inicial: **estrutura de 2 níveis (Disciplina → Serviço) com peso e
quantidade planejada/executada, substituindo o `MetaMensal` atual**, que só tinha um valor-alvo por
disciplina sem granularidade de serviço.

## Escopo desta rodada

- Estrutura de 2 níveis: `Disciplina` (peso próprio) → `CatalogoServico` (peso dentro da
  disciplina, quantidade planejada, quantidade executada).
- Quantidade executada é **digitada manualmente** pelo Gerente — não é somada automaticamente a
  partir de `ProducaoDiaria` (ver "Trade-off" abaixo).
- Uma tela (a aba "Metas" de Configurações vira "EAP") mostrando a árvore com peso/quantidade/
  avanço por nível.
- `MetaMensal` é removido; o cálculo de `execucao_percentual` do projeto passa a usar a nova
  estrutura.

## Fora de escopo (backlog para specs futuras)

- Hierarquia N-níveis (código hierárquico tipo 001.001.001).
- Importação/exportação via CSV.
- Visualização Gantt e cronograma com datas previstas/baseline.
- Integração automática com Produção (ligar `ProducaoDiaria` a um item específico da EAP — hoje a
  quantidade executada é manual).
- "Carta de controle" / painel diretor por item (detalhe expandido de um serviço).
- Cálculo de aderência (real vs. previsto por data) e status (no prazo/atenção/crítico).

## Trade-off importante (confirmado com o usuário)

Hoje `calcular_execucao_percentual` soma automaticamente `ProducaoDiaria.quantidade` por
disciplina+unidade — 100% automático, sem digitação. Com a EAP usando `quantidade_executada`
manual, esse número **deixa de ser automático**: passa a exigir atualização manual periódica do
Gerente, com risco de ficar desatualizado se ninguém mexer. Decisão consciente do usuário: a EAP é
uma fonte "oficial" curada pelo Gerente, distinta do log bruto diário de produção — não uma média
automática. Integração automática fica para uma spec futura, se necessária.

## Modelo de dados

### `Disciplina` (alteração)

Adiciona:
- `peso_percentual` (decimal, `max_digits=5, decimal_places=2`, `null=True, blank=True`) — peso da
  disciplina dentro do projeto. Soma das disciplinas de um projeto deveria ser ~100%, mas isso é
  só um aviso visual (não bloqueia salvar), mesma regra que `MetaMensal` já tinha.

### `CatalogoServico` (alteração)

Adiciona:
- `peso_percentual` (decimal, `max_digits=5, decimal_places=2`, `null=True, blank=True`) — peso do
  serviço dentro da disciplina. Soma dos serviços de uma disciplina deveria ser ~100% (aviso
  visual, mesma regra).
- `quantidade_planejada` (decimal, `max_digits=12, decimal_places=3`, `null=True, blank=True`).
- `quantidade_executada` (decimal, `max_digits=12, decimal_places=3`, `default=Decimal("0")`) —
  atualizada manualmente pelo Gerente.

A unidade da quantidade já existe (`CatalogoServico.unidade`), não precisa de campo novo.

### `MetaMensal` — removido

Migração de dados (Django data migration, best-effort): para cada `MetaMensal` existente, copia
`peso_percentual` para `Disciplina.peso_percentual` da disciplina correspondente. `valor_alvo` e a
`unidade` de `MetaMensal` não têm equivalente direto no novo modelo (quantidade agora vive por
serviço, não por disciplina) — são descartados. Aceitável porque hoje só existem dados de
seed/demo, sem uso em produção real.

## Cálculo de avanço (`buildflow/projetos/services.py`)

Reescreve `calcular_execucao_percentual`:

```python
def calcular_avanco_servico(servico: CatalogoServico) -> Decimal | None:
    if not servico.quantidade_planejada:
        return None
    return (servico.quantidade_executada / servico.quantidade_planejada * 100).quantize(Decimal("0.01"))

def calcular_avanco_disciplina(disciplina: Disciplina) -> Decimal | None:
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")
    for servico in disciplina.servicos.all():
        if servico.peso_percentual is None:
            continue
        avanco = calcular_avanco_servico(servico) or Decimal("0")
        soma_ponderada += avanco * servico.peso_percentual
        soma_pesos += servico.peso_percentual
    if soma_pesos == 0:
        return None
    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))

def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")
    for disciplina in projeto.disciplinas.all():
        if disciplina.peso_percentual is None:
            continue
        avanco = calcular_avanco_disciplina(disciplina) or Decimal("0")
        soma_ponderada += avanco * disciplina.peso_percentual
        soma_pesos += disciplina.peso_percentual
    if soma_pesos == 0:
        return None
    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))
```

Mesma regra de hoje: nunca inventa número — sem peso definido em nenhum nível, retorna `None`
(exibido como `—` no frontend, como já acontece).

## API (`buildflow/configuracoes/`)

Estado atual real (verificado em `configuracoes/urls.py`): já existe
`DisciplinaDetailViewSet` em `configuracoes/disciplinas/<pk>/` com `PATCH`. **Não existe** nenhuma
rota para `CatalogoServico` — nem criar, nem editar, nem listar isoladamente (só aparece aninhado,
read-only, dentro de `DisciplinaSerializer.servicos`). Isso precisa ser criado do zero, seguindo o
mesmo padrão já usado para `Pessoa`/`Maquina` aninhados em `Equipe`:

- `DisciplinaSerializer` ganha `peso_percentual` e `avanco_percentual`
  (`SerializerMethodField`, usa `calcular_avanco_disciplina`).
- `CatalogoServicoSerializer` ganha `peso_percentual`, `quantidade_planejada`,
  `quantidade_executada` e `avanco_percentual` (idem, usa `calcular_avanco_servico`).
- `ConfiguracaoProjetoView` remove a chave `metas` da resposta e o campo `soma_pesos_metas` vira
  `soma_pesos_disciplinas`, somando `Disciplina.peso_percentual` diretamente.
- `PATCH configuracoes/disciplinas/<pk>/` (já existe) passa a aceitar `peso_percentual` no body.
- **Novo**: `POST projetos/<projeto_pk>/configuracao/disciplinas/<disciplina_pk>/servicos/` para
  criar serviço (`ServicoViewSet`, mesmo padrão de `MaquinaViewSet` aninhado em equipe).
- **Novo**: `PATCH configuracoes/servicos/<pk>/` para editar peso/quantidade planejada/executada
  (`ServicoDetailViewSet`, mesmo padrão de `MaquinaDetailViewSet`).
- Rotas de meta (`configuracao/metas/`, `configuracoes/metas/<pk>/`, `MetaViewSet`,
  `MetaDetailViewSet`) são removidas.

## Frontend

- `ConfiguracaoPage.tsx`: aba "Metas" vira "EAP". Lista de disciplinas com peso e avanço agregado
  (barra colorida por `execucaoCorClasse`); cada disciplina expande os serviços (peso, quantidade
  planejada, quantidade executada com input inline que salva no blur, avanço individual).
- Formulários de criar Disciplina/Serviço (já existentes) ganham campos opcionais de
  peso/quantidade planejada no momento da criação — mas continuam editáveis depois (nenhum campo é
  obrigatório para criar a estrutura, só para ela contar no cálculo de avanço).
- Aviso de peso: mesma UI já usada (`border-amber-500/30 bg-amber-500/5` com texto), agora em dois
  níveis — soma das disciplinas do projeto E soma dos serviços de cada disciplina.
- `useCriarMeta`/`metaDisciplinaId`/etc. em `configuracaoApi.ts` são removidos; entram
  `useAtualizarDisciplina` e `useAtualizarServico` (mutations `PATCH`).
- `types/configuracao.ts`: `Meta`/`MetaInput` removidos; `Disciplina` e `CatalogoServico` ganham os
  campos novos.

## Permissões

Mesma regra de hoje: leitura de Configurações é aberta a qualquer perfil autenticado da empresa;
edição (criar/editar disciplina, serviço, peso, quantidade) fica restrita a Gerente
(`IsGerente`, mesmo padrão já usado em RNC e Custos & Ociosidade — hoje Configurações não tem essa
checagem em `IsGerente` explicitamente para escrita, então isso é uma correção acompanhando a
introdução do dado estratégico).

## Migração e compatibilidade

- `seed_demo_data.py`: troca `MetaMensal.objects.create(...)` por
  `Disciplina.objects.filter(...).update(peso_percentual=...)` e
  `CatalogoServico.objects.filter(...).update(peso_percentual=..., quantidade_planejada=...)`.
- `seed_legacy_data.py` (usa `BASE_EAP`/`BASE_QTD_L2` da planilha `MODELO IMPORT SOFT`): ajusta para
  popular peso/quantidade por serviço em vez de só por disciplina — a planilha legada já tem essa
  granularidade (é de onde `BASE_EAP` vem), então isso é mais fiel ao dado original do que o
  `MetaMensal` atual.

## Testes

- `buildflow/projetos/tests/test_execucao.py`: reescrito para não depender de `ProducaoDiaria`
  (quantidade executada agora é atribuída direto em `CatalogoServico.quantidade_executada`) —
  casos: sem disciplinas com peso → `None`; um serviço sem peso não conta; uma disciplina/serviço
  com peso calcula direto; duas disciplinas com pesos diferentes fazem média ponderada; um serviço
  sem quantidade planejada não conta (mesma regra "nunca inventa número").
- `buildflow/configuracoes/tests/test_api.py`: remove testes de `MetaMensal`/endpoint de metas,
  adiciona testes de `PATCH` de peso/quantidade em Disciplina e CatalogoServico, e de que
  auxiliar administrativo recebe 403 ao tentar editar.
- `buildflow/projetos/tests/test_dashboard.py` e `test_api.py`: ajusta fixtures que hoje criam
  `MetaMensal` para usar os novos campos.
- Frontend: `tests/e2e/config.spec.ts` — reescreve o teste que hoje cria uma "Meta" pela aba
  Metas para criar peso/quantidade na aba EAP.
