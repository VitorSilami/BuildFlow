import type {
  ApontamentoMaquinaInput,
  OcorrenciaInput,
  PresencaInput,
  ProducaoDiariaInput,
} from '../../../types/registroDiario'

export const PRODUCAO_VAZIA: ProducaoDiariaInput = {
  rodovia: '',
  sentido: 'crescente',
  disciplina: '',
  servico: '',
  km_inicial: '',
  km_final: '',
  quantidade: '',
  unidade: 0,
}

export const PRESENCA_VAZIA: PresencaInput = { nome_avulso: '', funcao: '', status: 'presente' }

export const MAQUINA_VAZIA: ApontamentoMaquinaInput = {
  identificacao_avulsa: '',
  horas_produtivas: '',
  horas_paradas: '0',
}

export const OCORRENCIA_VAZIA: OcorrenciaInput = {
  tipo: 'outro',
  recurso_afetado: 'outro',
  descricao: '',
  km: '',
}
