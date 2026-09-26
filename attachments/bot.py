import os
import re
import csv
import json
import logging
import base64
import sqlite3
import threading
from io import BytesIO
from datetime import datetime

import telebot
from telebot import types
from PIL import Image, ImageOps
from google import genai
from google.genai import types as genai_types
from apscheduler.schedulers.background import BackgroundScheduler
import pytz
import requests

from collections import Counter
from concurrent.futures import ThreadPoolExecutor

# --- ЛОГИРОВАНИЕ ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("rent_bot")

# --- СЕКРЕТЫ И НАСТРОЙКИ ---
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")  # Опционально для резервного распознавания через Groq
HF_TOKEN = os.getenv("HF_TOKEN")          # Опционально для Hugging Face

if not TOKEN or not GEMINI_API_KEY:
    logger.critical("Не заданы TELEGRAM_BOT_TOKEN или GEMINI_API_KEY в переменных окружения!")
    raise ValueError("Отсутствуют необходимые переменные окружения TELEGRAM_BOT_TOKEN или GEMINI_API_KEY.")

# ID администраторов (владельцев)
ADMIN_IDS = {528656263}

FLAT_ID = 1
DB_PATH = "/opt/rent_bot/rent_data.db"

# Исправленные актуальные имена моделей Gemini
GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash"]

SERIAL_HOT_WATER = "1011051599503"
SERIAL_COLD_WATER = "1011052063508"

bot = telebot.TeleBot(TOKEN)
ai_client = genai.Client(api_key=GEMINI_API_KEY)

user_temp_input = {}
user_pending_ai = {}

