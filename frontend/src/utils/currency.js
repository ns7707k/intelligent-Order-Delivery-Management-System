const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrencyGBP = (value) => {
  const numericValue = Number(value);
  return GBP_FORMATTER.format(Number.isFinite(numericValue) ? numericValue : 0);
};
