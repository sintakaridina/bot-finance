let config = { code: 'IDR', locale: 'en-US' };

export function setCurrencyConfig(next) {
  config = { ...config, ...next };
}

export function getCurrencyConfig() {
  return config;
}

export function formatMoney(amount) {
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
