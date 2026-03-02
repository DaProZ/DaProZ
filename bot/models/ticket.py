import enum
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Float, Enum, ForeignKey
from .database import Base


class TicketSource(str, enum.Enum):
    PURCHASE = "purchase"
    AD = "ad"
    BONUS = "bonus"
    ADMIN = "admin"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_telegram_id = Column(BigInteger, nullable=False, index=True)
    raffle_id = Column(Integer, ForeignKey("raffles.id"), nullable=False, index=True)
    ticket_number = Column(Integer, nullable=False)
    source = Column(Enum(TicketSource), nullable=False, default=TicketSource.PURCHASE)
    amount_paid = Column(Float, default=0.0, nullable=False)
    payment_id = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Ticket #{self.ticket_number} raffle={self.raffle_id} user={self.user_telegram_id}>"
