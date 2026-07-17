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
import { Alert, Card, FormField, PageHeader, Spinner } from '../components/ui'

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

      <Card title="Gerais">
        <div className="row" aria-label="Dados gerais">
          <div className="col-md-3">
            <FormField id="rdo-data" label="Data">
              <input
                id="rdo-data"
                type="date"
                className="form-control"
                value={dataReferencia}
                onChange={(event) => setDataReferencia(event.target.value)}
              />
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-turno" label="Turno">
              <select
                id="rdo-turno"
                className="form-select"
                value={turno}
                onChange={(event) => setTurno(event.target.value as typeof turno)}
              >
                <option value="diurno">Diurno</option>
                <option value="noturno">Noturno</option>
              </select>
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-clima" label="Clima">
              <select
                id="rdo-clima"
                className="form-select"
                value={clima}
                onChange={(event) => setClima(event.target.value as typeof clima)}
              >
                <option value="sol">Sol</option>
                <option value="nublado">Nublado</option>
                <option value="chuva">Chuva</option>
                <option value="chuva_forte">Chuva forte</option>
              </select>
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-equipe" label="Equipe">
              <select id="rdo-equipe" className="form-select" value={equipe} onChange={(event) => setEquipe(event.target.value)}>
                <option value="">Selecione…</option>
                {equipes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-fiscal" label="Fiscal">
              <select id="rdo-fiscal" className="form-select" value={fiscal} onChange={(event) => setFiscal(event.target.value)}>
                <option value="">Selecione…</option>
                {fiscais.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} ({item.email})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      </Card>

      <Card title="Produção">
        <div aria-label="Produção do dia">
          {producoes.map((producao, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">
                    Rodovia
                    <input
                      className="form-control"
                      value={producao.rodovia}
                      onChange={(event) =>
                        setProducoes((current) =>
                          current.map((item, i) => (i === index ? { ...item, rodovia: event.target.value } : item)),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Disciplina
                    <select
                      className="form-select"
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
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Serviço
                    <select
                      className="form-select"
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
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Km inicial
                    <input
                      className="form-control"
                      value={producao.km_inicial}
                      onChange={(event) =>
                        setProducoes((current) =>
                          current.map((item, i) => (i === index ? { ...item, km_inicial: event.target.value } : item)),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Km final
                    <input
                      className="form-control"
                      value={producao.km_final}
                      onChange={(event) =>
                        setProducoes((current) =>
                          current.map((item, i) => (i === index ? { ...item, km_final: event.target.value } : item)),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Quantidade
                    <input
                      className="form-control"
                      value={producao.quantidade}
                      onChange={(event) =>
                        setProducoes((current) =>
                          current.map((item, i) => (i === index ? { ...item, quantidade: event.target.value } : item)),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Unidade
                    <select
                      className="form-select"
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
                </div>
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-outline-primary" onClick={() => setProducoes((current) => [...current, PRODUCAO_VAZIA])}>
            + Adicionar produção
          </button>
        </div>
      </Card>

      <Card title="Equipe">
        <div aria-label="Equipe / presença">
          {presencas.map((presenca, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">
                    Pessoa cadastrada
                    <select
                      className="form-select"
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
                </div>
                {!presenca.pessoa && (
                  <div className="col-md-4">
                    <label className="form-label">
                      Nome (avulso)
                      <input
                        className="form-control"
                        value={presenca.nome_avulso ?? ''}
                        onChange={(event) =>
                          setPresencas((current) =>
                            current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                  </div>
                )}
                <div className="col-md-4">
                  <label className="form-label">
                    Função
                    <input
                      className="form-control"
                      value={presenca.funcao}
                      onChange={(event) =>
                        setPresencas((current) =>
                          current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Status
                    <select
                      className="form-select"
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
                </div>
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-outline-primary" onClick={() => setPresencas((current) => [...current, PRESENCA_VAZIA])}>
            + Adicionar pessoa
          </button>
        </div>
      </Card>

      <Card title="Máquinas">
        <div aria-label="Máquinas">
          {maquinas.map((maquina, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">
                    Máquina cadastrada
                    <select
                      className="form-select"
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
                </div>
                {!maquina.maquina && (
                  <div className="col-md-4">
                    <label className="form-label">
                      Identificação (avulsa)
                      <input
                        className="form-control"
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
                  </div>
                )}
                <div className="col-md-4">
                  <label className="form-label">
                    Horas produtivas
                    <input
                      className="form-control"
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
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Horas paradas
                    <input
                      className="form-control"
                      value={maquina.horas_paradas}
                      onChange={(event) =>
                        setMaquinas((current) =>
                          current.map((item, i) => (i === index ? { ...item, horas_paradas: event.target.value } : item)),
                        )
                      }
                    />
                  </label>
                </div>
                {Number(maquina.horas_paradas) > 0 && (
                  <div className="col-md-4">
                    <label className="form-label">
                      Motivo da parada
                      <select
                        className="form-select"
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
                  </div>
                )}
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-outline-primary" onClick={() => setMaquinas((current) => [...current, MAQUINA_VAZIA])}>
            + Adicionar máquina
          </button>
        </div>
      </Card>

      <Card title="Ocorrências">
        <div aria-label="Ocorrências">
          {ocorrencias.map((ocorrencia, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <label className="form-label">
                Descrição
                <textarea
                  className="form-control"
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
          <button type="button" className="btn btn-outline-primary" onClick={() => setOcorrencias((current) => [...current, OCORRENCIA_VAZIA])}>
            + Adicionar ocorrência
          </button>
        </div>
      </Card>

      {erro && <Alert>{erro}</Alert>}

      <button type="button" className="btn btn-primary btn-lg mb-5" onClick={handleSubmit} disabled={criarRegistro.isPending}>
        {criarRegistro.isPending ? 'Salvando…' : 'Salvar registro diário'}
      </button>
    </main>
  )
}
