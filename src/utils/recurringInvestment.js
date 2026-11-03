// Prepare the contribution independently of persistence. Never silently record a
// unit-tracked SIP without a usable NAV: that would leave cost and units inconsistent.
export function recurringInvestmentChanges(previous, amount, date, navInfo) {
  const contribution = Number(amount);
  if (!(contribution > 0) || !Number.isFinite(contribution)) throw new Error('Enter a positive contribution amount.');
  const changes = {
    id: previous.id,
    investedAmount: (Number(previous.investedAmount) || 0) + contribution,
    snapshotDate: date,
  };
  if (previous.schemeCode) {
    if (!(navInfo?.nav > 0) || !Number.isFinite(Number(navInfo.nav))) throw new Error('NAV is unavailable. Please retry this SIP later.');
    changes.units = (Number(previous.units) || 0) + contribution / Number(navInfo.nav);
    // Value all units at the newest known NAV, even when recording an older SIP.
    const useLatest = previous.navDate && previous.navDate > navInfo.date && Number(previous.navValue) > 0;
    changes.navValue = useLatest ? Number(previous.navValue) : Number(navInfo.nav);
    changes.navDate = useLatest ? previous.navDate : navInfo.date;
    changes.currentValue = Math.round(changes.units * changes.navValue);
  } else {
    changes.currentValue = (Number(previous.currentValue) || 0) + contribution;
  }
  return changes;
}
