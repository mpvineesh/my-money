import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  DEFAULT_FAMILY_MEMBER,
  formatCurrency,
  formatDate,
  getTypeInfo,
  isValidDateValue,
} from '../utils/constants';
import './InvestmentTransactions.css';

// Each change in an investment's current value is an addition (or reduction). The running total is
// the cumulative invested-in/value at that point, i.e. the current value after the change.
function buildInvestmentTransactions(investment) {
  const history = [...(investment.history || [])]
    .filter((entry) => isValidDateValue(entry.date))
    .sort((left, right) => left.date.localeCompare(right.date));

  let previousValue = 0;
  const rows = [];
  history.forEach((entry, index) => {
    const total = Number(entry.currentValue) || 0;
    const added = index === 0 ? total : total - previousValue;
    previousValue = total;
    if (added !== 0 || index === 0) rows.push({ date: entry.date, added, total });
  });

  return rows;
}

function TransactionTable({ group }) {
  return (
    <div className="txn-table">
      <div className="txn-row txn-row-head">
        <span>Date</span>
        <span>Amount added</span>
        <span>Total</span>
      </div>
      {[...group.transactions].reverse().map((transaction, index) => (
        <div key={`${group.id}-${transaction.date}-${index}`} className="txn-row">
          <span className="txn-date">{formatDate(transaction.date)}</span>
          <span className={`txn-amount ${transaction.added < 0 ? 'negative' : 'positive'}`}>
            {transaction.added < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            {transaction.added >= 0 ? '+' : ''}{formatCurrency(transaction.added)}
          </span>
          <span className="txn-total">{formatCurrency(transaction.total)}</span>
        </div>
      ))}
    </div>
  );
}

export default function InvestmentTransactions() {
  const { visibleInvestments, investmentVisibilityMember } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusedId = searchParams.get('investment') || '';
  const focusedInvestment = focusedId ? visibleInvestments.find((investment) => investment.id === focusedId) : null;
  const scopeLabel = focusedInvestment
    ? focusedInvestment.name
    : (investmentVisibilityMember ? investmentVisibilityMember.name : 'Whole family');

  const groups = useMemo(() => {
    const source = focusedId ? visibleInvestments.filter((investment) => investment.id === focusedId) : visibleInvestments;
    return source
      .map((investment) => ({
        id: investment.id,
        name: investment.name,
        type: investment.type,
        memberName: investment.memberName || DEFAULT_FAMILY_MEMBER.name,
        total: Number(investment.currentValue) || 0,
        transactions: buildInvestmentTransactions(investment),
      }))
      .filter((group) => group.transactions.length > 0)
      .sort((left, right) => right.total - left.total);
  }, [focusedId, visibleInvestments]);

  const totals = useMemo(() => {
    const totalValue = groups.reduce((sum, group) => sum + group.total, 0);
    return { totalValue };
  }, [groups]);

  return (
    <div className="txn-page">
      <header className="txn-header">
        <button type="button" className="txn-back-btn" onClick={() => navigate('/investments')}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="txn-label">Investments</p>
          <h1 className="txn-title">Transactions</h1>
          <p className="txn-scope">
            Showing: {scopeLabel}
            {focusedId ? (
              <button type="button" className="txn-show-all" onClick={() => navigate('/investments/transactions')}>
                View all
              </button>
            ) : null}
          </p>
        </div>
        <div style={{ width: 36 }} />
      </header>

      {groups.length === 0 ? (
        <div className="txn-empty">
          <Briefcase size={28} />
          <p>No investment transactions yet.</p>
          <span>Add or update an investment and each change to its value will appear here.</span>
        </div>
      ) : focusedId ? (
        <section className="txn-detail">
          <div className="txn-detail-head">
            <div className="txn-detail-title">
              <span className="txn-type-dot" style={{ backgroundColor: getTypeInfo(groups[0].type).color }} />
              <div>
                <h2>{groups[0].name}</h2>
                <p>{getTypeInfo(groups[0].type).label} · {groups[0].memberName}</p>
              </div>
            </div>
            <div className="txn-detail-total">
              <span>Total</span>
              <strong>{formatCurrency(groups[0].total)}</strong>
            </div>
          </div>
          <TransactionTable group={groups[0]} />
        </section>
      ) : (
        <>
          <section className="txn-summary">
            <div className="txn-summary-stat">
              <span>Total value</span>
              <strong>{formatCurrency(totals.totalValue)}</strong>
            </div>
          </section>

          {groups.map((group) => {
            const typeInfo = getTypeInfo(group.type);
            return (
              <section key={group.id} className="txn-card">
                <div className="txn-card-head">
                  <div className="txn-card-title">
                    <span className="txn-type-dot" style={{ backgroundColor: typeInfo.color }} />
                    <div>
                      <h2>{group.name}</h2>
                      <p>{typeInfo.label} · {group.memberName}</p>
                    </div>
                  </div>
                  <div className="txn-card-total">
                    <span>Total</span>
                    <strong>{formatCurrency(group.total)}</strong>
                  </div>
                </div>

                <TransactionTable group={group} />
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
