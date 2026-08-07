import {
  Camera,
  CheckCircle2,
  Clock3,
  CloudSun,
  FileText,
  Gauge,
  HardHat,
  MapPin,
  Truck,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AppStatCard,
  AppStatusBadge,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorRetry,
  PageHeader,
  Progress,
  Skeleton,
} from '../components/ui'
import type { BadgeTone } from '../components/ui'
import { ICONE_CLIMA, LABEL_CLIMA, LABEL_TURNO } from '../features/registros-diarios/climaIcons'
import { FotoUpload } from '../features/registros-diarios/FotoUpload'
import { useRegistroDiario } from '../features/registros-diarios/registrosDiariosApi'
import {
  STATUS_REGISTRO_ICON,
  STATUS_REGISTRO_LABEL,
  STATUS_REGISTRO_TONE,
} from '../features/registros-diarios/statusRegistroBadge'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { execucaoCorClasse, formatData } from '../lib/format'
import type {
  ApontamentoMaquina,
  Ocorrencia,
  Presenca,
  Producao,
  RegistroDiario,
  StatusPresenca,
} from '../types/registroDiario'

function RegistroDiarioDetailSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando...</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    </>
  )
}

const LABEL_STATUS_PRESENCA: Record<StatusPresenca, string> = {
  presente: 'Presente',
  falta: 'Falta',
  atestado: 'Atestado',
}

const TONE_STATUS_PRESENCA: Record<StatusPresenca, BadgeTone> = {
  presente: 'success',
  falta: 'danger',
  atestado: 'warning',
}

const ICON_STATUS_PRESENCA: Record<StatusPresenca, typeof CheckCircle2> = {
  presente: CheckCircle2,
  falta: XCircle,
  atestado: FileText,
}

function numero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0
  const normalizado = String(valor).replace(',', '.')
  const parsed = Number(normalizado)
  return Number.isFinite(parsed) ? parsed : 0
}

function somaQuantidade(producoes: Producao[]): string {
  const total = producoes.reduce((acc, producao) => acc + numero(producao.quantidade), 0)
  return total.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function eficienciaMedia(maquinas: ApontamentoMaquina[]): number {
  if (maquinas.length === 0) return 0
  const media = maquinas.reduce((acc, maquina) => acc + numero(maquina.eficiencia), 0) / maquinas.length
  return Math.round(media * 100)
}

function CampoResumo({ label, valor, icon }: { label: string; valor: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-medium text-ink">
        {icon}
        {valor}
      </p>
    </div>
  )
}

function RegistroStatusBadge({ registro }: { registro: RegistroDiario }) {
  const StatusIcon = STATUS_REGISTRO_ICON[registro.status]
  return (
    <AppStatusBadge
      tone={STATUS_REGISTRO_TONE[registro.status]}
      label={STATUS_REGISTRO_LABEL[registro.status]}
      icon={<StatusIcon size={12} aria-hidden="true" />}
    />
  )
}

function LinhaPresenca({ presenca }: { presenca: Presenca }) {
  const Icon = ICON_STATUS_PRESENCA[presenca.status]
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{presenca.pessoa_nome ?? presenca.nome_avulso}</span>
        <span className="block text-xs text-muted-foreground">{presenca.funcao}</span>
      </span>
      <AppStatusBadge
        tone={TONE_STATUS_PRESENCA[presenca.status]}
        label={LABEL_STATUS_PRESENCA[presenca.status]}
        icon={<Icon size={12} aria-hidden="true" />}
      />
    </li>
  )
}

