#!/usr/bin/env python3
"""Telegram-бот «Показания».

Мини-приложение открывается кнопкой. Расчёт приходит через web_app_data.
Переменные окружения:
  TELEGRAM_BOT_TOKEN  — токен от @BotFather
  MINIAPP_URL         — HTTPS-адрес мини-приложения (этот веб-апп)
  ADMIN_IDS           — telegram id владельца, через запятую
  DB_PATH             — sqlite-файл (по умолчанию ./rent_data.db)
"""

from __future__ import annotations

import csv
import json
import logging
import os
import sqlite3
from datetime import datetime
from io import BytesIO

import pytz
import telebot
from apscheduler.schedulers.background import BackgroundScheduler
from telebot import types

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("rent_bot")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
MINIAPP_URL = os.getenv("MINIAPP_URL", "").rstrip("/")
DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "rent_data.db"))
ADMIN_IDS = {
    int(x.strip())
    for x in os.getenv("ADMIN_IDS", "528656263").split(",")
    if x.strip().isdigit()
}
FLAT_ID = 1

if not TOKEN:
    raise ValueError("Не задан TELEGRAM_BOT_TOKEN")
if not MINIAPP_URL:
    logger.warning("MINIAPP_URL не задан — кнопка мини-приложения не заработает")

bot = telebot.TeleBot(TOKEN)

DEFAULT_TARIFFS = {
    "elec_t1": 7.10,
    "elec_t2": 2.82,
    "elec_t3": 5.80,
    "water_cold": 45.20,
    "water_hot": 150.00,
}


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db() -> None:
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS current_readings (
            user_id INTEGER PRIMARY KEY,
            t1 REAL, t2 REAL, t3 REAL,
            cold REAL, hot REAL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT,
            use_t1 REAL, use_t2 REAL, use_t3 REAL,
            use_cold REAL, use_hot REAL,
            cost_elec REAL, cost_water REAL, total_sum REAL
        )
        """
    )
    cur.execute("CREATE TABLE IF NOT EXISTS subscribers (chat_id INTEGER PRIMARY KEY)")
    cur.execute("CREATE TABLE IF NOT EXISTS tariffs (key TEXT PRIMARY KEY, value REAL)")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS allowed_users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            full_name TEXT,
            added_at TEXT
        )
        """
    )
    for k, v in DEFAULT_TARIFFS.items():
        cur.execute("INSERT OR IGNORE INTO tariffs (key, value) VALUES (?, ?)", (k, v))
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for admin_id in ADMIN_IDS:
        cur.execute(
            """
            INSERT OR IGNORE INTO allowed_users (user_id, username, full_name, added_at)
            VALUES (?, ?, ?, ?)
            """,
            (admin_id, "admin", "Владелец", now),
        )
    conn.commit()
    conn.close()


