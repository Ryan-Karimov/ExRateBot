const { bot, db } = require("./config");
const { CURRENCIES } = require("./currencies");
const { getLang } = require("./messages");
const { currencyKeyboard, navKeyboard } = require("./helpers");
const { fetchCurrency, fetchAllCurrencies, getHistory, getYesterdayRates } = require("./parser");
const { fmtCurrencyRate, fmtAllRates, fmtBankRating, fmtSpread, fmtHistory } = require("./formatters");

// ── Activity log (for daily digest) ─────────────────────────────────

const activityLog = {
  actions: {},
  activeUsers: new Set(),
  newUsers: [],
  currencies: {},
  subsAdded: 0,
  subsRemoved: 0,
  blocked: 0,
};

function logActivity(userId, action, code) {
  if (!process.env.USER_ID || String(userId) === String(process.env.USER_ID)) return;
  activityLog.activeUsers.add(userId);
  activityLog.actions[action] = (activityLog.actions[action] || 0) + 1;
  if (code) activityLog.currencies[code] = (activityLog.currencies[code] || 0) + 1;
}

function resetActivityLog() {
  activityLog.actions = {};
  activityLog.activeUsers = new Set();
  activityLog.newUsers = [];
  activityLog.currencies = {};
  activityLog.subsAdded = 0;
  activityLog.subsRemoved = 0;
  activityLog.blocked = 0;
}

// ── Commands ────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const langCode = msg.from.language_code;

  const res = await db.query(
    "INSERT INTO users (user_id, username, first_name, language, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (user_id) DO NOTHING",
    [msg.from.id, msg.from.username || "Без юзернейма", msg.from.first_name, langCode]
  );

  // New user — instant notification + log
  if (res.rowCount === 1 && process.env.USER_ID && String(msg.from.id) !== String(process.env.USER_ID)) {
    const name = msg.from.first_name || "User";
    const uname = msg.from.username ? `@${msg.from.username}` : "без юзернейма";
    activityLog.newUsers.push({ name, username: msg.from.username });
    bot.sendMessage(process.env.USER_ID, `🆕 Новый: ${name} (${uname})`);
  }

  const lang = getLang(langCode);
  bot.sendMessage(msg.chat.id, `${lang.start}\n\n${lang.info}`);
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, getLang(msg.from.language_code).help, { parse_mode: "Markdown" });
});

bot.onText(/\/kurs/, (msg) => {
  const lang = getLang(msg.from.language_code);
  bot.sendMessage(msg.chat.id, lang.choose_currency, currencyKeyboard("kurs"));
});

