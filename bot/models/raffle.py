import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Text, BigInteger
from .database import Base


class RaffleStatus(str, enum.Enum):
    ACTIVE = "active"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class Raffle(Base):
    __tablename__ = "raffles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    prize = Column(String(256), nullable=False)
    prize_image_url = Column(String(512), nullable=True)
    ticket_price = Column(Float, nullable=False, default=1.0)
    max_tickets = Column(Integer, nullable=True)  # None = unlimited
    tickets_sold = Column(Integer, default=0, nullable=False)
    status = Column(Enum(RaffleStatus), default=RaffleStatus.ACTIVE, nullable=False)
    winner_telegram_id = Column(BigInteger, nullable=True)
    winner_ticket_number = Column(Integer, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    drawn_at = Column(DateTime, nullable=True)
    created_by = Column(BigInteger, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Raffle id={self.id} title={self.title} status={self.status}>"

    @property
    def is_active(self):
        if self.status != RaffleStatus.ACTIVE:
            return False
        if self.ends_at and datetime.utcnow() > self.ends_at:
            return False
        if self.max_tickets and self.tickets_sold >= self.max_tickets:
            return False
        return True

    @property
    def progress_bar(self):
        if not self.max_tickets:
            return f"{self.tickets_sold} tickets vendidos"
        filled = int((self.tickets_sold / self.max_tickets) * 10)
        bar = "█" * filled + "░" * (10 - filled)
        pct = int((self.tickets_sold / self.max_tickets) * 100)
        return f"[{bar}] {pct}% ({self.tickets_sold}/{self.max_tickets})"
