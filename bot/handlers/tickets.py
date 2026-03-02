from telegram import Update, LabeledPrice, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler, PreCheckoutQueryHandler
from bot.models.database import SessionLocal
from bot.models.user import User
from bot.models.raffle import Raffle, RaffleStatus
from bot.models.ticket import Ticket, TicketSource
from config import PAYMENT_PROVIDER_TOKEN, CURRENCY


def _create_ticket(db, user_telegram_id: int, raffle: Raffle, quantity: int, source: TicketSource, amount_paid: float = 0.0, payment_id: str = None) -> list[Ticket]:
    tickets = []
    for _ in range(quantity):
        raffle.tickets_sold += 1
        ticket = Ticket(
            user_telegram_id=user_telegram_id,
            raffle_id=raffle.id,
            ticket_number=raffle.tickets_sold,
            source=source,
            amount_paid=amount_paid / quantity if quantity else 0,
            payment_id=payment_id,
        )
        db.add(ticket)
        tickets.append(ticket)
    return tickets


async def buy_tickets_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = SessionLocal()
    try:
        raffles = (
            db.query(Raffle)
            .filter(Raffle.status == RaffleStatus.ACTIVE)
            .all()
        )

        if not raffles:
            text = "No hay sorteos activos. Vuelve pronto!"
            if update.message:
                await update.message.reply_text(text)
            else:
                await update.callback_query.edit_message_text(text)
            return

        text = "💰 *Comprar Tickets*\n\nElige el sorteo en el que quieres participar:"
        keyboard = []
        for raffle in raffles:
            keyboard.append([
                InlineKeyboardButton(
                    f"🏆 {raffle.title} - ${raffle.ticket_price:.2f}/ticket",
                    callback_data=f"raffle_{raffle.id}",
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


async def initiate_purchase(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    parts = query.data.split("_")
    quantity = int(parts[1])
    raffle_id = int(parts[2])

    db = SessionLocal()
    try:
        raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
        if not raffle or not raffle.is_active:
            await query.edit_message_text("Este sorteo ya no esta disponible.")
            return

        if not PAYMENT_PROVIDER_TOKEN:
            # Demo mode: give tickets for free if no payment configured
            user = db.query(User).filter(User.user_telegram_id == query.from_user.id).first()
            _create_ticket(db, query.from_user.id, raffle, quantity, TicketSource.BONUS)
            db.commit()
            await query.edit_message_text(
                f"✅ Se han asignado {quantity} ticket(s) al sorteo *{raffle.title}*\n"
                f"_(Modo demo: sin proveedor de pagos configurado)_",
                parse_mode="Markdown",
            )
            return

        total_price = int(raffle.ticket_price * quantity * 100)  # in cents
        prices = [LabeledPrice(f"{quantity} ticket(s) - {raffle.title}", total_price)]

        await context.bot.send_invoice(
            chat_id=query.from_user.id,
            title=f"Tickets: {raffle.title}",
            description=f"Compra de {quantity} ticket(s) para el sorteo '{raffle.title}'. Premio: {raffle.prize}",
            payload=f"tickets_{quantity}_{raffle_id}",
            provider_token=PAYMENT_PROVIDER_TOKEN,
            currency=CURRENCY,
            prices=prices,
            start_parameter=f"buy-{raffle_id}",
        )
    finally:
        db.close()


async def precheckout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.pre_checkout_query
    if query.invoice_payload.startswith("tickets_"):
        await query.answer(ok=True)
    else:
        await query.answer(ok=False, error_message="Pago no reconocido.")


async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    payment = update.message.successful_payment
    payload = payment.invoice_payload

    if not payload.startswith("tickets_"):
        return

    _, quantity_str, raffle_id_str = payload.split("_")
    quantity = int(quantity_str)
    raffle_id = int(raffle_id_str)
    amount_paid = payment.total_amount / 100.0

    db = SessionLocal()
    try:
        raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
        user = db.query(User).filter(User.telegram_id == update.effective_user.id).first()

        if not raffle:
            await update.message.reply_text("Error: sorteo no encontrado. Contacta soporte.")
            return

        tickets = _create_ticket(
            db, update.effective_user.id, raffle, quantity, TicketSource.PURCHASE,
            amount_paid=amount_paid, payment_id=payment.telegram_payment_charge_id
        )
        if user:
            user.total_spent += amount_paid
        db.commit()

        numbers = ", ".join(f"#{t.ticket_number}" for t in tickets)
        await update.message.reply_text(
            f"✅ *Pago exitoso!*\n\n"
            f"Has comprado {quantity} ticket(s) para *{raffle.title}*\n"
            f"Tus numeros: {numbers}\n\n"
            f"¡Mucha suerte! 🍀",
            parse_mode="Markdown",
        )
    finally:
        db.close()


def register_ticket_handlers(app):
    app.add_handler(CommandHandler("comprar", buy_tickets_menu))
    app.add_handler(CallbackQueryHandler(buy_tickets_menu, pattern="^buy_tickets$"))
    app.add_handler(CallbackQueryHandler(initiate_purchase, pattern=r"^buy_\d+_\d+$"))
    app.add_handler(PreCheckoutQueryHandler(precheckout))
