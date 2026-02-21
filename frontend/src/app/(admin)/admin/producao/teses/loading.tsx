export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 bg-gray-200 rounded w-48 mb-2"/>
          <div className="h-4 bg-gray-100 rounded w-72"/>
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-purple-100 rounded-lg w-36"/>
          <div className="h-9 bg-blue-100 rounded-lg w-28"/>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg"/>)}
      </div>
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg"/>)}
      </div>
    </div>
  );
}
