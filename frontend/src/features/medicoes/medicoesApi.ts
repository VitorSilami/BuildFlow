import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { CriarMedicaoInput, Medicao } from '../../types/medicao'

export function useMedicoes(projetoId: string) {
  return useQuery({
    queryKey: ['medicoes', projetoId],
    queryFn: () => apiClient.get<Medicao[]>(`/api/v1/projetos/${projetoId}/medicoes/`),
    enabled: Boolean(projetoId),
  })
}

export function useMedicao(projetoId: string | undefined, medicaoId: string | undefined) {
  return useQuery({
    queryKey: ['medicao', projetoId, medicaoId],
    queryFn: () => apiClient.get<Medicao>(`/api/v1/projetos/${projetoId}/medicoes/${medicaoId}/`),
    enabled: Boolean(projetoId && medicaoId),
  })
}

function useInvalidarMedicoes(projetoId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['medicoes', projetoId] })
  }
}

export function useCriarMedicao(projetoId: string) {
  const invalidar = useInvalidarMedicoes(projetoId)
  return useMutation({
    mutationFn: (values: CriarMedicaoInput) =>
      apiClient.post<Medicao>(`/api/v1/projetos/${projetoId}/medicoes/`, values),
    onSuccess: invalidar,
  })
}

export function useAprovarMedicao(projetoId: string) {
  const invalidar = useInvalidarMedicoes(projetoId)
  return useMutation({
    mutationFn: (medicaoId: string) =>
      apiClient.post<Medicao>(`/api/v1/projetos/${projetoId}/medicoes/${medicaoId}/aprovar/`),
    onSuccess: invalidar,
  })
}

export function useRejeitarMedicao(projetoId: string) {
  const invalidar = useInvalidarMedicoes(projetoId)
  return useMutation({
    mutationFn: ({ medicaoId, motivoRejeicao }: { medicaoId: string; motivoRejeicao: string }) =>
      apiClient.post<Medicao>(`/api/v1/projetos/${projetoId}/medicoes/${medicaoId}/rejeitar/`, {
        motivo_rejeicao: motivoRejeicao,
      }),
    onSuccess: invalidar,
  })
}

export function useCancelarMedicao(projetoId: string) {
  const invalidar = useInvalidarMedicoes(projetoId)
  return useMutation({
    mutationFn: (medicaoId: string) =>
      apiClient.delete(`/api/v1/projetos/${projetoId}/medicoes/${medicaoId}/`),
    onSuccess: invalidar,
  })
}
