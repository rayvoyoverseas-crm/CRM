from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import secrets as py_secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# --- Config -----------------------------------------------------------------

JWT_ALGORITHM = "HS256"
STUDY_STAGES = ["NL", "CC", "DNP", "SL", "DR", "PR", "RA", "AP", "OL", "RD", "DP", "VS", "EN"]
ACCOM_STAGES = ["IN", "OS", "VS", "BK", "CF"]
LOAN_STAGES = ["AS", "DS", "PR", "AP", "DB"]

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Rayvoy Overseas CRM")
api = APIRouter(prefix="/api")

# --- Utilities --------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def clear_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")

def serialize_user(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "counsellor"),
        "phone": u.get("phone", ""),
        "created_at": u.get("created_at").isoformat() if isinstance(u.get("created_at"), datetime) else u.get("created_at"),
        "active": u.get("active", True),
    }

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or not user.get("active", True):
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user

# --- Models -----------------------------------------------------------------

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = ""
    role: Literal["admin", "counsellor"] = "counsellor"

class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["admin", "counsellor"]] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class LeadCreateIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    country_interest: Optional[str] = ""
    course_interest: Optional[str] = ""
    source: Literal["website", "manual", "referral", "walk-in", "social"] = "manual"
    pipeline: Literal["study_abroad", "accommodation", "loan"] = "study_abroad"
    notes: Optional[str] = ""
    assigned_to: Optional[str] = None

class LeadUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country_interest: Optional[str] = None
    course_interest: Optional[str] = None
    stage: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    source: Optional[str] = None

class NoteIn(BaseModel):
    text: str

