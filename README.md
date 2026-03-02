# 🎰 Bot de Telegram para Sorteos

Bot de Telegram para gestionar sorteos con sistema de tickets de pago y tickets gratuitos ganados viendo publicidad.

## Funcionalidades

### Para Usuarios
- 🎰 **Ver sorteos activos** con detalles del premio, precio y progreso
- 🎟️ **Comprar tickets** via Telegram Payments (tarjeta, etc.)
- 📺 **Ver publicidad** para ganar tickets gratis (con cooldown configurable)
- 👤 **Perfil** con balance de tickets e historial de gastos
- 📋 **Historial** de tickets y sorteos participados

### Para Administradores
- ➕ **Crear sorteos** con asistente paso a paso
- 🎲 **Realizar sorteos** con seleccion aleatoria del ganador
- 📊 **Estadisticas** generales del bot
- 🎁 **Dar tickets** manualmente a usuarios

## Estructura del Proyecto

```
telegram-raffle-bot/
├── bot/
│   ├── handlers/
│   │   ├── start.py        # /start, /ayuda, /perfil
│   │   ├── raffle.py       # /sorteos, /mis_tickets
│   │   ├── tickets.py      # /comprar, pagos
│   │   ├── ads.py          # /ver_publicidad
│   │   ├── payments.py     # Webhook de pagos exitosos
│   │   └── admin.py        # Comandos de administracion
│   ├── models/
│   │   ├── database.py     # Configuracion SQLAlchemy
│   │   ├── user.py         # Modelo de usuario
│   │   ├── raffle.py       # Modelo de sorteo
│   │   └── ticket.py       # Modelo de ticket
│   └── utils/
│       └── helpers.py      # Funciones utilitarias
├── config.py               # Configuracion central
├── main.py                 # Punto de entrada
├── requirements.txt
├── .env.example
└── README.md
```

## Instalacion

### 1. Requisitos previos
- Python 3.11+
- Cuenta en [BotFather](https://t.me/BotFather) de Telegram

### 2. Clonar y configurar

```bash
git clone https://github.com/DaProZ/DaProZ.git
cd DaProZ
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o: venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

| Variable | Descripcion |
|---|---|
| `BOT_TOKEN` | Token de tu bot (de @BotFather) |
| `ADMIN_IDS` | Tus IDs de Telegram separados por coma |
| `DATABASE_URL` | URL de base de datos (SQLite por defecto) |
| `PAYMENT_PROVIDER_TOKEN` | Token de pagos de Telegram (opcional) |
| `TICKETS_PER_AD` | Tickets que gana el usuario por ver un anuncio |
| `AD_COOLDOWN_SECONDS` | Segundos de espera entre anuncios |

### 4. Ejecutar

```bash
python main.py
```

## Configuracion de Pagos

Para habilitar pagos reales:

1. Ve a [@BotFather](https://t.me/BotFather) > `/mybots` > tu bot > **Payments**
2. Elige un proveedor (Stripe en modo test, etc.)
3. Copia el token al `.env` en `PAYMENT_PROVIDER_TOKEN`

Si `PAYMENT_PROVIDER_TOKEN` esta vacio, el bot funciona en **modo demo** (tickets gratis para testing).

## Comandos del Bot

### Usuarios
| Comando | Descripcion |
|---|---|
| `/start` | Iniciar el bot y registrarse |
| `/sorteos` | Ver sorteos activos |
| `/comprar` | Comprar tickets |
| `/ver_publicidad` | Ver anuncio para ganar ticket gratis |
| `/mis_tickets` | Ver mis tickets |
| `/perfil` | Ver mi perfil |
| `/historial` | Ver historial de participaciones |
| `/ayuda` | Ver todos los comandos |

### Administradores
| Comando | Descripcion |
|---|---|
| `/admin` | Panel de administracion |
| `/nuevo_sorteo` | Crear un nuevo sorteo |
| `/realizar_sorteo <id>` | Realizar el sorteo y elegir ganador |
| `/estadisticas` | Ver estadisticas generales |
| `/dar_tickets <user_id> <cant>` | Dar tickets a un usuario |

## Tecnologias

- **[python-telegram-bot](https://python-telegram-bot.org/)** v21 - Framework del bot
- **[SQLAlchemy](https://sqlalchemy.org/)** - ORM para base de datos
- **SQLite** (desarrollo) / **PostgreSQL** (produccion recomendado)

## Licencia

MIT
