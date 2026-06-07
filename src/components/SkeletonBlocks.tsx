import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-4 flex-1"
              style={{ opacity: 1 - r * 0.07 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-sm">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-8 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
