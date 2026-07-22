import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { CustosOciosidade } from '../../types/custoOciosidade'

export function useCustosOciosidade(projetoId: string, mes: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['custos-ociosidade', projetoId, mes],
    queryFn: () =>
      apiClient.get<CustosOciosidade>(
        `/api/v1/projetos/${projetoId}/custos-ociosidade/?mes=${mes}`,
      ),
    enabled: habilitado && Boolean(projetoId) && Boolean(mes),
  })
}
