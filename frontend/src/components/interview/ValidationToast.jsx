import { useEffect } from 'react';

export default function ValidationToast({ errors, onDismiss }) {
  useEffect(() => {
    if (errors.length > 0) {
      const timer = setTimeout(() => {
        errors.forEach(e => onDismiss(e.type));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [errors, onDismiss]);

  if (errors.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'language_enforcement': return '🌐';
      case 'relevance_check': return '🎯';
      case 'completeness_check': return '📝';
      case 'code_error': return '💻';
      case 'retry': return '🔄';
      default: return '⚠️';
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'language_enforcement': return 'border-blue-500/50 bg-blue-500/10 text-blue-300';
      case 'relevance_check': return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300';
      case 'completeness_check': return 'border-orange-500/50 bg-orange-500/10 text-orange-300';
      case 'code_error': return 'border-red-500/50 bg-red-500/10 text-red-300';
      case 'retry': return 'border-purple-500/50 bg-purple-500/10 text-purple-300';
      default: return 'border-gray-500/50 bg-gray-500/10 text-gray-300';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 w-full max-w-md space-y-2 animate-slide-in">
      {errors.map((error, index) => (
        <div key={index} className={`rounded-lg border p-4 ${getColor(error.type)} shadow-lg`}>
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">{getIcon(error.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{error.message}</p>
              {error.suggestions && error.suggestions.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-white/70">
                  {error.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span>→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => onDismiss(error.type)}
              className="text-white/50 hover:text-white text-xl leading-none px-2"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}