export default function JurisprudenciaLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-gray-200 rounded" />
      <div className="h-4 w-96 bg-gray-100 rounded" />
      <div className="flex gap-4">
        <div className="h-10 w-24 bg-gray-100 rounded" />
        <div className="h-10 w-32 bg-gray-100 rounded" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
