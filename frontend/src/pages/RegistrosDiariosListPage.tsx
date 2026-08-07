import { useState } from 'react'
import { AlertTriangle, CalendarCheck2, ClipboardList, Clock3, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppStatCard, AppStatusBadge, Button, Card, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import {
  CalendarioMensal,
  type DiaCalendario,
  type MesAno,
} from '../features/registros-diarios/CalendarioMensal'
import { ICONE_CLIMA, LABEL_CLIMA, LABEL_TURNO } from '../features/registros-diarios/climaIcons'
import { useRegistrosDiarios } from '../features/registros-diarios/registrosDiariosApi'
import {
  STATUS_REGISTRO_ICON,
  STATUS_REGISTRO_LABEL,
  STATUS_REGISTRO_TONE,
} from '../features/registros-diarios/statusRegistroBadge'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { formatData } from '../lib/format'
import type { RegistroDiario, StatusRegistro } from '../types/registroDiario'

function mesAnoAtual(): MesAno {
  const hoje = new Date()
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }
}

function mesAnterior(mesAno: MesAno): MesAno {
  return mesAno.mes === 1
    ? { ano: mesAno.ano - 1, mes: 12 }
    : { ano: mesAno.ano, mes: mesAno.mes - 1 }
}

function mesSeguinte(mesAno: MesAno): MesAno {
  return mesAno.mes === 12
    ? { ano: mesAno.ano + 1, mes: 1 }
    : { ano: mesAno.ano, mes: mesAno.mes + 1 }
}

function formatarMesParaFiltro(mesAno: MesAno): string {
  return `${mesAno.ano}-${String(mesAno.mes).padStart(2, '0')}`
}

function RegistroStatusBadge({ status }: { status: StatusRegistro }) {
  const Icon = STATUS_REGISTRO_ICON[status]
  return (
    <AppStatusBadge
      tone={STATUS_REGISTRO_TONE[status]}
      label={STATUS_REGISTRO_LABEL[status]}
      icon={<Icon size={12} aria-hidden="true" />}
    />
  )
}

function contarPorStatus(registros: RegistroDiario[], status: StatusRegistro): number {
  return registros.filter((registro) => registro.status === status).length
}

function diasComRegistro(registros: RegistroDiario[]): number {
  return new Set(registros.map((registro) => registro.data_referencia)).size
}

function RegistroDiaLink({ projetoId, registro }: { projetoId: string | undefined; registro: RegistroDiario }) {
  return (
    <Link
      to={`/projetos/${projetoId}/registros-diarios/${registro.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-medium text-ink">
          {ICONE_CLIMA[registro.clima]}
          {LABEL_TURNO[registro.turno]} · {LABEL_CLIMA[registro.clima]}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {registro.equipe_nome ? registro.equipe_nome : 'Equipe nao informada'}
        </span>
      </span>
      <RegistroStatusBadge status={registro.status} />
    </Link>
  )
}

function CalendarioSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando registros...</span>
      <div aria-hidden="true">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mb-4 h-12 w-full" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      </div>
    </>
  )
}

export function RegistrosDiariosListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const navigate = useNavigate()
  const [mesAno, setMesAno] = useState<MesAno>(mesAnoAtual)
  const [diaSelecionado, setDiaSelecionado] = useState<DiaCalendario | null>(null)

  const { data, isLoading, isError, refetch } = useRegistrosDiarios(projetoId ?? '', {
    mes: formatarMesParaFiltro(mesAno),
  })
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Registros diários' }])

  function irParaMes(novoMesAno: MesAno) {
    setDiaSelecionado(null)
    setMesAno(novoMesAno)
  }

  function handleDiaClick(dia: DiaCalendario) {
    if (dia.registros.length === 0) {
      navigate(`/projetos/${projetoId}/registros-diarios/novo?data=${dia.data}`)
      return
    }
    if (dia.registros.length === 1) {
      navigate(`/projetos/${projetoId}/registros-diarios/${dia.registros[0].id}`)
      return
    }
    setDiaSelecionado(dia)
  }

  const registros = data?.results ?? []
  const totalRegistros = registros.length
  const aguardandoAprovacao = contarPorStatus(registros, 'aguardando_aprovacao')
  const rejeitados = contarPorStatus(registros, 'rejeitado')
  const aprovados = contarPorStatus(registros, 'aprovado')

  return (
    <main aria-label="Registros diários">
      <PageHeader
        title="Registros diários"
        subtitle="Acompanhe a rotina de RDOs do mês, abra dias pendentes e consulte registros enviados."
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={`/projetos/${projetoId}/historico-aprovacoes`}>
                <Clock3 size={16} aria-hidden="true" />
                Aprovações
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/projetos/${projetoId}/registros-diarios/novo`}>
                <Plus size={16} aria-hidden="true" />
                Novo registro diário
              </Link>
            </Button>
          </div>
        }
      />

      {isLoading && <CalendarioSkeleton />}

      {isError && (
        <ErrorRetry
          message="Não foi possível carregar os registros diários."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <section className="space-y-5" aria-labelledby="registros-diarios-resumo">
          <h2 id="registros-diarios-resumo" className="sr-only">Resumo dos registros diários</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AppStatCard label="RDOs no mês" value={totalRegistros} icon={<ClipboardList size={18} />} />
            <AppStatCard label="Dias cobertos" value={diasComRegistro(registros)} icon={<CalendarCheck2 size={18} />} />
            <AppStatCard
              label="Aguardando"
              value={aguardandoAprovacao}
              tone={aguardandoAprovacao > 0 ? 'warning' : 'neutral'}
              icon={<Clock3 size={18} />}
            />
            <AppStatCard
              label="Rejeitados"
              value={rejeitados}
              tone={rejeitados > 0 ? 'danger' : 'success'}
              icon={<AlertTriangle size={18} />}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card
              title="Calendário mensal"
              eyebrow={`${aprovados} aprovado(s) no mês`}
              actions={
                <div className="hidden flex-wrap items-center gap-2 md:flex" aria-label="Legenda de status dos registros">
                  {(Object.keys(STATUS_REGISTRO_LABEL) as StatusRegistro[]).map((status) => (
                    <RegistroStatusBadge key={status} status={status} />
                  ))}
                </div>
              }
              className="mb-0"
            >
              <CalendarioMensal
                mesAno={mesAno}
                registros={registros}
                onMesAnteriorClick={() => irParaMes(mesAnterior(mesAno))}
                onMesSeguinteClick={() => irParaMes(mesSeguinte(mesAno))}
                onHojeClick={() => irParaMes(mesAnoAtual())}
                onDiaClick={handleDiaClick}
              />
            </Card>

            <Card
              title={diaSelecionado ? `Registros de ${formatData(diaSelecionado.data)}` : 'Dia selecionado'}
              eyebrow={diaSelecionado ? `${diaSelecionado.registros.length} RDO(s)` : 'Calendário'}
              className="mb-0"
            >
              {diaSelecionado ? (
                <>
                  <ul className="flex flex-col gap-2" aria-label="Registros do dia selecionado">
                    {diaSelecionado.registros.map((registro) => (
                      <li key={registro.id}>
                        <RegistroDiaLink projetoId={projetoId} registro={registro} />
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="mt-4 w-full" onClick={() => setDiaSelecionado(null)}>
                    Fechar
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Selecione um dia com múltiplos RDOs para comparar turnos e abrir o detalhe sem sair do calendário.
                </div>
              )}
            </Card>
          </div>
        </section>
      )}
    </main>
  )
}
