import { Link, useParams } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { FotoUpload } from '../features/registros-diarios/FotoUpload'
import { useRegistroDiario } from '../features/registros-diarios/registrosDiariosApi'

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

export function RegistroDiarioDetailPage() {
  const { projetoId, registroId } = useParams<{ projetoId: string; registroId: string }>()
  const { data: registro, isLoading, isError, refetch } = useRegistroDiario(registroId)

  if (isLoading) return <RegistroDiarioDetailSkeleton />

  if (isError || !registro) {
    return <ErrorRetry message="Não foi possível carregar o registro diário." onRetry={() => void refetch()} />
  }

  return (
    <main aria-label="Detalhe do registro diário">
      <PageHeader
        title={`Registro diário — ${registro.data_referencia}`}
        breadcrumbs={[
          { label: 'Projetos', to: '/projetos' },
          { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
          { label: registro.data_referencia },
        ]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/projetos/${projetoId}/registros-diarios`}>Voltar para a lista</Link>
          </Button>
        }
      />

      <Card title="Gerais">
        <p className="text-sm">Turno: {registro.turno}</p>
        <p className="text-sm">Clima: {registro.clima}</p>
      </Card>

      <Card title="Produção">
        <ul className="divide-y divide-border" aria-label="Produção">
          {registro.producoes.map((producao, index) => (
            <li className="py-2 text-sm" key={index}>
              {producao.rodovia} — km {producao.km_inicial} a {producao.km_final} — {producao.quantidade}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Equipe">
        <ul className="divide-y divide-border" aria-label="Presenças">
          {registro.presencas.map((presenca, index) => (
            <li className="py-2 text-sm" key={index}>
              {presenca.nome_avulso || presenca.pessoa} — {presenca.funcao} ({presenca.status})
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Máquinas">
        <ul className="divide-y divide-border" aria-label="Máquinas">
          {registro.maquinas.map((maquina, index) => (
            <li className="py-2 text-sm" key={index}>
              {maquina.identificacao_avulsa || maquina.maquina} — {maquina.horas_produtivas}h produtivas /{' '}
              {maquina.horas_paradas}h paradas
            </li>
          ))}
        </ul>
      </Card>

      {registro.ocorrencias.length > 0 && (
        <Card title="Ocorrências">
          <ul className="divide-y divide-border" aria-label="Ocorrências">
            {registro.ocorrencias.map((ocorrencia, index) => (
              <li className="py-2 text-sm" key={index}>
                {ocorrencia.tipo}: {ocorrencia.descricao}
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
