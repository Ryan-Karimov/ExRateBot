const messages = {
  ru: {
    start: "👋 Привет! Добро пожаловать.",
    info: "📌 Чтобы узнать курс валют, отправьте /kurs\n\n📖 Все команды: /help",
    help:
      "📖 *Доступные команды:*\n\n" +
      "/kurs — курс валюты (банки, спред, история — через кнопки)\n" +
      "/all — курсы всех валют\n" +
      "/help — список команд",
    title: "📊 Курс на сегодня",
    cb: "Курс ЦБ РУз",
    best_rates: "🏦 Лучшие курсы в банках",
    buy: "🔹 Купить",
    sell: "🔸 Продать",
    difference: "Разница",
    choose_currency: "Выберите валюту:",
    all_title: "📊 Все курсы на сегодня",
    banks_title: "🏦 Рейтинг банков",
    spread_title: "📊 Спред по банкам",
    history_title: "📈 История курса",
    no_data: "Нет данных",
    error: "❌ Ошибка получения курса валют.",
    nav_kurs: "📊 Курс",
    nav_banks: "🏦 Банки",
    nav_spread: "📈 Спред",
    nav_history: "📅 История",
    nav_subscribe: "🔔 Подписка",
    nav_unsubscribe: "🔕 Отписка",
    choose_time: "🕐 Выберите время рассылки {currency}:",
    subscribed: "🔔 Подписка на курс {currency} ({time})",
    unsubscribed: "🔕 Отписка от курса {currency}",
  },
  en: {
    start: "👋 Hello! Welcome.",
    info: "📌 To get exchange rates, send /kurs\n\n📖 All commands: /help",
    help:
      "📖 *Available commands:*\n\n" +
      "/kurs — currency rate (banks, spread, history — via buttons)\n" +
      "/all — all currency rates\n" +
      "/help — command list",
    title: "📊 Exchange rate today",
    cb: "CB Rate",
    best_rates: "🏦 Best rates in banks",
    buy: "🔹 Buy",
    sell: "🔸 Sell",
    difference: "Difference",
    choose_currency: "Choose currency:",
    all_title: "📊 All rates for today",
    banks_title: "🏦 Bank rating",
    spread_title: "📊 Bank spreads",
    history_title: "📈 Rate history",
    no_data: "No data",
    error: "❌ Error getting exchange rate.",
    nav_kurs: "📊 Rate",
    nav_banks: "🏦 Banks",
    nav_spread: "📈 Spread",
    nav_history: "📅 History",
    nav_subscribe: "🔔 Subscribe",
    nav_unsubscribe: "🔕 Unsubscribe",
    choose_time: "🕐 Choose delivery time for {currency}:",
    subscribed: "🔔 Subscribed to {currency} rate ({time})",
    unsubscribed: "🔕 Unsubscribed from {currency} rate",
  },
  uz: {
    start: "👋 Salom! Xush kelibsiz.",
    info: "📌 Valyuta kursini bilish uchun /kurs yuboring\n\n📖 Barcha buyruqlar: /help",
    help:
      "📖 *Mavjud buyruqlar:*\n\n" +
      "/kurs — valyuta kursi (banklar, spred, tarix — tugmalar orqali)\n" +
      "/all — barcha valyuta kurslari\n" +
      "/help — buyruqlar ro'yxati",
    title: "📊 Bugungi kurs",
    cb: "MB kursi",
    best_rates: "🏦 Banklardagi eng yaxshi kurslar",
    buy: "🔹 Sotib olish",
    sell: "🔸 Sotish",
    difference: "Farq",
    choose_currency: "Valyutani tanlang:",
    all_title: "📊 Bugungi barcha kurslar",
    banks_title: "🏦 Banklar reytingi",
    spread_title: "📊 Banklar bo'yicha spred",
    history_title: "📈 Kurs tarixi",
    no_data: "Ma'lumot yo'q",
    error: "❌ Valyuta kursini olishda xatolik.",
    nav_kurs: "📊 Kurs",
    nav_banks: "🏦 Banklar",
    nav_spread: "📈 Spred",
    nav_history: "📅 Tarix",
    nav_subscribe: "🔔 Obuna",
    nav_unsubscribe: "🔕 Bekor qilish",
    choose_time: "🕐 {currency} uchun yuborish vaqtini tanlang:",
    subscribed: "🔔 {currency} kursiga obuna ({time})",
    unsubscribed: "🔕 {currency} kursidan obuna bekor qilindi",
  },
  default: {
    start: "👋 Welcome!",
    info: "📌 To get exchange rates, send /kurs\n\n📖 All commands: /help",
    help:
      "📖 *Available commands:*\n\n" +
      "/kurs — currency rate (banks, spread, history — via buttons)\n" +
      "/all — all rates\n" +
      "/help — command list",
    title: "📊 Exchange rate today",
    cb: "CB Rate",
    best_rates: "🏦 Best rates in banks",
    buy: "🔹 Buy",
    sell: "🔸 Sell",
    difference: "Difference",
    choose_currency: "Choose currency:",
    all_title: "📊 All rates for today",
    banks_title: "🏦 Bank rating",
    spread_title: "📊 Bank spreads",
    history_title: "📈 Rate history",
    no_data: "No data",
    error: "❌ Error getting exchange rate.",
    nav_kurs: "📊 Rate",
    nav_banks: "🏦 Banks",
    nav_spread: "📈 Spread",
    nav_history: "📅 History",
    nav_subscribe: "🔔 Subscribe",
    nav_unsubscribe: "🔕 Unsubscribe",
    choose_time: "🕐 Choose delivery time for {currency}:",
    subscribed: "🔔 Subscribed to {currency} rate ({time})",
    unsubscribed: "🔕 Unsubscribed from {currency} rate",
  },
};

function getLang(langCode) {
  return messages[langCode] || messages.default;
}

module.exports = { messages, getLang };
