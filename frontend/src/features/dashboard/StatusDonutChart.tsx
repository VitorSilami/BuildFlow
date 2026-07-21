import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const CORES_STATUS = {
  ativo: '#10b981',
  pausado: '#f59e0b',
  concluido: '#64748b',
} as const

interface StatusDonutChartProps {
  ativos: number
  pausados: number
  concluidos: number
}

export function StatusDonutChart({ ativos, pausados, concluidos }: StatusDonutChartProps) {
  const dados = [
    { status: 'ativo' as const, label: 'Ativos', valor: ativos },
    { status: 'pausado' as const, label: 'Pausados', valor: pausados },
    { status: 'concluido' as const, label: 'Concluídos', valor: concluidos },
  ]

  return (
    <div aria-label="Gráfico de distribuição de status" style={{ width: '100%', height: 220 }}>
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
              <Cell key={entrada.status} fill={CORES_STATUS[entrada.status]} />
            ))}
          </Pie>
          <Tooltip
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