bot.onText(/\/all/, async (msg) => {
  const chatId = msg.chat.id;
  const langCode = msg.from.language_code;
  const lang = getLang(langCode);

  try {
    const [data, prevRates] = await Promise.all([fetchAllCurrencies(), getYesterdayRates()]);
    bot.sendMessage(chatId, fmtAllRates(data, lang, langCode, prevRates), { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Ошибка /all:", error);
    bot.sendMessage(chatId, lang.error);
  }

  logActivity(msg.from.id, "all");
});

// ── Inline button callbacks ─────────────────────────────────────────

bot.on("callback_query", async (query) => {
  if (query.data.startsWith("bc_") || query.data.startsWith("adm_")) return;

  const chatId = query.message.chat.id;
  const parts = query.data.split("_");
  const action = parts[0];
  const code = parts[1];
  const langCode = query.from.language_code;
  const lang = getLang(langCode);

  if (!CURRENCIES[code]) return;

  bot.answerCallbackQuery(query.id);

  // Time selection for subscription: subt_USD_9
  if (action === "subt") {
    const hour = parseInt(parts[2]);
    try {
      await db.query(
        "INSERT INTO subscriptions (user_id, currency, send_hour) VALUES ($1, $2, $3) ON CONFLICT (user_id, currency) DO UPDATE SET send_hour = $3",
        [query.from.id, code, hour]
      );
      bot.sendMessage(chatId, lang.subscribed.replace("{currency}", code).replace("{time}", `${hour}:00`));
      activityLog.subsAdded++;
    } catch (err) {
      console.error("Subscription error:", err);
    }
    return;
  }

  // Subscription: show time picker or unsubscribe
  if (action === "sub") {
    try {
      const exists = await db.query(
        "SELECT 1 FROM subscriptions WHERE user_id = $1 AND currency = $2",
        [query.from.id, code]
      );
      if (exists.rows.length > 0) {
        await db.query("DELETE FROM subscriptions WHERE user_id = $1 AND currency = $2", [query.from.id, code]);
        bot.sendMessage(chatId, lang.unsubscribed.replace("{currency}", code));
        activityLog.subsRemoved++;
      } else {
        // Show time picker
        bot.sendMessage(chatId, lang.choose_time.replace("{currency}", code), {
          reply_markup: {
            inline_keyboard: [
              [6, 7, 8, 9].map((h) => ({ text: `${h}:00`, callback_data: `subt_${code}_${h}` })),
              [10, 12, 18, 21].map((h) => ({ text: `${h}:00`, callback_data: `subt_${code}_${h}` })),
            ],
          },
        });
      }
    } catch (err) {
      console.error("Subscription error:", err);
    }
    return;
  }

  try {
    let text;

    if (action === "history") {
      const rows = await getHistory(code);
      text = fmtHistory(rows, code, lang, langCode);
    } else {
      const data = await fetchCurrency(code);
      if (action === "kurs") {
        const prevRates = await getYesterdayRates();
        text = fmtCurrencyRate(data, code, lang, langCode, prevRates[code]);
      }
      else if (action === "banks") text = fmtBankRating(data, code, lang, langCode);
      else if (action === "spread") text = fmtSpread(data, code, lang, langCode);
      else return;
    }

    const subRes = await db.query(
      "SELECT 1 FROM subscriptions WHERE user_id = $1 AND currency = $2",
      [query.from.id, code]
    );
    const subscribed = subRes.rows.length > 0;
    const nav = navKeyboard(code, action, lang, subscribed);
    bot.sendMessage(chatId, text, { parse_mode: "Markdown", ...nav });
    logActivity(query.from.id, action, code);
  } catch (error) {
    console.error(`Ошибка ${action}:`, error);
    bot.sendMessage(chatId, lang.error);
  }
});

// ── Admin ───────────────────────────────────────────────────────────

let broadcastState = null;

function isAdmin(msg) {
  return String(msg.from.id) === String(process.env.USER_ID);
}

bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg)) return;

  bot.sendMessage(msg.chat.id, "⚙️ *Админ-панель*", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📋 Пользователи", callback_data: "adm_users" },
          { text: "📊 Статистика", callback_data: "adm_stats" },
        ],
        [
          { text: "📢 Рассылка", callback_data: "adm_broadcast" },
          { text: "🧹 Очистка", callback_data: "adm_cleanup" },
        ],
      ],
    },
  });
});

bot.onText(/\/cancel/, (msg) => {
  if (isAdmin(msg) && broadcastState) {
    broadcastState = null;
    bot.sendMessage(msg.chat.id, "❌ Рассылка отменена.");
  }
});

