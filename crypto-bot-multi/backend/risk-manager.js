/**
 * Risk Manager
 * Controls position sizing and filters low-confidence signals.
 */

const DEFAULT_CONFIG = {
  maxPositions: 3,           // Max open positions at once
  riskPerTrade: 0.01,        // 1% of account per trade
  maxDrawdown: 0.1,          // Stop bot if drawdown exceeds 10%
  minConfidence: 0.6,        // Minimum signal confidence to act
  portfolioValue: 1000,      // USDT portfolio value (paper default)
};

/**
 * Decide whether to act on a signal given current state and risk config.
 * Returns true if the trade should proceed.
 */
function approve(signal, state, config = DEFAULT_CONFIG) {
  if (signal.action === 'hold') return false;

  // Minimum confidence threshold
  if (signal.confidence < config.minConfidence) {
    console.log(`[Risk] Signal rejected: confidence ${signal.confidence} < ${config.minConfidence}`);
    return false;
  }

  // Max open positions
  if (state.openPositions.length >= config.maxPositions) {
    console.log(`[Risk] Signal rejected: max positions (${config.maxPositions}) reached`);
    return false;
  }

  // Check drawdown
  if (state.stats.totalPnl < -config.portfolioValue * config.maxDrawdown) {
    console.log(`[Risk] Signal rejected: max drawdown reached (${state.stats.totalPnl.toFixed(2)} USDT)`);
    return false;
  }

  // Avoid duplicate direction (already long and trying to buy again)
  const sameDirection = state.openPositions.some((p) => p.action === signal.action);
  if (sameDirection) {
    console.log(`[Risk] Signal rejected: already have open ${signal.action} position`);
    return false;
  }

  return true;
}

/**
 * Calculate the quantity to trade based on risk per trade.
 * Returns quantity in base asset (e.g. BTC).
 */
function calcQuantity(signal, state, config = DEFAULT_CONFIG) {
  const riskAmount = config.portfolioValue * config.riskPerTrade;
  const quantity = riskAmount / state.openPositions.reduce(
    (_, p) => p.price,
    signal.price || 1
  );
  // Round to 5 decimal places (Binance requirement)
  return Math.max(parseFloat(quantity.toFixed(5)), 0.00001);
}

/**
 * Update stats after a closed trade.
 */
function recordTrade(trade, state) {
  state.stats.totalTrades++;
  if (trade.pnl > 0) {
    const wins = state.stats.winRate * (state.stats.totalTrades - 1) + 1;
    state.stats.winRate = wins / state.stats.totalTrades;
  } else {
    const wins = state.stats.winRate * (state.stats.totalTrades - 1);
    state.stats.winRate = wins / state.stats.totalTrades;
  }
  state.stats.totalPnl += trade.pnl || 0;
}

module.exports = { approve, calcQuantity, recordTrade, DEFAULT_CONFIG };
