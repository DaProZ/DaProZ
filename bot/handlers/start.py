from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler
from bot.models.database import SessionLocal
from bot.models.user import User
from config import MESSAGES


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = update.effective_user
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == tg_user.id).first()
        if not user:
            user = User(
                telegram_id=tg_user.id,
                username=tg_user.username,
                first_name=tg_user.first_name,
                last_name=tg_user.last_name,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

    keyboard = [
        [
            InlineKeyboardButton("🎰 Ver Sorteos", callback_data="list_raffles"),
            InlineKeyboardButton("🎟️ Mis Tickets", callback_data="my_tickets"),
        ],
        [
            InlineKeyboardButton("💰 Comprar Tickets", callback_data="buy_tickets"),
            InlineKeyboardButton("📺 Ver Publicidad", callback_data="watch_ad"),
        ],
        [
            InlineKeyboardButton("👤 Mi Perfil", callback_data="profile"),
        ],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        MESSAGES["welcome"], parse_mode="Markdown", reply_markup=reply_markup
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(MESSAGES["help"], parse_mode="Markdown")


async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = update.effective_user
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == tg_user.id).first()
        if not user:
            await update.message.reply_text("Primero usa /start para registrarte.")
            return

        text = (
            f"👤 *Tu Perfil*\n\n"
            f"Nombre: {user.display_name}\n"
            f"🎟️ Balance de tickets: *{user.ticket_balance}*\n"
            f"💸 Total gastado: *${user.total_spent:.2f}*\n"
            f"📅 Miembro desde: {user.created_at.strftime('%d/%m/%Y')}"
        )
        await update.message.reply_text(text, parse_mode="Markdown")
    finally:
        db.close()


def register_start_handlers(app):
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("ayuda", help_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("perfil", profile))