def is_allowed(user_id: int) -> bool:
    if user_id in ADMIN_IDS:
        return True
    conn = get_db()
    row = conn.execute("SELECT 1 FROM allowed_users WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()
    return row is not None


def add_allowed_user(user_id: int, username: str = "", full_name: str = "") -> None:
    conn = get_db()
    conn.execute(
        """
        INSERT OR REPLACE INTO allowed_users (user_id, username, full_name, added_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, username, full_name, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()
    conn.close()


def remove_allowed_user(user_id: int) -> None:
    conn = get_db()
    conn.execute("DELETE FROM allowed_users WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()


def get_allowed_users():
    conn = get_db()
    rows = conn.execute(
        "SELECT user_id, username, full_name, added_at FROM allowed_users"
    ).fetchall()
    conn.close()
    return rows


def get_tariffs() -> dict[str, float]:
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM tariffs").fetchall()
    conn.close()
    return dict(rows)


def update_tariff(key: str, value: float) -> None:
    conn = get_db()
    conn.execute(
        "INSERT INTO tariffs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()
    conn.close()


def register_subscriber(chat_id: int) -> None:
    conn = get_db()
    conn.execute("INSERT OR IGNORE INTO subscribers (chat_id) VALUES (?)", (chat_id,))
    conn.commit()
    conn.close()


def get_subscribers() -> list[int]:
    conn = get_db()
    rows = conn.execute("SELECT chat_id FROM subscribers").fetchall()
    conn.close()
    return [r[0] for r in rows]


def get_last_readings():
    conn = get_db()
    row = conn.execute(
        "SELECT t1, t2, t3, cold, hot FROM current_readings WHERE user_id = ?",
        (FLAT_ID,),
    ).fetchone()
    conn.close()
    return row


def save_current_readings(t1, t2, t3, cold, hot) -> None:
    conn = get_db()
    conn.execute(
        """
        INSERT INTO current_readings (user_id, t1, t2, t3, cold, hot)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        t1=excluded.t1, t2=excluded.t2, t3=excluded.t3,
        cold=excluded.cold, hot=excluded.hot
        """,
        (FLAT_ID, t1, t2, t3, cold, hot),
    )
    conn.commit()
    conn.close()


def save_history(date, u_t1, u_t2, u_t3, u_cold, u_hot, c_elec, c_water, total) -> None:
    conn = get_db()
    conn.execute(
        """
        INSERT INTO history (user_id, date, use_t1, use_t2, use_t3, use_cold, use_hot, cost_elec, cost_water, total_sum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (FLAT_ID, date, u_t1, u_t2, u_t3, u_cold, u_hot, c_elec, c_water, total),
    )
    conn.commit()
    conn.close()


init_db()


def check_access(func):
    def wrapper(message, *args, **kwargs):
        user_id = message.from_user.id
        if not is_allowed(user_id):
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("Запросить доступ", callback_data="request_access"))
            bot.send_message(
                message.chat.id,
                "У вас нет доступа к этому боту.\nНажмите кнопку, чтобы отправить запрос владельцу.",
                reply_markup=markup,
            )
            return
        return func(message, *args, **kwargs)

    return wrapper


def check_admin(func):
    def wrapper(message, *args, **kwargs):
        if message.from_user.id not in ADMIN_IDS:
            bot.send_message(message.chat.id, "Команда доступна только владельцу.")
            return
        return func(message, *args, **kwargs)

    return wrapper


def webapp_keyboard() -> types.ReplyKeyboardMarkup:
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    if MINIAPP_URL:
        markup.add(
            types.KeyboardButton(
                "Ввести показания",
                web_app=types.WebAppInfo(url=MINIAPP_URL),
            )
        )
    else:
        markup.add(types.KeyboardButton("Ввести показания"))
    markup.add(types.KeyboardButton("Показать введённые"))
    return markup


def format_receipt(date, u_t1, u_t2, u_t3, u_cold, u_hot, c_elec, c_water, total) -> str:
    return (
        f"Расчёт за коммунальные услуги ({date}):\n\n"
        "Электричество:\n"
        f"• Т1: {u_t1:.1f} кВт·ч\n"
        f"• Т2: {u_t2:.1f} кВт·ч\n"
        f"• Т3: {u_t3:.1f} кВт·ч\n"
        f"Сумма за свет: {c_elec:.2f} руб.\n\n"
        "Вода:\n"
        f"• Горячая: {u_hot:.1f} м³\n"
        f"• Холодная: {u_cold:.1f} м³\n"
        f"Сумма за воду: {c_water:.2f} руб.\n"
        "──────────────\n"
        f"ИТОГО К ОПЛАТЕ: {total:.2f} руб."
    )


def send_monthly_reminders() -> None:
    subs = get_subscribers()
    logger.info("Ежемесячное напоминание для %s подписчиков", len(subs))
    for chat_id in subs:
        try:
            bot.send_message(
                chat_id,
                "Сегодня 25 число. Пожалуйста, передайте показания счётчиков.",
                reply_markup=webapp_keyboard(),
            )
        except Exception as exc:
            logger.error("Напоминание в чат %s: %s", chat_id, exc)


scheduler = BackgroundScheduler(timezone=pytz.timezone("Europe/Moscow"))
scheduler.add_job(send_monthly_reminders, "cron", day=25, hour=10, minute=0)
scheduler.start()


@bot.message_handler(commands=["start"])
@check_access
def start_cmd(message):
    register_subscriber(message.chat.id)
    if MINIAPP_URL:
        try:
            bot.set_chat_menu_button(
                chat_id=message.chat.id,
                menu_button=types.MenuButtonWebApp(
                    text="Показания",
                    web_app=types.WebAppInfo(url=MINIAPP_URL),
                ),
            )
        except Exception as exc:
            logger.warning("set_chat_menu_button: %s", exc)
    bot.send_message(
        message.chat.id,
        "Бот учёта коммунальных платежей.\nОткройте мини-приложение, чтобы выставить цифры на счётчиках.",
        reply_markup=webapp_keyboard(),
    )


@bot.message_handler(commands=["help"])
@check_access
def help_cmd(message):
    bot.send_message(
        message.chat.id,
        "Ввести показания — открыть мини-приложение со счётчиками\n"
        "Показать введённые — последний расчёт\n"
        "/status — стартовые показания и тарифы\n"
        "/export_csv — история в CSV\n\n"
        "Владелец:\n"
        "/tenants — список арендаторов\n"
        "/add_tenant ID\n"
        "/del_tenant ID\n"
        "/set_initial — 5 чисел: Т1 Т2 Т3 Холодная Горячая\n"
        "/set_tariff ключ значение",
    )


@bot.message_handler(commands=["tenants"])
@check_admin
def list_tenants_cmd(message):
    users = get_allowed_users()
    if not users:
        bot.send_message(message.chat.id, "Список арендаторов пуст.")
        return
    text = "Разрешённые пользователи:\n\n"
    markup = types.InlineKeyboardMarkup()
    for uid, username, full_name, _added in users:
        role = " (админ)" if uid in ADMIN_IDS else ""
        text += f"• {full_name} (@{username}) | ID: {uid}{role}\n"
        if uid not in ADMIN_IDS:
            markup.add(
                types.InlineKeyboardButton(
                    f"Удалить {full_name} ({uid})",
                    callback_data=f"remove_user_{uid}",
                )
            )
    bot.send_message(message.chat.id, text, reply_markup=markup)


@bot.message_handler(commands=["add_tenant"])
@check_admin
def add_tenant_cmd(message):
    try:
        target_id = int(message.text.split()[1])
        add_allowed_user(target_id, "manual", "Арендатор")
        bot.send_message(message.chat.id, f"Пользователь {target_id} добавлен.")
    except Exception:
        bot.send_message(message.chat.id, "Использование: /add_tenant 123456789")


@bot.message_handler(commands=["del_tenant"])
@check_admin
def del_tenant_cmd(message):
    try:
        target_id = int(message.text.split()[1])
        if target_id in ADMIN_IDS:
            bot.send_message(message.chat.id, "Нельзя удалить администратора.")
            return
        remove_allowed_user(target_id)
        bot.send_message(message.chat.id, f"Пользователь {target_id} удалён.")
    except Exception:
        bot.send_message(message.chat.id, "Использование: /del_tenant 123456789")


@bot.message_handler(commands=["status"])
@check_access
def status_cmd(message):
    curr = get_last_readings()
    tariffs = get_tariffs()
    lines = ["Текущий статус\n"]
    if curr:
        lines.append(
            "Стартовые показания:\n"
            f"T1: {curr[0]} | T2: {curr[1]} | T3: {curr[2]}\n"
            f"Холодная: {curr[3]} м³ | Горячая: {curr[4]} м³\n"
        )
    else:
        lines.append("Стартовые показания ещё не заданы.\n")
    lines.append("Тарифы:")
    for k, v in tariffs.items():
        lines.append(f"• {k}: {v} руб.")
    bot.send_message(message.chat.id, "\n".join(lines))


@bot.message_handler(commands=["set_initial"])
@check_admin
def set_initial_cmd(message):
    msg = bot.send_message(
        message.chat.id,
        "Введите 5 начальных показаний через пробел:\nТ1 Т2 Т3 Холодная Горячая",
    )
    bot.register_next_step_handler(msg, process_initial_save)


def process_initial_save(message):
    try:
        t1, t2, t3, cold, hot = map(float, message.text.replace(",", ".").split())
        save_current_readings(t1, t2, t3, cold, hot)
        bot.send_message(message.chat.id, "Стартовые показания сохранены.", reply_markup=webapp_keyboard())
    except ValueError:
        bot.send_message(message.chat.id, "Нужно 5 чисел. Повторите /set_initial.")


@bot.message_handler(commands=["set_tariff"])
@check_admin
def set_tariff_cmd(message):
    try:
        _cmd, key, raw = message.text.split()
        val = float(raw.replace(",", "."))
        update_tariff(key, val)
        bot.send_message(message.chat.id, f"Тариф {key} обновлён: {val} руб.")
    except Exception:
        bot.send_message(
            message.chat.id,
            "Использование: /set_tariff water_hot 155.5",
        )


@bot.message_handler(commands=["export_csv"])
@check_access
def export_csv_cmd(message):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, date, use_t1, use_t2, use_t3, use_cold, use_hot, cost_elec, cost_water, total_sum FROM history ORDER BY id ASC"
    ).fetchall()
    conn.close()
    if not rows:
        bot.send_message(message.chat.id, "История расчётов пуста.")
        return
    buf = BytesIO()
    buf.write(b"\xef\xbb\xbf")
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(
        ["ID", "Дата", "Расход T1", "Расход T2", "Расход T3", "Расход ХВС", "Расход ГВС", "Сумма свет", "Сумма вода", "Итого"]
    )
    writer.writerows(rows)
    buf.seek(0)
    bot.send_document(message.chat.id, buf, visible_file_name="rent_history_export.csv")