class WebhookLeadIn(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    country_interest: Optional[str] = ""
    course_interest: Optional[str] = ""
    message: Optional[str] = ""

class TargetIn(BaseModel):
    period: Literal["monthly", "yearly"]
    year: int
    month: Optional[int] = None
    target_leads: int = 0
    target_deposits: int = 0
    target_enrollments: int = 0

# --- Startup ----------------------------------------------------------------

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index("assigned_to")
    await db.leads.create_index("pipeline")
    await db.leads.create_index("stage")
    await db.leads.create_index("created_at")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@rayvoyoverseas.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@Rayvoy2026")
    existing = await db.users.find_one({"email": admin_email.lower()})
    if not existing:
        await db.users.insert_one({
            "email": admin_email.lower(),
            "password_hash": hash_password(admin_password),
            "name": "Rayvoy Admin",
            "role": "admin",
            "phone": "",
            "active": True,
            "created_at": datetime.now(timezone.utc),
        })
        logging.info(f"Seeded admin: {admin_email}")

# --- Auth Routes ------------------------------------------------------------

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account is disabled")
    access = create_access_token(str(user["_id"]), user["email"], user["role"])
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return {"user": serialize_user(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)

# --- Users (Admin) ----------------------------------------------------------

@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = await db.users.find({}).to_list(500)
    return [serialize_user(u) for u in users]

@api.post("/users")
async def create_user(payload: UserCreateIn, admin: dict = Depends(require_admin)):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(400, "Email already exists")
    doc = {
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "phone": payload.phone or "",
        "role": payload.role,
        "active": True,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_user(doc)

@api.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdateIn, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items() if k != "password"}
    if payload.password:
        update["password_hash"] = hash_password(payload.password)
    if not update:
        raise HTTPException(400, "Nothing to update")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize_user(u)

@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if str(admin["_id"]) == user_id:
        raise HTTPException(400, "Cannot delete yourself")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"ok": True}

# --- Leads ------------------------------------------------------------------

def default_stage(pipeline: str) -> str:
    return {"study_abroad": "NL", "accommodation": "IN", "loan": "AS"}[pipeline]

def serialize_lead(l: dict) -> dict:
    return {
        "id": str(l["_id"]),
        "name": l.get("name", ""),
        "email": l.get("email", ""),
        "phone": l.get("phone", ""),
        "country_interest": l.get("country_interest", ""),
        "course_interest": l.get("course_interest", ""),
        "stage": l.get("stage"),
        "pipeline": l.get("pipeline"),
        "source": l.get("source"),
        "notes": l.get("notes", ""),
        "assigned_to": l.get("assigned_to"),
        "assigned_to_name": l.get("assigned_to_name", ""),
        "created_at": l["created_at"].isoformat() if isinstance(l.get("created_at"), datetime) else l.get("created_at"),
        "updated_at": l["updated_at"].isoformat() if isinstance(l.get("updated_at"), datetime) else l.get("updated_at"),
        "activity": l.get("activity", []),
        "reviewed": l.get("reviewed", True),
    }

async def _lead_visible_filter(user: dict) -> dict:
    if user.get("role") == "admin":
        return {}
    return {"assigned_to": str(user["_id"])}

@api.get("/leads")
async def list_leads(
    pipeline: Optional[str] = None,
    stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    source: Optional[str] = None,
    reviewed: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = await _lead_visible_filter(user)
    if pipeline: q["pipeline"] = pipeline
    if stage: q["stage"] = stage
    if assigned_to: q["assigned_to"] = assigned_to
    if source: q["source"] = source
    if reviewed is not None: q["reviewed"] = reviewed
    leads = await db.leads.find(q).sort("created_at", -1).to_list(2000)
    return [serialize_lead(l) for l in leads]

@api.post("/leads")
async def create_lead(payload: LeadCreateIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    assigned_name = ""
    if payload.assigned_to:
        assignee = await db.users.find_one({"_id": ObjectId(payload.assigned_to)})
        if assignee:
            assigned_name = assignee.get("name", "")
    doc = {
        **payload.model_dump(),
        "stage": default_stage(payload.pipeline),
        "assigned_to_name": assigned_name,
        "created_at": now,
        "updated_at": now,
        "reviewed": True,
        "activity": [{
            "type": "created",
            "text": f"Lead created by {user.get('name', 'user')}",
            "at": now.isoformat(),
            "by": user.get("name", ""),
        }],
    }
    res = await db.leads.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_lead(doc)

@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    q = {"_id": ObjectId(lead_id)}
    if user.get("role") != "admin":
        q["assigned_to"] = str(user["_id"])
    l = await db.leads.find_one(q)
    if not l:
        raise HTTPException(404, "Lead not found")
    return serialize_lead(l)

@api.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, payload: LeadUpdateIn, user: dict = Depends(get_current_user)):
    q = {"_id": ObjectId(lead_id)}
    if user.get("role") != "admin":
        q["assigned_to"] = str(user["_id"])
    existing = await db.leads.find_one(q)
    if not existing:
        raise HTTPException(404, "Lead not found")

    update = payload.model_dump(exclude_none=True)
    activity_entries = []
    now = datetime.now(timezone.utc)

    if "stage" in update and update["stage"] != existing.get("stage"):
        activity_entries.append({
            "type": "stage_change",
            "text": f"Stage changed: {existing.get('stage')} → {update['stage']}",
            "at": now.isoformat(),
            "by": user.get("name", ""),
        })
    if "assigned_to" in update and update["assigned_to"] != existing.get("assigned_to"):
        assignee = await db.users.find_one({"_id": ObjectId(update["assigned_to"])}) if update["assigned_to"] else None
        update["assigned_to_name"] = assignee.get("name", "") if assignee else ""
        activity_entries.append({
            "type": "assignment",
            "text": f"Assigned to {update.get('assigned_to_name') or 'unassigned'}",
            "at": now.isoformat(),
            "by": user.get("name", ""),
        })

    update["updated_at"] = now
    op = {"$set": update}
    if activity_entries:
        op["$push"] = {"activity": {"$each": activity_entries}}
    await db.leads.update_one({"_id": ObjectId(lead_id)}, op)
    l = await db.leads.find_one({"_id": ObjectId(lead_id)})
    return serialize_lead(l)

@api.post("/leads/{lead_id}/notes")
async def add_note(lead_id: str, payload: NoteIn, user: dict = Depends(get_current_user)):
    q = {"_id": ObjectId(lead_id)}
    if user.get("role") != "admin":
        q["assigned_to"] = str(user["_id"])
    l = await db.leads.find_one(q)
    if not l:
        raise HTTPException(404, "Lead not found")
    now = datetime.now(timezone.utc)
    entry = {"type": "note", "text": payload.text, "at": now.isoformat(), "by": user.get("name", "")}
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$push": {"activity": entry}, "$set": {"updated_at": now}})
    return {"ok": True, "entry": entry}

@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, admin: dict = Depends(require_admin)):
    await db.leads.delete_one({"_id": ObjectId(lead_id)})
    return {"ok": True}

# --- Website Webhook --------------------------------------------------------

@api.post("/webhook/website-lead")
async def website_lead(payload: WebhookLeadIn, x_api_key: Optional[str] = Header(None)):
    expected = os.environ.get("WEBHOOK_API_KEY")
    if not expected or x_api_key != expected:
        raise HTTPException(401, "Invalid API key")
    now = datetime.now(timezone.utc)
    doc = {
        "name": payload.name,
        "email": payload.email or "",
        "phone": payload.phone or "",
        "country_interest": payload.country_interest or "",
        "course_interest": payload.course_interest or "",
        "notes": payload.message or "",
        "source": "website",
        "pipeline": "study_abroad",
        "stage": "NL",
        "assigned_to": None,
        "assigned_to_name": "",
        "reviewed": False,
        "created_at": now,
        "updated_at": now,
        "activity": [{"type": "created", "text": "Received from website form", "at": now.isoformat(), "by": "system"}],
    }
    res = await db.leads.insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id)}

