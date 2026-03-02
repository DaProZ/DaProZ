from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler
from bot.models.database import SessionLocal
from bot.models.user import User
from bot.models.raffle import Raffle, RaffleStatus
from bot.models.ticket import Ticket, TicketSource
from config import ADS, AD_COOLDOWN_SECONDS, TICKETS_PER_AD


async def watch_ad(update: Update, context: ContextTypes.DEFAULT_TYPE, raffle_id: int = None):
    tg_user = update.effective_user
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == tg_user.id).first()
        if not user:
            text = "Primero usa /start para registrarte."
            if update.message:
                await update.message.reply_text(text)
            else:
                await update.callback_query.edit_message_text(text)
            return

        # Check cooldown
        if user.last_ad_watched:
            elapsed = (datetime.utcnow() - user.last_ad_watched).total_seconds()
            if elapsed < AD_COOLDOWN_SECONDS:
                remaining = int(AD_COOLDOWN_SECONDS - elapsed)
                hours = remaining // 3600
                minutes = (remaining % 3600) // 60
                cooldown_text = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
                text = (
                    f"⏳ *Debes esperar antes de ver otro anuncio.*\n\n"
                    f"Tiempo restante: *{cooldown_text}*\n\n"
                    f"Vuelve mas tarde para ganar mas tickets gratis!"
                )
                if update.message:
                    await update.message.reply_text(text, parse_mode="Markdown")
                else:
                    await update.callback_query.edit_message_text(text, parse_mode="Markdown")
                return

        if not ADS:
            text = "No hay anuncios disponibles ahora. Intentalo mas tarde."
            if update.message:
                await update.message.reply_text(text)
            else:
                await update.callback_query.edit_message_text(text)
            return

        ad = ADS[0]
        payload = f"confirm_ad_{ad['id']}"
        if raffle_id:
            payload += f"_{raffle_id}"

        text = (
            f"📺 *Ver Publicidad y Ganar Tickets!*\n\n"
            f"🎁 Recibirás: *{TICKETS_PER_AD} ticket(s) gratis*\n\n"
            f"━━━━━━━━━━━━━━\n"
            f"📣 *{ad['title']}*\n"
            f"{ad['description']}\n\n"
            f"🔗 [Ver el anuncio aqui]({ad['url']})\n"
            f"━━━━━━━━━━━━━━\n\n"
            f"Despues de ver el anuncio, haz clic en el boton para recibir tus tickets."
        )
        keyboard = [
            [InlineKeyboardButton("✅ Ya vi el anuncio, dame mis tickets!", callback_data=payload)],
            [InlineKeyboardButton("🔙 Cancelar", callback_data="main_menu")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        if update.message:
            await update.message.reply_text(text, parse_mode="Markdown", reply_markup=reply_markup)
        else:
            await update.callback_query.edit_message_text(
                text, parse_mode="Markdown", reply_markup=reply_markup
            )
    finally:
        db.close()


async def watch_ad_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await watch_ad(update, context)


async def watch_ad_for_raffle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    raffle_id = int(query.data.split("_")[2])
    await watch_ad(update, context, raffle_id=raffle_id)


async def watch_ad_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await watch_ad(update, context)


async def confirm_ad_watched(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    parts = query.data.split("_")
    raffle_id = int(parts[3]) if len(parts) > 3 else None

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == query.from_user.id).first()
        if not user:
            await query.edit_message_text("Error: usuario no encontrado.")
            return

        # Re-check cooldown (prevent double claims)
        if user.last_ad_watched:
            elapsed = (datetime.utcnow() - user.last_ad_watched).total_seconds()
            if elapsed < AD_COOLDOWN_SECONDS:
                await query.edit_message_text(
                    "Ya reclamaste este anuncio. Espera antes de ver otro."
                )
                return

        user.last_ad_watched = datetime.utcnow()

        raffle_text = ""
        if raffle_id:
            raffle = db.query(Raffle).filter(Raffle.id == raffle_id, Raffle.status == RaffleStatus.ACTIVE).first()
            if raffle and raffle.is_active:
                raffle.tickets_sold += TICKETS_PER_AD
                for i in range(TICKETS_PER_AD):
                    ticket = Ticket(
                        user_telegram_id=query.from_user.id,
                        raffle_id=raffle_id,
                        ticket_number=raffle.tickets_sold - TICKETS_PER_AD + i + 1,
                        source=TicketSource.AD,
                        amount_paid=0.0,
                    )
                    db.add(ticket)
                raffle_text = f" para el sorteo *{raffle.title}*"
            else:
                # Sorteo cerrado, agregar al balance general
                user.ticket_balance += TICKETS_PER_AD
                raffle_text = " (agregados a tu balance general)"
        else:
            user.ticket_balance += TICKETS_PER_AD
            raffle_text = " a tu balance"

        db.commit()

        next_ad_time = (datetime.utcnow() + timedelta(seconds=AD_COOLDOWN_SECONDS)).strftime("%H:%M")
        await query.edit_message_text(
            f"🎉 *Gracias por ver el anuncio!*\n\n"
            f"Has ganado *{TICKETS_PER_AD} ticket(s)*{raffle_text}!\n\n"
            f"⏰ Proxima publicidad disponible a las: {next_ad_time}",
            parse_mode="Markdown",
        )
    finally:
        db.close()


def register_ad_handlers(app):
    app.add_handler(CommandHandler("ver_publicidad", watch_ad_command))
    app.add_handler(CallbackQueryHandler(watch_ad_callback, pattern="^watch_ad$"))
    app.add_handler(CallbackQueryHandler(watch_ad_for_raffle_callback, pattern=r"^ad_for_\d+$"))
    app.add_handler(CallbackQueryHandler(confirm_ad_watched, pattern=r"^confirm_ad_[\w]+(_\d+)?$"))
