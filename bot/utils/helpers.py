from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu_keyboard():
    keyboard = [
        [
            InlineKeyboardButton("🎰 Ver Sorteos", callback_data="list_raffles"),
            InlineKeyboardButton("🎟️ Mis Tickets", callback_data="my_tickets"),
        ],
        [
            InlineKeyboardButton("💰 Comprar Tickets", callback_data="buy_tickets"),
            InlineKeyboardButton("📺 Ver Publicidad", callback_data="watch_ad"),
        ],
        [
            InlineKeyboardButton("👤 Mi Perfil", callback_data="profile"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)
