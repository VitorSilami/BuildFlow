import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import {
  useConfiguracaoRdo,
  useCriarRegistroDiario,
} from '../features/registros-diarios/registrosDiariosApi'
import { registroDiarioFormSchema } from '../schemas/registroDiario'
import type {
  ApontamentoMaquinaInput,
  OcorrenciaInput,
  PresencaInput,
  ProducaoDiariaInput,
} from '../types/registroDiario'

const PRODUCAO_VAZIA: ProducaoDiariaInput = {
  rodovia: '',
  sentido: 'crescente',
  disciplina: '',
  servico: '',
  km_inicial: '',
  km_final: '',
  quantidade: '',
  unidade: 0,
}

const PRESENCA_VAZIA: PresencaInput = { nome_avulso: '', funcao: '', status: 'presente' }

const MAQUINA_VAZIA: ApontamentoMaquinaInput = {
  identificacao_avulsa: '',
  horas_produtivas: '',
  horas_paradas: '0',
}

const OCORRENCIA_VAZIA: OcorrenciaInput = { tipo: 'outro', recurso_afetado: 'outro', descricao: '' }

export function RdoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const configuracao = useConfiguracaoRdo(projetoId ?? '')
  const criarRegistro = useCriarRegistroDiario(projetoId ?? '')

  const [dataReferencia, setDataReferencia] = useState('')
  const [turno, setTurno] = useState<'diurno' | 'noturno'>('diurno')
  const [clima, setClima] = useState<'sol' | 'nublado' | 'chuva' | 'chuva_forte'>('sol')
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

  if (configuracao.isLoading) return <p role="status">Carregando…</p>
  if (configuracao.isError || !configuracao.data) {
    return <p role="alert">Não foi possível carregar os cadastros do projeto.</p>
  }

  const {
    disciplinas,
    unidades,
    equipes,
    motivos_parada: motivosParada,
    fiscais,
  } = configuracao.data
  const equipeSelecionada = equipes.find((item) => item.id === equipe)

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
      <h1>Novo Registro Diário</h1>

      <section aria-label="Dados gerais">
        <h2>Gerais</h2>
        <label htmlFor="rdo-data">Data</label>
        <input
          id="rdo-data"
          type="date"
          value={dataReferencia}
          onChange={(event) => setDataReferencia(event.target.value)}
        />

        <label htmlFor="rdo-turno">Turno</label>
        <select id="rdo-turno" value={turno} onChange={(event) => setTurno(event.target.value as typeof turno)}>
          <option value="diurno">Diurno</option>
          <option value="noturno">Noturno</option>
        </select>

        <label htmlFor="rdo-clima">Clima</label>
        <select id="rdo-clima" value={clima} onChange={(event) => setClima(event.target.value as typeof clima)}>
          <option value="sol">Sol</option>
          <option value="nublado">Nublado</option>
          <option value="chuva">Chuva</option>
          <option value="chuva_forte">Chuva forte</option>
        </select>

        <label htmlFor="rdo-equipe">Equipe</label>
        <select id="rdo-equipe" value={equipe} onChange={(event) => setEquipe(event.target.value)}>
          <option value="">Selecione…</option>
          {equipes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>

        <label htmlFor="rdo-fiscal">Fiscal</label>
        <select id="rdo-fiscal" value={fiscal} onChange={(event) => setFiscal(event.target.value)}>
          <option value="">Selecione…</option>
          {fiscais.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome} ({item.email})
            </option>
          ))}
        </select>
      </section>

      <section aria-label="Produção do dia">
        <h2>Produção</h2>
        {producoes.map((producao, index) => (
          <fieldset key={index}>
            <label>
              Rodovia
              <input
                value={producao.rodovia}
                onChange={(event) =>
                  setProducoes((current) =>
                    current.map((item, i) => (i === index ? { ...item, rodovia: event.target.value } : item)),
                  )
                }
              />
            </label>
            <label>
              Disciplina
              <select
                value={producao.disciplina}
                onChange={(event) =>
                  setProducoes((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, disciplina: event.target.value, servico: '' } : item,
                    ),
                  )
                }
              >
                <option value="">Selecione…</option>
                {disciplinas.map((disciplina) => (
                  <option key={disciplina.id} value={disciplina.id}>
                    {disciplina.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Serviço
              <select
                value={producao.servico}
                onChange={(event) =>
                  setProducoes((current) =>
                    current.map((item, i) => (i === index ? { ...item, servico: event.target.value } : item)),
                  )
                }
              >
                <option value="">Selecione…</option>
                {disciplinas
                  .find((d) => d.id === producao.disciplina)
                  ?.servicos.map((servico) => (
                    <option key={servico.id} value={servico.id}>
                      {servico.nome}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Km inicial
              <input
                value={producao.km_inicial}
                onChange={(event) =>
                  setProducoes((current) =>
                    current.map((item, i) => (i === index ? { ...item, km_inicial: event.target.value } : item)),
                  )
                }
              />
            </label>
            <label>
              Km final
              <input
                value={producao.km_final}
                onChange={(event) =>
                  setProducoes((current) =>
                    current.map((item, i) => (i === index ? { ...item, km_final: event.target.value } : item)),
                  )
                }
              />
            </label>
            <label>
              Quantidade
              <input
                value={producao.quantidade}
                onChange={(event) =>
                  setProducoes((current) =>
                    current.map((item, i) => (i === index ? { ...item, quantidade: event.target.value } : item)),
                  )
                }
              />
            </label>
            <label>
              Unidade
              <select
                value={producao.unidade || ''}
                onChange={(event) =>
                  setProducoes((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, unidade: Number(event.target.value) } : item,
                    ),
                  )
                }
              >
                <option value="">Selecione…</option>
                {unidades.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.sigla}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        ))}
        <button type="button" onClick={() => setProducoes((current) => [...current, PRODUCAO_VAZIA])}>
          + Adicionar produção
        </button>
      </section>

      <section aria-label="Equipe / presença">
        <h2>Equipe</h2>
        {presencas.map((presenca, index) => (
          <fieldset key={index}>
            <label>
              Pessoa cadastrada
              <select
                value={presenca.pessoa ?? ''}
                onChange={(event) => {
                  const pessoaId = event.target.value || undefined
                  setPresencas((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, pessoa: pessoaId, nome_avulso: pessoaId ? '' : item.nome_avulso }
                        : item,
                    ),
                  )
                }}
              >
                <option value="">Avulso (digitar nome)</option>
                {equipeSelecionada?.pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
            </label>
            {!presenca.pessoa && (
              <label>
                Nome (avulso)
                <input
                  value={presenca.nome_avulso ?? ''}
                  onChange={(event) =>
                    setPresencas((current) =>
                      current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                    )
                  }
                />
              </label>
            )}
            <label>
              Função
              <input
                value={presenca.funcao}
                onChange={(event) =>
                  setPresencas((current) =>
                    current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                  )
                }
              />
            </label>
            <label>
              Status
              <select
                value={presenca.status}
                onChange={(event) =>
                  setPresencas((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, status: event.target.value as PresencaInput['status'] } : item,
                    ),
                  )
                }
              >
                <option value="presente">Presente</option>
                <option value="falta">Falta</option>
                <option value="atestado">Atestado</option>
              </select>
            </label>
          </fieldset>
        ))}
        <button type="button" onClick={() => setPresencas((current) => [...current, PRESENCA_VAZIA])}>
          + Adicionar pessoa
        </button>
      </section>

      <section aria-label="Máquinas">
        <h2>Máquinas</h2>
        {maquinas.map((maquina, index) => (
          <fieldset key={index}>
            <label>
              Máquina cadastrada
              <select
                value={maquina.maquina ?? ''}
                onChange={(event) => {
                  const maquinaId = event.target.value || undefined
                  setMaquinas((current) =>
                    current.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            maquina: maquinaId,
                            identificacao_avulsa: maquinaId ? '' : item.identificacao_avulsa,
                          }
                        : item,
                    ),
                  )
                }}
              >
                <option value="">Avulso (digitar identificação)</option>
                {equipeSelecionada?.maquinas.map((maq) => (
                  <option key={maq.id} value={maq.id}>
                    {maq.nome}
                  </option>
                ))}
              </select>
            </label>
            {!maquina.maquina && (
              <label>
                Identificação (avulsa)
                <input
                  value={maquina.identificacao_avulsa ?? ''}
                  onChange={(event) =>
                    setMaquinas((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, identificacao_avulsa: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
            )}
            <label>
              Horas produtivas
              <input
                value={maquina.horas_produtivas}
                onChange={(event) =>
                  setMaquinas((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, horas_produtivas: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              Horas paradas
              <input
                value={maquina.horas_paradas}
                onChange={(event) =>
                  setMaquinas((current) =>
                    current.map((item, i) => (i === index ? { ...item, horas_paradas: event.target.value } : item)),
                  )
                }
              />
            </label>
            {Number(maquina.horas_paradas) > 0 && (
              <label>
                Motivo da parada
                <select
                  value={maquina.motivo_parada ?? ''}
                  onChange={(event) =>
                    setMaquinas((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, motivo_parada: Number(event.target.value) } : item,
                      ),
                    )
                  }
                >
                  <option value="">Selecione…</option>
                  {motivosParada.map((motivo) => (
                    <option key={motivo.id} value={motivo.id}>
                      {motivo.descricao}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
        ))}
        <button type="button" onClick={() => setMaquinas((current) => [...current, MAQUINA_VAZIA])}>
          + Adicionar máquina
        </button>
      </section>

      <section aria-label="Ocorrências">
        <h2>Ocorrências</h2>
        {ocorrencias.map((ocorrencia, index) => (
          <fieldset key={index}>
            <label>
              Descrição
              <textarea
                value={ocorrencia.descricao}
                onChange={(event) =>
                  setOcorrencias((current) =>
                    current.map((item, i) => (i === index ? { ...item, descricao: event.target.value } : item)),
                  )
                }
              />
            </label>
          </fieldset>
        ))}
        <button type="button" onClick={() => setOcorrencias((current) => [...current, OCORRENCIA_VAZIA])}>
          + Adicionar ocorrência
        </button>
      </section>

      {erro && <p role="alert">{erro}</p>}

      <button type="button" onClick={handleSubmit} disabled={criarRegistro.isPending}>
        {criarRegistro.isPending ? 'Salvando…' : 'Salvar registro diário'}
      </button>
    </main>
  )
}