# --- БАЗА ДАННЫХ (WAL Mode) ---
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS current_readings (
            user_id INTEGER PRIMARY KEY,
            t1 REAL, t2 REAL, t3 REAL,
            cold REAL, hot REAL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT,
            use_t1 REAL, use_t2 REAL, use_t3 REAL,
            use_cold REAL, use_hot REAL,
            cost_elec REAL, cost_water REAL, total_sum REAL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subscribers (
            chat_id INTEGER PRIMARY KEY
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tariffs (
            key TEXT PRIMARY KEY,
            value REAL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS allowed_users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            full_name TEXT,
            added_at TEXT
        )
    ''')

    # Стартовые тарифы по умолчанию
    default_tariffs = {
        'elec_t1': 7.10,
        'elec_t2': 2.82,
        'elec_t3': 5.80,
        'water_cold': 45.20,
        'water_hot': 150.00
    }
    for k, v in default_tariffs.items():
        cursor.execute("INSERT OR IGNORE INTO tariffs (key, value) VALUES (?, ?)", (k, v))

    # Добавление администратора в список разрешенных пользователей
    for admin_id in ADMIN_IDS:
        cursor.execute('''
            INSERT OR IGNORE INTO allowed_users (user_id, username, full_name, added_at)
            VALUES (?, ?, ?, ?)
        ''', (admin_id, "admin", "Владелец", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))

    conn.commit()
    conn.close()

# --- ФУНКЦИИ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ---
def is_allowed(user_id):
    if user_id in ADMIN_IDS:
        return True
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM allowed_users WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def add_allowed_user(user_id, username="", full_name=""):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO allowed_users (user_id, username, full_name, added_at)
        VALUES (?, ?, ?, ?)
    ''', (user_id, username, full_name, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    conn.close()

def remove_allowed_user(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM allowed_users WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

def get_allowed_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, username, full_name, added_at FROM allowed_users")
    rows = cursor.fetchall()
    conn.close()
    return rows

def get_tariffs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM tariffs")
    rows = cursor.fetchall()
    conn.close()
    return dict(rows)

def update_tariff(key, value):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO tariffs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
    conn.commit()
    conn.close()

def register_subscriber(chat_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO subscribers (chat_id) VALUES (?)", (chat_id,))
    conn.commit()
    conn.close()

def get_subscribers():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT chat_id FROM subscribers")
    rows = cursor.fetchall()
    conn.close()
    return [r[0] for r in rows]

def get_last_readings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT t1, t2, t3, cold, hot FROM current_readings WHERE user_id = ?", (FLAT_ID,))
    row = cursor.fetchone()
    conn.close()
    return row

def save_current_readings(t1, t2, t3, cold, hot):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO current_readings (user_id, t1, t2, t3, cold, hot)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
        t1=excluded.t1, t2=excluded.t2, t3=excluded.t3,
        cold=excluded.cold, hot=excluded.hot
    ''', (FLAT_ID, t1, t2, t3, cold, hot))
    conn.commit()
    conn.close()

def save_history(date, u_t1, u_t2, u_t3, u_cold, u_hot, c_elec, c_water, total):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO history (user_id, date, use_t1, use_t2, use_t3, use_cold, use_hot, cost_elec, cost_water, total_sum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (FLAT_ID, date, u_t1, u_t2, u_t3, u_cold, u_hot, c_elec, c_water, total))
    conn.commit()
    conn.close()

init_db()

# --- ДЕКОРАТОРЫ БЕЗОПАСНОСТИ ---
def check_access(func):
    def wrapper(message, *args, **kwargs):
        user_id = message.from_user.id
        if not is_allowed(user_id):
            logger.warning(f"Несанкционированный доступ от ID: {user_id}")
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("📩 Запросить доступ", callback_data="request_access"))
            bot.send_message(
                message.chat.id,
                "⛔ **У вас нет доступа к этому боту.**\nНажмите кнопку ниже, чтобы отправить запрос владельцу квартиры.",
                parse_mode="Markdown",
                reply_markup=markup
            )
            return
        return func(message, *args, **kwargs)
    return wrapper

def check_admin(func):
    def wrapper(message, *args, **kwargs):
        user_id = message.from_user.id
        if user_id not in ADMIN_IDS:
            bot.send_message(message.chat.id, "⛔ Эта команда доступна только администратору (владельцу).")
            return
        return func(message, *args, **kwargs)
    return wrapper

# --- СЖАТИЕ ИЗОБРАЖЕНИЙ ---
def prepare_image(image_bytes, max_side=1024):
    img = Image.open(BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)
    img.thumbnail((max_side, max_side))
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()

# --- РЕЗЕРВНЫЙ ДВИЖОК: GROQ VISION API ---
def recognize_with_groq(image_bytes, prompt):
    if not GROQ_API_KEY:
        return None
    try:
        opt_bytes = prepare_image(image_bytes, 1024)
        b64_img = base64.b64encode(opt_bytes).decode('utf-8')
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.2-11b-vision-preview",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                    ]
                }
            ],
            "temperature": 0.1,
            "max_tokens": 150
        }
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=15)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Ошибка Groq Vision: {e}")
    return None

# --- Hugging Face
import requests

HF_API_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-7B-Instruct"
HF_HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}  # Переменная HF_TOKEN должна быть задана

def recognize_with_hf(image_bytes, prompt):
    try:
        import base64
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        payload = {
            "inputs": {
                "image": base64_image,
                "prompt": prompt
            }
        }
        response = requests.post(HF_API_URL, headers=HF_HEADERS, json=payload, timeout=12)
        if response.status_code == 200:
            res = response.json()
            if isinstance(res, list) and len(res) > 0:
                return res[0].get('generated_text', '')
            elif isinstance(res, dict):
                return res.get('generated_text', str(res))
    except Exception as e:
        logger.error(f"Ошибка HuggingFace: {e}")
    return None

# --- ГОЛОСОВАНИЕ
def vote_majority(results_list):
    """
    Принимает список результатов вида [(hot, cold), (hot, cold), ...]
    Округляет значения до 2 знаков для исключения мелких разностей и выбирает самый частый ответ.
    """
    valid_results = []
    for res in results_list:
        if res and res[0] is not None and res[1] is not None:
            # Округляем до 2 знаков после запятой для точного сравнения (25.081 -> 25.08)
            rounded = (round(float(res[0]), 2), round(float(res[1]), 2))
            valid_results.append(rounded)

    if not valid_results:
        return None, None

    # Считаем количество голосов за каждый вариант
    counts = Counter(valid_results)
    most_common, top_count = counts.most_common(1)[0]
    
    logger.info(f"Результаты голосования нейросетей: {dict(counts)} -> Победитель: {most_common} (голосов: {top_count})")
    return most_common

# --- AI РАСПОЗНАВАНИЕ (GEMINI + GROQ FALLBACK) ---
def _worker_gemini(image_bytes, prompt):
    opt_bytes = prepare_image(image_bytes, 1024)
    img = Image.open(BytesIO(opt_bytes))
    config = genai_types.GenerateContentConfig(
        temperature=0,
        max_output_tokens=1000,
        response_mime_type="application/json"
    )
    for model in GEMINI_MODELS:
        try:
            response = ai_client.models.generate_content(
                model=model,
                contents=[img, prompt],
                config=config
            )
            if response and response.text:
                text = response.text.strip()
                logger.info(f"[Worker Gemini ({model})]: {text}")
                hot_m = re.search(r'"hot"\s*:\s*(\d+(?:[\.,]\d+)?)', text)
                cold_m = re.search(r'"cold"\s*:\s*(\d+(?:[\.,]\d+)?)', text)
                if hot_m and cold_m:
                    return float(hot_m.group(1).replace(',', '.')), float(cold_m.group(1).replace(',', '.'))
                nums = re.findall(r"\d+(?:[\.,]\d+)?", text)
                if len(nums) >= 2:
                    return float(nums[0].replace(',', '.')), float(nums[1].replace(',', '.'))
        except Exception as e:
            logger.error(f"[Worker Gemini ({model})] Ошибка: {e}")
    return None

def _worker_groq(image_bytes, prompt):
    try:
        text = recognize_with_groq(image_bytes, prompt)
        if text:
            logger.info(f"[Worker Groq]: {text}")
            hot_m = re.search(r'"hot"\s*:\s*(\d+(?:[\.,]\d+)?)', text)
            cold_m = re.search(r'"cold"\s*:\s*(\d+(?:[\.,]\d+)?)', text)
            if hot_m and cold_m:
                return float(hot_m.group(1).replace(',', '.')), float(cold_m.group(1).replace(',', '.'))
            nums = re.findall(r"\d+(?:[\.,]\d+)?", text)
            if len(nums) >= 2:
                return float(nums[0].replace(',', '.')), float(nums[1].replace(',', '.'))
    except Exception as e:
        logger.error(f"[Worker Groq] Ошибка: {e}")
    return None

def _worker_hf(image_bytes, prompt):
    try:
        text = recognize_with_hf(image_bytes, prompt)
        if text:
            logger.info(f"[Worker HF]: {text}")
            hot_m = re.search(r'"hot"\s*:\s*(\d+(?:[\.,]\d+)?)', text)
            cold_m = re.search(r'"cold"\s*:\s*(\d+(?:[\.,]\d+)?)', text)
            if hot_m and cold_m:
                return float(hot_m.group(1).replace(',', '.')), float(cold_m.group(1).replace(',', '.'))
            nums = re.findall(r"\d+(?:[\.,]\d+)?", text)
            if len(nums) >= 2:
                return float(nums[0].replace(',', '.')), float(nums[1].replace(',', '.'))
    except Exception as e:
        logger.error(f"[Worker HF] Ошибка: {e}")
    return None


def recognize_dual_water_photo(image_bytes):
    prompt = f"""
    На фото два счетчика воды.
    1. Счетчик с заводским номером {SERIAL_HOT_WATER} (или красный/слева) — счетчик ГОРЯЧЕЙ воды (hot).
    2. Счетчик с заводским номером {SERIAL_COLD_WATER} (или синий/справа) — счетчик ХОЛОДНОЙ воды (cold).
    Считай показания. Черные цифры - целая часть, красные - дробная.
    Верни ТОЛЬКО JSON вида: {{"hot": 12.34, "cold": 56.78}}
    """

    # Запускаем все 3 нейросети одновременно
    with ThreadPoolExecutor(max_workers=3) as executor:
        f_gemini = executor.submit(_worker_gemini, image_bytes, prompt)
        f_groq = executor.submit(_worker_groq, image_bytes, prompt)
        f_hf = executor.submit(_worker_hf, image_bytes, prompt)

        res_gemini = f_gemini.result()
        res_groq = f_groq.result()
        res_hf = f_hf.result()

    logger.info(f"Ответы сетей — Gemini: {res_gemini}, Groq: {res_groq}, HF: {res_hf}")

    # Выбираем ответ большинства
    return vote_majority([res_gemini, res_groq, res_hf])
def recognize_single_meter_photo(image_bytes):
    opt_bytes = prepare_image(image_bytes, 1024)
    img = Image.open(BytesIO(opt_bytes))

    prompt = "Считай числовые показания с циферблата счетчика. Верни только число."
    config = genai_types.GenerateContentConfig(
        temperature=0,
        max_output_tokens=500
    )

    for model in GEMINI_MODELS:
        try:
            response = ai_client.models.generate_content(
                model=model,
                contents=[img, prompt],
                config=config
            )
            if response and response.text:
                raw_text = response.text.strip()
                logger.info(f"Ответ Gemini ({model}): {raw_text}")
                m = re.search(r"\d+(?:[\.,]\d+)?", raw_text)
                if m:
                    return float(m.group(0).replace(',', '.'))
        except Exception as e:
            logger.error(f"Ошибка single_meter Gemini ({model}): {e}")

    groq_res = recognize_with_groq(image_bytes, prompt)
    if groq_res:
        m = re.search(r"\d+(?:[\.,]\d+)?", groq_res)
        if m:
            return float(m.group(0).replace(',', '.'))

    return None
# --- APSCHEDULER НАПОМИНАНИЯ ---
def send_monthly_reminders():
    subs = get_subscribers()
    logger.info(f"Запуск ежемесячного напоминания для {len(subs)} подписчиков.")
    for chat_id in subs:
        try:
            bot.send_message(chat_id, "🔔 Сегодня 25 число! Пожалуйста, передайте показания счетчиков за текущий месяц.")
        except Exception as e:
            logger.error(f"Ошибка отправки напоминания в чат {chat_id}: {e}")

scheduler = BackgroundScheduler(timezone=pytz.timezone('Europe/Moscow'))
scheduler.add_job(send_monthly_reminders, 'cron', day=25, hour=10, minute=0)
scheduler.start()

# --- КЛАВИАТУРЫ ---
def get_main_keyboard():
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    markup.add(
        types.KeyboardButton("📝 Ввести показания"),
        types.KeyboardButton("📊 Показать введенные")
    )
    return markup

def get_input_inline_keyboard(user_id):
    temp = user_temp_input.get(user_id, {})

    btn_hot = f"🔴 Горячая вода: {temp['hot']}" if 'hot' in temp else "🔴 Горячая вода"
    btn_cold = f"🔵 Холодная вода: {temp['cold']}" if 'cold' in temp else "🔵 Холодная вода"
    btn_t1 = f"💡 Т1: {temp['t1']}" if 't1' in temp else "💡 Т1"
    btn_t2 = f"💡 Т2: {temp['t2']}" if 't2' in temp else "💡 Т2"
    btn_t3 = f"💡 Т3: {temp['t3']}" if 't3' in temp else "💡 Т3"

    markup = types.InlineKeyboardMarkup(row_width=1)
    markup.add(types.InlineKeyboardButton("📸 Одно фото для всей воды (ГВС + ХВС)", callback_data="set_water_dual_photo"))
    markup.row(
        types.InlineKeyboardButton(btn_hot, callback_data="set_hot"),
        types.InlineKeyboardButton(btn_cold, callback_data="set_cold")
    )
    markup.row(
        types.InlineKeyboardButton(btn_t1, callback_data="set_t1"),
        types.InlineKeyboardButton(btn_t2, callback_data="set_t2"),
        types.InlineKeyboardButton(btn_t3, callback_data="set_t3")
    )
    markup.add(types.InlineKeyboardButton("🧮 Рассчитать итог", callback_data="calculate_total"))
    return markup

# --- ОБРАБОТЧИКИ КОМАНД ---
@bot.message_handler(commands=['start'])
@check_access
def start_cmd(message):
    register_subscriber(message.chat.id)
    bot.send_message(
        message.chat.id,
        "Привет! Бот управления коммунальными платежами готов к работе.",
        reply_markup=get_main_keyboard()
    )

@bot.message_handler(commands=['help'])
@check_access
def help_cmd(message):
    text = (
        "📖 **Справка по командам:**\n\n"
        "📝 **Ввести показания** — построчный ввод чисел или отправка фото счетчиков\n"
        "📊 **Показать введенные** — посмотреть результаты последнего расчета\n"
        "ℹ️ `/status` — текущие стартовые показания и тарифы\n"
        "❌ `/cancel` — сбросить текущий черновик ввода\n"
        "📁 `/export_csv` — скачать всю историю расчетов в CSV\n\n"
        "⚙️ **Админ-команды (Владелец):**\n"
        "• `/tenants` — управление списком арендаторов\n"
        "• `/add_tenant ` — добавить арендатора по Telegram ID\n"
        "• `/del_tenant ` — удалить арендатора\n"
        "• `/set_initial` — установить начальные показания\n"
        "• `/set_tariff  ` — обновить тариф"
    )
    bot.send_message(message.chat.id, text, parse_mode="Markdown")

@bot.message_handler(commands=['tenants'])
@check_admin
def list_tenants_cmd(message):
    users = get_allowed_users()
    if not users:
        bot.send_message(message.chat.id, "Список арендаторов пуст.")
        return

    text = "👥 **Список разрешенных пользователей:**\n\n"
    markup = types.InlineKeyboardMarkup()
    for uid, username, full_name, added_at in users:
        role = " (Админ)" if uid in ADMIN_IDS else ""
        text += f"• **{full_name}** (@{username}) | ID: `{uid}`{role}\n"
        if uid not in ADMIN_IDS:
            markup.add(types.InlineKeyboardButton(f"❌ Удалить {full_name} ({uid})", callback_data=f"remove_user_{uid}"))

    bot.send_message(message.chat.id, text, parse_mode="Markdown", reply_markup=markup)

@bot.message_handler(commands=['add_tenant'])
@check_admin
def add_tenant_cmd(message):
    try:
        parts = message.text.split()
        if len(parts) < 2:
            raise ValueError()
        target_id = int(parts[1])
        add_allowed_user(target_id, "manual", "Арендатор")
        bot.send_message(message.chat.id, f"✅ Пользователь `{target_id}` успешно добавлен!", parse_mode="Markdown")
    except Exception:
        bot.send_message(message.chat.id, "⚠️ Использование: `/add_tenant `", parse_mode="Markdown")

@bot.message_handler(commands=['del_tenant'])
@check_admin
def del_tenant_cmd(message):
    try:
        parts = message.text.split()
        if len(parts) < 2:
            raise ValueError()
        target_id = int(parts[1])
        if target_id in ADMIN_IDS:
            bot.send_message(message.chat.id, "⛔ Нельзя удалить администратора.")
            return
        remove_allowed_user(target_id)
        bot.send_message(message.chat.id, f"✅ Пользователь `{target_id}` удален.", parse_mode="Markdown")
    except Exception:
        bot.send_message(message.chat.id, "⚠️ Использование: `/del_tenant `", parse_mode="Markdown")

@bot.message_handler(commands=['cancel'])
@check_access
def cancel_cmd(message):
    user_temp_input.pop(message.chat.id, None)
    user_pending_ai.pop(message.chat.id, None)
    bot.send_message(message.chat.id, "❌ Ввод показаний отменен. Черновик очищен.", reply_markup=get_main_keyboard())

@bot.message_handler(commands=['status'])
@check_access
def status_cmd(message):
    curr = get_last_readings()
    tariffs = get_tariffs()

    text = "ℹ️ **Текущий статус системы:**\n\n"
    if curr:
        text += (
            "📌 **Сохраненные стартовые показания:**\n"
            f"• T1: `{curr[0]}` | T2: `{curr[1]}` | T3: `{curr[2]}`\n"
            f"• Холодная: `{curr[3]}` м³ | Горячая: `{curr[4]}` м³\n\n"
        )
    else:
        text += "⚠️ Стартовые показания еще не заданы!\n\n"

    text += "💰 **Актуальные тарифы:**\n"
    for k, v in tariffs.items():
        text += f"• `{k}`: {v} руб.\n"

    bot.send_message(message.chat.id, text, parse_mode="Markdown")

@bot.message_handler(commands=['set_initial'])
@check_admin
def set_initial_cmd(message):
    msg = bot.send_message(
        message.chat.id,
        "⚙️ **Админ-панель**\nВведите 5 начальных показаний через пробел:\n`Т1 Т2 Т3 Холодная Горячая`",
        parse_mode="Markdown"
    )
    bot.register_next_step_handler(msg, process_initial_save)

def process_initial_save(message):
    try:
        t1, t2, t3, cold, hot = map(float, message.text.replace(',', '.').split())
        save_current_readings(t1, t2, t3, cold, hot)
        bot.send_message(message.chat.id, "✅ Стартовые показания сохранены!", reply_markup=get_main_keyboard())
    except ValueError:
        bot.send_message(message.chat.id, "⚠️ Ошибка. Введите 5 чисел через пробел. Попробуйте /set_initial заново.")

@bot.message_handler(commands=['set_tariff'])
@check_admin
def set_tariff_cmd(message):
    try:
        parts = message.text.split()
        if len(parts) != 3:
            raise ValueError()
        key, val = parts[1], float(parts[2].replace(',', '.'))
        update_tariff(key, val)
        bot.send_message(message.chat.id, f"✅ Тариф `{key}` обновлен на **{val}** руб.", parse_mode="Markdown")
    except Exception:
        bot.send_message(
            message.chat.id,
            "⚠️ Использование: `/set_tariff  `\nПример: `/set_tariff water_hot 155.5`",
            parse_mode="Markdown"
        )

@bot.message_handler(commands=['export_csv'])
@check_access
def export_csv_cmd(message):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, date, use_t1, use_t2, use_t3, use_cold, use_hot, cost_elec, cost_water, total_sum FROM history ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        bot.send_message(message.chat.id, "📁 История расчетов пока пуста.")
        return

    csv_buf = BytesIO()
    csv_buf.write(b'\xef\xbb\xbf')
    writer = csv.writer(csv_buf, delimiter=';')
    writer.writerow(['ID', 'Дата', 'Расход T1', 'Расход T2', 'Расход T3', 'Расход ХВС', 'Расход ГВС', 'Сумма Свет', 'Сумма Вода', 'Итого'])

    for r in rows:
        writer.writerow(r)

    csv_buf.seek(0)
    bot.send_document(
        message.chat.id,
        visible_file_name="rent_history_export.csv",
        document=csv_buf,
        caption="📊 Экспорт истории коммунальных расчетов"
    )

@bot.message_handler(func=lambda msg: msg.text == "📝 Ввести показания")
@check_access
def start_input_process(message):
    register_subscriber(message.chat.id)
    old_data = get_last_readings()
    if not old_data:
        bot.send_message(message.chat.id, "❌ Начальные показания еще не заданы владельцем (/set_initial).")
        return

    user_temp_input[message.chat.id] = {}
    bot.send_message(
        message.chat.id,
        "Выберите параметр или отправьте фото:",
        reply_markup=get_input_inline_keyboard(message.chat.id)
    )

# --- CALLBACK ОБРАБОТЧИК ---
@bot.callback_query_handler(func=lambda call: True)
def callback_handler(call):
    user_id = call.from_user.id

    # 1. Запрос доступа неавторизованным пользователем
    if call.data == "request_access":
        user_info = call.from_user
        username = user_info.username or "без_ника"
        full_name = f"{user_info.first_name or ''} {user_info.last_name or ''}".strip() or "Пользователь"

        bot.answer_callback_query(call.id, "Запрос отправлен владельцу!")
        bot.edit_message_text("⏳ Ваш запрос отправлен администратору. Ожидайте подтверждения.", call.message.chat.id, call.message.message_id)

        admin_markup = types.InlineKeyboardMarkup()
        admin_markup.row(
            types.InlineKeyboardButton("✅ Принять", callback_data=f"access_approve_{user_id}"),
            types.InlineKeyboardButton("❌ Отклонить", callback_data=f"access_deny_{user_id}")
        )
        for admin_id in ADMIN_IDS:
            try:
                bot.send_message(
                    admin_id,
                    f"🔔 **Запрос доступа к боту!**\n\nИмя: **{full_name}**\nЮзернейм: @{username}\nID: `{user_id}`",
                    parse_mode="Markdown",
                    reply_markup=admin_markup
                )
            except Exception as e:
                logger.error(f"Ошибка отправки администратору {admin_id}: {e}")
        return

    # 2. Обработка подтверждения доступа Администратором
    if call.data.startswith("access_approve_"):
        if user_id not in ADMIN_IDS:
            bot.answer_callback_query(call.id, "⛔ Вы не админ", show_alert=True)
            return
        target_uid = int(call.data.split("_")[2])
        add_allowed_user(target_uid, username="approved", full_name="Арендатор")
        bot.answer_callback_query(call.id, "Доступ предоставлен!")
        bot.edit_message_text(f"✅ Доступ для пользователя `{target_uid}` успешно одобрен.", call.message.chat.id, call.message.message_id, parse_mode="Markdown")
        try:
            bot.send_message(target_uid, "🎉 Ваш запрос одобрен! Теперь вы можете пользоваться ботом.\nВведите /start для начала.")
        except Exception as e:
            logger.error(f"Не удалось оповестить пользователя {target_uid}: {e}")
        return

    if call.data.startswith("access_deny_"):
        if user_id not in ADMIN_IDS:
            bot.answer_callback_query(call.id, "⛔ Вы не админ", show_alert=True)
            return
        target_uid = int(call.data.split("_")[2])
        bot.answer_callback_query(call.id, "Запрос отклонен.")
        bot.edit_message_text(f"❌ Запрос пользователя `{target_uid}` отклонен.", call.message.chat.id, call.message.message_id, parse_mode="Markdown")
        try:
            bot.send_message(target_uid, "❌ Ваш запрос на доступ к боту был отклонен администратором.")
        except Exception as e:
            logger.error(f"Не удалось оповестить пользователя {target_uid}: {e}")
        return

    # 3. Удаление арендатора
    if call.data.startswith("remove_user_"):
        if user_id not in ADMIN_IDS:
            bot.answer_callback_query(call.id, "⛔ Вы не админ", show_alert=True)
            return
        target_uid = int(call.data.split("_")[2])
        remove_allowed_user(target_uid)
        bot.answer_callback_query(call.id, "Пользователь удален!")
        bot.edit_message_text(f"🗑 Пользователь `{target_uid}` удален из списка доступа.", call.message.chat.id, call.message.message_id, parse_mode="Markdown")
        return

    # 4. Проверка прав доступа для остальных функций
    if not is_allowed(user_id):
        bot.answer_callback_query(call.id, "⛔ Нет доступа", show_alert=True)
        return

    if call.data == "set_water_dual_photo":
        msg = bot.send_message(user_id, "📷 Отправьте **одно фото**, где видны сразу оба счетчика воды:")
        bot.register_next_step_handler(msg, process_dual_water_input, call.message.message_id)
        bot.answer_callback_query(call.id)

    elif call.data.startswith("set_"):
        meter_type = call.data.split("_")[1]
        names = {
            'hot': '🔴 Горячую воду',
            'cold': '🔵 Холодную воду',
            't1': '💡 Электричество Т1',
            't2': '💡 Электричество Т2',
            't3': '💡 Электричество Т3'
        }
        msg = bot.send_message(
            user_id,
            f"Отправьте **ФОТО** счетчика на **{names[meter_type]}** или введите значение числом:",
            parse_mode="Markdown"
        )
        bot.register_next_step_handler(msg, process_single_meter_input, meter_type, call.message.message_id)
        bot.answer_callback_query(call.id)

    elif call.data == "confirm_ai_dual_water":
        pending = user_pending_ai.get(user_id, {})
        hot_val = pending.get('hot')
        cold_val = pending.get('cold')
        inline_msg_id = pending.get('inline_msg_id')

        if hot_val is not None and cold_val is not None:
            user_temp_input.setdefault(user_id, {})['hot'] = hot_val
            user_temp_input[user_id]['cold'] = cold_val
            bot.send_message(user_id, f"✅ Сохранено:\n🔴 Горячая: **{hot_val}**\n🔵 Холодная: **{cold_val}**", parse_mode="Markdown")
            bot.edit_message_reply_markup(
                chat_id=user_id,
                message_id=inline_msg_id,
                reply_markup=get_input_inline_keyboard(user_id)
            )
        bot.answer_callback_query(call.id)

    elif call.data.startswith("confirm_ai_"):
        meter_type = call.data.split("_")[2]
        pending = user_pending_ai.get(user_id, {})
        val = pending.get('val')
        inline_msg_id = pending.get('inline_msg_id')

        if val is not None:
            user_temp_input.setdefault(user_id, {})[meter_type] = val
            bot.send_message(user_id, f"✅ Сохранено значение: **{val}**", parse_mode="Markdown")
            bot.edit_message_reply_markup(
                chat_id=user_id,
                message_id=inline_msg_id,
                reply_markup=get_input_inline_keyboard(user_id)
            )
        bot.answer_callback_query(call.id)

    elif call.data == "calculate_total":
        temp = user_temp_input.get(user_id, {})
        required = ['hot', 'cold', 't1', 't2', 't3']

        missing = [r for r in required if r not in temp]
        if missing:
            bot.answer_callback_query(call.id, "⚠️ Заполните ВСЕ счетчики перед расчетом!", show_alert=True)
            return

        old_t1, old_t2, old_t3, old_cold, old_hot = get_last_readings()

        errors = []
        if temp['t1'] < old_t1: errors.append(f"• T1 ({temp['t1']} < прошлых {old_t1})")
        if temp['t2'] < old_t2: errors.append(f"• T2 ({temp['t2']} < прошлых {old_t2})")
        if temp['t3'] < old_t3: errors.append(f"• T3 ({temp['t3']} < прошлых {old_t3})")
        if temp['cold'] < old_cold: errors.append(f"• Холодная ({temp['cold']} < прошлых {old_cold})")
        if temp['hot'] < old_hot: errors.append(f"• Горячая ({temp['hot']} < прошлых {old_hot})")

        if errors:
            bot.send_message(
                user_id,
                "⚠️ **Ошибка расчета! Новые показания меньше предыдущих:**\n" + "\n".join(errors) + "\n\nПроверьте значения или сбросьте ввод через /cancel.",
                parse_mode="Markdown"
            )
            bot.answer_callback_query(call.id)
            return

        u_t1 = temp['t1'] - old_t1
        u_t2 = temp['t2'] - old_t2
        u_t3 = temp['t3'] - old_t3
        u_cold = temp['cold'] - old_cold
        u_hot = temp['hot'] - old_hot

        tariffs = get_tariffs()
        cost_elec = (u_t1 * tariffs['elec_t1']) + (u_t2 * tariffs['elec_t2']) + (u_t3 * tariffs['elec_t3'])
        cost_water = (u_cold * tariffs['water_cold']) + (u_hot * tariffs['water_hot'])
        total_utility = cost_elec + cost_water

        date_str = datetime.now().strftime("%d.%m.%Y")

        receipt = (
            f"🧾 **Расчет за коммунальные услуги ({date_str}):**\n\n"
            "⚡ **Электричество:**\n"
            f"• Т1: {u_t1:.1f} кВт⋅ч\n"
            f"• Т2: {u_t2:.1f} кВт⋅ч\n"
            f"• Т3: {u_t3:.1f} кВт⋅ч\n"
            f"Сумма за свет: {cost_elec:.2f} руб.\n\n"
            "💧 **Вода:**\n"
            f"• 🔴 Горячая: {u_hot:.1f} м³\n"
            f"• 🔵 Холодная: {u_cold:.1f} м³\n"
            f"Сумма за воду: {cost_water:.2f} руб.\n"
            "──────────────\n"
            f"💰 **ИТОГО К ОПЛАТЕ:** {total_utility:.2f} руб."
        )

        save_history(date_str, u_t1, u_t2, u_t3, u_cold, u_hot, cost_elec, cost_water, total_utility)
        save_current_readings(temp['t1'], temp['t2'], temp['t3'], temp['cold'], temp['hot'])

        user_temp_input.pop(user_id, None)
        user_pending_ai.pop(user_id, None)

        bot.send_message(user_id, receipt, parse_mode="Markdown", reply_markup=get_main_keyboard())
        bot.answer_callback_query(call.id)

# --- АСИНХРОННАЯ ОБРАБОТКА ФОТО ---
def process_dual_water_input(message, inline_msg_id):
    user_id = message.chat.id
    if message.content_type == 'photo':
        wait_msg = bot.send_message(user_id, "🤖 Нейросеть считывает счетчики воды с фото...")

        def run_ai():
            try:
                file_info = bot.get_file(message.photo[-1].file_id)
                downloaded_file = bot.download_file(file_info.file_path)
                hot_val, cold_val = recognize_dual_water_photo(downloaded_file)
                bot.delete_message(user_id, wait_msg.message_id)

                if hot_val is not None and cold_val is not None:
                    user_pending_ai[user_id] = {'hot': hot_val, 'cold': cold_val, 'inline_msg_id': inline_msg_id}
                    confirm_markup = types.InlineKeyboardMarkup()
                    confirm_markup.add(
                        types.InlineKeyboardButton(f"✅ Сохранить оба (ГВС: {hot_val}, ХВС: {cold_val})", callback_data="confirm_ai_dual_water")
                    )
                    bot.send_message(
                        user_id,
                        f"🔍 **Распознано с фото:**\n🔴 Горячая вода: `{hot_val}`\n🔵 Холодная вода: `{cold_val}`\n\nВсе верно?",
                        parse_mode="Markdown",
                        reply_markup=confirm_markup
                    )
                else:
                    bot.send_message(user_id, "❌ Не удалось распознать счетчики. Введите значение текстом.")
            except Exception as e:
                logger.error(f"Ошибка в потоке dual_water: {e}")
                bot.send_message(user_id, "⚠️ Ошибка при обработке фото.")

        threading.Thread(target=run_ai, daemon=True).start()
    else:
        bot.send_message(user_id, "⚠️ Отправьте фотографию счетчиков.")

def process_single_meter_input(message, meter_type, inline_msg_id):
    user_id = message.chat.id

    if message.content_type == 'photo':
        wait_msg = bot.send_message(user_id, "🤖 Нейросеть считывает показания с фото...")

        def run_ai():
            try:
                file_info = bot.get_file(message.photo[-1].file_id)
                downloaded_file = bot.download_file(file_info.file_path)
                val = recognize_single_meter_photo(downloaded_file)
                bot.delete_message(user_id, wait_msg.message_id)

                if val is not None:
                    user_pending_ai[user_id] = {'val': val, 'inline_msg_id': inline_msg_id}
                    confirm_markup = types.InlineKeyboardMarkup()
                    confirm_markup.add(
                        types.InlineKeyboardButton(f"✅ Да, сохранить {val}", callback_data=f"confirm_ai_{meter_type}")
                    )
                    bot.send_message(
                        user_id,
                        f"🔍 **Распознано с фото:** `{val}`\nВсе верно?",
                        parse_mode="Markdown",
                        reply_markup=confirm_markup
                    )
                else:
                    bot.send_message(user_id, "❌ Не удалось распознать цифры. Введите значение вручную.")
            except Exception as e:
                logger.error(f"Ошибка в потоке single_meter: {e}")
                bot.send_message(user_id, "⚠️ Ошибка при обработке фото.")

        threading.Thread(target=run_ai, daemon=True).start()

    elif message.text:
        try:
            val = float(message.text.replace(',', '.'))
            user_temp_input.setdefault(user_id, {})[meter_type] = val
            bot.edit_message_reply_markup(
                chat_id=user_id,
                message_id=inline_msg_id,
                reply_markup=get_input_inline_keyboard(user_id)
            )
            bot.delete_message(user_id, message.message_id)
        except ValueError:
            bot.send_message(user_id, "⚠️ Введите число (например, 120.5)")

@bot.message_handler(func=lambda msg: msg.text == "📊 Показать введенные")
@check_access
def show_history(message):
    register_subscriber(message.chat.id)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT date, use_t1, use_t2, use_t3, use_cold, use_hot, cost_elec, cost_water, total_sum
        FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 1
    ''', (FLAT_ID,))
    last_hist = cursor.fetchone()
    conn.close()

    if not last_hist:
        bot.send_message(message.chat.id, "📊 История расчетов пока пуста.")
        return

    date, u_t1, u_t2, u_t3, u_cold, u_hot, c_elec, c_water, total = last_hist

    text = (
        f"📊 **Последний расчет ({date}):**\n\n"
        "**Потребленные ресурсы:**\n"
        f"💡 Электричество Т1: {u_t1:.1f} кВт⋅ч\n"
        f"💡 Электричество Т2: {u_t2:.1f} кВт⋅ч\n"
        f"💡 Электричество Т3: {u_t3:.1f} кВт⋅ч\n"
        f"🔴 Горячая вода: {u_hot:.1f} м³\n"
        f"🔵 Холодная вода: {u_cold:.1f} м³\n\n"
        "**Стоимость:**\n"
        f"• Электричество: {c_elec:.2f} руб.\n"
        f"• Вода: {c_water:.2f} руб.\n"
        f"──────────────\n"
        f"💰 **Итого к оплате:** {total:.2f} руб."
    )
    bot.send_message(message.chat.id, text, parse_mode="Markdown")

if __name__ == '__main__':
    logger.info("Запуск обновленного Telegram-бота rent_bot...")
    bot.infinity_polling()
