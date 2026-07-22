export interface Unidade {
  id: number
  sigla: string
  descricao: string
}

export interface CatalogoServico {
  id: string
  nome: string
  unidade: number
}

export interface Disciplina {
  id: string
  nome: string
  servicos: CatalogoServico[]
}

export interface Pessoa {
  id: string
  nome: string
  funcao: string
}

export interface Maquina {
  id: string
  codigo: string
  nome: string
}

export interface Equipe {
  id: string
  nome: string
  pessoas: Pessoa[]
  maquinas: Maquina[]
}

export interface MotivoParada {
  id: number
  descricao: string
}

export interface Fiscal {
  id: number
  nome: string
  email: string
}

export interface ConfiguracaoRdo {
  disciplinas: Disciplina[]
  unidades: Unidade[]
  equipes: Equipe[]
  motivos_parada: MotivoParada[]
  fiscais: Fiscal[]
}

export interface ProducaoDiariaInput {
  rodovia: string
  sentido: 'crescente' | 'decrescente'
  disciplina: string
  servico: string
  km_inicial: string
  km_final: string
  quantidade: string
  unidade: number
}

export type StatusPresenca = 'presente' | 'falta' | 'atestado'

export interface PresencaInput {
  pessoa?: string
  nome_avulso?: string
  funcao: string
  status: StatusPresenca
}

export interface ApontamentoMaquinaInput {
  maquina?: string
  identificacao_avulsa?: string
  horas_produtivas: string
  horas_paradas: string
  motivo_parada?: number
}

export interface OcorrenciaInput {
  tipo: string
  recurso_afetado: string
  descricao: string
}

export type Turno = 'diurno' | 'noturno'
export type Clima = 'sol' | 'nublado' | 'chuva' | 'chuva_forte'

export type StatusRegistro = 'aguardando_aprovacao' | 'aprovado' | 'rejeitado'

export interface RegistroDiarioInput {
  data_referencia: string
  turno: Turno
  clima: Clima
  equipe: string
  fiscal: number
  producoes: ProducaoDiariaInput[]
  presencas: PresencaInput[]
  maquinas: ApontamentoMaquinaInput[]
  ocorrencias: OcorrenciaInput[]
}

export interface Foto {
  id: string
  arquivo: string
  km: string | null
  created_at: string
}

export interface Producao extends ProducaoDiariaInput {
  id: string
  disciplina_nome: string
  servico_nome: string
  unidade_sigla: string
}

export interface Presenca extends PresencaInput {
  id: string
  pessoa_nome: string | null
}

export interface ApontamentoMaquina extends ApontamentoMaquinaInput {
  id: string
  maquina_nome: string | null
  maquina_codigo: string | null
  motivo_parada_descricao: string | null
  eficiencia: number
}

export interface Ocorrencia extends OcorrenciaInput {
  id: string
}

export interface RegistroDiario
  extends Omit<RegistroDiarioInput, 'producoes' | 'presencas' | 'maquinas' | 'ocorrencias'> {
  id: string
  autor: number
  status: StatusRegistro
  motivo_rejeicao: string
  aprovado_em: string | null
  created_at: string
  updated_at: string
  fotos: Foto[]
  producoes: Producao[]
  presencas: Presenca[]
  maquinas: ApontamentoMaquina[]
  ocorrencias: Ocorrencia[]
  equipe_nome: string
  fiscal_nome: string
}
