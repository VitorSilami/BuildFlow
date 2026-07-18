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
import { Alert, Button, Card, FormField, Input, PageHeader, SelectField, Spinner, Textarea } from '../components/ui'

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

// `<select>` nativo (não SelectField/Radix) propositalmente para os campos que
// tests/e2e/rdo.spec.ts aciona via `.selectOption(...)` — esse metodo do
// Playwright exige um <select> real (`Element is not a <select> element` ao
// tentar num Radix Select, que renderiza um <button role="combobox">, ja que
// getByLabel resolve para o elemento com o id do <label for>, que e o trigger,
// nao um <select> nativo escondido). Confirmado rodando o spec (nao pode ser
// alterado) contra a versao com SelectField em todos os campos.
const NATIVE_SELECT_CLASSNAME =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5" aria-label="Dados gerais">
          <FormField id="rdo-data" label="Data">
            <Input
              id="rdo-data"
              type="date"
              value={dataReferencia}
              onChange={(event) => setDataReferencia(event.target.value)}
            />
          </FormField>
          <SelectField
            id="rdo-turno"
            label="Turno"
            value={turno}
            onChange={(value) => setTurno(value as typeof turno)}
            options={[
              { value: 'diurno', label: 'Diurno' },
              { value: 'noturno', label: 'Noturno' },
            ]}
          />
          <SelectField
            id="rdo-clima"
            label="Clima"
            value={clima}
            onChange={(value) => setClima(value as typeof clima)}
            options={[
              { value: 'sol', label: 'Sol' },
              { value: 'nublado', label: 'Nublado' },
              { value: 'chuva', label: 'Chuva' },
              { value: 'chuva_forte', label: 'Chuva forte' },
            ]}
          />
          <FormField id="rdo-equipe" label="Equipe">
            <select
              id="rdo-equipe"
              className={NATIVE_SELECT_CLASSNAME}
              value={equipe}
              onChange={(event) => setEquipe(event.target.value)}
            >
              <option value="">Selecione…</option>
              {equipes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="rdo-fiscal" label="Fiscal">
            <select
              id="rdo-fiscal"
              className={NATIVE_SELECT_CLASSNAME}
              value={fiscal}
              onChange={(event) => setFiscal(event.target.value)}
            >
              <option value="">Selecione…</option>
              {fiscais.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome} ({item.email})
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </Card>

      <Card title="Produção">
        <div aria-label="Produção do dia">
          {producoes.map((producao, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField id={`producao-rodovia-${index}`} label="Rodovia">
                  <Input
                    id={`producao-rodovia-${index}`}
                    value={producao.rodovia}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, rodovia: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`producao-disciplina-${index}`} label="Disciplina">
                  <select
                    id={`producao-disciplina-${index}`}
                    className={NATIVE_SELECT_CLASSNAME}
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
                </FormField>
                <FormField id={`producao-servico-${index}`} label="Serviço">
                  <select
                    id={`producao-servico-${index}`}
                    className={NATIVE_SELECT_CLASSNAME}
                    value={producao.servico}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, servico: event.target.value } : item)),
                      )
                    }
                  >
                    <option value="">Selecione…</option>
                    {(disciplinas.find((d) => d.id === producao.disciplina)?.servicos ?? []).map((servico) => (
                      <option key={servico.id} value={servico.id}>
                        {servico.nome}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id={`producao-km-inicial-${index}`} label="Km inicial">
                  <Input
                    id={`producao-km-inicial-${index}`}
                    value={producao.km_inicial}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, km_inicial: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`producao-km-final-${index}`} label="Km final">
                  <Input
                    id={`producao-km-final-${index}`}
                    value={producao.km_final}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, km_final: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`producao-quantidade-${index}`} label="Quantidade">
                  <Input
                    id={`producao-quantidade-${index}`}
                    value={producao.quantidade}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, quantidade: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`producao-unidade-${index}`} label="Unidade">
                  <select
                    id={`producao-unidade-${index}`}
                    className={NATIVE_SELECT_CLASSNAME}
                    value={producao.unidade ? String(producao.unidade) : ''}
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
                      <option key={unidade.id} value={String(unidade.id)}>
                        {unidade.sigla}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setProducoes((current) => [...current, PRODUCAO_VAZIA])}>
            + Adicionar produção
          </Button>
        </div>
      </Card>

      <Card title="Equipe">
        <div aria-label="Equipe / presença">
          {presencas.map((presenca, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField id={`presenca-pessoa-${index}`} label="Pessoa cadastrada">
                  <select
                    id={`presenca-pessoa-${index}`}
                    className={NATIVE_SELECT_CLASSNAME}
                    value={presenca.pessoa ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      setPresencas((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, pessoa: value || undefined, nome_avulso: value ? '' : item.nome_avulso }
                            : item,
                        ),
                      )
                    }}
                  >
                    <option value="">Avulso (digitar nome)</option>
                    {(equipeSelecionada?.pessoas ?? []).map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </option>
                    ))}
                  </select>
                </FormField>
                {!presenca.pessoa && (
                  <FormField id={`presenca-nome-avulso-${index}`} label="Nome (avulso)">
                    <Input
                      id={`presenca-nome-avulso-${index}`}
                      value={presenca.nome_avulso ?? ''}
                      onChange={(event) =>
                        setPresencas((current) =>
                          current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                        )
                      }
                    />
                  </FormField>
                )}
                <FormField id={`presenca-funcao-${index}`} label="Função">
                  <Input
                    id={`presenca-funcao-${index}`}
                    value={presenca.funcao}
                    onChange={(event) =>
                      setPresencas((current) =>
                        current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <SelectField
                  id={`presenca-status-${index}`}
                  label="Status"
                  value={presenca.status}
                  onChange={(value) =>
                    setPresencas((current) =>
                      current.map((item, i) => (i === index ? { ...item, status: value as PresencaInput['status'] } : item)),
                    )
                  }
                  options={[
                    { value: 'presente', label: 'Presente' },
                    { value: 'falta', label: 'Falta' },
                    { value: 'atestado', label: 'Atestado' },
                  ]}
                />
              </div>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setPresencas((current) => [...current, PRESENCA_VAZIA])}>
            + Adicionar pessoa
          </Button>
        </div>
      </Card>

      <Card title="Máquinas">
        <div aria-label="Máquinas">
          {maquinas.map((maquina, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SelectField
                  id={`maquina-maquina-${index}`}
                  label="Máquina cadastrada"
                  value={maquina.maquina ?? ''}
                  onChange={(value) => {
                    setMaquinas((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, maquina: value || undefined, identificacao_avulsa: value ? '' : item.identificacao_avulsa }
                          : item,
                      ),
                    )
                  }}
                  placeholder="Avulso (digitar identificação)"
                  options={(equipeSelecionada?.maquinas ?? []).map((maq) => ({ value: maq.id, label: maq.nome }))}
                />
                {!maquina.maquina && (
                  <FormField id={`maquina-identificacao-${index}`} label="Identificação (avulsa)">
                    <Input
                      id={`maquina-identificacao-${index}`}
                      value={maquina.identificacao_avulsa ?? ''}
                      onChange={(event) =>
                        setMaquinas((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, identificacao_avulsa: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </FormField>
                )}
                <FormField id={`maquina-horas-produtivas-${index}`} label="Horas produtivas">
                  <Input
                    id={`maquina-horas-produtivas-${index}`}
                    value={maquina.horas_produtivas}
                    onChange={(event) =>
                      setMaquinas((current) =>
                        current.map((item, i) => (i === index ? { ...item, horas_produtivas: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`maquina-horas-paradas-${index}`} label="Horas paradas">
                  <Input
                    id={`maquina-horas-paradas-${index}`}
                    value={maquina.horas_paradas}
                    onChange={(event) =>
                      setMaquinas((current) =>
                        current.map((item, i) => (i === index ? { ...item, horas_paradas: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                {Number(maquina.horas_paradas) > 0 && (
                  <SelectField
                    id={`maquina-motivo-parada-${index}`}
                    label="Motivo da parada"
                    value={maquina.motivo_parada ? String(maquina.motivo_parada) : ''}
                    onChange={(value) =>
                      setMaquinas((current) =>
                        current.map((item, i) => (i === index ? { ...item, motivo_parada: Number(value) } : item)),
                      )
                    }
                    options={motivosParada.map((motivo) => ({ value: String(motivo.id), label: motivo.descricao }))}
                  />
                )}
              </div>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setMaquinas((current) => [...current, MAQUINA_VAZIA])}>
            + Adicionar máquina
          </Button>
        </div>
      </Card>

      <Card title="Ocorrências">
        <div aria-label="Ocorrências">
          {ocorrencias.map((ocorrencia, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <FormField id={`ocorrencia-descricao-${index}`} label="Descrição">
                <Textarea
                  id={`ocorrencia-descricao-${index}`}
                  value={ocorrencia.descricao}
                  onChange={(event) =>
                    setOcorrencias((current) =>
                      current.map((item, i) => (i === index ? { ...item, descricao: event.target.value } : item)),
                    )
                  }
                />
              </FormField>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setOcorrencias((current) => [...current, OCORRENCIA_VAZIA])}>
            + Adicionar ocorrência
          </Button>
        </div>
      </Card>

      {erro && <Alert>{erro}</Alert>}

      <Button size="lg" className="mb-8" onClick={handleSubmit} disabled={criarRegistro.isPending}>
        {criarRegistro.isPending ? 'Salvando…' : 'Salvar registro diário'}
      </Button>
    </main>
  )
}