@bot.message_handler(func=lambda msg: msg.text == "Показать введённые")
@check_access
def show_history(message):
    register_subscriber(message.chat.id)
    conn = get_db()
    last = conn.execute(
        """
        SELECT date, use_t1, use_t2, use_t3, use_cold, use_hot, cost_elec, cost_water, total_sum
        FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 1
        """,
        (FLAT_ID,),
    ).fetchone()
    conn.close()
    if not last:
        bot.send_message(message.chat.id, "История расчётов пуста.")
        return
    bot.send_message(message.chat.id, format_receipt(*last))


@bot.message_handler(func=lambda msg: msg.text == "Ввести показания")
@check_access
def open_app_hint(message):
    if MINIAPP_URL:
        bot.send_message(
            message.chat.id,
            "Нажмите кнопку «Ввести показания» на клавиатуре — она открывает мини-приложение.",
            reply_markup=webapp_keyboard(),
        )
    else:
        bot.send_message(message.chat.id, "MINIAPP_URL не задан на сервере бота.")


@bot.message_handler(content_types=["web_app_data"])
def web_app_data(message):
    user_id = message.from_user.id
    if not is_allowed(user_id):
        bot.send_message(message.chat.id, "Нет доступа.")
        return
    try:
        data = json.loads(message.web_app_data.data)
        t1 = float(data["t1"])
        t2 = float(data["t2"])
        t3 = float(data["t3"])
        cold = float(data["cold"])
        hot = float(data["hot"])
    except Exception as exc:
        logger.error("web_app_data parse: %s", exc)
        bot.send_message(message.chat.id, "Не удалось прочитать данные мини-приложения.")
        return

    old = get_last_readings()
    tariffs = get_tariffs()
    if not old:
        save_current_readings(t1, t2, t3, cold, hot)
        bot.send_message(
            message.chat.id,
            "Начальные показания записаны. В следующем месяце придёт расчёт.",
            reply_markup=webapp_keyboard(),
        )
        return

    old_t1, old_t2, old_t3, old_cold, old_hot = old
    errors = []
    if t1 < old_t1:
        errors.append(f"T1 ({t1} < {old_t1})")
    if t2 < old_t2:
        errors.append(f"T2 ({t2} < {old_t2})")
    if t3 < old_t3:
        errors.append(f"T3 ({t3} < {old_t3})")
    if cold < old_cold:
        errors.append(f"Холодная ({cold} < {old_cold})")
    if hot < old_hot:
        errors.append(f"Горячая ({hot} < {old_hot})")
    if errors:
        bot.send_message(
            message.chat.id,
            "Ошибка: новые показания меньше предыдущих:\n" + "\n".join(errors),
        )
        return

    u_t1, u_t2, u_t3 = t1 - old_t1, t2 - old_t2, t3 - old_t3
    u_cold, u_hot = cold - old_cold, hot - old_hot
    cost_elec = u_t1 * tariffs["elec_t1"] + u_t2 * tariffs["elec_t2"] + u_t3 * tariffs["elec_t3"]
    cost_water = u_cold * tariffs["water_cold"] + u_hot * tariffs["water_hot"]
    total = cost_elec + cost_water
    date_str = datetime.now().strftime("%d.%m.%Y")
    save_history(date_str, u_t1, u_t2, u_t3, u_cold, u_hot, cost_elec, cost_water, total)
    save_current_readings(t1, t2, t3, cold, hot)
    bot.send_message(
        message.chat.id,
        format_receipt(date_str, u_t1, u_t2, u_t3, u_cold, u_hot, cost_elec, cost_water, total),
        reply_markup=webapp_keyboard(),
    )


