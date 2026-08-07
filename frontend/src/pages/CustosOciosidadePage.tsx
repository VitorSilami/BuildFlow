import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  AppStatCard,
  AppStatusBadge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorRetry,
  ForbiddenState,
  FormField,
  Input,
  PageHeader,
  Progress,
  Skeleton,
  type DataTableColumn,
} from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { CustoCompositionDonutChart } from '../features/custos-ociosidade/CustoCompositionDonutChart'
import { useCustosOciosidade } from '../features/custos-ociosidade/custosOciosidadeApi'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { execucaoCorClasse, formatMoeda } from '../lib/format'
import type {
  CustosOciosidade,
  FaltaPorPessoa,
  HorasOciosasPorCausa,
  MaoDeObraPorFuncao,
  MaquinaPorEquipamento,
} from '../types/custoOciosidade'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gauge,
  TimerOff,
  TrendingDown,
  Truck,
  Users,
} from 'lucide-react'

function mesAtualFiltro(): string {
  return new Date().toISOString().slice(0, 7)
}

function numero(valor: string | number | null | undefined): number {
  return Number(valor ?? 0)
}

function formatPercentual(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '-'
  return `${Math.round(valor)}%`
}

function percentual(parte: number, total: number): number {
  if (total <= 0) return 0
  return Math.min((parte / total) * 100, 100)
}

