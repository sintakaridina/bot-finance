function getCurrencyConfig() {
  return {
    code: (process.env.CURRENCY_CODE || 'IDR').toUpperCase(),
    locale: process.env.CURRENCY_LOCALE || 'en-US',
  };
}

function formatMoney(amount) {
  const { code, locale } = getCurrencyConfig();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

module.exports = { getCurrencyConfig, formatMoney, formatRupiah: formatMoney };
