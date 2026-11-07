import { cn } from '../../lib/utils';

/**
 * Responsive table: a real table from md upward, stacked cards below.
 * Pages can supply a bespoke mobileRenderer or fall back to columns.
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading = false,
  mobileRenderer,
  minWidth = 720,
  dense = false,
  className,
  caption,
}) {
  const keyFor = (row, index) => (rowKey ? rowKey(row) : row.id ?? index);

  if (loading) {
    return (
      <div className="space-y-2 p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-11 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <div className={cn('p-4', className)}>{empty}</div>;
  }

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left" style={{ minWidth }}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line bg-surface-2/70">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-3',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={keyFor(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'row-hover border-b border-line/70 last:border-0',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 text-[12.5px] text-ink-2',
                      dense ? 'py-2.5' : 'py-3.5',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.className,
                    )}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2 p-3 md:hidden">
        {rows.map((row, index) => (
          <div
            key={keyFor(row, index)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={
              onRowClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            className={cn(
              'rounded-xl border border-line bg-surface-2/50 p-3.5',
              onRowClick && 'cursor-pointer transition hover:border-brand/30 hover:bg-surface-2',
            )}
          >
            {mobileRenderer
              ? mobileRenderer(row)
              : columns.map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-4 border-b border-line/60 py-1.5 last:border-0 last:pb-0 first:pt-0">
                    <span className="text-[11px] uppercase tracking-[0.06em] text-ink-3">{column.header}</span>
                    <span className="max-w-[62%] text-right text-[12.5px] text-ink">
                      {column.render ? column.render(row) : row[column.key]}
                    </span>
                  </div>
                ))}
          </div>
        ))}
      </div>
    </div>
  );
}
