import os
from dotenv import load_dotenv

load_dotenv()

# Bot Configuration
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_IDS = list(map(int, os.getenv("ADMIN_IDS", "").split(","))) if os.getenv("ADMIN_IDS") else []

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///raffle_bot.db")

# Payments (Telegram Payments API)
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")
CURRENCY = os.getenv("CURRENCY", "USD")

# Ticket pricing
TICKET_PRICE_USD = float(os.getenv("TICKET_PRICE_USD", "1.00"))  # $1.00 per ticket
TICKETS_PER_AD = int(os.getenv("TICKETS_PER_AD", "1"))           # 1 ticket per ad watched
AD_COOLDOWN_SECONDS = int(os.getenv("AD_COOLDOWN_SECONDS", "3600"))  # 1 hour cooldown between ads

# Ad Configuration
ADS = [
    {
        "id": "ad_001",
        "title": "Oferta Especial",
        "description": "Descubre las mejores ofertas del dia",
        "url": os.getenv("AD_URL_1", "https://example.com/ad1"),
        "image_url": os.getenv("AD_IMAGE_URL_1", ""),
        "duration_seconds": int(os.getenv("AD_DURATION_SECONDS", "10")),
    },
]

# Messages
MESSAGES = {
    "welcome": (
        "👋 *Bienvenido al Bot de Sorteos!*\n\n"
        "Aqui podras participar en emocionantes sorteos.\n\n"
        "🎟️ *Como conseguir tickets:*\n"
        "  • Comprar tickets directamente\n"
        "  • Ver publicidad para obtener tickets gratis\n\n"
        "Usa /ayuda para ver todos los comandos disponibles."
    ),
    "help": (
        "📋 *Comandos disponibles:*\n\n"
        "🎰 *Sorteos*\n"
        "  /sorteos - Ver sorteos activos\n"
        "  /mis_tickets - Ver mis tickets\n\n"
        "🎟️ *Tickets*\n"
        "  /comprar - Comprar tickets\n"
        "  /ver_publicidad - Ver un anuncio para ganar ticket gratis\n\n"
        "👤 *Perfil*\n"
        "  /perfil - Ver mi perfil\n"
        "  /historial - Ver historial de participaciones\n\n"
        "ℹ️ /ayuda - Mostrar este mensaje"
    ),
}
