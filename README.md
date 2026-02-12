# ExRateBot

Telegram-бот для отслеживания курсов валют в Узбекистане.

## Возможности

- Курс ЦБ РУз и лучшие курсы банков (покупка/продажа)
- Рейтинг банков и спред
- История курса за 7 дней
- Ежедневные уведомления с выбором времени
- Мультиязычность (русский, английский, узбекский)

## Команды

| Команда  | Описание                  |
| -------- | ------------------------- |
| `/start` | Запуск бота               |
| `/kurs`  | Курс выбранной валюты     |
| `/all`   | Все курсы одним сообщением |
| `/help`  | Список команд             |

Валюты: USD, EUR, RUB, GBP, KZT

## Стек

- Node.js + [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- PostgreSQL (pg)
- axios + cheerio
- Деплой: Railway

## Установка

```bash
git clone https://github.com/Ryan-Karimov/ExRateBot.git
cd ExRateBot
npm install
```

Создайте `.env`:

```
BOT_TOKEN=токен_от_botfather
DATABASE_URL=postgresql://user:pass@host:5432/dbname
USER_ID=ваш_telegram_id
```

Запуск:

```bash
npm start
```

## Структура

```
bot.js              — точка входа, планировщик, подписки
src/
  config.js         — подключение к Telegram API и PostgreSQL
  currencies.js     — список валют
  parser.js         — парсинг данных и работа с историей
  formatters.js     — форматирование сообщений
  handlers.js       — обработчики команд и callback-кнопок
  helpers.js        — клавиатуры
  messages.js       — тексты на 3 языках
```

## Автор

[Ravshanbek Karimov](https://github.com/Ryan-Karimov)
