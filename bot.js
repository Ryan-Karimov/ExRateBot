const TelegramBot = require("node-telegram-bot-api");
const { Client } = require("pg");
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const bot = new TelegramBot(TOKEN, { polling: true });

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

db.connect();

const messages = {
  ru: {
    start: "👋 Привет! Добро пожаловать.",
    title: "📊 Курс ЦБ РУз на сегодня",
    kurs: "💰 Курс ЦБ РУз",
    best_rates: "🏦 *Лучшие курсы в банках*",
    buy: "🔹 Покупка",
    sell: "🔹 Продажа",
    info: "📌 Чтобы узнать курс валют, отправьте команду: /kurs",
  },
  en: {
    start: "👋 Hello! Welcome.",
    title: "📊 CB Uz exchange rate today",
    kurs: "💰 Exchange rate of the Central Bank of Uzbekistan",
    best_rates: "🏦 *Best rates in banks*",
    buy: "🔹 Buy",
    sell: "🔹 Sell",
    info: "📌 To get the exchange rate, send the command: /kurs",
  },
  uz: {
    start: "👋 Salom! Xush kelibsiz.",
    title: "📊 O'zMB kursi bugun",
    kurs: "💰 O'zbekiston Markaziy banki kursi",
    best_rates: "🏦 *Banklardagi eng yaxshi kurslar*",
    buy: "🔹 Sotib olish",
    sell: "🔹 Sotish",
    info: "📌 Valyuta kursini bilish uchun /kurs buyrug'ini yuboring",
  },
  default: {
    start: "👋 Welcome!",
    title: "📊 CB Uz exchange rate today",
    kurs: "💰 Exchange rate",
    best_rates: "🏦 *Best rates in banks*",
    buy: "🔹 Buy",
    sell: "🔹 Sell",
    info: "📌 To get the exchange rate, send the command: /kurs",
  },
};

function getLang(msg) {
  return messages[msg.from.language_code] || messages.default;
}

async function getExchangeRate(msg) {
  try {
    const { data } = await axios.get(process.env.LINK);
    const $ = cheerio.load(data);

    const cleanText = (text) => text.replace(/сум/g, "").trim();

    const cbRateTitle = cleanText($(".about-block a").first().text());
    const cbRateValue = cleanText(
      $(".col-2.cours-active").eq(1).find(".semibold-text").text()
    );

    const buyRate = cleanText($(".col-4 .semibold-text").first().text());
    const buyBank = $(".col-4 .regular-text a").first().text().trim();

    const sellRate = cleanText($(".col-4 .semibold-text").last().text());
    const sellBank = $(".col-4 .regular-text a").last().text().trim();

    const lang = getLang(msg);

    const date = new Intl.DateTimeFormat(msg.from.language_code || "en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());

    return ` *${lang.title}* (${date})\n${lang.kurs}: *${cbRateValue}*\n\n${lang.best_rates}:\n${lang.buy}: *${buyRate}* (🏦 ${buyBank})\n${lang.sell}: *${sellRate}* (🏦 ${sellBank})`;
  } catch (error) {
    console.error("Ошибка парсинга:", error);
    return "❌ Ошибка получения курса валют.";
  }
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const firstName = msg.from.first_name;
  const lang = msg.from.language_code;
  const username = msg.from.username || "Без юзернейма";

  await db.query(
    "INSERT INTO users (user_id, username, first_name, language, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (user_id) DO NOTHING",
    [userId, username, firstName, lang]
  );

  const text = getLang(msg);
  bot.sendMessage(chatId, `${text.start}\n\n${text.info}`);
});

bot.onText(/\/kurs/, async (msg) => {
  const chatId = msg.chat.id;
  const exchangeRate = await getExchangeRate(msg);

  bot.sendMessage(chatId, exchangeRate, { parse_mode: "Markdown" });
  if (process.env.USER_ID) {
    bot.sendMessage(
      process.env.USER_ID,
      `🔗 Юзернейм: @${msg.from.username || "Без юзернейма"}`
    );
  }
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const text = getLang(msg).help;

  bot.sendMessage(chatId, text);
});

bot.onText(/\/userslist/, async (msg) => {
  if (msg.from.username !== ADMIN_USERNAME) {
    return bot.sendMessage(msg.chat.id, "⛔ У вас нет доступа к этой команде.");
  }

  const res = await db.query(
    "SELECT user_id, username, first_name, language, to_char(created_at, 'DD-MM-YYYY HH24:MI:SS') as created_at FROM users"
  );

  if (res.rows.length === 0) {
    return bot.sendMessage(msg.chat.id, "📭 В базе данных нет пользователей.");
  }

  let userList = "📋 *Список пользователей:*\n\n";
  res.rows.forEach((user, i) => {
    const usernameText = user.username
      ? `[${user.username}](https://t.me/${user.username.replace(/_/g, "\\_")})`
      : "нет";
    userList += `👤 ${i + 1}. *ID:* ${user.user_id}\n`;
    userList += `   🏷 *Имя:* ${user.first_name}\n`;
    userList += `   🔗 *Юзернейм:* @${usernameText || "нет"}\n`;
    userList += `   🌍 *Язык:* ${user.language || "неизвестен"}\n`;
    userList += `   📅 *Дата регистрации:* ${user.created_at}\n\n`;
  });

  bot.sendMessage(msg.chat.id, userList, { parse_mode: "Markdown" });
});

console.log("Бот запущен...");
