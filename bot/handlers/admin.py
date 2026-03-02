import random
from datetime import datetime
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler, ConversationHandler, MessageHandler, filters
from bot.models.database import SessionLocal
from bot.models.raffle import Raffle, RaffleStatus
from bot.models.ticket import Ticket
from bot.models.user import User
from config import ADMIN_IDS

# Conversation states
(
    RAFFLE_TITLE,
    RAFFLE_DESCRIPTION,
    RAFFLE_PRIZE,
    RAFFLE_PRICE,
    RAFFLE_MAX_TICKETS,
    RAFFLE_END_DATE,
) = range(6)


def admin_only(func):
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.effective_user.id not in ADMIN_IDS:
            await update.message.reply_text("⛔ No tienes permiso para usar este comando.")
            return ConversationHandler.END
        return await func(update, context)
    return wrapper


@admin_only
async def admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "🛠️ *Panel de Administracion*\n\n"
        "/nuevo_sorteo - Crear nuevo sorteo\n"
        "/listar_sorteos - Ver todos los sorteos\n"
        "/realizar_sorteo <id> - Realizar el sorteo\n"
        "/cancelar_sorteo <id> - Cancelar un sorteo\n"
        "/estadisticas - Ver estadisticas generales\n"
        "/dar_tickets <user_id> <cantidad> - Dar tickets a un usuario"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


@admin_only
async def new_raffle_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🎰 *Crear nuevo sorteo*\n\nPaso 1/6: Escribe el *titulo* del sorteo:",
        parse_mode="Markdown",
    )
    return RAFFLE_TITLE


async def raffle_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["raffle_title"] = update.message.text
    await update.message.reply_text("Paso 2/6: Escribe la *descripcion* del sorteo (o /saltar):")
    return RAFFLE_DESCRIPTION


async def raffle_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text != "/saltar":
        context.user_data["raffle_description"] = update.message.text
    await update.message.reply_text("Paso 3/6: Escribe el *premio* del sorteo:")
    return RAFFLE_PRIZE


