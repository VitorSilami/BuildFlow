import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { CatalogoServico, ConfiguracaoProjeto, Disciplina, ValorCusto } from '../../types/configuracao'
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
    mutationFn: (values: { nome: string; peso_percentual?: string }) =>
      apiClient.post<Disciplina>(`/api/v1/projetos/${projetoId}/configuracao/disciplinas/`, values),
    onSuccess: invalidar,
  })
}

export function useAtualizarDisciplina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({ disciplinaId, peso_percentual }: { disciplinaId: string; peso_percentual: string }) =>
      apiClient.patch<Disciplina>(`/api/v1/configuracoes/disciplinas/${disciplinaId}/`, { peso_percentual }),
    onSuccess: invalidar,
  })
}

export function useCriarServico(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({
      disciplinaId,
      nome,
      unidade,
      peso_percentual,
      quantidade_planejada,
    }: {
      disciplinaId: string
      nome: string
      unidade: number
      peso_percentual?: string
      quantidade_planejada?: string
    }) =>
      apiClient.post<CatalogoServico>(`/api/v1/configuracoes/disciplinas/${disciplinaId}/servicos/`, {
        nome,
        unidade,
        peso_percentual,
        quantidade_planejada,
      }),
    onSuccess: invalidar,
  })
}

export function useAtualizarServico(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({
      servicoId,
      ...values
    }: {
      servicoId: string
      peso_percentual?: string
      quantidade_planejada?: string
      quantidade_executada?: string
    }) => apiClient.patch<CatalogoServico>(`/api/v1/configuracoes/servicos/${servicoId}/`, values),
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