function CardMaquina({ maquina }: { maquina: ApontamentoMaquina }) {
  const eficienciaPercentual = Math.round(numero(maquina.eficiencia) * 100)
  return (
    <li className="py-3 text-sm">
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <span className="font-medium text-ink">
          {maquina.maquina_nome ?? maquina.identificacao_avulsa}
          {maquina.maquina_codigo && <span className="text-muted-foreground"> ({maquina.maquina_codigo})</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          {maquina.horas_produtivas}h produtivas · {maquina.horas_paradas}h paradas
        </span>
      </div>
      {Number(maquina.horas_paradas) > 0 && maquina.motivo_parada_descricao && (
        <p className="mb-2 text-xs text-muted-foreground">Motivo da parada: {maquina.motivo_parada_descricao}</p>
      )}
      <div className="flex items-center gap-2">
        <Progress
          value={eficienciaPercentual}
          indicatorClassName={execucaoCorClasse(String(eficienciaPercentual))}
          className="h-1.5 flex-1 bg-muted"
        />
        <span className="w-10 text-right text-xs text-muted-foreground">{eficienciaPercentual}%</span>
      </div>
    </li>
  )
}

function OcorrenciasLista({ ocorrencias }: { ocorrencias: Ocorrencia[] }) {
  if (ocorrencias.length === 0) {
    return <EmptyState title="Sem ocorrências">Nenhuma interferência, parada ou observação foi registrada.</EmptyState>
  }

  return (
    <ul className="divide-y divide-border" aria-label="Ocorrências">
      {ocorrencias.map((ocorrencia) => (
        <li className="py-3 text-sm" key={ocorrencia.id}>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{ocorrencia.tipo}</Badge>
            {ocorrencia.km && <span className="font-mono text-xs text-muted-foreground">km {ocorrencia.km}</span>}
          </div>
          <p className="text-ink">{ocorrencia.descricao}</p>
          {ocorrencia.recurso_afetado && (
            <p className="mt-1 text-xs text-muted-foreground">Recurso afetado: {ocorrencia.recurso_afetado}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

export function RegistroDiarioDetailPage() {
  const { projetoId, registroId } = useParams<{ projetoId: string; registroId: string }>()
  const { data: registro, isLoading, isError, refetch } = useRegistroDiario(registroId)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
    { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
    { label: registro?.data_referencia ?? '...' },
  ])

  if (isLoading) return <RegistroDiarioDetailSkeleton />

  if (isError || !registro) {
    return <ErrorRetry message="Não foi possível carregar o registro diário." onRetry={() => void refetch()} />
  }

  const eficiencia = eficienciaMedia(registro.maquinas)
  const fotosComKm = registro.fotos.filter((foto) => foto.km).length

  return (
    <main aria-label="Detalhe do registro diário">
      <PageHeader
        title={`Registro diário - ${formatData(registro.data_referencia)}`}
        subtitle="Conferência operacional do turno, produção, equipe, máquinas, ocorrências e evidências."
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <RegistroStatusBadge registro={registro} />
            <Button asChild variant="outline" size="sm">
              <Link to={`/projetos/${projetoId}/registros-diarios`}>Voltar para a lista</Link>
            </Button>
          </div>
        }
      />

      <section className="space-y-5" aria-labelledby="rdo-resumo">
        <h2 id="rdo-resumo" className="sr-only">Resumo do registro diário</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AppStatCard label="Produção total" value={somaQuantidade(registro.producoes)} icon={<Gauge size={18} />} />
          <AppStatCard label="Equipe" value={registro.presencas.length} icon={<Users size={18} />} />
          <AppStatCard
            label="Eficiência média"
            value={`${eficiencia}%`}
            tone={eficiencia >= 80 || registro.maquinas.length === 0 ? 'success' : 'warning'}
            icon={<Truck size={18} />}
          />
          <AppStatCard
            label="Fotos com km"
            value={`${fotosComKm}/${registro.fotos.length}`}
            tone={registro.fotos.length > 0 ? 'success' : 'neutral'}
            icon={<Camera size={18} />}
          />
        </div>

        <Card title="Dados do turno" eyebrow={<RegistroStatusBadge registro={registro} />} className="mb-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CampoResumo label="Turno" valor={LABEL_TURNO[registro.turno]} icon={<Clock3 size={16} aria-hidden="true" />} />
            <CampoResumo
              label="Clima"
              valor={LABEL_CLIMA[registro.clima]}
              icon={ICONE_CLIMA[registro.clima] ?? <CloudSun size={16} aria-hidden="true" />}
            />
            <CampoResumo
              label="Equipe"
              valor={registro.equipe_nome}
              icon={<HardHat size={16} className="text-muted-foreground" aria-hidden="true" />}
            />
            <CampoResumo
              label="Fiscal"
              valor={registro.fiscal_nome}
              icon={<UserCheck size={16} className="text-muted-foreground" aria-hidden="true" />}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card title="Produção" eyebrow={`${registro.producoes.length} lançamento(s)`} className="mb-0">
              {registro.producoes.length === 0 ? (
                <EmptyState>Nenhuma produção registrada.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <DataTable
                    ariaLabel="Produção"
                    data={registro.producoes}
                    getRowKey={(producao, index) => producao.id ?? `${producao.rodovia}-${index}`}
                    columns={[
                      {
                        id: 'trecho',
                        header: 'Trecho',
                        cell: (producao) => (
                          <div className="min-w-52">
                            <p className="flex items-center gap-2 font-medium text-ink">
                              <MapPin size={14} className="text-muted-foreground" aria-hidden="true" />
                              {producao.rodovia}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              km {producao.km_inicial} a {producao.km_final}
                            </p>
                          </div>
                        ),
                      },
                      {
                        id: 'servico',
                        header: 'Serviço',
                        cell: (producao) => (
                          <div className="min-w-48">
                            <p className="font-medium text-ink">{producao.servico_nome}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{producao.disciplina_nome}</p>
                          </div>
                        ),
                      },
                      {
                        id: 'quantidade',
                        header: 'Quantidade',
                        cell: (producao) => (
                          <span className="font-mono font-semibold text-ink">
                            {producao.quantidade} {producao.unidade_sigla}
                          </span>
                        ),
                        className: 'whitespace-nowrap',
                      },
                    ]}
                  />
                </div>
              )}
            </Card>

            <Card title="Ocorrências" eyebrow={`${registro.ocorrencias.length} ocorrência(s)`} className="mb-0">
              <OcorrenciasLista ocorrencias={registro.ocorrencias} />
            </Card>
          </div>

          <aside className="space-y-5">
            <Card title="Equipe" eyebrow={`${registro.presencas.length} pessoa(s)`} className="mb-0">
              {registro.presencas.length === 0 ? (
                <EmptyState>Nenhuma presença registrada.</EmptyState>
              ) : (
                <ul className="divide-y divide-border" aria-label="Presenças">
                  {registro.presencas.map((presenca, index) => (
                    <LinhaPresenca key={presenca.id ?? index} presenca={presenca} />
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Máquinas" eyebrow={`${registro.maquinas.length} máquina(s)`} className="mb-0">
              {registro.maquinas.length === 0 ? (
                <EmptyState>Nenhuma máquina registrada.</EmptyState>
              ) : (
                <ul className="divide-y divide-border" aria-label="Máquinas">
                  {registro.maquinas.map((maquina, index) => (
                    <CardMaquina key={maquina.id ?? index} maquina={maquina} />
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>

        <Card title="Fotos" eyebrow={`${registro.fotos.length} evidência(s)`} className="mb-0">
          {registro.fotos.length === 0 && <EmptyState>Nenhuma foto anexada ainda.</EmptyState>}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Fotos">
            {registro.fotos.map((foto) => (
              <figure className="m-0 overflow-hidden rounded-lg border border-border bg-card" key={foto.id}>
                <img
                  src={foto.arquivo}
                  alt={foto.km ? `Foto do registro diário no km ${foto.km}` : 'Foto do registro diário'}
                  className="aspect-square w-full object-cover"
                />
                {foto.km && <figcaption className="px-2 py-1 text-xs text-muted-foreground">km {foto.km}</figcaption>}
              </figure>
            ))}
          </div>
          <FotoUpload registroId={registro.id} />
        </Card>
      </section>
    </main>
  )
}
