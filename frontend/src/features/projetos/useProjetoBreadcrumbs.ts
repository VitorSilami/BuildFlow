import type { Breadcrumb } from '../../components/ui/page-header'
import { useProjeto } from './projetosApi'

export function useProjetoBreadcrumbs(
  projetoId: string | undefined,
  trilhaFinal: Breadcrumb[],
): Breadcrumb[] {
  const projeto = useProjeto(projetoId)
  const nomeProjeto = projeto.data?.nome ?? '…'

  return [
    { label: 'Projetos', to: '/projetos' },
    { label: nomeProjeto, to: `/projetos/${projetoId}/registros-diarios` },
    ...trilhaFinal,
  ]
}
