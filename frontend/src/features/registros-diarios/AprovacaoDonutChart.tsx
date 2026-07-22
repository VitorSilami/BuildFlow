import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const CORES_STATUS = {
  aguardando_aprovacao: 'var(--color-amber-500)',
  aprovado: 'var(--color-emerald-500)',
  rejeitado: 'var(--color-red-500)',
} as const

interface AprovacaoDonutChartProps {
  aguardando: number
  aprovados: number
  rejeitados: number
}

export function AprovacaoDonutChart({ aguardando, aprovados, rejeitados }: AprovacaoDonutChartProps) {
  const dados = [
    { status: 'aguardando_aprovacao' as const, label: 'Aguardando', valor: aguardando },
    { status: 'aprovado' as const, label: 'Aprovado', valor: aprovados },
    { status: 'rejeitado' as const, label: 'Rejeitado', valor: rejeitados },
  ]

  return (
    <div aria-label="Gráfico de distribuição de status dos RDOs" style={{ width: '100%', height: 220 }}>
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
