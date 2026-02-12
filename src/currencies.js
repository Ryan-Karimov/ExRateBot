const CURRENCIES = {
  USD: { flag: "🇺🇸", url: "https://bank.uz/currency/dollar-ssha", name: { ru: "Доллар США", en: "US Dollar", uz: "AQSH dollari" } },
  EUR: { flag: "🇪🇺", url: "https://bank.uz/currency/evro", name: { ru: "Евро", en: "Euro", uz: "Yevro" } },
  RUB: { flag: "🇷🇺", url: "https://bank.uz/currency/rossiyskiy-rubl", name: { ru: "Российский рубль", en: "Russian Ruble", uz: "Rossiya rubli" } },
  GBP: { flag: "🇬🇧", url: "https://bank.uz/currency/funt-sterlingov", name: { ru: "Фунт стерлингов", en: "British Pound", uz: "Britaniya funti" } },
  KZT: { flag: "🇰🇿", url: "https://bank.uz/currency/kzt", name: { ru: "Казахстанский тенге", en: "Kazakh Tenge", uz: "Qozog'iston tengesi" } },
};

const CURRENCY_CODES = Object.keys(CURRENCIES);

module.exports = { CURRENCIES, CURRENCY_CODES };