// Admin & Broadcast callback buttons
bot.on("callback_query", async (query) => {
  if (!query.data.startsWith("bc_") && !query.data.startsWith("adm_")) return;
  if (String(query.from.id) !== String(process.env.USER_ID)) return;

  bot.answerCallbackQuery(query.id);
  const chatId = query.message.chat.id;
  const action = query.data;

  // Admin panel actions
  if (action === "adm_users") {
    const res = await db.query(
      "SELECT user_id, username, first_name, language, to_char(created_at, 'DD-MM-YYYY HH24:MI:SS') as created_at FROM users"
    );

    if (res.rows.length === 0) {
      return bot.sendMessage(chatId, "📭 В базе данных нет пользователей.");
    }

    let text = `📋 *Список пользователей (${res.rows.length}):*\n\n`;
    res.rows.forEach((user, i) => {
      const uname = user.username
        ? `[${user.username}](https://t.me/${user.username.replace(/_/g, "\\_")})`
        : "нет";
      text += `👤 ${i + 1}. *ID:* ${user.user_id}\n`;
      text += `   🏷 *Имя:* ${user.first_name}\n`;
      text += `   🔗 *Юзернейм:* @${uname}\n`;
      text += `   🌍 *Язык:* ${user.language || "неизвестен"}\n`;
      text += `   📅 *Дата:* ${user.created_at}\n\n`;
    });

    return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }

  if (action === "adm_stats") {
    const [total, today, week, subs] = await Promise.all([
      db.query("SELECT COUNT(*) as count FROM users"),
      db.query("SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE"),
      db.query("SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"),
      db.query("SELECT currency, COUNT(*) as count FROM subscriptions GROUP BY currency ORDER BY count DESC"),
    ]);

    let text = "📊 *Статистика*\n\n";
    text += `👥 Всего: *${total.rows[0].count}*\n`;
    text += `🆕 Сегодня: *${today.rows[0].count}*\n`;
    text += `📅 За неделю: *${week.rows[0].count}*\n\n`;

    if (subs.rows.length > 0) {
      text += "🔔 *Подписки:*\n";
      subs.rows.forEach((s) => {
        text += `  ${s.currency}: ${s.count}\n`;
      });
    } else {
      text += "🔔 Подписок нет\n";
    }

    return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }

  if (action === "adm_cleanup") {
    bot.sendMessage(chatId, "🧹 Проверяю пользователей...");

    const res = await db.query("SELECT user_id FROM users");
    let removed = 0;

    for (const user of res.rows) {
      try {
        await bot.sendChatAction(user.user_id, "typing");
      } catch (err) {
        if (err.response && err.response.statusCode === 403) {
          await db.query("DELETE FROM subscriptions WHERE user_id = $1", [user.user_id]);
          await db.query("DELETE FROM users WHERE user_id = $1", [user.user_id]);
          removed++;
          activityLog.blocked++;
        }
      }
      await new Promise((r) => setTimeout(r, 35));
    }

    return bot.sendMessage(chatId, `🧹 Очистка завершена. Удалено: *${removed}*`, { parse_mode: "Markdown" });
  }

  if (action === "adm_broadcast") {
    broadcastState = { step: "choose_type" };
    return bot.sendMessage(chatId, "📢 *Рассылка*\n\nВыберите тип:", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🌐 Мультиязычный", callback_data: "bc_multi" },
            { text: "📝 Один для всех", callback_data: "bc_single" },
          ],
          [{ text: "❌ Отмена", callback_data: "bc_cancel" }],
        ],
      },
    });
  }

  if (action === "bc_cancel") {
    broadcastState = null;
    return bot.sendMessage(chatId, "❌ Рассылка отменена.");
  }

  if (action === "bc_multi") {
    broadcastState = { step: "input_ru", type: "multi", texts: {} };
    return bot.sendMessage(chatId, "🇷🇺 Введите текст на *русском*:", { parse_mode: "Markdown" });
  }

  if (action === "bc_single") {
    broadcastState = { step: "input_single", type: "single", texts: {} };
    return bot.sendMessage(chatId, "📝 Введите текст рассылки:");
  }

  if (action === "bc_edit_single" && broadcastState) {
    broadcastState.step = "input_single";
    return bot.sendMessage(chatId, "📝 Введите новый текст рассылки:");
  }

  if (action === "bc_edit_ru" && broadcastState) {
    broadcastState.step = "input_ru";
    return bot.sendMessage(chatId, "🇷🇺 Введите новый текст на *русском*:", { parse_mode: "Markdown" });
  }

  if (action === "bc_edit_en" && broadcastState) {
    broadcastState.step = "input_en";
    return bot.sendMessage(chatId, "🇬🇧 Введите новый текст на *английском*:", { parse_mode: "Markdown" });
  }

  if (action === "bc_edit_uz" && broadcastState) {
    broadcastState.step = "input_uz";
    return bot.sendMessage(chatId, "🇺🇿 Введите новый текст на *узбекском*:", { parse_mode: "Markdown" });
  }

  if (action === "bc_send" && broadcastState && broadcastState.step === "confirm") {
    return executeBroadcast(chatId);
  }
});

