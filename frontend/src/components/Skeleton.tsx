export function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="px-6 lg:px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <SkeletonPulse className="h-7 w-48 mb-2" />
          <SkeletonPulse className="h-4 w-72" />
        </div>
        <SkeletonPulse className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <SkeletonPulse className="h-4 w-20 mb-3" />
            <SkeletonPulse className="h-8 w-16 mb-2" />
            <SkeletonPulse className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <SkeletonPulse className="h-5 w-40 mb-4" />
            {[...Array(4)].map((_, j) => (
              <SkeletonPulse key={j} className="h-12 w-full mb-2 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TablePageSkeleton({ title = '' }: { title?: string }) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <SkeletonPulse className="h-7 w-44 mb-2" />
          <SkeletonPulse className="h-4 w-64" />
        </div>
        <SkeletonPulse className="h-10 w-36 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <SkeletonPulse className="h-10 flex-1 rounded-lg" />
          <SkeletonPulse className="h-10 w-28 rounded-lg" />
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <SkeletonPulse className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <SkeletonPulse className="h-4 w-48 mb-2" />
                <SkeletonPulse className="h-3 w-32" />
              </div>
              <SkeletonPulse className="h-6 w-20 rounded-full" />
              <SkeletonPulse className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <SkeletonPulse className="h-7 w-52 mb-2" />
        <SkeletonPulse className="h-4 w-80" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <SkeletonPulse key={i} className="h-10 w-32 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <SkeletonPulse className="h-4 w-24 mb-2" />
              <SkeletonPulse className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <SkeletonPulse className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <SkeletonPulse className="h-7 w-44 mb-2" />
        <SkeletonPulse className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <SkeletonPulse className="h-4 w-28 mb-3" />
            <SkeletonPulse className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <SkeletonPulse className="h-10 w-full rounded-lg" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-50">
            <SkeletonPulse className="h-5 w-8" />
            <div className="flex-1">
              <SkeletonPulse className="h-4 w-56 mb-1" />
              <SkeletonPulse className="h-3 w-36" />
            </div>
            <SkeletonPulse className="h-5 w-24" />
            <SkeletonPulse className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