@api.post("/leads/{lead_id}/review")
async def mark_reviewed(lead_id: str, user: dict = Depends(get_current_user)):
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": {"reviewed": True}})
    return {"ok": True}

# --- Analytics --------------------------------------------------------------

def _date_range(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)

@api.get("/analytics/summary")
async def analytics_summary(
    days: int = 30,
    pipeline: str = "study_abroad",
    counsellor: Optional[str] = None,
    source: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {"pipeline": pipeline}
    if user.get("role") != "admin":
        q["assigned_to"] = str(user["_id"])
    elif counsellor:
        q["assigned_to"] = counsellor
    if source:
        q["source"] = source
    q["created_at"] = {"$gte": _date_range(days)}

    leads = await db.leads.find(q).to_list(5000)
    stages = STUDY_STAGES if pipeline == "study_abroad" else (ACCOM_STAGES if pipeline == "accommodation" else LOAN_STAGES)
    counts = {s: 0 for s in stages}
    for l in leads:
        s = l.get("stage")
        if s in counts:
            counts[s] += 1

    total = len(leads)
    funnel = [{"stage": s, "count": counts[s]} for s in stages]

    # Stage-to-stage conversion (each stage count / previous stage count, cumulative)
    # But since a lead only occupies one stage, count leads that at least reached that stage.
    # Compute: leads_reached[stage_i] = sum of counts from stage_i onwards
    reached = []
    cum = 0
    for s in reversed(stages):
        cum += counts[s]
        reached.insert(0, {"stage": s, "count": cum})
    conversion_table = []
    for i, row in enumerate(reached):
        prev = reached[i - 1]["count"] if i > 0 else (reached[0]["count"] or 1)
        pct = round((row["count"] / prev * 100), 2) if prev else 0
        conversion_table.append({
            "stage": row["stage"],
            "reached": row["count"],
            "conv_from_prev_pct": pct,
            "conv_from_start_pct": round((row["count"] / (reached[0]["count"] or 1) * 100), 2),
        })

    # Monthly buckets
    monthly = {}
    for l in leads:
        c = l.get("created_at")
        if isinstance(c, datetime):
            key = c.strftime("%Y-%m")
            monthly[key] = monthly.get(key, 0) + 1
    monthly_list = [{"month": k, "count": v} for k, v in sorted(monthly.items())]

    return {
        "total_leads": total,
        "funnel": funnel,
        "reached": reached,
        "conversion_table": conversion_table,
        "monthly": monthly_list,
    }

@api.get("/analytics/counsellor-performance")
async def counsellor_performance(days: int = 30, admin: dict = Depends(require_admin)):
    counsellors = await db.users.find({"role": {"$in": ["counsellor", "admin"]}}).to_list(500)
    since = _date_range(days)
    rows = []
    for c in counsellors:
        cid = str(c["_id"])
        leads = await db.leads.find({"assigned_to": cid, "created_at": {"$gte": since}}).to_list(5000)
        total = len(leads)
        deposits = sum(1 for l in leads if l.get("stage") in ("DP", "VS", "EN"))
        enrollments = sum(1 for l in leads if l.get("stage") == "EN")
        rows.append({
            "counsellor_id": cid,
            "name": c.get("name", ""),
            "role": c.get("role"),
            "total_leads": total,
            "deposits": deposits,
            "enrollments": enrollments,
            "conversion_pct": round((deposits / total * 100), 2) if total else 0,
        })
    rows.sort(key=lambda r: r["total_leads"], reverse=True)
    return rows

@api.get("/analytics/kpis")
async def kpis(user: dict = Depends(get_current_user)):
    q_base: dict = {}
    if user.get("role") != "admin":
        q_base["assigned_to"] = str(user["_id"])
    total = await db.leads.count_documents({**q_base, "pipeline": "study_abroad"})
    active = await db.leads.count_documents({**q_base, "pipeline": "study_abroad", "stage": {"$nin": ["DNP", "EN"]}})
    deposits = await db.leads.count_documents({**q_base, "pipeline": "study_abroad", "stage": {"$in": ["DP", "VS", "EN"]}})
    enrollments = await db.leads.count_documents({**q_base, "pipeline": "study_abroad", "stage": "EN"})
    new_this_month = await db.leads.count_documents({
        **q_base, "pipeline": "study_abroad",
        "created_at": {"$gte": datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)},
    })
    unreviewed = await db.leads.count_documents({**q_base, "source": "website", "reviewed": False})
    return {
        "total": total, "active": active, "deposits": deposits,
        "enrollments": enrollments, "new_this_month": new_this_month,
        "unreviewed_website": unreviewed,
        "conversion_pct": round((deposits / total * 100), 2) if total else 0,
    }

