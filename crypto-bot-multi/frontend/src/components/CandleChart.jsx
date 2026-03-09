import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
}

export default function CandleChart({ candles = [], symbol }) {
  const data = candles.map((c) => ({
    time: formatTime(c.time),
    close: c.close,
    volume: c.volume,
    high: c.high,
    low: c.low,
  }));

  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">{symbol} — Price Chart</h2>
      {data.length === 0 ? (
        <div className="text-center text-gray-600 py-16 text-sm">Start the bot or click a symbol to load candles</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#8b949e' }} interval="preserveStartEnd" />
            <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#8b949e' }} />
            <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 10, fill: '#8b949e' }} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 12 }}
              labelStyle={{ color: '#8b949e' }}
            />
            <Bar yAxisId="vol" dataKey="volume" fill="#58a6ff22" name="Volume" />
            <Line yAxisId="price" type="monotone" dataKey="close" stroke="#58a6ff" dot={false} strokeWidth={2} name="Price" />
            <Line yAxisId="price" type="monotone" dataKey="high" stroke="#3fb95044" dot={false} strokeWidth={1} name="High" />
            <Line yAxisId="price" type="monotone" dataKey="low" stroke="#f8514944" dot={false} strokeWidth={1} name="Low" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
