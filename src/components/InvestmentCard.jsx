import { getTypeInfo, formatCurrency, calculateReturns } from '../utils/constants';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './InvestmentCard.css';

export default function InvestmentCard({ investment, onClick }) {
  const typeInfo = getTypeInfo(investment.type);
  const returns = calculateReturns(investment.investedAmount, investment.currentValue);
  const gain = investment.currentValue - investment.investedAmount;
  const isPositive = gain > 0;
  const isNeutral = gain === 0;

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
      </div>
    </div>
  );
}
