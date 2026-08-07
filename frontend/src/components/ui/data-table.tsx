import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

export interface DataTableColumn<TData> {
  id: string
  header: ReactNode
  cell: (row: TData) => ReactNode
  className?: string
  headerClassName?: string
}

interface DataTableProps<TData> {
  columns: Array<DataTableColumn<TData>>
  data: TData[]
  getRowKey: (row: TData, index: number) => string
  emptyTitle?: string
  emptyMessage?: ReactNode
  ariaLabel?: string
  className?: string
}

export function DataTable<TData>({
  columns,
  data,
  getRowKey,
  emptyTitle = 'Nenhum item encontrado',
  emptyMessage = 'Ajuste os filtros ou crie um novo registro.',
  ariaLabel,
  className,
}: DataTableProps<TData>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyMessage}</EmptyState>
  }

  return (
    <Table aria-label={ariaLabel} className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.headerClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow key={getRowKey(row, index)}>
            {columns.map((column) => (
              <TableCell key={column.id} className={cn('align-top', column.className)}>
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
