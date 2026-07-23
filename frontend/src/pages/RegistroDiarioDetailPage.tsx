import { Gauge, HardHat, MapPin, UserCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { ICONE_CLIMA, LABEL_CLIMA, LABEL_TURNO } from '../features/registros-diarios/climaIcons'
import { FotoUpload } from '../features/registros-diarios/FotoUpload'
import { useRegistroDiario } from '../features/registros-diarios/registrosDiariosApi'
import { STATUS_REGISTRO_COR_TEXTO, STATUS_REGISTRO_LABEL } from '../features/registros-diarios/statusRegistroBadge'
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

const COR_STATUS_PRESENCA: Record<StatusPresenca, string> = {
  presente: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  falta: 'border-transparent bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  atestado: 'border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
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
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${execucaoCorClasse(String(eficienciaPercentual))}`}
            style={{ width: `${eficienciaPercentual}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs text-muted-foreground">{eficienciaPercentual}%</span>
      </div>
    </li>
  )
}

function LinhaPresenca({ presenca }: { presenca: Presenca }) {
  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <span>
        {presenca.pessoa_nome ?? presenca.nome_avulso} — {presenca.funcao}
      </span>
      <Badge className={COR_STATUS_PRESENCA[presenca.status]}>{LABEL_STATUS_PRESENCA[presenca.status]}</Badge>
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

  return (
    <main aria-label="Detalhe do registro diário">
      <PageHeader
        title={`Registro diário — ${formatData(registro.data_referencia)}`}
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${STATUS_REGISTRO_COR_TEXTO[registro.status]}`}
            >
              {STATUS_REGISTRO_LABEL[registro.status]}
            </span>
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
