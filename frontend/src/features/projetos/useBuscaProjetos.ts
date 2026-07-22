import { useState } from 'react'
import { useProjetos } from './projetosApi'

const LIMITE_PADRAO = 5

export function useBuscaProjetos(limite = LIMITE_PADRAO) {
  const [termo, setTermo] = useState('')
  const projetos = useProjetos({ enabled: termo.length > 0 })

  const resultados = termo
    ? (projetos.data?.results ?? [])
        .filter((projeto) => projeto.nome.toLowerCase().includes(termo.toLowerCase()))
        .slice(0, limite)
    : []

  return { termo, setTermo, resultados }
}
