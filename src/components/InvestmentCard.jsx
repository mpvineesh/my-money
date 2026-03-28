import { getTypeInfo, formatCurrency, calculateReturns, formatDate } from '../utils/constants';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './InvestmentCard.css';

export default function InvestmentCard({ investment, onClick }) {
  const typeInfo = getTypeInfo(investment.type);
  const returns = calculateReturns(investment.investedAmount, investment.currentValue);
  const gain = investment.currentValue - investment.investedAmount;
  const isPositive = gain > 0;
  const isNeutral = gain === 0;
  const historyCount = Array.isArray(investment.history) ? investment.history.length : 0;

  // Projection: compute future values for next N years using interestRate (annual %)
  const years = 5;
  const rate = parseFloat(investment.interestRate) || 0;
  const projection = [];
  for (let i = 0; i <= years; i++) {
    const value = investment.currentValue * Math.pow(1 + rate / 100, i);
    projection.push({ year: i === 0 ? 'Now' : `+${i}y`, value: Math.round(value) });
  }
  const futureValue = projection[projection.length - 1].value;

  return (
    <div className="investment-card" onClick={onClick}>
      <div className="inv-card-header">
        <div className="inv-type-badge" style={{ backgroundColor: typeInfo.color + '18', color: typeInfo.color }}>
          {typeInfo.label}
        </div>
        <div className={`inv-returns ${isPositive ? 'positive' : isNeutral ? 'neutral' : 'negative'}`}>
          {isPositive ? <TrendingUp size={14} /> : isNeutral ? <Minus size={14} /> : <TrendingDown size={14} />}
          <span>{isPositive ? '+' : ''}{returns}%</span>
        </div>
      </div>
      <h3 className="inv-card-name">{investment.name}</h3>
      <div className="inv-card-amounts">
        <div className="inv-amount-group">
          <span className="inv-amount-label">Current Value</span>
          <span className="inv-amount-value">{formatCurrency(investment.currentValue)}</span>
        </div>
        <div className="inv-amount-group">
          <span className="inv-amount-label">Invested</span>
          <span className="inv-amount-value inv-amount-invested">{formatCurrency(investment.investedAmount)}</span>
        </div>
      </div>
      <div className="inv-card-gain">
        <span className={`gain-value ${isPositive ? 'positive' : isNeutral ? 'neutral' : 'negative'}`}>
          {isPositive ? '+' : ''}{formatCurrency(gain)}
        </span>
        <span className="inv-card-history-meta">
          Updated {formatDate(investment.lastUpdated)}{historyCount ? ` · ${historyCount} snapshot${historyCount === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      <div className="inv-card-projection">
        <div className="projection-chart">
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={projection} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip formatter={(val) => formatCurrency(val)} labelFormatter={() => ''} />
              <Line type="monotone" dataKey="value" stroke={typeInfo.color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="projection-meta">
          <span className="proj-label">{rate ? `${rate}% p.a.` : 'Rate N/A'}</span>
          <span className="proj-value">{rate ? `~ ${formatCurrency(futureValue)} in ${years}y` : '—'}</span>
        </div>
      </div>
    </div>
  );
}
