function SentimentBadge({ sentiment }) {
  const colors = {
    bullish: 'bg-brand-green/20 text-brand-green',
    bearish: 'bg-brand-red/20 text-brand-red',
    neutral: 'bg-gray-700 text-gray-400',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[sentiment] || colors.neutral}`}>
      {sentiment}
    </span>
  );
}

export default function ClaudePanel({ analysis }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
        Claude AI Analysis
      </h2>

      {!analysis ? (
        <p className="text-gray-600 text-sm text-center py-8">
          Click "Analyze with Claude" to get AI market analysis
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sentiment:</span>
            <SentimentBadge sentiment={analysis.sentiment} />
          </div>

          <p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>

          {analysis.recommendation && (
            <p className="text-sm text-brand-blue italic border-l-2 border-brand-blue pl-2">
              {analysis.recommendation}
            </p>
          )}

          {analysis.keyLevels && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Support</p>
                {(analysis.keyLevels.support || []).map((l) => (
                  <p key={l} className="text-xs font-mono text-brand-green">${l.toLocaleString()}</p>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Resistance</p>
                {(analysis.keyLevels.resistance || []).map((l) => (
                  <p key={l} className="text-xs font-mono text-brand-red">${l.toLocaleString()}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
