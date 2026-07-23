import {
  CalendarClock,
  Gauge,
  Leaf,
  Package,
  Truck,
  User as UserIcon,
  Users,
  Workflow,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ErrorRetry,
  FormField,
  Input,
  Label,
  PageHeader,
  Skeleton,
  Textarea,
} from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { AdicionarAcaoCorretivaForm } from '../features/rnc/AdicionarAcaoCorretivaForm'
import { CATEGORIA_ITENS, CATEGORIA_LABELS, GRAVIDADE_LABELS, ORIGEM_LABELS, TIPO_LABELS } from '../features/rnc/categoriaItens'
import { NATIVE_SELECT_CLASSNAME } from '../features/rnc/nativeSelectClassName'
import { useAtualizarRnc, useConcluirRnc, useCriarRnc, useRnc } from '../features/rnc/rncApi'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { toast } from '../hooks/use-toast'
import { cn } from '../lib/utils'
import type { Categoria, Gravidade, Origem, RncInput, TipoRnc } from '../types/rnc'

const GRAVIDADE_BOTAO_ATIVO: Record<Gravidade, string> = {
  alta: 'border-red-500 bg-red-500/10 text-red-600',
  media: 'border-amber-500 bg-amber-500/10 text-amber-600',
  baixa: 'border-emerald-500 bg-emerald-500/10 text-emerald-600',
}

const CAMPOS_VAZIOS: RncInput = {
  data_emissao: '',
  contratada: '',
  categoria: 'terraplenagem',
  origem: 'servico',
  gravidade: 'alta',
  tipo: 'ac',
  item: '',
  subitem: '',
  norma: '',
  requisito: '',
  abrangencia: '',
  km: '',
  reincidencia: false,
  descricao: '',
  acao_imediata: '',
  data_implementacao: null,
  responsavel_implementacao: '',
  causa_metodo: false,
  causa_metodo_detalhe: '',
  causa_material: false,
  causa_material_detalhe: '',
  causa_mao_de_obra: false,
  causa_mao_de_obra_detalhe: '',
  causa_maquina: false,
  causa_maquina_detalhe: '',
  causa_medicao: false,
  causa_medicao_detalhe: '',
  causa_meio_ambiente: false,
  causa_meio_ambiente_detalhe: '',
  data_prazo: null,
  acoes_corretivas: [],
}

function RncFormSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </>
  )
}