// Intercept admin text messages during broadcast dialog
bot.on("message", (msg) => {
  if (!broadcastState) return;
  if (!isAdmin(msg)) return;
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = msg.text;

  if (broadcastState.type === "single" && broadcastState.step === "input_single") {
    broadcastState.texts.all = text;
    broadcastState.step = "confirm";
    return showPreview(chatId);
  }

  if (broadcastState.type === "multi") {
    const isEditing = broadcastState.texts.ru && broadcastState.texts.en && broadcastState.texts.uz;

    if (broadcastState.step === "input_ru") {
      broadcastState.texts.ru = text;
      if (isEditing) { broadcastState.step = "confirm"; return showPreview(chatId); }
      broadcastState.step = "input_en";
      return bot.sendMessage(chatId, "🇬🇧 Введите текст на *английском*:", { parse_mode: "Markdown" });
    }
    if (broadcastState.step === "input_en") {
      broadcastState.texts.en = text;
      if (isEditing) { broadcastState.step = "confirm"; return showPreview(chatId); }
      broadcastState.step = "input_uz";
      return bot.sendMessage(chatId, "🇺🇿 Введите текст на *узбекском*:", { parse_mode: "Markdown" });
    }
    if (broadcastState.step === "input_uz") {
      broadcastState.texts.uz = text;
      broadcastState.step = "confirm";
      return showPreview(chatId);
    }
  }
});

function showPreview(chatId) {
  let preview = "📢 *Превью рассылки:*\n\n";
  let editButtons;

  if (broadcastState.type === "single") {
    preview += `${broadcastState.texts.all}\n`;
    editButtons = [{ text: "✏️ Изменить", callback_data: "bc_edit_single" }];
  } else {
    preview += `🇷🇺 *Русский:*\n${broadcastState.texts.ru}\n\n`;
    preview += `🇬🇧 *English:*\n${broadcastState.texts.en}\n\n`;
    preview += `🇺🇿 *O'zbek:*\n${broadcastState.texts.uz}\n`;
    editButtons = [
      { text: "✏️ RU", callback_data: "bc_edit_ru" },
      { text: "✏️ EN", callback_data: "bc_edit_en" },
      { text: "✏️ UZ", callback_data: "bc_edit_uz" },
    ];
  }

  bot.sendMessage(chatId, preview, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        editButtons,
        [
          { text: "✅ Отправить", callback_data: "bc_send" },
          { text: "❌ Отмена", callback_data: "bc_cancel" },
        ],
      ],
    },
  });
}

async function executeBroadcast(chatId) {
  const adminId = String(process.env.USER_ID);
  const texts = broadcastState.texts;
  const isMulti = broadcastState.type === "multi";

  broadcastState = null;

  bot.sendMessage(chatId, "⏳ Рассылка начата...");

  const res = await db.query("SELECT user_id, language FROM users");
  let sent = 0, blocked = 0, errors = 0;

  for (const user of res.rows) {
    if (String(user.user_id) === adminId) continue;

    let msgText;
    if (isMulti) {
      const lang = user.language || "ru";
      msgText = texts[lang] || texts.ru;
    } else {
      msgText = texts.all;
    }

    try {
      await bot.sendMessage(user.user_id, msgText, { parse_mode: "Markdown" });
      sent++;
    } catch (err) {
      if (err.response && err.response.statusCode === 403) {
        blocked++;
      } else {
        errors++;
        console.error(`Broadcast error for ${user.user_id}:`, err.message);
      }
    }

    // Rate limit: ~30 msg/sec
    await new Promise((r) => setTimeout(r, 35));
  }

  bot.sendMessage(
    chatId,
    `📢 *Рассылка завершена!*\n\n✅ Отправлено: ${sent}\n🚫 Заблокировали: ${blocked}\n❌ Ошибок: ${errors}`,
    { parse_mode: "Markdown" }
  );
}

module.exports = { activityLog, resetActivityLog };
