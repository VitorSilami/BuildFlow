import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import {
  useConfiguracaoRdo,
  useCriarRegistroDiario,
  useRegistrosDiarios,
} from '../features/registros-diarios/registrosDiariosApi'
import { RdoStepEquipe } from '../features/registros-diarios/wizard/RdoStepEquipe'
import { RdoStepGerais } from '../features/registros-diarios/wizard/RdoStepGerais'
import { RdoStepMaquinas } from '../features/registros-diarios/wizard/RdoStepMaquinas'
import { RdoStepOcorrencias } from '../features/registros-diarios/wizard/RdoStepOcorrencias'
import { RdoStepProducao } from '../features/registros-diarios/wizard/RdoStepProducao'
import { RdoStepRevisao } from '../features/registros-diarios/wizard/RdoStepRevisao'
import { NOMES_PASSOS, RdoWizardNav } from '../features/registros-diarios/wizard/RdoWizardNav'
import {
  MAQUINA_VAZIA,
  PRESENCA_VAZIA,
  PRODUCAO_VAZIA,
} from '../features/registros-diarios/wizard/valoresVazios'
import { registroDiarioFormSchema } from '../schemas/registroDiario'
import type {
  ApontamentoMaquinaInput,
  Clima,
  OcorrenciaInput,
  PresencaInput,
  ProducaoDiariaInput,
  Turno,
} from '../types/registroDiario'
import { Alert, Card, PageHeader, Spinner } from '../components/ui'

export function RdoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const configuracao = useConfiguracaoRdo(projetoId ?? '')
  const registrosAnteriores = useRegistrosDiarios(projetoId ?? '')
  const criarRegistro = useCriarRegistroDiario(projetoId ?? '')

  const [passoAtual, setPassoAtual] = useState(0)

  const [dataReferencia, setDataReferencia] = useState(() => searchParams.get('data') ?? '')
  const [turno, setTurno] = useState<Turno>('diurno')
  const [clima, setClima] = useState<Clima>('sol')
  const [equipe, setEquipe] = useState('')
  const [fiscal, setFiscal] = useState('')

  // Pre-preenche com o proprio usuario autenticado — antes exigia digitar um
  // ID de usuario a mao, sem forma de descobri-lo na UI (bug real encontrado
  // em teste manual).
  useEffect(() => {
    if (!fiscal && user) {
      setFiscal(String(user.id))
    }
  }, [user, fiscal])

  const [producoes, setProducoes] = useState<ProducaoDiariaInput[]>([PRODUCAO_VAZIA])
  const [presencas, setPresencas] = useState<PresencaInput[]>([PRESENCA_VAZIA])
  const [maquinas, setMaquinas] = useState<ApontamentoMaquinaInput[]>([MAQUINA_VAZIA])
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaInput[]>([])

  const [erro, setErro] = useState<string | null>(null)

  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return <Alert>Não foi possível carregar os cadastros do projeto.</Alert>
  }

  const {
    disciplinas,
    unidades,
    equipes,
    motivos_parada: motivosParada,
    fiscais,
  } = configuracao.data
  const equipeSelecionada = equipes.find((item) => item.id === equipe)
  const fiscalSelecionado = fiscais.find((item) => String(item.id) === fiscal)

  function duplicarDiaAnterior() {
    const ultimo = registrosAnteriores.data?.results[0]
    if (!ultimo) return
    setEquipe(ultimo.equipe)
    setFiscal(String(ultimo.fiscal))
  }

  function handleSubmit() {
    setErro(null)

    const result = registroDiarioFormSchema.safeParse({
      data_referencia: dataReferencia,
      turno,
      clima,
      equipe,
      fiscal: Number(fiscal),
      producoes,
      presencas,
      maquinas,
      ocorrencias,
    })

    if (!result.success) {
      setErro(result.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    criarRegistro.mutate(result.data, {
      onSuccess: (registro) =>
        navigate(`/projetos/${projetoId}/registros-diarios/${registro.id}`),
      onError: () => setErro('Não foi possível salvar o registro diário. Tente novamente.'),
    })
  }

  return (
    <main aria-label="Novo registro diário">
      <PageHeader
        title="Novo Registro Diário"
        breadcrumbs={[
          { label: 'Projetos', to: '/projetos' },
          { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
          { label: 'Novo' },
        ]}
      />

      <RdoWizardNav
        passoAtual={passoAtual}
        onAnterior={() => setPassoAtual((atual) => Math.max(0, atual - 1))}
        onProximo={() => setPassoAtual((atual) => Math.min(NOMES_PASSOS.length - 1, atual + 1))}
      />

      <Card title={NOMES_PASSOS[passoAtual]}>
        {passoAtual === 0 && (
          <RdoStepGerais
            dataReferencia={dataReferencia}
            onDataReferenciaChange={setDataReferencia}
            turno={turno}
            onTurnoChange={setTurno}
            clima={clima}
            onClimaChange={setClima}
            equipe={equipe}
            onEquipeChange={setEquipe}
            fiscal={fiscal}
            onFiscalChange={setFiscal}
            equipes={equipes}
            fiscais={fiscais}
            podeDuplicarDiaAnterior={Boolean(registrosAnteriores.data?.results.length)}
            onDuplicarDiaAnterior={duplicarDiaAnterior}
          />
        )}
        {passoAtual === 1 && (
          <RdoStepProducao
            producoes={producoes}
            onProducoesChange={setProducoes}
            disciplinas={disciplinas}
            unidades={unidades}
          />
        )}
        {passoAtual === 2 && (
          <RdoStepEquipe
            presencas={presencas}
            onPresencasChange={setPresencas}
            equipeSelecionada={equipeSelecionada}
          />
        )}
        {passoAtual === 3 && (
          <RdoStepMaquinas
            maquinas={maquinas}
            onMaquinasChange={setMaquinas}
            equipeSelecionada={equipeSelecionada}
            motivosParada={motivosParada}
          />
        )}
        {passoAtual === 4 && (
          <RdoStepOcorrencias ocorrencias={ocorrencias} onOcorrenciasChange={setOcorrencias} />
        )}
        {passoAtual === 5 && (
          <RdoStepRevisao
            dataReferencia={dataReferencia}
            equipeSelecionada={equipeSelecionada}
            fiscalSelecionado={fiscalSelecionado}
            producoes={producoes}
            presencas={presencas}
            maquinas={maquinas}
            ocorrencias={ocorrencias}
            erro={erro}
            salvando={criarRegistro.isPending}
            onSalvar={handleSubmit}
          />
        )}
      </Card>
    </main>
  )
}
