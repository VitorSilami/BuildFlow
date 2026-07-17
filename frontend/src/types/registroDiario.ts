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

export interface PresencaInput {
  pessoa?: string
  nome_avulso?: string
  funcao: string
  status: 'presente' | 'falta' | 'atestado'
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

export interface RegistroDiarioInput {
  data_referencia: string
  turno: 'diurno' | 'noturno'
  clima: 'sol' | 'nublado' | 'chuva' | 'chuva_forte'
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

export interface RegistroDiario extends RegistroDiarioInput {
  id: string
  autor: number
  created_at: string
  updated_at: string
  fotos: Foto[]
}
