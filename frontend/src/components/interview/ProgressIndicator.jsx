export default function ProgressIndicator({ current, total, percentage, phase }) {
  return (
    <div className="flex items-center gap-4 min-w-[300px]">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-violet to-brand-green rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-right text-xs text-gray-400 whitespace-nowrap">
        <p className="font-medium text-white">{current} / {total}</p>
        <p>{percentage}% complete</p>
        {phase && phase !== 'theory' && (
          <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded bg-brand-green/20 text-brand-green">
            {phase.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}