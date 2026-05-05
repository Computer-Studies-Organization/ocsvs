import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { Eye, Edit, Archive, RotateCcw, ArrowUpDown, Search } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { COURSE_VALUES, YEAR_LEVEL_VALUES } from '@/@types'

type User = {
  id: string
  studentId: string
  firstName: string
  lastName: string
  username: string
  email: string | null
  yearLevel: string
  course: string
  role: string
  hasVoted: boolean
  deletedAt: number | null
}

type UsersTableProps = {
  users: User[]
  isLoading: boolean
  includeDeleted: boolean
  onIncludeDeletedChange: (value: boolean) => void
  onView: (user: User) => void
  onEdit: (user: User) => void
  onArchive: (user: User) => void
  onRestore: (user: User) => void
}

export function UsersTable({ users, isLoading, includeDeleted, onIncludeDeletedChange, onView, onEdit, onArchive, onRestore }: UsersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'studentId',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs"
          style={{ color: 'oklch(0.70 0.015 250)' }}
        >
          Student ID
          <ArrowUpDown size={14} />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
          {row.getValue('studentId')}
        </span>
      ),
    },
    {
      accessorKey: 'firstName',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs"
          style={{ color: 'oklch(0.70 0.015 250)' }}
        >
          First Name
          <ArrowUpDown size={14} />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
          {row.getValue('firstName')}
        </span>
      ),
    },
    {
      accessorKey: 'lastName',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs"
          style={{ color: 'oklch(0.70 0.015 250)' }}
        >
          Last Name
          <ArrowUpDown size={14} />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-semibold" style={{ color: 'oklch(0.95 0.008 250)' }}>
          {row.getValue('lastName')}
        </span>
      ),
    },
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => (
        <span className="font-medium" style={{ color: 'oklch(0.80 0.015 250)' }}>
          {row.getValue('username')}
        </span>
      ),
    },
    {
      accessorKey: 'yearLevel',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs"
          style={{ color: 'oklch(0.70 0.015 250)' }}
        >
          Year
          <ArrowUpDown size={14} />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-medium" style={{ color: 'oklch(0.80 0.015 250)' }}>
          {row.getValue('yearLevel')}
        </span>
      ),
    },
    {
      accessorKey: 'course',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs"
          style={{ color: 'oklch(0.70 0.015 250)' }}
        >
          Course
          <ArrowUpDown size={14} />
        </button>
      ),
      cell: ({ row }) => (
        <span className="font-medium" style={{ color: 'oklch(0.80 0.015 250)' }}>
          {row.getValue('course')}
        </span>
      ),
    },
    {
      accessorKey: 'hasVoted',
      header: 'Status',
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex gap-1">
            {user.deletedAt && (
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  background: 'oklch(0.70 0.12 30)',
                  color: 'oklch(0.98 0.005 250)',
                }}
              >
                ARCHIVED
              </span>
            )}
            {user.hasVoted && (
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  background: 'oklch(0.70 0.12 140)',
                  color: 'oklch(0.98 0.005 250)',
                }}
              >
                VOTED
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex gap-2">
            {user.deletedAt ? (
              <>
                <button
                  onClick={() => onView(user)}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    background: 'oklch(0.25 0.025 250)',
                    color: 'oklch(0.95 0.008 250)',
                  }}
                  title="View"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => onRestore(user)}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    background: 'oklch(0.70 0.12 140)',
                    color: 'oklch(0.98 0.005 250)',
                  }}
                  title="Restore"
                >
                  <RotateCcw size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onView(user)}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    background: 'oklch(0.25 0.025 250)',
                    color: 'oklch(0.95 0.008 250)',
                  }}
                  title="View"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => onEdit(user)}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    background: 'oklch(0.55 0.15 250)',
                    color: 'oklch(0.98 0.005 250)',
                  }}
                  title="Edit"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => onArchive(user)}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    background: 'oklch(0.70 0.12 30)',
                    color: 'oklch(0.98 0.005 250)',
                  }}
                  title="Archive"
                >
                  <Archive size={16} />
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: users,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  })

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'oklch(0.60 0.015 250)' }}
          />
          <input
            type="text"
            placeholder="Search users..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 font-medium transition-all"
            style={{
              background: 'oklch(0.18 0.022 250)',
              borderColor: 'oklch(0.28 0.025 250)',
              color: 'oklch(0.95 0.008 250)',
            }}
          />
        </div>
        <label 
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-semibold cursor-pointer transition-all whitespace-nowrap"
          style={{
            background: includeDeleted ? 'oklch(0.25 0.025 250)' : 'oklch(0.18 0.022 250)',
            borderColor: 'oklch(0.28 0.025 250)',
            color: 'oklch(0.95 0.008 250)'
          }}
        >
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => onIncludeDeletedChange(e.target.checked)}
            className="w-4 h-4"
          />
          <span>Show archived</span>
        </label>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: 'oklch(0.20 0.022 250)',
          borderColor: 'oklch(0.25 0.025 250)',
        }}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                style={{ borderColor: 'oklch(0.25 0.025 250)' }}
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                  style={{ color: 'oklch(0.70 0.015 250)' }}
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  style={{
                    borderColor: 'oklch(0.25 0.025 250)',
                    opacity: row.original.deletedAt ? 0.6 : 1,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                  style={{ color: 'oklch(0.70 0.015 250)' }}
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div
          className="text-sm font-medium"
          style={{ color: 'oklch(0.70 0.015 250)' }}
        >
          {table.getFilteredRowModel().rows.length} user(s)
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-30"
            style={{
              background: 'oklch(0.25 0.025 250)',
              color: 'oklch(0.95 0.008 250)',
            }}
          >
            ←
          </button>
          <span
            className="px-4 py-2 font-bold"
            style={{ color: 'oklch(0.95 0.008 250)' }}
          >
            {table.getState().pagination.pageIndex + 1} /{' '}
            {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-30"
            style={{
              background: 'oklch(0.25 0.025 250)',
              color: 'oklch(0.95 0.008 250)',
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
