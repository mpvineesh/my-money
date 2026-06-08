// Indian equity charge calculation for swing trades, modelled on Zerodha's brokerage calculator.
// All rates are statutory/exchange rates (NSE) except brokerage, which follows the Zerodha model
// (delivery free; intraday min(₹20, 0.03% of turnover) per executed order). Brokerage can be
// overridden per trade. Statutory rates are fixed by law/exchange and are not user-editable.

export const TRADE_SEGMENTS = [
  { value: 'delivery', label: 'Delivery (CNC)' },
  { value: 'intraday', label: 'Intraday (MIS)' },
];

// Rates as decimals (e.g. 0.001 = 0.1%). Sourced from NSE equity + Zerodha, current as of 2024-25.
export const CHARGE_RATES = {
  brokerageIntradayPct: 0.0003, // 0.03% per order
  brokerageIntradayCap: 20, // ₹20 max per order
  sttDelivery: 0.001, // 0.1% on buy and sell
  sttIntradaySell: 0.00025, // 0.025% on sell only
  exchangeTxnNse: 0.0000297, // 0.00297% on turnover (both sides)
  sebi: 0.000001, // ₹10 per crore = 0.0001%
  stampDeliveryBuy: 0.00015, // 0.015% on buy
  stampIntradayBuy: 0.00003, // 0.003% on buy
  gst: 0.18, // 18% on brokerage + exchange txn + SEBI + DP
  dpChargePerSell: 13.5, // flat DP charge per scrip on a delivery sell (Zerodha)
};

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function autoBrokerage(turnover, isIntraday) {
  if (!isIntraday || turnover <= 0) return 0;
  return Math.min(CHARGE_RATES.brokerageIntradayCap, turnover * CHARGE_RATES.brokerageIntradayPct);
}

// Compute the full charge breakdown and net P&L for a trade.
// `brokerageOverride`: when a finite number is supplied it replaces the auto-computed total brokerage
// (e.g. for a non-Zerodha broker). Leave blank/null to auto-calculate.
export function computeTradeCharges({
  segment = 'delivery',
  quantity = 0,
  buyPrice = 0,
  sellPrice = 0,
  brokerageOverride = null,
} = {}) {
  const qty = Number(quantity) || 0;
  const buy = Number(buyPrice) || 0;
  const sell = Number(sellPrice) || 0;
  const isIntraday = segment === 'intraday';

  const buyTurnover = qty * buy;
  const sellTurnover = qty * sell;
  const hasSell = qty > 0 && sell > 0;

  // Brokerage (auto by segment, unless overridden).
  const overrideNum = Number(brokerageOverride);
  const hasOverride = brokerageOverride !== null && brokerageOverride !== '' && Number.isFinite(overrideNum);
  const brokerage = hasOverride
    ? Math.max(0, overrideNum)
    : autoBrokerage(buyTurnover, isIntraday) + (hasSell ? autoBrokerage(sellTurnover, isIntraday) : 0);

  // Securities Transaction Tax.
  const stt = isIntraday
    ? sellTurnover * CHARGE_RATES.sttIntradaySell
    : buyTurnover * CHARGE_RATES.sttDelivery + (hasSell ? sellTurnover * CHARGE_RATES.sttDelivery : 0);

  // Turnover that has actually occurred so far (buy always; sell only once entered).
  const totalTurnover = buyTurnover + (hasSell ? sellTurnover : 0);
  const exchangeTxn = totalTurnover * CHARGE_RATES.exchangeTxnNse;
  const sebi = totalTurnover * CHARGE_RATES.sebi;

  // Stamp duty is charged on the buy side only.
  const stampRate = isIntraday ? CHARGE_RATES.stampIntradayBuy : CHARGE_RATES.stampDeliveryBuy;
  const stamp = buyTurnover * stampRate;

  // DP charge: flat, on a delivery sell only.
  const dp = !isIntraday && hasSell ? CHARGE_RATES.dpChargePerSell : 0;

  // GST applies to brokerage, exchange transaction charges, SEBI fees and DP charge.
  const gst = CHARGE_RATES.gst * (brokerage + exchangeTxn + sebi + dp);

  const total = brokerage + stt + exchangeTxn + sebi + stamp + dp + gst;

  const grossPnl = hasSell ? sellTurnover - buyTurnover : 0;
  const netPnl = hasSell ? grossPnl - total : 0;
  const netPnlPct = hasSell && buyTurnover > 0 ? (netPnl / buyTurnover) * 100 : 0;
  // Breakeven sell price per share that covers buy cost + all charges.
  const breakeven = hasSell && qty > 0 ? (buyTurnover + total) / qty : 0;

  return {
    isIntraday,
    hasSell,
    qty,
    buyTurnover: round2(buyTurnover),
    sellTurnover: round2(sellTurnover),
    components: {
      brokerage: round2(brokerage),
      stt: round2(stt),
      exchangeTxn: round2(exchangeTxn),
      sebi: round2(sebi),
      stamp: round2(stamp),
      dp: round2(dp),
      gst: round2(gst),
    },
    total: round2(total),
    grossPnl: round2(grossPnl),
    netPnl: round2(netPnl),
    netPnlPct: round2(netPnlPct),
    breakeven: round2(breakeven),
  };
}

// Ordered list for rendering the breakdown in the UI.
export const CHARGE_LABELS = [
  { key: 'brokerage', label: 'Brokerage' },
  { key: 'stt', label: 'STT' },
  { key: 'exchangeTxn', label: 'Exchange txn' },
  { key: 'gst', label: 'GST' },
  { key: 'sebi', label: 'SEBI charges' },
  { key: 'stamp', label: 'Stamp duty' },
  { key: 'dp', label: 'DP charges' },
];
