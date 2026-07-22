import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { ConfiguracaoProjeto, Disciplina, MetaMensal, ValorCusto } from '../../types/configuracao'
import type { Equipe, Maquina, Pessoa } from '../../types/registroDiario'

export function useConfiguracaoProjeto(projetoId: string) {
  return useQuery({
    queryKey: ['configuracao', projetoId],
    queryFn: () => apiClient.get<ConfiguracaoProjeto>(`/api/v1/projetos/${projetoId}/configuracao/`),
  })
}

function useInvalidarConfiguracao(projetoId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['configuracao', projetoId] })
    void queryClient.invalidateQueries({ queryKey: ['configuracao-rdo', projetoId] })
  }
}

export function useCriarDisciplina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (nome: string) =>
      apiClient.post<Disciplina>(`/api/v1/projetos/${projetoId}/configuracao/disciplinas/`, { nome }),
    onSuccess: invalidar,
  })
}

export function useCriarEquipe(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (nome: string) =>
      apiClient.post<Equipe>(`/api/v1/projetos/${projetoId}/configuracao/equipes/`, { nome }),
    onSuccess: invalidar,
  })
}

export function useCriarPessoa(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({ equipeId, nome, funcao }: { equipeId: string; nome: string; funcao: string }) =>
      apiClient.post<Pessoa>(`/api/v1/configuracoes/equipes/${equipeId}/pessoas/`, { nome, funcao }),
    onSuccess: invalidar,
  })
}

export function useCriarMaquina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({ equipeId, codigo, nome }: { equipeId: string; codigo: string; nome: string }) =>
      apiClient.post<Maquina>(`/api/v1/configuracoes/equipes/${equipeId}/maquinas/`, { codigo, nome }),
    onSuccess: invalidar,
  })
}

export function useCriarMeta(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: { disciplina: string; unidade: number; valor_alvo: string; peso_percentual?: string }) =>
      apiClient.post<MetaMensal>(`/api/v1/projetos/${projetoId}/configuracao/metas/`, values),
    onSuccess: invalidar,
  })
}

export function useCriarValorCusto(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: {
      tipo: string
      descricao: string
      valor: string
      funcao?: string
      maquina?: string
    }) => apiClient.post<ValorCusto>(`/api/v1/projetos/${projetoId}/configuracao/valores/`, values),
    onSuccess: invalidar,
  })
}
