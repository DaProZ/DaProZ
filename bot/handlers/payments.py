from telegram import Update
from telegram.ext import ContextTypes, MessageHandler, filters
from bot.models.database import SessionLocal
from bot.models.user import User
from bot.models.raffle import Raffle
from bot.models.ticket import Ticket, TicketSource


async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    payment = update.message.successful_payment
    payload = payment.invoice_payload

    if not payload.startswith("tickets_"):
        return

    parts = payload.split("_")
    if len(parts) < 3:
        return

    quantity = int(parts[1])
    raffle_id = int(parts[2])
    amount_paid = payment.total_amount / 100.0

    db = SessionLocal()
    try:
        raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
        user = db.query(User).filter(User.telegram_id == update.effective_user.id).first()

        if not raffle:
            await update.message.reply_text("Error: sorteo no encontrado. Contacta soporte.")
            return

        ticket_numbers = []
        for _ in range(quantity):
            raffle.tickets_sold += 1
            ticket = Ticket(
                user_telegram_id=update.effective_user.id,
                raffle_id=raffle_id,
                ticket_number=raffle.tickets_sold,
                source=TicketSource.PURCHASE,
                amount_paid=amount_paid / quantity,
                payment_id=payment.telegram_payment_charge_id,
            )
            db.add(ticket)
            ticket_numbers.append(raffle.tickets_sold)

        if user:
            user.total_spent += amount_paid

        db.commit()

        numbers = ", ".join(f"#{n}" for n in ticket_numbers)
        await update.message.reply_text(
            f"✅ *Pago exitoso!*\n\n"
            f"Has comprado {quantity} ticket(s) para *{raffle.title}*\n"
            f"Tus numeros: {numbers}\n\n"
            f"¡Mucha suerte! 🍀",
            parse_mode="Markdown",
        )
    finally:
        db.close()


def register_payment_handlers(app):
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))
