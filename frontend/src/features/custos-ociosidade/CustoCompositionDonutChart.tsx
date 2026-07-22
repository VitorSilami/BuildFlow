import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoeda } from '../../lib/format'

const CORES_COMPOSICAO = {
  mao_de_obra: 'var(--color-primary)',
  maquinas_produtivo: 'var(--color-emerald-500)',
  maquinas_ocioso: 'var(--color-red-500)',
} as const

interface CustoCompositionDonutChartProps {
  custoMaoDeObra: number
  custoProdutivoMaquinas: number
  custoOciosoMaquinas: number
}

export function CustoCompositionDonutChart({
  custoMaoDeObra,
  custoProdutivoMaquinas,
  custoOciosoMaquinas,
}: CustoCompositionDonutChartProps) {
  const dados = [
    { composicao: 'mao_de_obra' as const, label: 'Mão de obra', valor: custoMaoDeObra },
    { composicao: 'maquinas_produtivo' as const, label: 'Máquinas produtivas', valor: custoProdutivoMaquinas },
    { composicao: 'maquinas_ocioso' as const, label: 'Máquinas ociosas', valor: custoOciosoMaquinas },
  ]

  return (
    <div aria-label="Gráfico de composição do custo total" style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={dados}
            dataKey="valor"
            nameKey="label"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {dados.map((entrada) => (
              <Cell key={entrada.composicao} fill={CORES_COMPOSICAO[entrada.composicao]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(valor: number) => formatMoeda(String(valor))}
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
