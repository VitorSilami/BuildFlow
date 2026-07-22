import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Card, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { useCustosOciosidade } from '../features/custos-ociosidade/custosOciosidadeApi'
import { CustoCompositionDonutChart } from '../features/custos-ociosidade/CustoCompositionDonutChart'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { execucaoCorClasse, formatMoeda } from '../lib/format'
import type { CustosOciosidade } from '../types/custoOciosidade'

function mesAtualFiltro(): string {
  return new Date().toISOString().slice(0, 7)
}

function CustosOciosidadeSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}

function TileCusto({ label, valor, corFundo }: { label: string; valor: string; corFundo?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${corFundo ?? 'border-dashed border-border'}`}>
      <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-xl font-bold text-ink">{valor}</p>
    </div>
  )
}

function BarraSimples({ label, valor, maximo, corBarra }: { label: string; valor: number; maximo: number; corBarra: string }) {
  const pct = maximo > 0 ? (valor / maximo) * 100 : 0
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${corBarra}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function BarraHistograma({
  label,
  principal,
  secundario,
  maximo,
}: {
  label: string
  principal: number
  secundario: number
  maximo: number
}) {
  const pctPrincipal = maximo > 0 ? (principal / maximo) * 100 : 0
  const pctSecundario = maximo > 0 ? (secundario / maximo) * 100 : 0
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-emerald-500" style={{ width: `${pctPrincipal}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${pctSecundario}%` }} />
      </div>
    </div>
  )
}

function SemValorDefinido() {
  return (
    <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      sem valor definido
    </span>
  )
}

function CustosOciosidadeConteudo({ dados }: { dados: CustosOciosidade }) {
  const maximoMaoDeObra = Math.max(
    ...dados.mao_de_obra_por_funcao.map((item) => Number(item.custo) + Number(item.deficit)),
    1,
  )
  const maximoMaquinas = Math.max(
    ...dados.maquinas_por_equipamento.map(
      (item) => Number(item.custo_produtivo) + Number(item.custo_ocioso),
    ),
    1,
  )

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <TileCusto label="Custo mão de obra" valor={formatMoeda(dados.custo_mao_de_obra)} />
          <TileCusto label="Déficit mão de obra" valor={formatMoeda(dados.deficit_mao_de_obra)} />
          <TileCusto label="Custo máquinas" valor={formatMoeda(dados.custo_produtivo_maquinas)} />
          <TileCusto label="Custo ocioso máquinas" valor={formatMoeda(dados.custo_ocioso_maquinas)} />
          <TileCusto label="Custo total do mês" valor={formatMoeda(dados.custo_total)} />
          <TileCusto
            label="Ociosidade evitável"
            valor={formatMoeda(dados.ociosidade_evitavel_total)}
            corFundo="border-red-500/30 bg-red-500/5"
          />
          <TileCusto label="Horas ociosas" valor={`${dados.horas_ociosas_total}h`} />
          <TileCusto
            label="Eficiência gerencial"
            valor={
              dados.eficiencia_gerencial_percentual === null
                ? '—'
                : `${dados.eficiencia_gerencial_percentual}%`
            }
          />
        </div>
        <Card title="Composição do custo total">
          <CustoCompositionDonutChart
            custoMaoDeObra={Number(dados.custo_mao_de_obra)}
            custoProdutivoMaquinas={Number(dados.custo_produtivo_maquinas)}
            custoOciosoMaquinas={Number(dados.custo_ocioso_maquinas)}
          />
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Mão de obra por função" eyebrow="Custo trabalhado vs. déficit">
          {dados.mao_de_obra_por_funcao.length === 0 ? (
            <EmptyState>Nenhuma presença registrada no mês.</EmptyState>
          ) : (
            dados.mao_de_obra_por_funcao.map((item) => (
              <BarraHistograma
                key={item.funcao}
                label={item.funcao}
                principal={Number(item.custo)}
                secundario={Number(item.deficit)}
                maximo={maximoMaoDeObra}
              />
            ))
          )}
        </Card>

        <Card title="Máquinas por equipamento" eyebrow="Custo produtivo vs. ocioso">
          {dados.maquinas_por_equipamento.length === 0 ? (
            <EmptyState>Nenhum apontamento de máquina no mês.</EmptyState>
          ) : (
            dados.maquinas_por_equipamento.map((item) => (
              <BarraHistograma
                key={item.maquina_id}
                label={`${item.nome} (${item.codigo})`}
                principal={Number(item.custo_produtivo)}
                secundario={Number(item.custo_ocioso)}
                maximo={maximoMaquinas}
              />
            ))
          )}
        </Card>
      </div>

      <Card title="Eficiência e custo parado por equipamento">
        {dados.maquinas_por_equipamento.length === 0 ? (
          <EmptyState>Nenhum apontamento de máquina no mês.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {dados.maquinas_por_equipamento.map((item) => (
              <li key={item.maquina_id} className="flex flex-col gap-1 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    {item.nome} ({item.codigo}) — {item.equipe_nome}
                  </span>
                  <span className="flex items-center">
                    {item.eficiencia_percentual === null ? '—' : `${item.eficiencia_percentual}%`}
                    {' · '}
                    {formatMoeda(item.custo_ocioso)}
                    {!item.tem_valor_cadastrado && <SemValorDefinido />}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${execucaoCorClasse(
                      item.eficiencia_percentual === null ? null : String(item.eficiencia_percentual),
                    )}`}
                    style={{ width: `${item.eficiencia_percentual ?? 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Horas ociosas por causa">
          {dados.horas_ociosas_por_causa.length === 0 ? (
            <EmptyState>Nenhuma hora ociosa registrada no mês.</EmptyState>
          ) : (
            (() => {
              const maximoHoras = Math.max(...dados.horas_ociosas_por_causa.map((item) => Number(item.horas)), 1)
              return dados.horas_ociosas_por_causa.map((item) => (
                <BarraSimples
                  key={item.motivo}
                  label={`${item.motivo} — ${item.horas}h`}
                  valor={Number(item.horas)}
                  maximo={maximoHoras}
                  corBarra="bg-amber-500"
                />
              ))
            })()
          )}
        </Card>

        <Card title="Faltas por pessoa">
          {dados.faltas_por_pessoa.length === 0 ? (
            <EmptyState>Nenhuma falta registrada no mês.</EmptyState>
          ) : (
            (() => {
              const maximoValorPerdido = Math.max(
                ...dados.faltas_por_pessoa.map((item) => Number(item.valor_perdido)),
                1,
              )
              return dados.faltas_por_pessoa.map((item) => (
                <div key={item.pessoa_id} className="mb-3">
                  <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {item.nome} ({item.funcao}) — {item.faltas} falta(s) — {formatMoeda(item.valor_perdido)}
                    </span>
                    {item.reincidente && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-600">
                        reincidente
                      </span>
                    )}
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${(Number(item.valor_perdido) / maximoValorPerdido) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            })()
          )}
        </Card>
      </div>
    </>
  )
}

export function CustosOciosidadePage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { user } = useAuth()
  const [mes, setMes] = useState(mesAtualFiltro())
  const ehGerente = user?.perfil === 'gerente'
  const custos = useCustosOciosidade(projetoId ?? '', mes, ehGerente)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Custos & Ociosidade' }])

  if (!ehGerente) {
    return (
      <main aria-label="Custos e ociosidade">
        <PageHeader title="Custos & Ociosidade" breadcrumbs={breadcrumbs} />
        <Alert>Esta tela é restrita ao perfil Gerente.</Alert>
      </main>
    )
  }

  return (
    <main aria-label="Custos e ociosidade">
      <PageHeader
        title="Custos & Ociosidade"
        breadcrumbs={breadcrumbs}
        actions={
          <input
            type="month"
            aria-label="Mês de referência"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        }
      />

      {custos.isLoading && <CustosOciosidadeSkeleton />}

      {custos.isError && (
        <ErrorRetry
          message="Não foi possível carregar os custos do mês."
          onRetry={() => void custos.refetch()}
        />
      )}

      {!custos.isLoading && !custos.isError && custos.data && (
        <CustosOciosidadeConteudo dados={custos.data} />
      )}
    </main>
  )
}