@bot.callback_query_handler(func=lambda call: True)
def callback_handler(call):
    user_id = call.from_user.id
    if call.data == "request_access":
        username = call.from_user.username or "без_ника"
        full_name = f"{call.from_user.first_name or ''} {call.from_user.last_name or ''}".strip() or "Пользователь"
        bot.answer_callback_query(call.id, "Запрос отправлен")
        bot.edit_message_text(
            "Запрос отправлен администратору.",
            call.message.chat.id,
            call.message.message_id,
        )
        admin_markup = types.InlineKeyboardMarkup()
        admin_markup.row(
            types.InlineKeyboardButton("Принять", callback_data=f"access_approve_{user_id}"),
            types.InlineKeyboardButton("Отклонить", callback_data=f"access_deny_{user_id}"),
        )
        for admin_id in ADMIN_IDS:
            try:
                bot.send_message(
                    admin_id,
                    f"Запрос доступа\nИмя: {full_name}\nЮзернейм: @{username}\nID: {user_id}",
                    reply_markup=admin_markup,
                )
            except Exception as exc:
                logger.error("admin notify %s: %s", admin_id, exc)
        return

    if call.data.startswith("access_approve_"):
        if user_id not in ADMIN_IDS:
            bot.answer_callback_query(call.id, "Нет прав", show_alert=True)
            return
        target_uid = int(call.data.split("_")[2])
        add_allowed_user(target_uid, username="approved", full_name="Арендатор")
        bot.answer_callback_query(call.id, "Доступ выдан")
        bot.edit_message_text(
            f"Доступ для {target_uid} одобрен.",
            call.message.chat.id,
            call.message.message_id,
        )
        try:
            bot.send_message(target_uid, "Доступ одобрен. Введите /start.")
        except Exception:
            pass
        return

    if call.data.startswith("access_deny_"):
        if user_id not in ADMIN_IDS:
            bot.answer_callback_query(call.id, "Нет прав", show_alert=True)
            return
        target_uid = int(call.data.split("_")[2])
        bot.answer_callback_query(call.id, "Отклонено")
        bot.edit_message_text(
            f"Запрос {target_uid} отклонён.",
            call.message.chat.id,
            call.message.message_id,
        )
        try:
            bot.send_message(target_uid, "Запрос на доступ отклонён.")
        except Exception:
            pass
        return

    if call.data.startswith("remove_user_"):
        if user_id not in ADMIN_IDS:
            bot.answer_callback_query(call.id, "Нет прав", show_alert=True)
            return
        target_uid = int(call.data.split("_")[2])
        remove_allowed_user(target_uid)
        bot.answer_callback_query(call.id, "Удалён")
        bot.edit_message_text(
            f"Пользователь {target_uid} удалён.",
            call.message.chat.id,
            call.message.message_id,
        )


if __name__ == "__main__":
    logger.info("Запуск бота Показания, miniapp=%s", MINIAPP_URL or "(не задан)")
    bot.infinity_polling()