# --- Targets ---------------------------------------------------------------

@api.get("/targets")
async def get_targets(user: dict = Depends(get_current_user)):
    items = await db.targets.find({}).to_list(500)
    return [{**{k: v for k, v in it.items() if k != "_id"}, "id": str(it["_id"])} for it in items]

@api.post("/targets")
async def set_target(payload: TargetIn, admin: dict = Depends(require_admin)):
    key = {"period": payload.period, "year": payload.year, "month": payload.month}
    await db.targets.update_one(key, {"$set": payload.model_dump()}, upsert=True)
    return {"ok": True}

# --- Config / Webhook Info -------------------------------------------------

@api.get("/config/webhook")
async def webhook_config(admin: dict = Depends(require_admin)):
    backend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    return {
        "endpoint": f"{backend_url}/api/webhook/website-lead",
        "api_key": os.environ.get("WEBHOOK_API_KEY", ""),
        "method": "POST",
        "headers": {"Content-Type": "application/json", "X-API-Key": "<api_key>"},
        "body_example": {
            "name": "John Doe", "email": "john@example.com", "phone": "+91...",
            "country_interest": "UK", "course_interest": "MSc CS", "message": "Interested in fall intake",
        },
    }

# --- Meta / Health ---------------------------------------------------------

@api.get("/")
async def root():
    return {"service": "Rayvoy Overseas CRM", "ok": True}

@api.get("/meta/stages")
async def stages_meta():
    return {"study_abroad": STUDY_STAGES, "accommodation": ACCOM_STAGES, "loan": LOAN_STAGES}

# --- App wiring -------------------------------------------------------------

app.include_router(api)

_frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
_cors_origins = os.environ.get("CORS_ORIGINS", _frontend_url).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown():
    client.close()
