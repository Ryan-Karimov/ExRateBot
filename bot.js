const { bot, db } = require("./src/config");
const { getLang } = require("./src/messages");
const { fetchCurrency, getYesterdayRates } = require("./src/parser");
const { fmtCurrencyRate } = require("./src/formatters");

const { activityLog, resetActivityLog } = require("./src/handlers");

// ── Create subscriptions table ──────────────────────────────────────

db.query(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    send_hour INTEGER DEFAULT 9,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, currency)
  )
`).catch((err) => console.error("Ошибка создания таблицы subscriptions:", err));

// Add send_hour column if table already exists without it
db.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS send_hour INTEGER DEFAULT 9`)
  .catch(() => {});

// ── Subscription sender ─────────────────────────────────────────────

async function sendSubscriptions(hour) {
  const subs = await db.query(
    `SELECT s.user_id, s.currency, u.language
     FROM subscriptions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.send_hour = $1`,
    [hour]
  );

  if (subs.rows.length === 0) return;

  const prevRates = await getYesterdayRates();
  const rateCache = {};
  let sent = 0;

  for (const sub of subs.rows) {
    try {
      if (!rateCache[sub.currency]) {
        rateCache[sub.currency] = await fetchCurrency(sub.currency);
      }

      const data = rateCache[sub.currency];
      const lang = getLang(sub.language);
      const text = fmtCurrencyRate(data, sub.currency, lang, sub.language, prevRates[sub.currency]);

      await bot.sendMessage(sub.user_id, text, { parse_mode: "Markdown" });
      sent++;
    } catch (err) {
      if (err.response && err.response.statusCode === 403) {
        await db.query("DELETE FROM subscriptions WHERE user_id = $1", [sub.user_id]);
      } else {
        console.error(`Subscription send error for ${sub.user_id}:`, err.message);
      }
    }

    await new Promise((r) => setTimeout(r, 35));
  }

  if (sent > 0) console.log(`📬 Рассылка (${hour}:00): ${sent} сообщений`);
}

// ── Daily digest (21:00 Tashkent) ───────────────────────────────────

let lastDigestDate = null;

async function sendDigest() {
  if (!process.env.USER_ID) return;

  const now = new Date().toLocaleString("ru-RU", {
    day: "numeric", month: "long", timeZone: "Asia/Tashkent",
  });

  const [totalRes, subsRes] = await Promise.all([
    db.query("SELECT COUNT(*) as count FROM users"),
    db.query("SELECT currency, COUNT(*) as count FROM subscriptions GROUP BY currency ORDER BY count DESC"),
  ]);

  const totalUsers = totalRes.rows[0].count;
  const activeCount = activityLog.activeUsers.size;
  const totalActions = Object.values(activityLog.actions).reduce((a, b) => a + b, 0);

  let text = `📊 *Дайджест за ${now}*\n\n`;
  text += `👥 Всего: *${totalUsers}* | Активных: *${activeCount}*\n`;

  // New users
  if (activityLog.newUsers.length > 0) {
    text += `🆕 Новые: *${activityLog.newUsers.length}*\n`;
    activityLog.newUsers.forEach((u, i) => {
      const uname = u.username ? `@${u.username}` : "без юзернейма";
      text += `  ${i + 1}. ${u.name} (${uname})\n`;
    });
  } else {
    text += `🆕 Новые: *0*\n`;
  }

  // Actions
  text += `\n📈 Запросов: *${totalActions}*\n`;
  if (totalActions > 0) {
    const parts = Object.entries(activityLog.actions)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} — ${v}`);
    text += `  ${parts.join(" | ")}\n`;
  }

  // Popular currency
  const sortedCur = Object.entries(activityLog.currencies).sort((a, b) => b[1] - a[1]);
  if (sortedCur.length > 0) {
    text += `\n💰 Популярная: *${sortedCur[0][0]}* (${sortedCur[0][1]})\n`;
  }

  // Subscriptions
  const totalSubs = subsRes.rows.reduce((a, r) => a + parseInt(r.count), 0);
  const subChange = activityLog.subsAdded || activityLog.subsRemoved
    ? ` (+${activityLog.subsAdded} / -${activityLog.subsRemoved})`
    : "";
  text += `\n🔔 Подписки: *${totalSubs}*${subChange}\n`;
  if (subsRes.rows.length > 0) {
    text += `  ${subsRes.rows.map((s) => `${s.currency}: ${s.count}`).join(" | ")}\n`;
  }

  // Blocked
  if (activityLog.blocked > 0) {
    text += `\n🚫 Заблокировали: *${activityLog.blocked}*\n`;
  }

  await bot.sendMessage(process.env.USER_ID, text, { parse_mode: "Markdown" });
  resetActivityLog();
}

// ── Scheduler ───────────────────────────────────────────────────────

let lastSentHour = null;

setInterval(() => {
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" });
  const d = new Date(now);
  const today = d.toISOString().split("T")[0];
  const hourKey = `${today}_${d.getHours()}`;

  // Send subscriptions every hour (for users who chose that hour)
  if (d.getMinutes() === 0 && lastSentHour !== hourKey) {
    lastSentHour = hourKey;
    sendSubscriptions(d.getHours()).catch((err) => console.error("Scheduler error:", err));
  }

  if (d.getHours() === 6 && d.getMinutes() === 0 && lastDigestDate !== today) {
    lastDigestDate = today;
    sendDigest().catch((err) => console.error("Digest error:", err));
  }
}, 30_000);

// ── Graceful shutdown ───────────────────────────────────────────────

function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  bot.stopPolling();
  db.end().then(() => {
    console.log("DB connection closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("Бот запущен...");
