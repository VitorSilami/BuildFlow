import { BookOpen, DollarSign, HardHat, Target, Truck, Users } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useConfiguracaoProjeto,
  useCriarDisciplina,
  useCriarEquipe,
  useCriarMaquina,
  useCriarMeta,
  useCriarPessoa,
  useCriarValorCusto,
} from '../features/configuracoes/configuracaoApi'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import {
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
import { toast } from '../hooks/use-toast'

function ConfiguracaoSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true">
        <Skeleton className="h-9 w-80" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}

export function ConfiguracaoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const configuracao = useConfiguracaoProjeto(projetoId ?? '')
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Configurações' }])

  const criarDisciplina = useCriarDisciplina(projetoId ?? '')
  const criarEquipe = useCriarEquipe(projetoId ?? '')
  const criarPessoa = useCriarPessoa(projetoId ?? '')
  const criarMaquina = useCriarMaquina(projetoId ?? '')
  const criarMeta = useCriarMeta(projetoId ?? '')
  const criarValorCusto = useCriarValorCusto(projetoId ?? '')

  const [nomeDisciplina, setNomeDisciplina] = useState('')
  const [nomeEquipe, setNomeEquipe] = useState('')
  const [pessoaNome, setPessoaNome] = useState('')
  const [pessoaFuncao, setPessoaFuncao] = useState('')
  const [pessoaEquipeId, setPessoaEquipeId] = useState('')
  const [maquinaCodigo, setMaquinaCodigo] = useState('')
  const [maquinaNome, setMaquinaNome] = useState('')
  const [maquinaEquipeId, setMaquinaEquipeId] = useState('')
  const [metaDisciplinaId, setMetaDisciplinaId] = useState('')
  const [metaValorAlvo, setMetaValorAlvo] = useState('')
  const [metaPeso, setMetaPeso] = useState('')
  const [valorTipo, setValorTipo] = useState<'mao_de_obra' | 'equipamento'>('mao_de_obra')
  const [valorDescricao, setValorDescricao] = useState('')
  const [valorValor, setValorValor] = useState('')
  const [valorFuncao, setValorFuncao] = useState('')
  const [valorMaquinaId, setValorMaquinaId] = useState('')

  if (configuracao.isLoading) return <ConfiguracaoSkeleton />
  if (configuracao.isError || !configuracao.data) {
    return (
      <ErrorRetry
        message="Não foi possível carregar a configuração do projeto."
        onRetry={() => void configuracao.refetch()}
      />
    )
  }

  const { disciplinas, equipes, metas, valores_custo: valoresCusto, soma_pesos_metas: somaPesos } =
    configuracao.data

  return (
    <main aria-label="Configurações do projeto">
      <PageHeader title="Configurações" breadcrumbs={breadcrumbs} />

      <Tabs defaultValue="disciplinas">
        <TabsList aria-label="Seções de configuração">
          <TabsTrigger value="disciplinas">Disciplinas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="valores">Valores</TabsTrigger>
        </TabsList>

        <TabsContent value="disciplinas">
          <Card title="Disciplinas">
            <div aria-label="Disciplinas">
              {disciplinas.length === 0 && <EmptyState>Nenhuma disciplina cadastrada ainda.</EmptyState>}
              <ul className="mb-4 flex flex-col gap-2">
                {disciplinas.map((disciplina) => (
                  <li
                    className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-ink"
                    key={disciplina.id}
                  >
                    <BookOpen size={14} className="text-primary" aria-hidden="true" />
                    {disciplina.nome}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <FormField id="nova-disciplina" label="Nova disciplina">
                  <Input id="nova-disciplina" value={nomeDisciplina} onChange={(event) => setNomeDisciplina(event.target.value)} />
                </FormField>
                <Button
                  onClick={() =>
                    criarDisciplina.mutate(nomeDisciplina, {
                      onSuccess: () => setNomeDisciplina(''),
                      onError: () => toast({ title: 'Não foi possível criar a disciplina.', variant: 'destructive' }),
                    })
                  }
                  disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
                >
                  Adicionar disciplina
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="metas">
          <Card title="Metas">
            <div aria-label="Metas">
              {metas.length === 0 && <EmptyState>Nenhuma meta cadastrada ainda.</EmptyState>}
              <ul className="mb-4 flex flex-col gap-2">
                {metas.map((meta) => (
                  <li
                    key={meta.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm text-ink"
                  >
                    <span className="flex items-center gap-2">
                      <Target size={14} className="text-primary" aria-hidden="true" />
                      {disciplinas.find((d) => d.id === meta.disciplina)?.nome ?? meta.disciplina}: {meta.valor_alvo}
                    </span>
                    {meta.peso_percentual && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {meta.peso_percentual}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mb-4 text-sm text-muted-foreground">Soma dos pesos: {somaPesos}%</p>
              {Math.abs(somaPesos - 100) > 0.01 && somaPesos > 0 && (
                <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
                  Atenção: a soma dos pesos das metas não fecha 100%.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <SelectField
                  id="meta-disciplina"
                  label="Disciplina"
                  value={metaDisciplinaId}
                  onChange={setMetaDisciplinaId}
                  options={disciplinas.map((disciplina) => ({ value: disciplina.id, label: disciplina.nome }))}
                />
                <FormField id="meta-valor" label="Valor alvo">
                  <Input id="meta-valor" value={metaValorAlvo} onChange={(event) => setMetaValorAlvo(event.target.value)} />
                </FormField>
                <FormField id="meta-peso" label="Peso (%)">
                  <Input id="meta-peso" value={metaPeso} onChange={(event) => setMetaPeso(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!metaDisciplinaId || !metaValorAlvo || criarMeta.isPending}
                    onClick={() =>
                      criarMeta.mutate(
                        {
                          disciplina: metaDisciplinaId,
                          unidade: disciplinas.find((d) => d.id === metaDisciplinaId)?.servicos[0]?.unidade ?? 0,
                          valor_alvo: metaValorAlvo,
                          peso_percentual: metaPeso || undefined,
                        },
                        {
                          onSuccess: () => { setMetaValorAlvo(''); setMetaPeso('') },
                          onError: () => toast({ title: 'Não foi possível criar a meta.', variant: 'destructive' }),
                        },
                      )
                    }
                  >
                    Adicionar meta
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="equipes">
          <Card title="Equipes">
            <div aria-label="Equipes">
              {equipes.length === 0 && <EmptyState>Nenhuma equipe cadastrada ainda.</EmptyState>}
              <ul className="mb-4 flex flex-col gap-2">
                {equipes.map((equipe) => (
                  <li className="rounded-lg border border-border p-3 text-sm" key={equipe.id}>
                    <p className="mb-2 flex items-center gap-2 font-display font-bold text-ink">
                      <HardHat size={14} className="text-primary" aria-hidden="true" />
                      {equipe.nome}
                    </p>
                    {equipe.pessoas.length === 0 && equipe.maquinas.length === 0 ? (
                      <p className="pl-5 text-xs text-muted-foreground">Sem pessoas ou máquinas ainda.</p>
                    ) : (
                      <ul className="flex flex-col gap-1 pl-5 text-muted-foreground">
                        {equipe.pessoas.map((pessoa) => (
                          <li key={pessoa.id} className="flex items-center gap-2">
                            <Users size={12} aria-hidden="true" />
                            {pessoa.nome} — {pessoa.funcao}
                          </li>
                        ))}
                        {equipe.maquinas.map((maquina) => (
                          <li key={maquina.id} className="flex items-center gap-2">
                            <Truck size={12} aria-hidden="true" />
                            {maquina.nome} ({maquina.codigo})
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mb-6 flex flex-wrap items-end gap-3">
                <FormField id="nova-equipe" label="Nova equipe">
                  <Input id="nova-equipe" value={nomeEquipe} onChange={(event) => setNomeEquipe(event.target.value)} />
                </FormField>
                <Button
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

              <h5 className="mb-3 font-display text-sm font-semibold text-ink">Adicionar pessoa</h5>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <SelectField
                  id="pessoa-equipe"
                  label="Equipe"
                  value={pessoaEquipeId}
                  onChange={setPessoaEquipeId}
                  options={equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))}
                />
                <FormField id="pessoa-nome" label="Nome">
                  <Input id="pessoa-nome" value={pessoaNome} onChange={(event) => setPessoaNome(event.target.value)} />
                </FormField>
                <FormField id="pessoa-funcao" label="Função">
                  <Input id="pessoa-funcao" value={pessoaFuncao} onChange={(event) => setPessoaFuncao(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!pessoaEquipeId || !pessoaNome.trim() || criarPessoa.isPending}
                    onClick={() =>
                      criarPessoa.mutate(
                        { equipeId: pessoaEquipeId, nome: pessoaNome, funcao: pessoaFuncao },
                        {
                          onSuccess: () => { setPessoaNome(''); setPessoaFuncao('') },
                          onError: () => toast({ title: 'Não foi possível adicionar a pessoa.', variant: 'destructive' }),
                        },
                      )
                    }
                  >
                    Adicionar pessoa
                  </Button>
                </div>
              </div>

              <h5 className="mb-3 font-display text-sm font-semibold text-ink">Adicionar máquina</h5>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <SelectField
                  id="maquina-equipe"
                  label="Equipe"
                  value={maquinaEquipeId}
                  onChange={setMaquinaEquipeId}
                  options={equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))}
                />
                <FormField id="maquina-codigo" label="Código">
                  <Input id="maquina-codigo" value={maquinaCodigo} onChange={(event) => setMaquinaCodigo(event.target.value)} />
                </FormField>
                <FormField id="maquina-nome" label="Nome">
                  <Input id="maquina-nome" value={maquinaNome} onChange={(event) => setMaquinaNome(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!maquinaEquipeId || !maquinaNome.trim() || criarMaquina.isPending}
                    onClick={() =>
                      criarMaquina.mutate(
                        { equipeId: maquinaEquipeId, codigo: maquinaCodigo, nome: maquinaNome },
                        {
                          onSuccess: () => { setMaquinaCodigo(''); setMaquinaNome('') },
                          onError: () => toast({ title: 'Não foi possível adicionar a máquina.', variant: 'destructive' }),
                        },
                      )
                    }
                  >
                    Adicionar máquina
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="valores">
          <Card title="Valores">
            <div aria-label="Valores de custo">
              {valoresCusto.length === 0 && <EmptyState>Nenhum valor cadastrado ainda.</EmptyState>}
              <ul className="mb-4 flex flex-col gap-2">
                {valoresCusto.map((valor) => (
                  <li
                    key={valor.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm text-ink"
                  >
                    <span className="flex items-center gap-2">
                      {valor.tipo === 'mao_de_obra' ? (
                        <Users size={14} className="text-primary" aria-hidden="true" />
                      ) : (
                        <Truck size={14} className="text-primary" aria-hidden="true" />
                      )}
                      {valor.descricao}
                      {valor.funcao && ` — ${valor.funcao}`}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-xs font-semibold text-ink">
                      <DollarSign size={12} className="text-emerald-600" aria-hidden="true" />
                      {valor.valor}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
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
                    options={equipes.flatMap((equipe) =>
                      equipe.maquinas.map((maquina) => ({
                        value: maquina.id,
                        label: `${maquina.nome} (${maquina.codigo})`,
                      })),
                    )}
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
                <div className="flex items-end">
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
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}