export function RncFormPage() {
  const { projetoId, rncId } = useParams<{ projetoId: string; rncId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const ehEdicao = Boolean(rncId)
  const ehGerente = user?.perfil === 'gerente'

  const rnc = useRnc(rncId, ehGerente)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
    { label: 'RNCs', to: `/projetos/${projetoId}/rncs` },
    { label: ehEdicao ? 'Editar' : 'Nova' },
  ])
  const criarRnc = useCriarRnc(projetoId ?? '')
  const atualizarRnc = useAtualizarRnc(rncId ?? '')
  const concluirRnc = useConcluirRnc(rncId ?? '')

  const [form, setForm] = useState<RncInput>(CAMPOS_VAZIOS)
  const [eficaciaSelecionada, setEficaciaSelecionada] = useState<'eficaz' | 'ineficaz'>('eficaz')

  useEffect(() => {
    if (ehEdicao && rnc.data) {
      setForm({
        data_emissao: rnc.data.data_emissao,
        contratada: rnc.data.contratada,
        categoria: rnc.data.categoria,
        origem: rnc.data.origem,
        gravidade: rnc.data.gravidade,
        tipo: rnc.data.tipo,
        item: rnc.data.item,
        subitem: rnc.data.subitem,
        norma: rnc.data.norma,
        requisito: rnc.data.requisito,
        abrangencia: rnc.data.abrangencia,
        km: rnc.data.km,
        reincidencia: rnc.data.reincidencia,
        descricao: rnc.data.descricao,
        acao_imediata: rnc.data.acao_imediata,
        data_implementacao: rnc.data.data_implementacao,
        responsavel_implementacao: rnc.data.responsavel_implementacao,
        causa_metodo: rnc.data.causa_metodo,
        causa_metodo_detalhe: rnc.data.causa_metodo_detalhe,
        causa_material: rnc.data.causa_material,
        causa_material_detalhe: rnc.data.causa_material_detalhe,
        causa_mao_de_obra: rnc.data.causa_mao_de_obra,
        causa_mao_de_obra_detalhe: rnc.data.causa_mao_de_obra_detalhe,
        causa_maquina: rnc.data.causa_maquina,
        causa_maquina_detalhe: rnc.data.causa_maquina_detalhe,
        causa_medicao: rnc.data.causa_medicao,
        causa_medicao_detalhe: rnc.data.causa_medicao_detalhe,
        causa_meio_ambiente: rnc.data.causa_meio_ambiente,
        causa_meio_ambiente_detalhe: rnc.data.causa_meio_ambiente_detalhe,
        data_prazo: rnc.data.data_prazo,
        acoes_corretivas: [],
      })
    }
  }, [ehEdicao, rnc.data])

  function atualizarCampo<K extends keyof RncInput>(campo: K, valor: RncInput[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function handleSalvar() {
    if (ehEdicao) {
      atualizarRnc.mutate(form, {
        onSuccess: () => toast({ title: 'RNC atualizada.', variant: 'success' }),
        onError: () => toast({ title: 'Não foi possível atualizar a RNC.', variant: 'destructive' }),
      })
      return
    }
    criarRnc.mutate(form, {
      onSuccess: (rncCriada) => {
        toast({ title: 'RNC criada.', variant: 'success' })
        navigate(`/projetos/${projetoId}/rncs/${rncCriada.id}`)
      },
      onError: () => toast({ title: 'Não foi possível criar a RNC.', variant: 'destructive' }),
    })
  }

  function handleConcluir() {
    concluirRnc.mutate(eficaciaSelecionada, {
      onSuccess: () => toast({ title: 'RNC concluída.', variant: 'success' }),
      onError: () => toast({ title: 'Não foi possível concluir a RNC.', variant: 'destructive' }),
    })
  }

  if (!ehGerente) {
    return (
      <main aria-label={ehEdicao ? 'Editar RNC' : 'Nova RNC'}>
        <PageHeader title={ehEdicao ? 'Editar RNC' : 'Nova RNC'} breadcrumbs={breadcrumbs} />
        <Alert>Esta tela é restrita ao perfil Gerente.</Alert>
      </main>
    )
  }

  if (ehEdicao && rnc.isLoading) return <RncFormSkeleton />
  if (ehEdicao && rnc.isError) {
    return <ErrorRetry message="Não foi possível carregar a RNC." onRetry={() => void rnc.refetch()} />
  }

  const somenteLeitura = ehEdicao && rnc.data?.status === 'concluida'
  const itensDaCategoria = CATEGORIA_ITENS[form.categoria]

  return (
    <main aria-label={ehEdicao ? 'Editar RNC' : 'Nova RNC'}>
      <PageHeader
        title={ehEdicao && rnc.data ? `RNC-${String(rnc.data.numero_sequencial).padStart(3, '0')}` : 'Nova RNC'}
        breadcrumbs={breadcrumbs}
      />

      {somenteLeitura && <Alert>Esta RNC já foi concluída e não pode mais ser editada.</Alert>}

      <Card title="Identificação">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="rnc-data-emissao" label="Data de emissão">
            <Input
              id="rnc-data-emissao"
              type="date"
              value={form.data_emissao}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('data_emissao', event.target.value)}
            />
          </FormField>
          <FormField id="rnc-contratada" label="Contratada">
            <Input
              id="rnc-contratada"
              value={form.contratada}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('contratada', event.target.value)}
            />
          </FormField>
          <FormField id="rnc-categoria" label="Categoria">
            <select
              id="rnc-categoria"
              className={NATIVE_SELECT_CLASSNAME}
              value={form.categoria}
              disabled={somenteLeitura}
              onChange={(event) => {
                const novaCategoria = event.target.value as Categoria
                atualizarCampo('categoria', novaCategoria)
                atualizarCampo('item', '')
              }}
            >
              {Object.entries(CATEGORIA_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="rnc-item" label="Item">
            <select
              id="rnc-item"
              className={NATIVE_SELECT_CLASSNAME}
              value={form.item}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('item', event.target.value)}
            >
              <option value="">Selecione…</option>
              {itensDaCategoria.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="rnc-subitem" label="Subitem">
            <Input
              id="rnc-subitem"
              value={form.subitem}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('subitem', event.target.value)}
            />
          </FormField>
          <FormField id="rnc-origem" label="Origem">
            <select
              id="rnc-origem"
              className={NATIVE_SELECT_CLASSNAME}
              value={form.origem}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('origem', event.target.value as Origem)}
            >
              {Object.entries(ORIGEM_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <div>
            <p id="rnc-gravidade-label" className="mb-1.5 text-sm font-medium text-ink">
              Gravidade
            </p>
            <div role="group" aria-labelledby="rnc-gravidade-label" className="flex gap-2">
              {(Object.entries(GRAVIDADE_LABELS) as [Gravidade, string][]).map(([valor, label]) => (
                <button
                  key={valor}
                  type="button"
                  disabled={somenteLeitura}
                  aria-pressed={form.gravidade === valor}
                  onClick={() => atualizarCampo('gravidade', valor)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    form.gravidade === valor
                      ? GRAVIDADE_BOTAO_ATIVO[valor]
                      : 'border-border text-muted-foreground hover:bg-surface',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <FormField id="rnc-tipo" label="Tipo">
            <select
              id="rnc-tipo"
              className={NATIVE_SELECT_CLASSNAME}
              value={form.tipo}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('tipo', event.target.value as TipoRnc)}
            >
              {Object.entries(TIPO_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="rnc-norma" label="Norma / requisito normativo">
            <Input
              id="rnc-norma"
              value={form.norma}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('norma', event.target.value)}
            />
          </FormField>
          <FormField id="rnc-abrangencia" label="Abrangência">
            <Input
              id="rnc-abrangencia"
              value={form.abrangencia}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('abrangencia', event.target.value)}
            />
          </FormField>
          <FormField id="rnc-km" label="Km">
            <Input
              id="rnc-km"
              value={form.km}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('km', event.target.value)}
            />
          </FormField>
          <FormField id="rnc-prazo" label="Data prazo">
            <Input
              id="rnc-prazo"
              type="date"
              value={form.data_prazo ?? ''}
              disabled={somenteLeitura}
              onChange={(event) => atualizarCampo('data_prazo', event.target.value || null)}
            />
          </FormField>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            id="rnc-reincidencia"
            checked={form.reincidencia}
            disabled={somenteLeitura}
            onCheckedChange={(checked) => atualizarCampo('reincidencia', checked === true)}
          />
          <Label htmlFor="rnc-reincidencia">Reincidência</Label>
        </div>
      </Card>

      <Card title="Detalhamento">
        <FormField id="rnc-descricao" label="Descrição">
          <Textarea
            id="rnc-descricao"
            value={form.descricao}
            disabled={somenteLeitura}
            onChange={(event) => atualizarCampo('descricao', event.target.value)}
          />
        </FormField>
        <FormField id="rnc-acao-imediata" label="Ação imediata">
          <Textarea
            id="rnc-acao-imediata"
            value={form.acao_imediata}
            disabled={somenteLeitura}
            onChange={(event) => atualizarCampo('acao_imediata', event.target.value)}
          />
        </FormField>
        <FormField id="rnc-responsavel-implementacao" label="Responsável pela implementação">
          <Input
            id="rnc-responsavel-implementacao"
            value={form.responsavel_implementacao}
            disabled={somenteLeitura}
            onChange={(event) => atualizarCampo('responsavel_implementacao', event.target.value)}
          />
        </FormField>
      </Card>

      <Card title="Análise de causa raiz (6M)">
        {/* Seis blocos explícitos (não um .map() genérico sobre keyof RncInput) —
            atribuição dinâmica de propriedade por chave tipada exigiria um cast
            (`as never`) em cada onChange, o que é mais risco de quebrar o build
            do que a repetição de 6 blocos quase idênticos. */}
        <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rnc-causa-metodo"
              checked={form.causa_metodo}
              disabled={somenteLeitura}
              onCheckedChange={(checked) => atualizarCampo('causa_metodo', checked === true)}
            />
            <Label htmlFor="rnc-causa-metodo" className="flex items-center gap-1.5">
              <Workflow size={14} className="text-muted-foreground" aria-hidden="true" />
              Método (processo)
            </Label>
          </div>
          {form.causa_metodo && (
            <Input
              aria-label="Detalhe: Método"
              value={form.causa_metodo_detalhe}
              disabled={somenteLeitura}
              placeholder="Detalhe (opcional)"
              onChange={(event) => atualizarCampo('causa_metodo_detalhe', event.target.value)}
            />
          )}
        </div>

        <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rnc-causa-material"
              checked={form.causa_material}
              disabled={somenteLeitura}
              onCheckedChange={(checked) => atualizarCampo('causa_material', checked === true)}
            />
            <Label htmlFor="rnc-causa-material" className="flex items-center gap-1.5">
              <Package size={14} className="text-muted-foreground" aria-hidden="true" />
              Material
            </Label>
          </div>
          {form.causa_material && (
            <Input
              aria-label="Detalhe: Material"
              value={form.causa_material_detalhe}
              disabled={somenteLeitura}
              placeholder="Detalhe (opcional)"
              onChange={(event) => atualizarCampo('causa_material_detalhe', event.target.value)}
            />
          )}
        </div>

        <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rnc-causa-mao-de-obra"
              checked={form.causa_mao_de_obra}
              disabled={somenteLeitura}
              onCheckedChange={(checked) => atualizarCampo('causa_mao_de_obra', checked === true)}
            />
            <Label htmlFor="rnc-causa-mao-de-obra" className="flex items-center gap-1.5">
              <Users size={14} className="text-muted-foreground" aria-hidden="true" />
              Mão de obra
            </Label>
          </div>
          {form.causa_mao_de_obra && (
            <Input
              aria-label="Detalhe: Mão de obra"
              value={form.causa_mao_de_obra_detalhe}
              disabled={somenteLeitura}
              placeholder="Detalhe (opcional)"
              onChange={(event) => atualizarCampo('causa_mao_de_obra_detalhe', event.target.value)}
            />
          )}
        </div>

        <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rnc-causa-maquina"
              checked={form.causa_maquina}
              disabled={somenteLeitura}
              onCheckedChange={(checked) => atualizarCampo('causa_maquina', checked === true)}
            />
            <Label htmlFor="rnc-causa-maquina" className="flex items-center gap-1.5">
              <Truck size={14} className="text-muted-foreground" aria-hidden="true" />
              Máquina
            </Label>
          </div>
          {form.causa_maquina && (
            <Input
              aria-label="Detalhe: Máquina"
              value={form.causa_maquina_detalhe}
              disabled={somenteLeitura}
              placeholder="Detalhe (opcional)"
              onChange={(event) => atualizarCampo('causa_maquina_detalhe', event.target.value)}
            />
          )}
        </div>

        <div className="mb-3 flex flex-col gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rnc-causa-medicao"
              checked={form.causa_medicao}
              disabled={somenteLeitura}
              onCheckedChange={(checked) => atualizarCampo('causa_medicao', checked === true)}
            />
            <Label htmlFor="rnc-causa-medicao" className="flex items-center gap-1.5">
              <Gauge size={14} className="text-muted-foreground" aria-hidden="true" />
              Medição
            </Label>
          </div>
          {form.causa_medicao && (
            <Input
              aria-label="Detalhe: Medição"
              value={form.causa_medicao_detalhe}
              disabled={somenteLeitura}
              placeholder="Detalhe (opcional)"
              onChange={(event) => atualizarCampo('causa_medicao_detalhe', event.target.value)}
            />
          )}
        </div>

        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rnc-causa-meio-ambiente"
              checked={form.causa_meio_ambiente}
              disabled={somenteLeitura}
              onCheckedChange={(checked) => atualizarCampo('causa_meio_ambiente', checked === true)}
            />
            <Label htmlFor="rnc-causa-meio-ambiente" className="flex items-center gap-1.5">
              <Leaf size={14} className="text-muted-foreground" aria-hidden="true" />
              Meio ambiente
            </Label>
          </div>
          {form.causa_meio_ambiente && (
            <Input
              aria-label="Detalhe: Meio ambiente"
              value={form.causa_meio_ambiente_detalhe}
              disabled={somenteLeitura}
              placeholder="Detalhe (opcional)"
              onChange={(event) => atualizarCampo('causa_meio_ambiente_detalhe', event.target.value)}
            />
          )}
        </div>
      </Card>

      <Card title="Ações corretivas">
        {ehEdicao && rnc.data && rnc.data.acoes_corretivas.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2" aria-label="Ações corretivas cadastradas">
            {rnc.data.acoes_corretivas.map((acao) => (
              <li key={acao.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-ink">{acao.descricao}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <UserIcon size={12} aria-hidden="true" />
                    {acao.responsavel}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarClock size={12} aria-hidden="true" />
                    até {acao.data_limite}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {ehEdicao && rncId && !somenteLeitura && <AdicionarAcaoCorretivaForm rncId={rncId} />}
        {!ehEdicao && (
          <p className="text-sm text-muted-foreground">
            Salve a RNC primeiro para poder adicionar ações corretivas.
          </p>
        )}
      </Card>

      {!somenteLeitura && (
        <Button onClick={handleSalvar} disabled={criarRnc.isPending || atualizarRnc.isPending}>
          {ehEdicao ? 'Salvar alterações' : 'Criar RNC'}
        </Button>
      )}

      {ehEdicao && rnc.data?.status === 'pendente' && (
        <Card title="Concluir RNC">
          <FormField id="rnc-eficacia" label="Eficácia">
            <select
              id="rnc-eficacia"
              className={NATIVE_SELECT_CLASSNAME}
              value={eficaciaSelecionada}
              onChange={(event) => setEficaciaSelecionada(event.target.value as 'eficaz' | 'ineficaz')}
            >
              <option value="eficaz">Eficaz</option>
              <option value="ineficaz">Ineficaz</option>
            </select>
          </FormField>
          <Button onClick={handleConcluir} disabled={concluirRnc.isPending}>
            Concluir RNC
          </Button>
        </Card>
      )}
    </main>
  )
}
