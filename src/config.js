const TelegramBot = require("node-telegram-bot-api");
const { Client } = require("pg");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});
db.connect();

module.exports = { bot, db };
