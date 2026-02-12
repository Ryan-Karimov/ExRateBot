const { CURRENCIES, CURRENCY_CODES } = require("./currencies");
const { formatRate, formatDate } = require("./helpers");

// data per currency: { cbRate, buy, sell }
// В парсере: buy = банк покупает (юзер продаёт), sell = банк продаёт (юзер покупает)

function changeArrow(current, previous) {
  if (!previous || previous === 0 || current === 0) return "";
  if (current > previous) return " ↑";
  if (current < previous) return " ↓";
  return "";
}

function fmtCurrencyRate(data, code, lang, langCode, prevRate) {
  const cur = CURRENCIES[code];
  const date = formatDate(langCode);

  let text = `${cur.flag} *${code} — ${cur.name[langCode] || cur.name.en}*\n`;
  text += `📅 ${date}\n\n`;

  if (data.cbRate > 0) {
    const arrow = changeArrow(data.cbRate, prevRate);
    text += `💰 ${lang.cb}: *${formatRate(data.cbRate)}*${arrow}\n\n`;
  }

  text += `${lang.best_rates}:\n`;
  if (data.sell.length > 0) {
    text += `${lang.buy}: *${formatRate(data.sell[0].rate)}* (🏦 ${data.sell[0].bank})\n`;
  }
  if (data.buy.length > 0) {
    text += `${lang.sell}: *${formatRate(data.buy[0].rate)}* (🏦 ${data.buy[0].bank})\n`;
  }

  return text;
}

function fmtAllRates(allData, lang, langCode, prevRates) {
  const date = formatDate(langCode);
  let text = `*${lang.all_title}*\n📅 ${date}\n\n`;

  for (const code of CURRENCY_CODES) {
    const cur = CURRENCIES[code];
    const data = allData[code];

    text += `${cur.flag} *${code}*`;
    if (data.cbRate > 0) {
      const arrow = prevRates ? changeArrow(data.cbRate, prevRates[code]) : "";
      text += `  (${lang.cb}: ${formatRate(data.cbRate)}${arrow})`;
    }
    text += "\n";

    if (data.sell.length > 0) {
      text += `  ${lang.buy}: ${formatRate(data.sell[0].rate)} — ${data.sell[0].bank}\n`;
    }
    if (data.buy.length > 0) {
      text += `  ${lang.sell}: ${formatRate(data.buy[0].rate)} — ${data.buy[0].bank}\n`;
    }
    text += "\n";
  }

  return text;
}

function fmtBankRating(data, code, lang, langCode) {
  const cur = CURRENCIES[code];
  const date = formatDate(langCode);

  let text = `${cur.flag} *${lang.banks_title} — ${code}*\n`;
  text += `📅 ${date}\n\n`;

  text += `*${lang.buy}:*\n`;
  if (data.sell.length === 0) {
    text += `${lang.no_data}\n`;
  } else {
    data.sell.forEach((b, i) => {
      text += `  ${i + 1}. ${b.bank} — *${formatRate(b.rate)}*\n`;
    });
  }

  text += `\n*${lang.sell}:*\n`;
  if (data.buy.length === 0) {
    text += `${lang.no_data}\n`;
  } else {
    data.buy.forEach((b, i) => {
      text += `  ${i + 1}. ${b.bank} — *${formatRate(b.rate)}*\n`;
    });
  }

  return text;
}

function fmtSpread(data, code, lang, langCode) {
  const cur = CURRENCIES[code];
  const date = formatDate(langCode);

  const map = {};
  for (const b of data.buy) map[b.bank] = { userSell: b.rate };
  for (const s of data.sell) {
    if (map[s.bank]) map[s.bank].userBuy = s.rate;
    else map[s.bank] = { userBuy: s.rate };
  }

  const spreads = [];
  for (const [bank, r] of Object.entries(map)) {
    if (r.userBuy && r.userSell) {
      spreads.push({ bank, userBuy: r.userBuy, userSell: r.userSell, spread: r.userBuy - r.userSell });
    }
  }
  spreads.sort((a, b) => a.spread - b.spread);

  let text = `${cur.flag} *${lang.spread_title} — ${code}*\n`;
  text += `📅 ${date}\n\n`;

  if (spreads.length === 0) {
    text += lang.no_data;
    return text;
  }

  const medals = ["🥇", "🥈", "🥉"];
  spreads.forEach((s, i) => {
    const prefix = medals[i] || `${i + 1}.`;
    const pct = ((s.spread / s.userSell) * 100).toFixed(2);
    text += `${prefix} *${s.bank}* — ${lang.difference}: *${formatRate(s.spread)}* (${pct}%)\n`;
    text += `   ${lang.buy}: ${formatRate(s.userBuy)} | ${lang.sell}: ${formatRate(s.userSell)}\n`;
  });

  return text;
}

function fmtHistory(rows, code, lang, langCode) {
  const cur = CURRENCIES[code];

  let text = `${cur.flag} *${lang.history_title} — ${code}*\n\n`;

  if (rows.length === 0) {
    text += lang.no_data;
    return text;
  }

  rows.forEach((row, i) => {
    const d = new Intl.DateTimeFormat(langCode || "en", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Tashkent",
    }).format(new Date(row.date));

    const prev = rows[i + 1];
    let arrow = "";
    if (prev && prev.cb_rate > 0 && row.cb_rate > 0) {
      if (row.cb_rate > prev.cb_rate) arrow = " 📈";
      else if (row.cb_rate < prev.cb_rate) arrow = " 📉";
      else arrow = " ➡️";
    }

    text += `*${d}*${arrow}\n`;

    if (row.cb_rate > 0) {
      text += `  💰 ${lang.cb}: ${formatRate(row.cb_rate)}\n`;
    }
    if (row.bank_sell_rate > 0) {
      text += `  ${lang.buy}: ${formatRate(row.bank_sell_rate)}`;
      if (row.bank_sell_name) text += ` — ${row.bank_sell_name}`;
      text += "\n";
    }
    if (row.bank_buy_rate > 0) {
      text += `  ${lang.sell}: ${formatRate(row.bank_buy_rate)}`;
      if (row.bank_buy_name) text += ` — ${row.bank_buy_name}`;
      text += "\n";
    }
    text += "\n";
  });

  return text;
}

module.exports = { fmtCurrencyRate, fmtAllRates, fmtBankRating, fmtSpread, fmtHistory };
