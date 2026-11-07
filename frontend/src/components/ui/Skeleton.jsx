import { cn } from '../../lib/utils';

export default function Skeleton({ className }) {
  return <span className={cn('skeleton block h-4 w-full', className)} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3, className }) {
  return (
    <div className={cn('card space-y-3 p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <div className="space-y-2 pt-1">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={index === lines - 1 ? 'h-2.5 w-2/3' : 'h-2.5 w-full'} />
        ))}
      </div>
    </div>
  );
}
