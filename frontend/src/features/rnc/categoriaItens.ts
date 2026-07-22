import type { Categoria, Gravidade, Origem, TipoRnc } from '../../types/rnc'

export const CATEGORIA_ITENS: Record<Categoria, string[]> = {
  terraplenagem: [
    'Serviços complementares',
    'Caminhos de serviço',
    'Cortes',
    'Empréstimos',
    'Aterros',
    'Limpeza',
    'Outros',
  ],
  pavimentacao: [
    'Regularização do subleito',
    'Reforço do subleito',
    'Sub-base',
    'Base',
    'Imprimação',
    'Pintura de ligação',
    'Camada de ligação',
    'Reciclagem',
    'Outros',
  ],
  contencoes: ['Infraestrutura', 'Mesoestrutura', 'Superestrutura', 'Encontros', 'Acabamentos', 'Outros'],
  oaes: ['Infraestrutura', 'Mesoestrutura', 'Superestrutura', 'Encontros', 'Outros'],
  oacs_e_drenagem: [
    'Bueiros',
    'Drenos transversais',
    'Canaletas e valetas',
    "Descidas d'água e escadas",
    'Caixas coletoras',
    'Drenagens',
    'Outros',
  ],
  sinalizacao_seguranca: ['Sinalização vertical', 'Sinalização horizontal', 'Sinalização de obras', 'Outros'],
  outros: [
    'Insumos e materiais',
    'Instalações e equipamentos',
    'Execução',
    'Procedimento',
    'Manejo ambiental',
    'Segurança do trabalho',
    'Controle de qualidade',
    'Controle',
    'Outros',
  ],
}

export const CATEGORIA_LABELS: Record<Categoria, string> = {
  terraplenagem: 'Terraplenagem',
  pavimentacao: 'Pavimentação',
  contencoes: 'Contenções',
  oaes: 'OAEs',
  oacs_e_drenagem: 'OACs e Drenagem',
  sinalizacao_seguranca: 'Sinalização e Segurança',
  outros: 'Outros',
}

export const ORIGEM_LABELS: Record<Origem, string> = {
  produto: 'Produto',
  servico: 'Serviço',
  pessoal: 'Pessoal',
  seguranca: 'Segurança',
  equipamento: 'Equipamento',
  projeto: 'Projeto',
}

export const GRAVIDADE_LABELS: Record<Gravidade, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const TIPO_LABELS: Record<TipoRnc, string> = {
  ac: 'Ação Corretiva',
  ap: 'Ação Preventiva',
}
