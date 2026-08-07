import { useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  BookOpen,
  DollarSign,
  HardHat,
  Layers3,
  Plus,
  Settings2,
  Truck,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorRetry,
  FormField,
  Input,
  PageHeader,
  SelectField,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui'
import {
  useConfiguracaoProjeto,
  useCriarDisciplina,
  useCriarEquipe,
  useCriarMaquina,
  useCriarPessoa,
  useCriarValorCusto,
} from '../features/configuracoes/configuracaoApi'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { toast } from '../hooks/use-toast'
import type { Disciplina, ValorCusto } from '../types/configuracao'
import type { Equipe } from '../types/registroDiario'

type ConfigTab = 'disciplinas' | 'equipes' | 'valores'

function ConfiguracaoSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando...
      </span>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </>
  )
}

function contarServicos(disciplinas: Disciplina[]): number {
  return disciplinas.reduce((total, disciplina) => total + disciplina.servicos.length, 0)
}

function contarPessoas(equipes: Equipe[]): number {
  return equipes.reduce((total, equipe) => total + equipe.pessoas.length, 0)
}

function contarMaquinas(equipes: Equipe[]): number {
  return equipes.reduce((total, equipe) => total + equipe.maquinas.length, 0)
}

function progressoConfiguracao({
  disciplinas,
  equipes,
  valoresCusto,
}: {
  disciplinas: Disciplina[]
  equipes: Equipe[]
  valoresCusto: ValorCusto[]
}): number {
  const checks = [
    disciplinas.length > 0,
    contarServicos(disciplinas) > 0,
    equipes.length > 0,
    contarPessoas(equipes) > 0,
    contarMaquinas(equipes) > 0,
    valoresCusto.length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function MetricTile({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail?: string
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const toneClass = {
    neutral: 'border-border bg-background text-ink',
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  }[tone]

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function DisciplinaItem({ disciplina }: { disciplina: Disciplina }) {
  return (
    <li className="rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:border-primary/35">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
          <BookOpen size={15} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{disciplina.nome}</span>
        </span>
        <Badge variant="outline">{disciplina.servicos.length} serviço(s)</Badge>
      </div>
      {disciplina.servicos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {disciplina.servicos.slice(0, 4).map((servico) => (
            <li key={servico.id} className="rounded-md border border-border px-2 py-1">
              {servico.nome}
            </li>
          ))}
          {disciplina.servicos.length > 4 && (
            <li className="rounded-md border border-border px-2 py-1">+{disciplina.servicos.length - 4}</li>
          )}
        </ul>
      )}
    </li>
  )
}

function EquipeItem({ equipe }: { equipe: Equipe }) {
  return (
    <li className="rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:border-primary/35">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display font-bold text-ink">
          <HardHat size={15} className="text-primary" aria-hidden="true" />
          {equipe.nome}
        </p>
        <div className="flex gap-2">
          <Badge variant="outline">{equipe.pessoas.length} pessoa(s)</Badge>
          <Badge variant="outline">{equipe.maquinas.length} máquina(s)</Badge>
        </div>
      </div>

      {equipe.pessoas.length === 0 && equipe.maquinas.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Sem pessoas ou máquinas ainda.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ul className="space-y-1 text-xs text-muted-foreground">
            {equipe.pessoas.map((pessoa) => (
              <li key={pessoa.id} className="flex items-center gap-2">
                <Users size={12} aria-hidden="true" />
                {pessoa.nome} — {pessoa.funcao}
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {equipe.maquinas.map((maquina) => (
              <li key={maquina.id} className="flex items-center gap-2">
                <Truck size={12} aria-hidden="true" />
                {maquina.nome} ({maquina.codigo})
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

function ValorItem({ valor }: { valor: ValorCusto }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 text-sm text-ink transition-colors hover:border-primary/35 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        {valor.tipo === 'mao_de_obra' ? (
          <Users size={14} className="text-primary" aria-hidden="true" />
        ) : (
          <Truck size={14} className="text-primary" aria-hidden="true" />
        )}
        <span>
          <span className="font-medium">{valor.descricao}</span>
          {valor.funcao && <span className="text-muted-foreground"> — {valor.funcao}</span>}
        </span>
      </span>
      <span className="flex items-center gap-1 font-mono text-xs font-semibold text-ink">
        <DollarSign size={12} className="text-emerald-600" aria-hidden="true" />
        {valor.valor}
      </span>
    </li>
  )
}

export function ConfiguracaoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const abaAtiva = (searchParams.get('tab') ?? 'disciplinas') as ConfigTab | 'eap'
  const configuracao = useConfiguracaoProjeto(projetoId ?? '')
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Configurações' }])

  const criarDisciplina = useCriarDisciplina(projetoId ?? '')
  const criarEquipe = useCriarEquipe(projetoId ?? '')
  const criarPessoa = useCriarPessoa(projetoId ?? '')
  const criarMaquina = useCriarMaquina(projetoId ?? '')
  const criarValorCusto = useCriarValorCusto(projetoId ?? '')

  const [nomeDisciplina, setNomeDisciplina] = useState('')
  const [nomeEquipe, setNomeEquipe] = useState('')
  const [pessoaNome, setPessoaNome] = useState('')
  const [pessoaFuncao, setPessoaFuncao] = useState('')
  const [pessoaEquipeId, setPessoaEquipeId] = useState('')
  const [maquinaCodigo, setMaquinaCodigo] = useState('')
  const [maquinaNome, setMaquinaNome] = useState('')
  const [maquinaEquipeId, setMaquinaEquipeId] = useState('')
  const [valorTipo, setValorTipo] = useState<'mao_de_obra' | 'equipamento'>('mao_de_obra')
  const [valorDescricao, setValorDescricao] = useState('')
  const [valorValor, setValorValor] = useState('')
  const [valorFuncao, setValorFuncao] = useState('')
  const [valorMaquinaId, setValorMaquinaId] = useState('')

  if (abaAtiva === 'eap') {
    return <Navigate to={`/projetos/${projetoId}/planejamento/eap`} replace />
  }

  if (configuracao.isLoading) return <ConfiguracaoSkeleton />
  if (configuracao.isError || !configuracao.data) {
    return (
      <ErrorRetry
        message="Não foi possível carregar a configuração do projeto."
        onRetry={() => void configuracao.refetch()}
      />
    )
  }

  const { disciplinas, equipes, valores_custo: valoresCusto } = configuracao.data
  const totalServicos = contarServicos(disciplinas)
  const totalPessoas = contarPessoas(equipes)
  const totalMaquinas = contarMaquinas(equipes)
  const progresso = progressoConfiguracao({ disciplinas, equipes, valoresCusto })
  const equipesOptions = equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))
  const maquinasOptions = equipes.flatMap((equipe) =>
    equipe.maquinas.map((maquina) => ({
      value: maquina.id,
      label: `${maquina.nome} (${maquina.codigo})`,
    })),
  )

  return (
    <main aria-label="Configurações do projeto">
      <PageHeader
        title="Configurações"
        subtitle="Central de parametrização do projeto: disciplinas, equipes, recursos e custos usados nos RDOs."
        breadcrumbs={breadcrumbs}
      />

      <section className="mb-5 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_33rem]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Setup operacional</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">
              Configuração {progresso}% pronta para campo
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Cadastre o catálogo de serviços, monte as equipes e defina valores para transformar RDO em dado confiável.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile label="Disciplinas" value={disciplinas.length} tone={disciplinas.length > 0 ? 'success' : 'warning'} />
            <MetricTile label="Serviços" value={totalServicos} detail="catálogo" tone={totalServicos > 0 ? 'success' : 'warning'} />
            <MetricTile label="Equipes" value={equipes.length} tone={equipes.length > 0 ? 'success' : 'warning'} />
            <MetricTile
              label="Recursos"
              value={totalPessoas + totalMaquinas}
              detail={`${totalPessoas} pessoas, ${totalMaquinas} máquinas`}
              tone={totalPessoas + totalMaquinas > 0 ? 'success' : 'warning'}
            />
          </div>
        </div>
      </section>

      <Tabs
        value={abaAtiva}
        onValueChange={(valor) => {
          setSearchParams((prev) => {
            const proximo = new URLSearchParams(prev)
            proximo.set('tab', valor)
            return proximo
          })
        }}
      >
        <section className="mb-5 rounded-lg border border-border bg-card p-3 shadow-sm">
          <TabsList aria-label="Seções de configuração">
            <TabsTrigger value="disciplinas">Disciplinas</TabsTrigger>
            <TabsTrigger value="equipes">Equipes</TabsTrigger>
            <TabsTrigger value="valores">Valores</TabsTrigger>
          </TabsList>
        </section>

        <TabsContent value="disciplinas">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <Card
              title="Disciplinas"
              eyebrow={
                <>
                  <Layers3 size={12} aria-hidden="true" />
                  Catálogo técnico
                </>
              }
              className="mb-0"
            >
              <div aria-label="Disciplinas">
                {disciplinas.length === 0 && <EmptyState>Nenhuma disciplina cadastrada ainda.</EmptyState>}
                <ul className="flex flex-col gap-2">
                  {disciplinas.map((disciplina) => (
                    <DisciplinaItem key={disciplina.id} disciplina={disciplina} />
                  ))}
                </ul>
              </div>
            </Card>

            <Card
              title="Nova disciplina"
              eyebrow={
                <>
                  <Plus size={12} aria-hidden="true" />
                  Cadastro rápido
                </>
              }
              className="mb-0"
            >
              <div className="space-y-3">
                <FormField id="nova-disciplina" label="Nova disciplina">
                  <Input
                    id="nova-disciplina"
                    value={nomeDisciplina}
                    onChange={(event) => setNomeDisciplina(event.target.value)}
                  />
                </FormField>
                <Button
                  className="w-full"
                  onClick={() =>
                    criarDisciplina.mutate(
                      { nome: nomeDisciplina },
                      {
                        onSuccess: () => setNomeDisciplina(''),
                        onError: () =>
                          toast({ title: 'Não foi possível criar a disciplina.', variant: 'destructive' }),
                      },
                    )
                  }
                  disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
                >
                  Adicionar disciplina
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipes">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <Card
              title="Equipes"
              eyebrow={
                <>
                  <HardHat size={12} aria-hidden="true" />
                  Frentes e recursos
                </>
              }
              className="mb-0"
            >
              <div aria-label="Equipes">
                {equipes.length === 0 && <EmptyState>Nenhuma equipe cadastrada ainda.</EmptyState>}
                <ul className="flex flex-col gap-2">
                  {equipes.map((equipe) => (
                    <EquipeItem key={equipe.id} equipe={equipe} />
                  ))}
                </ul>
              </div>
            </Card>

            <div className="space-y-4">
              <Card title="Nova equipe" eyebrow="Frente de trabalho" className="mb-0">
                <div className="space-y-3">
                  <FormField id="nova-equipe" label="Nova equipe">
                    <Input id="nova-equipe" value={nomeEquipe} onChange={(event) => setNomeEquipe(event.target.value)} />
                  </FormField>
                  <Button
                    className="w-full"
                    disabled={!nomeEquipe.trim() || criarEquipe.isPending}
                    onClick={() =>
                      criarEquipe.mutate(nomeEquipe, {
                        onSuccess: () => setNomeEquipe(''),
                        onError: () => toast({ title: 'Não foi possível criar a equipe.', variant: 'destructive' }),
                      })
                    }
                  >
                    Adicionar equipe
                  </Button>
                </div>
              </Card>

              <Card
                title="Adicionar pessoa"
                eyebrow={
                  <>
                    <UserPlus size={12} aria-hidden="true" />
                    Mão de obra
                  </>
                }
                className="mb-0"
              >
                <div className="space-y-3">
                  <SelectField
                    id="pessoa-equipe"
                    label="Equipe"
                    value={pessoaEquipeId}
                    onChange={setPessoaEquipeId}
                    options={equipesOptions}
                  />
                  <FormField id="pessoa-nome" label="Nome">
                    <Input id="pessoa-nome" value={pessoaNome} onChange={(event) => setPessoaNome(event.target.value)} />
                  </FormField>
                  <FormField id="pessoa-funcao" label="Função">
                    <Input
                      id="pessoa-funcao"
                      value={pessoaFuncao}
                      onChange={(event) => setPessoaFuncao(event.target.value)}
                    />
                  </FormField>
                  <Button
                    className="w-full"
                    disabled={!pessoaEquipeId || !pessoaNome.trim() || criarPessoa.isPending}
                    onClick={() =>
                      criarPessoa.mutate(
                        { equipeId: pessoaEquipeId, nome: pessoaNome, funcao: pessoaFuncao },
                        {
                          onSuccess: () => {
                            setPessoaNome('')
                            setPessoaFuncao('')
                          },
                          onError: () => toast({ title: 'Não foi possível adicionar a pessoa.', variant: 'destructive' }),
                        },
                      )
                    }
                  >
                    Adicionar pessoa
                  </Button>
                </div>
              </Card>

              <Card
                title="Adicionar máquina"
                eyebrow={
                  <>
                    <Truck size={12} aria-hidden="true" />
                    Equipamento
                  </>
                }
                className="mb-0"
              >
                <div className="space-y-3">
                  <SelectField
                    id="maquina-equipe"
                    label="Equipe"
                    value={maquinaEquipeId}
                    onChange={setMaquinaEquipeId}
                    options={equipesOptions}
                  />
                  <FormField id="maquina-codigo" label="Código">
                    <Input
                      id="maquina-codigo"
                      value={maquinaCodigo}
                      onChange={(event) => setMaquinaCodigo(event.target.value)}
                    />
                  </FormField>
                  <FormField id="maquina-nome" label="Nome">
                    <Input
                      id="maquina-nome"
                      value={maquinaNome}
                      onChange={(event) => setMaquinaNome(event.target.value)}
                    />
                  </FormField>
                  <Button
                    className="w-full"
                    disabled={!maquinaEquipeId || !maquinaNome.trim() || criarMaquina.isPending}
                    onClick={() =>
                      criarMaquina.mutate(
                        { equipeId: maquinaEquipeId, codigo: maquinaCodigo, nome: maquinaNome },
                        {
                          onSuccess: () => {
                            setMaquinaCodigo('')
                            setMaquinaNome('')
                          },
                          onError: () =>
                            toast({ title: 'Não foi possível adicionar a máquina.', variant: 'destructive' }),
                        },
                      )
                    }
                  >
                    Adicionar máquina
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="valores">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <Card
              title="Valores"
              eyebrow={
                <>
                  <Banknote size={12} aria-hidden="true" />
                  Base de custo
                </>
              }
              className="mb-0"
            >
              <div aria-label="Valores de custo">
                {valoresCusto.length === 0 && <EmptyState>Nenhum valor cadastrado ainda.</EmptyState>}
                <ul className="flex flex-col gap-2">
                  {valoresCusto.map((valor) => (
                    <ValorItem key={valor.id} valor={valor} />
                  ))}
                </ul>
              </div>
            </Card>

            <Card
              title="Adicionar valor"
              eyebrow={
                <>
                  <Settings2 size={12} aria-hidden="true" />
                  Parâmetro financeiro
                </>
              }
              className="mb-0"
            >
              <div className="space-y-3">
                <SelectField
                  id="valor-tipo"
                  label="Tipo"
                  value={valorTipo}
                  onChange={(value) => setValorTipo(value as typeof valorTipo)}
                  options={[
                    { value: 'mao_de_obra', label: 'Mão de obra' },
                    { value: 'equipamento', label: 'Equipamento' },
                  ]}
                />
                {valorTipo === 'mao_de_obra' ? (
                  <FormField id="valor-funcao" label="Função">
                    <Input
                      id="valor-funcao"
                      value={valorFuncao}
                      onChange={(event) => setValorFuncao(event.target.value)}
                    />
                  </FormField>
                ) : (
                  <SelectField
                    id="valor-maquina"
                    label="Máquina"
                    value={valorMaquinaId}
                    onChange={setValorMaquinaId}
                    options={maquinasOptions}
                  />
                )}
                <FormField id="valor-descricao" label="Descrição">
                  <Input
                    id="valor-descricao"
                    value={valorDescricao}
                    onChange={(event) => setValorDescricao(event.target.value)}
                  />
                </FormField>
                <FormField
                  id="valor-valor"
                  label={valorTipo === 'mao_de_obra' ? 'Valor (R$/dia)' : 'Valor (R$/hora)'}
                >
                  <Input id="valor-valor" value={valorValor} onChange={(event) => setValorValor(event.target.value)} />
                </FormField>
                <Button
                  className="w-full"
                  disabled={!valorDescricao.trim() || !valorValor || criarValorCusto.isPending}
                  onClick={() =>
                    criarValorCusto.mutate(
                      {
                        tipo: valorTipo,
                        descricao: valorDescricao,
                        valor: valorValor,
                        funcao: valorTipo === 'mao_de_obra' ? valorFuncao : undefined,
                        maquina: valorTipo === 'equipamento' ? valorMaquinaId : undefined,
                      },
                      {
                        onSuccess: () => {
                          setValorDescricao('')
                          setValorValor('')
                          setValorFuncao('')
                          setValorMaquinaId('')
                        },
                        onError: () => toast({ title: 'Não foi possível criar o valor.', variant: 'destructive' }),
                      },
                    )
                  }
                >
                  Adicionar valor
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}
