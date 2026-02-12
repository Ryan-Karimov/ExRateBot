const { CURRENCIES, CURRENCY_CODES } = require("./currencies");

function parseRate(str) {
  const cleaned = str.replace(/сум/gi, "").replace(/\s/g, "").trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

function formatRate(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDate(langCode) {
  return new Intl.DateTimeFormat(langCode || "en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tashkent",
  }).format(new Date());
}

function currencyKeyboard(action) {
  return {
    reply_markup: {
      inline_keyboard: [
        CURRENCY_CODES.map((code) => ({
          text: `${CURRENCIES[code].flag} ${code}`,
          callback_data: `${action}_${code}`,
        })),
      ],
    },
  };
}

function navKeyboard(code, currentAction, lang, subscribed) {
  const buttons = [
    { key: "kurs", label: lang.nav_kurs || "Курс" },
    { key: "banks", label: lang.nav_banks || "Банки" },
    { key: "spread", label: lang.nav_spread || "Спред" },
    { key: "history", label: lang.nav_history || "История" },
  ];

  const subLabel = subscribed
    ? (lang.nav_unsubscribe || "🔕 Отписка")
    : (lang.nav_subscribe || "🔔 Подписка");

  return {
    reply_markup: {
      inline_keyboard: [
        buttons
          .filter((b) => b.key !== currentAction)
          .map((b) => ({ text: b.label, callback_data: `${b.key}_${code}` })),
        [{ text: subLabel, callback_data: `sub_${code}` }],
      ],
    },
  };
}

module.exports = { parseRate, formatRate, formatDate, currencyKeyboard, navKeyboard };