async def raffle_prize(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["raffle_prize"] = update.message.text
    await update.message.reply_text("Paso 4/6: Precio por ticket en USD (ej: 1.50):")
    return RAFFLE_PRICE


async def raffle_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        price = float(update.message.text)
        context.user_data["raffle_price"] = price
    except ValueError:
        await update.message.reply_text("Precio invalido. Usa formato: 1.50")
        return RAFFLE_PRICE
    await update.message.reply_text("Paso 5/6: Maximo de tickets (o /saltar para ilimitado):")
    return RAFFLE_MAX_TICKETS


async def raffle_max_tickets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text != "/saltar":
        try:
            context.user_data["raffle_max_tickets"] = int(update.message.text)
        except ValueError:
            await update.message.reply_text("Numero invalido. Intenta de nuevo o usa /saltar:")
            return RAFFLE_MAX_TICKETS
    await update.message.reply_text(
        "Paso 6/6: Fecha de cierre en formato DD/MM/YYYY HH:MM (o /saltar para sin fecha):"
    )
    return RAFFLE_END_DATE


async def raffle_end_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ends_at = None
    if update.message.text != "/saltar":
        try:
            ends_at = datetime.strptime(update.message.text, "%d/%m/%Y %H:%M")
        except ValueError:
            await update.message.reply_text("Formato invalido. Usa DD/MM/YYYY HH:MM o /saltar:")
            return RAFFLE_END_DATE

    db = SessionLocal()
    try:
        raffle = Raffle(
            title=context.user_data["raffle_title"],
            description=context.user_data.get("raffle_description"),
            prize=context.user_data["raffle_prize"],
            ticket_price=context.user_data["raffle_price"],
            max_tickets=context.user_data.get("raffle_max_tickets"),
            ends_at=ends_at,
            created_by=update.effective_user.id,
        )
        db.add(raffle)
        db.commit()
        db.refresh(raffle)

        await update.message.reply_text(
            f"✅ *Sorteo creado exitosamente!*\n\n"
            f"ID: {raffle.id}\n"
            f"Titulo: {raffle.title}\n"
            f"Premio: {raffle.prize}\n"
            f"Precio/ticket: ${raffle.ticket_price:.2f}",
            parse_mode="Markdown",
        )
    finally:
        db.close()

    context.user_data.clear()
    return ConversationHandler.END


async def cancel_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("Operacion cancelada.")
    return ConversationHandler.END


@admin_only
async def draw_raffle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Uso: /realizar_sorteo <id>")
        return

    raffle_id = int(args[0])
    db = SessionLocal()
    try:
        raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
        if not raffle:
            await update.message.reply_text("Sorteo no encontrado.")
            return
        if raffle.status != RaffleStatus.ACTIVE:
            await update.message.reply_text("Este sorteo no esta activo.")
            return

        tickets = db.query(Ticket).filter(Ticket.raffle_id == raffle_id).all()
        if not tickets:
            await update.message.reply_text("No hay tickets vendidos en este sorteo.")
            return

        winner_ticket = random.choice(tickets)
        winner_user = db.query(User).filter(User.telegram_id == winner_ticket.user_telegram_id).first()

        raffle.status = RaffleStatus.FINISHED
        raffle.winner_telegram_id = winner_ticket.user_telegram_id
        raffle.winner_ticket_number = winner_ticket.ticket_number
        raffle.drawn_at = datetime.utcnow()
        db.commit()

        winner_name = winner_user.display_name if winner_user else f"ID:{winner_ticket.user_telegram_id}"
        await update.message.reply_text(
            f"🎉 *Sorteo Realizado!*\n\n"
            f"Sorteo: *{raffle.title}*\n"
            f"Premio: *{raffle.prize}*\n\n"
            f"🏆 Ganador: {winner_name}\n"
            f"🎟️ Ticket ganador: #{winner_ticket.ticket_number}\n"
            f"Total participantes: {raffle.tickets_sold}",
            parse_mode="Markdown",
        )

        # Notify winner
        try:
            await context.bot.send_message(
                chat_id=winner_ticket.user_telegram_id,
                text=(
                    f"🎉 *¡FELICITACIONES!*\n\n"
                    f"Has ganado el sorteo *{raffle.title}*!\n"
                    f"Premio: *{raffle.prize}*\n"
                    f"Ticket ganador: #{winner_ticket.ticket_number}\n\n"
                    f"El administrador se pondra en contacto contigo pronto."
                ),
                parse_mode="Markdown",
            )
        except Exception:
            pass  # User may have blocked the bot
    finally:
        db.close()


@admin_only
async def statistics(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = SessionLocal()
    try:
        total_users = db.query(User).count()
        total_raffles = db.query(Raffle).count()
        active_raffles = db.query(Raffle).filter(Raffle.status == RaffleStatus.ACTIVE).count()
        total_tickets = db.query(Ticket).count()

        await update.message.reply_text(
            f"📊 *Estadisticas Generales*\n\n"
            f"👥 Usuarios registrados: {total_users}\n"
            f"🎰 Sorteos totales: {total_raffles}\n"
            f"🟢 Sorteos activos: {active_raffles}\n"
            f"🎟️ Tickets emitidos: {total_tickets}",
            parse_mode="Markdown",
        )
    finally:
        db.close()


@admin_only
async def give_tickets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Uso: /dar_tickets <telegram_id> <cantidad>")
        return

    target_id = int(args[0])
    quantity = int(args[1])

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == target_id).first()
        if not user:
            await update.message.reply_text("Usuario no encontrado.")
            return

        user.ticket_balance += quantity
        db.commit()

        await update.message.reply_text(
            f"✅ Se dieron {quantity} tickets a {user.display_name}.\n"
            f"Balance actual: {user.ticket_balance}"
        )
    finally:
        db.close()


def register_admin_handlers(app):
    new_raffle_handler = ConversationHandler(
        entry_points=[CommandHandler("nuevo_sorteo", new_raffle_start)],
        states={
            RAFFLE_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, raffle_title)],
            RAFFLE_DESCRIPTION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, raffle_description),
                CommandHandler("saltar", raffle_description),
            ],
            RAFFLE_PRIZE: [MessageHandler(filters.TEXT & ~filters.COMMAND, raffle_prize)],
            RAFFLE_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, raffle_price)],
            RAFFLE_MAX_TICKETS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, raffle_max_tickets),
                CommandHandler("saltar", raffle_max_tickets),
            ],
            RAFFLE_END_DATE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, raffle_end_date),
                CommandHandler("saltar", raffle_end_date),
            ],
        },
        fallbacks=[CommandHandler("cancelar", cancel_conversation)],
    )

    app.add_handler(CommandHandler("admin", admin_menu))
    app.add_handler(new_raffle_handler)
    app.add_handler(CommandHandler("realizar_sorteo", draw_raffle))
    app.add_handler(CommandHandler("cancelar_sorteo", draw_raffle))
    app.add_handler(CommandHandler("estadisticas", statistics))
    app.add_handler(CommandHandler("dar_tickets", give_tickets))
