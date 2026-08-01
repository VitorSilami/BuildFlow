import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Disciplina, StatusEap } from '../../types/configuracao'

interface GanttChartProps {
  disciplinas: Disciplina[]
}

const ALTURA_CABECALHO = 40
const ALTURA_POR_LINHA = 40
const MS_POR_DIA = 24 * 60 * 60 * 1000

const STATUS_GANTT_CORES: Record<StatusEap, string> = {
  concluido: '#10b981',
  no_prazo: '#10b981',
  atencao: '#f59e0b',
  critico: '#ef4444',
  nao_iniciado: 'var(--color-muted-foreground)',
  planejado: '#06b6d4',
}
const COR_SEM_STATUS = 'var(--color-muted-foreground)'

function corDaBarra(status: StatusEap | null): string {
  return status === null ? COR_SEM_STATUS : STATUS_GANTT_CORES[status]
}

function parseDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function gerarTicksMensais(minimo: number, maximo: number): number[] {
  const ticks: number[] = []
  const cursor = new Date(minimo)
  cursor.setDate(1)
  cursor.setHours(0, 0, 0, 0)
  while (cursor.getTime() <= maximo) {
    ticks.push(cursor.getTime() - minimo)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return ticks
}

interface BarraDuracaoProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: { avancoReal: number | null; cor: string }
}

function BarraDuracao({ x = 0, y = 0, width = 0, height = 0, payload }: BarraDuracaoProps) {
  const cor = payload?.cor ?? COR_SEM_STATUS
  const avancoReal = payload?.avancoReal ?? null
  const larguraProgresso = avancoReal === null ? 0 : Math.max(0, (width * Math.min(100, avancoReal)) / 100)
  const larguraVisivel = Math.max(2, width)
  return (
    <g>
      <rect x={x} y={y} width={larguraVisivel} height={height} rx={4} fill={cor} fillOpacity={0.18} stroke={cor} strokeWidth={1} />
      <rect x={x} y={y} width={larguraProgresso} height={height} rx={4} fill={cor} />
    </g>
  )
}

interface TooltipGanttProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: { nome: string; avancoReal: number | null } }>
}

function TooltipGantt({ active, payload }: TooltipGanttProps) {
  if (!active || !payload || payload.length === 0) return null
  const linha = payload[0].payload
  if (!linha) return null
  const { nome, avancoReal } = linha
  return (
    <div
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontSize: 12,
        padding: '6px 10px',
      }}
    >
      <div style={{ fontWeight: 600 }}>{nome}</div>
      <div>{avancoReal === null ? '—' : `${avancoReal}% executado`}</div>
    </div>
  )
}

function achatarDisciplinas(disciplinas: Disciplina[]): Disciplina[] {
  return disciplinas.flatMap((disciplina) => [disciplina, ...achatarDisciplinas(disciplina.subdisciplinas)])
}

export function GanttChart({ disciplinas }: GanttChartProps) {
  const linhas = achatarDisciplinas(disciplinas)
    .filter((d) => d.data_inicio_prevista !== null && d.data_fim_prevista !== null)
    .map((d) => ({
      id: d.id,
      nome: d.nome,
      inicio: parseDataLocal(d.data_inicio_prevista as string).getTime(),
      // data_fim_prevista e inclusiva (o servico ainda esta em andamento durante
      // o proprio dia final) — soma 1 dia pra virar um instante exclusivo, senao
      // o ultimo dia do cronograma tem duracao zero e a linha "Hoje" some nele.
      fim: parseDataLocal(d.data_fim_prevista as string).getTime() + MS_POR_DIA,
      avancoReal: d.avanco_percentual ? Number(d.avanco_percentual) : null,
      cor: corDaBarra(d.status_eap),
    }))

  if (linhas.length === 0) return null

  const dominioMinimo = Math.min(...linhas.map((l) => l.inicio))
  const dominioMaximo = Math.max(...linhas.map((l) => l.fim))

  const dados = linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    offset: l.inicio - dominioMinimo,
    duracao: l.fim - l.inicio,
    avancoReal: l.avancoReal,
    cor: l.cor,
  }))

  const ticksMensais = gerarTicksMensais(dominioMinimo, dominioMaximo)
  const hojeOffset = Date.now() - dominioMinimo
  const mostrarHoje = hojeOffset >= 0 && hojeOffset <= dominioMaximo - dominioMinimo

  return (
    <div
      aria-label="Cronograma da EAP"
      style={{ width: '100%', height: ALTURA_CABECALHO + linhas.length * ALTURA_POR_LINHA }}
    >
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            domain={[0, dominioMaximo - dominioMinimo]}
            ticks={ticksMensais}
            tickFormatter={(offset: number) =>
              new Date(offset + dominioMinimo).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
            }
            stroke="var(--color-muted-foreground)"
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="id"
            tickFormatter={(id: string) => dados.find((d) => d.id === id)?.nome ?? ''}
            // 180px cabe nomes de subdisciplina mais longos sem quebra de linha no Recharts
            width={180}
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={TooltipGantt} />
          {mostrarHoje && (
            <ReferenceLine
              x={hojeOffset}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              label={{ value: 'Hoje', position: 'top', fill: '#f59e0b', fontSize: 11, fontWeight: 600 }}
            />
          )}
          <Bar dataKey="offset" stackId="gantt" fill="transparent" isAnimationActive={false} name="offset" />
          <Bar dataKey="duracao" stackId="gantt" shape={BarraDuracao} isAnimationActive={false} name="duracao" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
