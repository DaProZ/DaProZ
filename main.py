import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler, ContextTypes

from config import BOT_TOKEN
from bot.models.database import init_db
from bot.handlers import (
    register_start_handlers,
    register_raffle_handlers,
    register_ticket_handlers,
    register_ad_handlers,
    register_admin_handlers,
    register_payment_handlers,
)
from bot.utils.helpers import main_menu_keyboard

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def main_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        "🏠 *Menu Principal*\n\nElige una opcion:",
        parse_mode="Markdown",
        reply_markup=main_menu_keyboard(),
    )


async def profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from bot.models.database import SessionLocal
    from bot.models.user import User

    query = update.callback_query
    await query.answer()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == query.from_user.id).first()
        if not user:
            await query.edit_message_text("Primero usa /start para registrarte.")
            return

        text = (
            f"👤 *Tu Perfil*\n\n"
            f"Nombre: {user.display_name}\n"
            f"🎟️ Balance de tickets: *{user.ticket_balance}*\n"
            f"💸 Total gastado: *${user.total_spent:.2f}*\n"
            f"📅 Miembro desde: {user.created_at.strftime('%d/%m/%Y')}"
        )
        keyboard = [[InlineKeyboardButton("🔙 Menu Principal", callback_data="main_menu")]]
        await query.edit_message_text(
            text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard)
        )
    finally:
        db.close()


def main():
    if not BOT_TOKEN:
        raise ValueError("BOT_TOKEN no configurado. Revisa tu archivo .env")

    # Initialize database
    init_db()
    logger.info("Base de datos inicializada.")

    # Build application
    app = Application.builder().token(BOT_TOKEN).build()

    # Register all handlers
    register_start_handlers(app)
    register_raffle_handlers(app)
    register_ticket_handlers(app)
    register_ad_handlers(app)
    register_admin_handlers(app)
    register_payment_handlers(app)

    # Global callback handlers
    app.add_handler(CallbackQueryHandler(main_menu_callback, pattern="^main_menu$"))
    app.add_handler(CallbackQueryHandler(profile_callback, pattern="^profile$"))

    logger.info("Bot iniciado. Esperando mensajes...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
