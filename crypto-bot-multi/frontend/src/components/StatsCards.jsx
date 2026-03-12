import { InfoIcon } from './Tooltip';

function Card({ label, value, color, tip }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-lg p-4 flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-gray-500 uppercase tracking-wide">
        {label}
        {tip && <InfoIcon text={tip} />}
      </span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

export default function StatsCards({ dbStats, signal }) {
  // Use real DB stats (P&L/WinRate come from signal-db, not state.stats which is never updated)
  const pnl        = dbStats?.totalPnl  ?? 0;
  const winRate    = dbStats?.winRate   ?? 0;
  const closed     = dbStats?.closed    ?? 0;
  const open       = dbStats?.open      ?? 0;

  const signalColor =
    signal?.action === 'buy'  ? 'text-brand-green' :
    signal?.action === 'sell' ? 'text-brand-red'   :
    'text-gray-400';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
      <Card
        label="Total P&L"
        value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`}
        color={pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}
        tip="Ganancia/pérdida acumulada en paper ($100 por operación). Se actualiza cada vez que una señal toca SL o TP."
      />
      <Card
        label="Win Rate"
        value={closed > 0 ? `${(winRate * 100).toFixed(1)}%` : '—'}
        color="text-brand-blue"
        tip="% de señales que llegaron al Take Profit antes que al Stop Loss. Solo cuenta señales ya cerradas."
      />
      <Card
        label="Cerradas / Abiertas"
        value={`${closed} / ${open}`}
        color="text-gray-200"
        tip="Cerradas: señales que ya tocaron SL o TP. Abiertas: todavía en curso, esperando resultado."
      />
      <Card
        label="Last Signal"
        value={signal ? `${signal.action.toUpperCase()} (${(signal.confidence * 100).toFixed(0)}%)` : '—'}
        color={signalColor}
        tip="Última señal generada por Claude. El porcentaje es la confianza (0-100%). Solo se ejecuta si supera el 60%."
      />
    </div>
  );
}
