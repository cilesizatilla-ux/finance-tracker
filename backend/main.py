import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

load_dotenv()

from backend.database import Base, SessionLocal, engine
from backend.dependencies import get_current_user
from backend.models import AdminAuditLog  # noqa: F401
from backend.models import AdminUser  # noqa: F401
from backend.models import Category  # noqa: F401 – ensures model is registered
from backend.models import Party  # noqa: F401
from backend.models import SharedReport  # noqa: F401
from backend.models import Transaction  # noqa: F401
from backend.models import User  # noqa: F401
from backend.models import UserProfile  # noqa: F401
from backend.models import Notification, UserNotificationRead  # noqa
from backend.models import AuditEntry, AuditAssignment, AuditExpense  # noqa
from backend.models import SavingsGoal, GoalContribution  # noqa
from backend.routers import analyze, categories, chat, reports, transactions
from backend.routers import auth as auth_router
from backend.routers import extract, parties, shared
from backend.routers import admin as admin_router
from backend.routers.audit import audit_router, admin_audit_router
from backend.routers.goals import router as goals_router

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Finance Tracker API")

# CORS
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
cors_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Database initialisation + seeding
# ---------------------------------------------------------------------------

_DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Groceries", "color": "#22c55e"},
    {"name": "Rent/Mortgage", "color": "#ef4444"},
    {"name": "Utilities", "color": "#f97316"},
    {"name": "Transportation", "color": "#3b82f6"},
    {"name": "Entertainment", "color": "#a855f7"},
    {"name": "Food & Dining", "color": "#f59e0b"},
    {"name": "Subscriptions", "color": "#06b6d4"},
    {"name": "Other", "color": "#6b7280"},
]

_DEFAULT_INCOME_CATEGORIES = [
    {"name": "Salary", "color": "#22c55e"},
    {"name": "Freelance", "color": "#10b981"},
    {"name": "Business", "color": "#3b82f6"},
    {"name": "Investment", "color": "#8b5cf6"},
    {"name": "Bonus", "color": "#f59e0b"},
    {"name": "Other Income", "color": "#06b6d4"},
]


@app.on_event("startup")
def on_startup():
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Schema migrations
    with engine.connect() as conn:
        cat_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(categories)"))]
        if "is_income" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN is_income BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        if "user_id" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id)"))
            conn.commit()

        txn_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(transactions)"))]
        if "user_id" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)"))
            # Assign all existing transactions to user 1 (first registered user)
            conn.execute(text("UPDATE transactions SET user_id = 1 WHERE user_id IS NULL"))
            conn.commit()
        if "party_id" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN party_id INTEGER REFERENCES parties(id)"))
            conn.commit()
        if "invoice_number" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN invoice_number VARCHAR"))
            conn.commit()
        if "tax_amount_cents" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN tax_amount_cents INTEGER"))
            conn.commit()
        if "notes" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN notes TEXT"))
            conn.commit()
        if "payment_method" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN payment_method VARCHAR"))
            conn.commit()
        if "is_reconciled" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN is_reconciled BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        if "receipt_path" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN receipt_path VARCHAR"))
            conn.commit()
        if "is_recurring" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()

        # Migrations for users table
        user_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(users)"))]
        if "last_active_at" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_active_at DATETIME"))
            conn.commit()

    db = SessionLocal()
    try:
        # Seed expense categories if none exist
        if db.query(Category).filter(Category.is_income.is_(False)).count() == 0:
            for cat_data in _DEFAULT_EXPENSE_CATEGORIES:
                if not db.query(Category).filter(Category.name == cat_data["name"]).first():
                    db.add(Category(name=cat_data["name"], color=cat_data["color"], budget_cents=0, is_income=False))
            db.commit()

        # Seed income categories if none exist
        if db.query(Category).filter(Category.is_income.is_(True)).count() == 0:
            for cat_data in _DEFAULT_INCOME_CATEGORIES:
                if not db.query(Category).filter(Category.name == cat_data["name"]).first():
                    db.add(Category(name=cat_data["name"], color=cat_data["color"], budget_cents=0, is_income=True))
            db.commit()

        # Seed super admin
        from passlib.context import CryptContext
        _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        admin_pass = os.getenv("ADMIN_PASSWORD", "Admin@Finance2024!")
        if not db.query(AdminUser).filter(AdminUser.username == "admin").first():
            db.add(AdminUser(
                username="admin",
                email="admin@financetracker.local",
                password_hash=_pwd_ctx.hash(admin_pass),
                role="super_admin",
                is_active=True,
            ))
            db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

_auth_dep = [Depends(get_current_user)]

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1", dependencies=_auth_dep)
app.include_router(transactions.router, prefix="/api/v1", dependencies=_auth_dep)
app.include_router(reports.router, prefix="/api/v1", dependencies=_auth_dep)
app.include_router(chat.router, prefix="/api/v1", dependencies=_auth_dep)
app.include_router(analyze.router, prefix="/api/v1", dependencies=_auth_dep)
app.include_router(parties.router, prefix="/api/v1", dependencies=_auth_dep)
app.include_router(extract.router, prefix="/api/v1", dependencies=_auth_dep)
# shared router has its own mixed auth (POST is protected, GET is public)
app.include_router(shared.router, prefix="/api/v1")
app.include_router(admin_router.router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(admin_audit_router, prefix="/api/v1")
app.include_router(goals_router, prefix="/api/v1")

# ---------------------------------------------------------------------------
# Static file serving for uploaded receipts
# ---------------------------------------------------------------------------

_uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


# ---------------------------------------------------------------------------
# Health / status — must be before the SPA catch-all
# ---------------------------------------------------------------------------

@app.get("/api/v1/status")
def get_status():
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    ai_configured = bool(api_key and api_key != "sk-ant-your-key-here" and not api_key.startswith("sk-ant-your"))
    return {"status": "ok", "ai_configured": ai_configured}


# ---------------------------------------------------------------------------
# React SPA — served in production (when frontend/dist exists)
# ---------------------------------------------------------------------------

_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(_frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_frontend_dist, "assets")), name="spa-assets")

    @app.get("/")
    def spa_root():
        return FileResponse(os.path.join(_frontend_dist, "index.html"))

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        return FileResponse(os.path.join(_frontend_dist, "index.html"))

else:
    @app.get("/")
    def health_check():
        return {"status": "ok"}
