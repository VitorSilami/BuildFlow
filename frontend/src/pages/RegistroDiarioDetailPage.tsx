import { CheckCircle2, FileText, Gauge, HardHat, MapPin, UserCheck, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppStatusBadge, Badge, Button, Card, EmptyState, ErrorRetry, PageHeader, Progress, Skeleton } from '../components/ui'
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
import type { ApontamentoMaquina, Presenca, StatusPresenca } from '../types/registroDiario'

function RegistroDiarioDetailSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
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

function CampoResumo({ label, valor, icon }: { label: string; valor: string; icon?: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-medium text-ink">
        {icon}
        {valor}
      </p>
    </div>
  )
}

function CardMaquina({ maquina }: { maquina: ApontamentoMaquina }) {
  const eficienciaPercentual = Math.round(maquina.eficiencia * 100)
  return (
    <li className="py-3 text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-ink">
          {maquina.maquina_nome ?? maquina.identificacao_avulsa}
          {maquina.maquina_codigo && <span className="text-muted-foreground"> ({maquina.maquina_codigo})</span>}
        </span>
        <span className="text-muted-foreground">
          {maquina.horas_produtivas}h produtivas · {maquina.horas_paradas}h paradas
        </span>
      </div>
      {Number(maquina.horas_paradas) > 0 && maquina.motivo_parada_descricao && (
        <p className="mb-1 text-xs text-muted-foreground">Motivo da parada: {maquina.motivo_parada_descricao}</p>
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

function LinhaPresenca({ presenca }: { presenca: Presenca }) {
  const Icon = ICON_STATUS_PRESENCA[presenca.status]
  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <span>
        {presenca.pessoa_nome ?? presenca.nome_avulso} — {presenca.funcao}
      </span>
      <AppStatusBadge
        tone={TONE_STATUS_PRESENCA[presenca.status]}
        label={LABEL_STATUS_PRESENCA[presenca.status]}
        icon={<Icon size={12} aria-hidden="true" />}
      />
    </li>
  )
}

export function RegistroDiarioDetailPage() {
  const { projetoId, registroId } = useParams<{ projetoId: string; registroId: string }>()
  const { data: registro, isLoading, isError, refetch } = useRegistroDiario(registroId)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
    { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
    { label: registro?.data_referencia ?? '…' },
  ])

  if (isLoading) return <RegistroDiarioDetailSkeleton />

  if (isError || !registro) {
    return <ErrorRetry message="Não foi possível carregar o registro diário." onRetry={() => void refetch()} />
  }

  const StatusIcon = STATUS_REGISTRO_ICON[registro.status]

  return (
    <main aria-label="Detalhe do registro diário">
      <PageHeader
        title={`Registro diário — ${formatData(registro.data_referencia)}`}
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex items-center gap-3">
            <AppStatusBadge
              tone={STATUS_REGISTRO_TONE[registro.status]}
              label={STATUS_REGISTRO_LABEL[registro.status]}
              icon={<StatusIcon size={12} aria-hidden="true" />}
            />
            <Button asChild variant="outline" size="sm">
              <Link to={`/projetos/${projetoId}/registros-diarios`}>Voltar para a lista</Link>
            </Button>
          </div>
        }
      />

      <Card title="Gerais">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <CampoResumo label="Turno" valor={LABEL_TURNO[registro.turno]} />
          <CampoResumo
            label="Clima"
            valor={LABEL_CLIMA[registro.clima]}
            icon={ICONE_CLIMA[registro.clima]}
          />
          <CampoResumo label="Equipe" valor={registro.equipe_nome} icon={<HardHat size={16} className="text-muted-foreground" aria-hidden="true" />} />
          <CampoResumo label="Fiscal" valor={registro.fiscal_nome} icon={<UserCheck size={16} className="text-muted-foreground" aria-hidden="true" />} />
        </div>
      </Card>

      <Card title="Produção">
        {registro.producoes.length === 0 ? (
          <EmptyState>Nenhuma produção registrada.</EmptyState>
        ) : (
          <ul className="divide-y divide-border" aria-label="Produção">
            {registro.producoes.map((producao, index) => (
              <li className="py-3 text-sm" key={index}>
                <div className="mb-1 flex items-center gap-2 font-medium text-ink">
                  <MapPin size={14} className="text-muted-foreground" aria-hidden="true" />
                  {producao.rodovia} · km {producao.km_inicial} a {producao.km_final}
                </div>
                <p className="text-muted-foreground">
                  {producao.disciplina_nome} — {producao.servico_nome}
                </p>
                <p className="mt-1 flex items-center gap-1 font-display font-semibold text-ink">
                  <Gauge size={14} className="text-primary" aria-hidden="true" />
                  {producao.quantidade} {producao.unidade_sigla}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Equipe" eyebrow={`${registro.presencas.length} pessoa(s)`}>
        {registro.presencas.length === 0 ? (
          <EmptyState>Nenhuma presença registrada.</EmptyState>
        ) : (
          <ul className="divide-y divide-border" aria-label="Presenças">
            {registro.presencas.map((presenca, index) => (
              <LinhaPresenca key={index} presenca={presenca} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Máquinas" eyebrow={`${registro.maquinas.length} máquina(s)`}>
        {registro.maquinas.length === 0 ? (
          <EmptyState>Nenhuma máquina registrada.</EmptyState>
        ) : (
          <ul className="divide-y divide-border" aria-label="Máquinas">
            {registro.maquinas.map((maquina, index) => (
              <CardMaquina key={index} maquina={maquina} />
            ))}
          </ul>
        )}
      </Card>

      {registro.ocorrencias.length > 0 && (
        <Card title="Ocorrências">
          <ul className="divide-y divide-border" aria-label="Ocorrências">
            {registro.ocorrencias.map((ocorrencia, index) => (
              <li className="py-2 text-sm" key={index}>
                <Badge variant="outline" className="mb-1">
                  {ocorrencia.tipo}
                </Badge>
                <p>{ocorrencia.descricao}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Fotos">
        {registro.fotos.length === 0 && <EmptyState>Nenhuma foto anexada ainda.</EmptyState>}
        <div className="mb-4 flex flex-wrap gap-4" aria-label="Fotos">
          {registro.fotos.map((foto) => (
            <figure className="m-0" key={foto.id}>
              <img src={foto.arquivo} alt="" width={120} className="rounded-md" />
              {foto.km && <figcaption className="text-xs text-muted-foreground">km {foto.km}</figcaption>}
            </figure>
          ))}
        </div>
        <FotoUpload registroId={registro.id} />
      </Card>
    </main>
  )
}
