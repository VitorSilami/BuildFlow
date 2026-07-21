import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, ErrorRetry, PageHeader, Spinner } from '../components/ui'
import {
  CalendarioMensal,
  type DiaCalendario,
  type MesAno,
} from '../features/registros-diarios/CalendarioMensal'
import { useRegistrosDiarios } from '../features/registros-diarios/registrosDiariosApi'

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

export function RegistrosDiariosListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const navigate = useNavigate()
  const [mesAno, setMesAno] = useState<MesAno>(mesAnoAtual)
  const [diaSelecionado, setDiaSelecionado] = useState<DiaCalendario | null>(null)

  const { data, isLoading, isError, refetch } = useRegistrosDiarios(projetoId ?? '', {
    mes: formatarMesParaFiltro(mesAno),
  })

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

  return (
    <main aria-label="Registros diários">
      <PageHeader
        title="Registros diários"
        breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Registros diários' }]}
        actions={
          <Button asChild className="gap-2">
            <Link to={`/projetos/${projetoId}/registros-diarios/novo`}>
              <Plus size={16} aria-hidden="true" />
              Novo registro diário
            </Link>
          </Button>
        }
      />

      {isLoading && <Spinner label="Carregando registros…" />}

      {isError && (
        <ErrorRetry
          message="Não foi possível carregar os registros diários."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          <Card>
            <CalendarioMensal
              mesAno={mesAno}
              registros={data.results}
              onMesAnteriorClick={() => irParaMes(mesAnterior(mesAno))}
              onMesSeguinteClick={() => irParaMes(mesSeguinte(mesAno))}
              onHojeClick={() => irParaMes(mesAnoAtual())}
              onDiaClick={handleDiaClick}
            />
          </Card>

          {diaSelecionado && (
            <Card title={`Registros de ${diaSelecionado.data}`}>
              <ul className="flex flex-col gap-2" aria-label="Registros do dia selecionado">
                {diaSelecionado.registros.map((registro) => (
                  <li key={registro.id}>
                    <Link
                      to={`/projetos/${projetoId}/registros-diarios/${registro.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {registro.data_referencia} — {registro.turno} — {registro.clima}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-4" onClick={() => setDiaSelecionado(null)}>
                Fechar
              </Button>
            </Card>
          )}
        </>
      )}
    </main>
  )
}