function formatMes(mes: string): string {
  const [ano, mesNumero] = mes.split('-').map(Number)
  if (!ano || !mesNumero) return mes
  return new Date(ano, mesNumero - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

function alterarMes(mes: string, deslocamento: number): string {
  const [ano, mesNumero] = mes.split('-').map(Number)
  const data = new Date(ano, mesNumero - 1 + deslocamento, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function CustosOciosidadeSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando...
      </span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    </>
  )
}

function SemValorDefinido() {
  return (
    <span className="ml-2 inline-flex rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-warning">
      sem valor definido
    </span>
  )
}

function LinhaDiagnostico({
  label,
  valor,
  detalhe,
  percentualValor,
  tone,
}: {
  label: string
  valor: string
  detalhe: string
  percentualValor: number
  tone: 'danger' | 'warning' | 'success' | 'neutral'
}) {
  const corBarra = {
    danger: 'bg-danger',
    warning: 'bg-warning',
    success: 'bg-success',
    neutral: 'bg-info',
  }[tone]

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-muted-foreground">{detalhe}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-ink">{valor}</span>
      </div>
      <Progress value={percentualValor} indicatorClassName={corBarra} className="h-2 bg-muted" />
    </div>
  )
}

function RankingItem({
  posicao,
  titulo,
  subtitulo,
  valor,
  tone = 'warning',
}: {
  posicao: number
  titulo: string
  subtitulo: string
  valor: string
  tone?: 'warning' | 'danger' | 'neutral'
}) {
  const toneClass = {
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/30 bg-danger/10 text-danger',
    neutral: 'border-border bg-card text-ink',
  }[tone]

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info/10 font-mono text-xs font-bold text-info">
        {posicao}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{titulo}</p>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${toneClass}`}>
        {valor}
      </span>
    </li>
  )
}

function BarraComparativa({
  label,
  principal,
  secundario,
  labelPrincipal,
  labelSecundario,
  maximo,
}: {
  label: string
  principal: number
  secundario: number
  labelPrincipal: string
  labelSecundario: string
  maximo: number
}) {
  const pctPrincipal = percentual(principal, maximo)
  const pctSecundario = percentual(secundario, maximo)

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-muted-foreground">
            {labelPrincipal}: {formatMoeda(String(principal))} · {labelSecundario}:{' '}
            {formatMoeda(String(secundario))}
          </p>
        </div>
        {secundario > 0 && <TrendingDown className="size-4 shrink-0 text-danger" aria-hidden="true" />}
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-success" style={{ width: `${pctPrincipal}%` }} />
        <div className="h-full bg-danger" style={{ width: `${pctSecundario}%` }} />
      </div>
    </div>
  )
}

function BarraHoras({ item, maximo }: { item: HorasOciosasPorCausa; maximo: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{item.motivo}</span>
        <span className="font-mono text-xs text-muted-foreground">{item.horas}h</span>
      </div>
      <Progress value={percentual(numero(item.horas), maximo)} indicatorClassName="bg-warning" className="h-2 bg-muted" />
    </div>
  )
}

function CustosOciosidadeConteudo({ dados }: { dados: CustosOciosidade }) {
  const resumo = useMemo(() => {
    const custoMaoDeObra = numero(dados.custo_mao_de_obra)
    const deficitMaoDeObra = numero(dados.deficit_mao_de_obra)
    const custoProdutivoMaquinas = numero(dados.custo_produtivo_maquinas)
    const custoOciosoMaquinas = numero(dados.custo_ocioso_maquinas)
    const custoTotal = numero(dados.custo_total)
    const ociosidadeEvitavel = numero(dados.ociosidade_evitavel_total)
    const horasOciosas = numero(dados.horas_ociosas_total)
    const custoMaquinasTotal = custoProdutivoMaquinas + custoOciosoMaquinas
    const custoOperado = Math.max(custoTotal - ociosidadeEvitavel, 0)

    const maquinasOrdenadas = [...dados.maquinas_por_equipamento].sort(
      (a, b) => numero(b.custo_ocioso) - numero(a.custo_ocioso),
    )
    const faltasOrdenadas = [...dados.faltas_por_pessoa].sort(
      (a, b) => numero(b.valor_perdido) - numero(a.valor_perdido),
    )
    const causasOrdenadas = [...dados.horas_ociosas_por_causa].sort(
      (a, b) => numero(b.horas) - numero(a.horas),
    )
    const funcoesOrdenadas = [...dados.mao_de_obra_por_funcao].sort(
      (a, b) => numero(b.deficit) - numero(a.deficit),
    )

    return {
      custoMaoDeObra,
      deficitMaoDeObra,
      custoProdutivoMaquinas,
      custoOciosoMaquinas,
      custoTotal,
      ociosidadeEvitavel,
      horasOciosas,
      custoMaquinasTotal,
      custoOperado,
      maquinasOrdenadas,
      faltasOrdenadas,
      causasOrdenadas,
      funcoesOrdenadas,
      percentualOciosidade: percentual(ociosidadeEvitavel, custoTotal),
      percentualMaquinaParada: percentual(custoOciosoMaquinas, custoMaquinasTotal),
      percentualDeficitMaoDeObra: percentual(deficitMaoDeObra, custoMaoDeObra + deficitMaoDeObra),
    }
  }, [dados])

  const eficiencia = dados.eficiencia_gerencial_percentual
  const principalMaquina = resumo.maquinasOrdenadas[0]
  const principalFalta = resumo.faltasOrdenadas[0]
  const principalCausa = resumo.causasOrdenadas[0]
  const maximoFuncao = Math.max(
    ...resumo.funcoesOrdenadas.map((item) => numero(item.custo) + numero(item.deficit)),
    1,
  )
  const maximoMaquina = Math.max(
    ...resumo.maquinasOrdenadas.map((item) => numero(item.custo_produtivo) + numero(item.custo_ocioso)),
    1,
  )
  const maximoHoras = Math.max(...resumo.causasOrdenadas.map((item) => numero(item.horas)), 1)

  const colunasMaquinas: Array<DataTableColumn<MaquinaPorEquipamento>> = [
    {
      id: 'equipamento',
      header: 'Equipamento',
      cell: (item) => (
        <div>
          <p className="font-semibold text-ink">{item.codigo}</p>
          <p className="text-xs text-muted-foreground">
            {item.nome} · {item.equipe_nome}
          </p>
        </div>
      ),
    },
    {
      id: 'eficiencia',
      header: 'Eficiência',
      cell: (item) => (
        <div className="flex min-w-40 items-center gap-3">
          <Progress
            value={item.eficiencia_percentual ?? 0}
            indicatorClassName={execucaoCorClasse(
              item.eficiencia_percentual === null ? null : String(item.eficiencia_percentual),
            )}
            className="h-2 w-28 shrink-0 bg-muted"
          />
          <span className="text-sm font-semibold text-ink">{formatPercentual(item.eficiencia_percentual)}</span>
        </div>
      ),
    },
    {
      id: 'horas',
      header: 'Horas',
      cell: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.horas_produtivas}h prod. · {item.horas_paradas}h par.
        </span>
      ),
    },
    {
      id: 'custo',
      header: 'Custo parado',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (item) => (
        <>
          <span className="font-semibold text-danger">
            {formatMoeda(item.custo_ocioso)}
          </span>
          {!item.tem_valor_cadastrado && <SemValorDefinido />}
        </>
      ),
    },
  ]

  const colunasFaltas: Array<DataTableColumn<FaltaPorPessoa>> = [
    {
      id: 'pessoa',
      header: 'Prestador',
      cell: (item) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{item.nome}</p>
            {item.reincidente && <AppStatusBadge tone="danger" label="reincidente" />}
          </div>
          <p className="text-xs text-muted-foreground">{item.funcao}</p>
        </div>
      ),
    },
    {
      id: 'ocorrencias',
      header: 'Ocorrências',
      cell: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.faltas} falta(s) · {item.atestados} atestado(s)
        </span>
      ),
    },
    {
      id: 'valor',
      header: 'Valor perdido',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (item) => (
        <>
          <span className="font-semibold text-danger">
            {formatMoeda(item.valor_perdido)}
          </span>
          {!item.tem_valor_cadastrado && <SemValorDefinido />}
        </>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <AppStatusBadge
                tone={resumo.ociosidadeEvitavel > 0 ? 'danger' : 'success'}
                label={resumo.ociosidadeEvitavel > 0 ? 'Perda evitável detectada' : 'Sem perda evitável'}
                icon={resumo.ociosidadeEvitavel > 0 ? <AlertTriangle className="size-3" /> : <Gauge className="size-3" />}
              />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {formatMes(dados.mes)}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Custo total do mês
                </p>
                <p className="mt-1 font-display text-4xl font-bold text-ink">
                  {formatMoeda(dados.custo_total)}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {formatMoeda(dados.ociosidade_evitavel_total)} estão classificados como ociosidade
                  evitável entre faltas, déficit de mão de obra e máquinas paradas.
                </p>
              </div>
              <div className="rounded-lg border border-danger/25 bg-danger/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-danger">
                  <ArrowDownRight className="size-4" aria-hidden="true" />
                  Dinheiro em risco
                </p>
                <p className="mt-2 font-display text-3xl font-bold text-danger">
                  {formatMoeda(dados.ociosidade_evitavel_total)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Math.round(resumo.percentualOciosidade)}% do custo total pode virar plano de ação.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AppStatCard label="Eficiência" value={formatPercentual(eficiencia)} icon={<Gauge size={18} />} />
            <AppStatCard
              label="Horas paradas"
              value={`${resumo.horasOciosas}h`}
              tone={resumo.horasOciosas > 0 ? 'warning' : 'success'}
              icon={<TimerOff size={18} />}
            />
            <AppStatCard label="Mão de obra" value={formatMoeda(dados.custo_mao_de_obra)} icon={<Users size={18} />} />
            <AppStatCard label="Máquinas" value={formatMoeda(dados.custo_produtivo_maquinas)} icon={<Truck size={18} />} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
        <Card
          title="Diagnóstico financeiro"
          eyebrow={
            <>
              <Banknote className="size-3" aria-hidden="true" />
              perdas por origem
            </>
          }
          className="mb-0"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <LinhaDiagnostico
              label="Ociosidade evitável"
              valor={formatMoeda(dados.ociosidade_evitavel_total)}
              detalhe={`${Math.round(resumo.percentualOciosidade)}% do custo total`}
              percentualValor={resumo.percentualOciosidade}
              tone="danger"
            />
            <LinhaDiagnostico
              label="Máquinas paradas"
              valor={formatMoeda(dados.custo_ocioso_maquinas)}
              detalhe={`${Math.round(resumo.percentualMaquinaParada)}% do custo de máquinas`}
              percentualValor={resumo.percentualMaquinaParada}
              tone="warning"
            />
            <LinhaDiagnostico
              label="Déficit de mão de obra"
              valor={formatMoeda(dados.deficit_mao_de_obra)}
              detalhe={`${Math.round(resumo.percentualDeficitMaoDeObra)}% da base de mão de obra`}
              percentualValor={resumo.percentualDeficitMaoDeObra}
              tone="warning"
            />
            <LinhaDiagnostico
              label="Custo operado"
              valor={formatMoeda(String(resumo.custoOperado))}
              detalhe="custo produtivo sem perdas evitáveis"
              percentualValor={percentual(resumo.custoOperado, resumo.custoTotal)}
              tone="success"
            />
          </div>
        </Card>

        <Card
          title="Composição"
          eyebrow={
            <>
              <ArrowUpRight className="size-3" aria-hidden="true" />
              base de custo
            </>
          }
          className="mb-0"
        >
          <CustoCompositionDonutChart
            custoMaoDeObra={resumo.custoMaoDeObra}
            custoProdutivoMaquinas={resumo.custoProdutivoMaquinas}
            custoOciosoMaquinas={resumo.custoOciosoMaquinas}
          />
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Mão de obra</span>
              <span className="font-semibold text-ink">{formatMoeda(dados.custo_mao_de_obra)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Máquinas produtivas</span>
              <span className="font-semibold text-ink">{formatMoeda(dados.custo_produtivo_maquinas)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Máquinas ociosas</span>
              <span className="font-semibold text-danger">
                {formatMoeda(dados.custo_ocioso_maquinas)}
              </span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
        <Card
          title="Máquinas críticas"
          eyebrow={
            <>
              <Truck className="size-3" aria-hidden="true" />
              eficiência e custo parado
            </>
          }
          className="mb-0"
        >
          <DataTable
            ariaLabel="Eficiência e custo parado por equipamento"
            data={resumo.maquinasOrdenadas}
            columns={colunasMaquinas}
            getRowKey={(item) => item.maquina_id}
            emptyTitle="Nenhum apontamento de máquina no mês."
            emptyMessage="Quando houver RDO aprovado com máquina, o ranking aparecerá aqui."
          />
        </Card>

        <Card
          title="Alvos do mês"
          eyebrow={
            <>
              <AlertTriangle className="size-3" aria-hidden="true" />
              priorização
            </>
          }
          className="mb-0"
        >
          <ol className="space-y-3">
            {principalMaquina && (
              <RankingItem
                posicao={1}
                titulo={principalMaquina.codigo}
                subtitulo={`${principalMaquina.nome} · ${principalMaquina.horas_paradas}h paradas`}
                valor={formatMoeda(principalMaquina.custo_ocioso)}
                tone="danger"
              />
            )}
            {principalFalta && (
              <RankingItem
                posicao={2}
                titulo={principalFalta.nome}
                subtitulo={`${principalFalta.faltas} falta(s) · ${principalFalta.funcao}`}
                valor={formatMoeda(principalFalta.valor_perdido)}
                tone="warning"
              />
            )}
            {principalCausa && (
              <RankingItem
                posicao={3}
                titulo={principalCausa.motivo}
                subtitulo="maior causa de horas ociosas"
                valor={`${principalCausa.horas}h`}
                tone="neutral"
              />
            )}
            {!principalMaquina && !principalFalta && !principalCausa && (
              <EmptyState title="Sem alvos no mês.">
                Não há perda operacional registrada para priorizar.
              </EmptyState>
            )}
          </ol>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title="Mão de obra por função"
          eyebrow={
            <>
              <Users className="size-3" aria-hidden="true" />
              trabalhado vs. déficit
            </>
          }
          className="mb-0"
        >
          {resumo.funcoesOrdenadas.length === 0 ? (
            <EmptyState title="Nenhuma presença registrada no mês.">
              A análise de mão de obra depende dos RDOs aprovados.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {resumo.funcoesOrdenadas.map((item: MaoDeObraPorFuncao) => (
                <BarraComparativa
                  key={item.funcao}
                  label={item.funcao}
                  principal={numero(item.custo)}
                  secundario={numero(item.deficit)}
                  labelPrincipal="Trabalhado"
                  labelSecundario="Déficit"
                  maximo={maximoFuncao}
                />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Custo por equipamento"
          eyebrow={
            <>
              <TimerOff className="size-3" aria-hidden="true" />
              produtivo vs. parado
            </>
          }
          className="mb-0"
        >
          {resumo.maquinasOrdenadas.length === 0 ? (
            <EmptyState title="Nenhum apontamento de máquina no mês.">
              A composição aparece quando houver horas de máquina no RDO.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {resumo.maquinasOrdenadas.map((item: MaquinaPorEquipamento) => (
                <BarraComparativa
                  key={item.maquina_id}
                  label={`${item.nome} (${item.codigo})`}
                  principal={numero(item.custo_produtivo)}
                  secundario={numero(item.custo_ocioso)}
                  labelPrincipal="Produtivo"
                  labelSecundario="Parado"
                  maximo={maximoMaquina}
                />
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card
          title="Horas ociosas por causa"
          eyebrow={
            <>
              <CalendarDays className="size-3" aria-hidden="true" />
              causas registradas
            </>
          }
          className="mb-0"
        >
          {resumo.causasOrdenadas.length === 0 ? (
            <EmptyState title="Nenhuma hora ociosa registrada no mês.">
              Ocorrências de parada aparecerão neste painel.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {resumo.causasOrdenadas.map((item) => (
                <BarraHoras key={item.motivo} item={item} maximo={maximoHoras} />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Faltas por pessoa"
          eyebrow={
            <>
              <TrendingDown className="size-3" aria-hidden="true" />
              valor perdido
            </>
          }
          className="mb-0"
        >
          <DataTable
            ariaLabel="Faltas por pessoa"
            data={resumo.faltasOrdenadas}
            columns={colunasFaltas}
            getRowKey={(item) => item.pessoa_id ?? item.nome}
            emptyTitle="Nenhuma falta registrada no mês."
            emptyMessage="Quando houver ausência apontada no RDO, ela aparecerá aqui."
          />
        </Card>
      </section>
    </div>
  )
}

export function CustosOciosidadePage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { user } = useAuth()
  const [mes, setMes] = useState(mesAtualFiltro())
  const ehGerente = user?.perfil === 'gerente'
  const custos = useCustosOciosidade(projetoId ?? '', mes, ehGerente)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Custos & Ociosidade' }])

  if (!ehGerente) {
    return (
      <main aria-label="Custos e ociosidade">
        <PageHeader title="Custos & Ociosidade" breadcrumbs={breadcrumbs} />
        <ForbiddenState message="Esta tela é restrita ao perfil Gerente." />
      </main>
    )
  }

  return (
    <main aria-label="Custos e ociosidade">
      <PageHeader
        title="Custos & Ociosidade"
        subtitle="Impacto financeiro da mão de obra, máquinas paradas e perdas evitáveis por mês."
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setMes((valor) => alterarMes(valor, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <FormField id="custos-mes-referencia" label="Mês de referência" className="mb-0 min-w-44">
              <Input
                id="custos-mes-referencia"
                type="month"
                aria-label="Mês de referência"
                value={mes}
                onChange={(event) => setMes(event.target.value)}
              />
            </FormField>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
              onClick={() => setMes((valor) => alterarMes(valor, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        }
      />

      {custos.isLoading && <CustosOciosidadeSkeleton />}

      {custos.isError && (
        <ErrorRetry
          message="Não foi possível carregar os custos do mês."
          onRetry={() => void custos.refetch()}
        />
      )}

      {!custos.isLoading && !custos.isError && custos.data && (
        <CustosOciosidadeConteudo dados={custos.data} />
      )}
    </main>
  )
}
