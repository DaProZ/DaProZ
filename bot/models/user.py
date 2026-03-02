from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Float
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(64), nullable=True)
    first_name = Column(String(128), nullable=False)
    last_name = Column(String(128), nullable=True)
    ticket_balance = Column(Integer, default=0, nullable=False)
    total_spent = Column(Float, default=0.0, nullable=False)
    last_ad_watched = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<User telegram_id={self.telegram_id} username={self.username}>"

    @property
    def display_name(self):
        if self.username:
            return f"@{self.username}"
        full = self.first_name
        if self.last_name:
            full += f" {self.last_name}"
        return full
