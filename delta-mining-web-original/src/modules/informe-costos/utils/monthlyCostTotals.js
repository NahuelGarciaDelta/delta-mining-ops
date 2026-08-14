export function sumRoundedMonthlyTotals(months, rowMonths = {}) {
  return (Array.isArray(months) ? months : []).reduce((sum, month) => {
    const data = rowMonths?.[month?.key] || {};
    const prev = Number(data.prev) || 0;
    const corr = Number(data.corr) || 0;
    const total = Number(data.total) || (prev + corr);
    return sum + Math.round(total);
  }, 0);
}
