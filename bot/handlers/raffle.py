from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler
from bot.models.database import SessionLocal
from bot.models.raffle import Raffle, RaffleStatus
from bot.models.ticket import Ticket


async def list_raffles(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = SessionLocal()
    try:
        raffles = (
            db.query(Raffle)
            .filter(Raffle.status == RaffleStatus.ACTIVE)
            .order_by(Raffle.created_at.desc())
            .all()
        )

        if not raffles:
            text = "😔 No hay sorteos activos en este momento.\nVuelve pronto!"
            if update.message:
                await update.message.reply_text(text)
            else:
                await update.callback_query.edit_message_text(text)
            return

        text = "🎰 *Sorteos Activos*\n\n"
        keyboard = []
        for raffle in raffles:
            ends_info = ""
            if raffle.ends_at:
                remaining = raffle.ends_at - datetime.utcnow()
                hours = int(remaining.total_seconds() // 3600)
                ends_info = f" | ⏰ {hours}h restantes"

            text += (
                f"🏆 *{raffle.title}*\n"
                f"Premio: {raffle.prize}\n"
                f"Ticket: ${raffle.ticket_price:.2f}\n"
                f"{raffle.progress_bar}{ends_info}\n\n"
            )
            keyboard.append([
                InlineKeyboardButton(
                    f"🎟️ Participar en: {raffle.title[:30]}",
                    callback_data=f"raffle_{raffle.id}"
                )
            ])

        keyboard.append([InlineKeyboardButton("🔙 Menu Principal", callback_data="main_menu")])
        reply_markup = InlineKeyboardMarkup(keyboard)

        if update.message:
            await update.message.reply_text(text, parse_mode="Markdown", reply_markup=reply_markup)
        else:
            await update.callback_query.edit_message_text(
                text, parse_mode="Markdown", reply_markup=reply_markup
            )
    finally:
        db.close()


async def raffle_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    raffle_id = int(query.data.split("_")[1])
    db = SessionLocal()
    try:
        raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
        if not raffle:
            await query.edit_message_text("Sorteo no encontrado.")
            return

        user_tickets = (
            db.query(Ticket)
            .filter(
                Ticket.raffle_id == raffle_id,
                Ticket.user_telegram_id == query.from_user.id,
            )
            .count()
        )

        ends_info = "Sin fecha limite"
        if raffle.ends_at:
            ends_info = raffle.ends_at.strftime("%d/%m/%Y %H:%M")

        text = (
            f"🏆 *{raffle.title}*\n\n"
            f"📝 {raffle.description or 'Sin descripcion adicional.'}\n\n"
            f"🎁 Premio: *{raffle.prize}*\n"
            f"🎟️ Precio por ticket: *${raffle.ticket_price:.2f}*\n"
            f"📊 {raffle.progress_bar}\n"
            f"⏰ Cierre: {ends_info}\n\n"
            f"Tus tickets en este sorteo: *{user_tickets}*"
        )

        keyboard = [
            [
                InlineKeyboardButton("🎟️ Comprar 1 ticket", callback_data=f"buy_1_{raffle_id}"),
                InlineKeyboardButton("🎟️x5 Comprar 5", callback_data=f"buy_5_{raffle_id}"),
            ],
            [InlineKeyboardButton("📺 Ganar ticket viendo anuncio", callback_data=f"ad_for_{raffle_id}")],
            [InlineKeyboardButton("🔙 Ver todos los sorteos", callback_data="list_raffles")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=reply_markup)
    finally:
        db.close()


async def my_tickets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = update.effective_user
    db = SessionLocal()
    try:
        tickets = (
            db.query(Ticket, Raffle)
            .join(Raffle, Ticket.raffle_id == Raffle.id)
            .filter(Ticket.user_telegram_id == tg_user.id)
            .order_by(Ticket.created_at.desc())
            .limit(20)
            .all()
        )

        if not tickets:
            text = "No tienes tickets aun.\n\nUsa /sorteos para participar o /ver_publicidad para ganar tickets gratis!"
        else:
            text = "🎟️ *Tus Tickets*\n\n"
            current_raffle = None
            for ticket, raffle in tickets:
                if current_raffle != raffle.id:
                    current_raffle = raffle.id
                    status_icon = "🟢" if raffle.is_active else "🔴"
                    text += f"{status_icon} *{raffle.title}*\n"
                text += f"  • Ticket #{ticket.ticket_number} ({ticket.source.value})\n"
            text += "\n_Mostrando los ultimos 20 tickets_"

        if update.message:
            await update.message.reply_text(text, parse_mode="Markdown")
        else:
            await update.callback_query.edit_message_text(text, parse_mode="Markdown")
    finally:
        db.close()


def register_raffle_handlers(app):
    app.add_handler(CommandHandler("sorteos", list_raffles))
    app.add_handler(CommandHandler("mis_tickets", my_tickets))
    app.add_handler(CommandHandler("historial", my_tickets))
    app.add_handler(CallbackQueryHandler(list_raffles, pattern="^list_raffles$"))
    app.add_handler(CallbackQueryHandler(raffle_detail, pattern=r"^raffle_\d+$"))
    app.add_handler(CallbackQueryHandler(my_tickets, pattern="^my_tickets$"))
