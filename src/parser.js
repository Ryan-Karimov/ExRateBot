const axios = require("axios");
const cheerio = require("cheerio");
const { CURRENCIES, CURRENCY_CODES } = require("./currencies");
const { parseRate } = require("./helpers");
const { db } = require("./config");

// ── Cache (5 min TTL) ───────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(code) {
  const entry = cache.get(code);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

// ── Fetch single currency page ──────────────────────────────────────

async function fetchCurrency(code) {
  const cached = getCached(code);
  if (cached) return cached;

  const { data: html } = await axios.get(CURRENCIES[code].url);
  const $ = cheerio.load(html);

  // CB rate from top summary block
  const cbRateText = $(".col-2.cours-active").eq(1).find(".semibold-text").text();
  const cbRate = parseRate(cbRateText);

  // Full bank lists from the currency's tab
  const tab = $(`#best_${code}`);
  const buy = [];
  const sell = [];

  tab.find(".bc-inner-blocks-left .bc-inner-block-left-texts").each((_, el) => {
    const bank = $(el).find(".bc-inner-block-left-text .medium-text").text().trim();
    const rate = parseRate($(el).find(".medium-text.green-date").text());
    if (rate > 0 && bank) buy.push({ bank, rate });
  });

  tab.find(".bc-inner-blocks-right .bc-inner-block-left-texts").each((_, el) => {
    const bank = $(el).find(".bc-inner-block-left-text .medium-text").text().trim();
    const rate = parseRate($(el).find(".medium-text.green-date").text());
    if (rate > 0 && bank) sell.push({ bank, rate });
  });

  // Chart history from embedded JS
  const chartData = extractChartData(html);

  const result = { cbRate, buy, sell };

  cache.set(code, { data: result, ts: Date.now() });

  // Save to DB (fire-and-forget)
  saveHistory(code, cbRate, buy, sell, chartData).catch((err) =>
    console.error("Ошибка сохранения:", err)
  );

  return result;
}

// ── Fetch all currencies in parallel ────────────────────────────────

async function fetchAllCurrencies() {
  const results = {};
  await Promise.all(
    CURRENCY_CODES.map(async (code) => {
      results[code] = await fetchCurrency(code);
    })
  );
  return results;
}

// ── Chart data extraction ───────────────────────────────────────────

function extractChartData(html) {
  const match = html.match(/chart\.data\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

// ── DB persistence ──────────────────────────────────────────────────

async function saveHistory(code, cbRate, buy, sell, chartData) {
  const today = new Date().toISOString().split("T")[0];

  const bankBuyRate = buy.length > 0 ? buy[0].rate : 0;
  const bankBuyName = buy.length > 0 ? buy[0].bank : null;
  const bankSellRate = sell.length > 0 ? sell[0].rate : 0;
  const bankSellName = sell.length > 0 ? sell[0].bank : null;

  // Save today's full data
  await db.query(
    `INSERT INTO rates_history (date, currency, cb_rate, bank_buy_rate, bank_buy_name, bank_sell_rate, bank_sell_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (date, currency) DO UPDATE SET
       cb_rate = $3, bank_buy_rate = $4, bank_buy_name = $5, bank_sell_rate = $6, bank_sell_name = $7`,
    [today, code, cbRate, bankBuyRate, bankBuyName, bankSellRate, bankSellName]
  );

  // Backfill CB history from chart.data (last 30 days)
  if (chartData.length > 0) {
    const recent = chartData.slice(-30);
    for (const entry of recent) {
      const rate = Math.round(parseFloat(entry.value));
      if (rate > 0) {
        await db.query(
          `INSERT INTO rates_history (date, currency, cb_rate)
           VALUES ($1, $2, $3)
           ON CONFLICT (date, currency) DO UPDATE SET cb_rate = $3`,
          [entry.date, code, rate]
        );
      }
    }
  }
}

// ── History from DB ─────────────────────────────────────────────────

async function getHistory(code, days = 7) {
  const res = await db.query(
    `SELECT date, cb_rate, bank_buy_rate, bank_buy_name, bank_sell_rate, bank_sell_name
     FROM rates_history
     WHERE currency = $1
     ORDER BY date DESC
     LIMIT $2`,
    [code, days]
  );
  return res.rows;
}

// ── Yesterday's rates (for change indicator) ────────────────────────

let prevRatesCache = { data: null, date: null };

async function getYesterdayRates() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  if (prevRatesCache.date === today && prevRatesCache.data) return prevRatesCache.data;

  const res = await db.query(
    `SELECT DISTINCT ON (currency) currency, cb_rate
     FROM rates_history WHERE date < $1 AND cb_rate > 0
     ORDER BY currency, date DESC`,
    [today]
  );
  const rates = {};
  for (const row of res.rows) rates[row.currency] = row.cb_rate;

  prevRatesCache = { data: rates, date: today };
  return rates;
}

module.exports = { fetchCurrency, fetchAllCurrencies, getHistory, getYesterdayRates };
