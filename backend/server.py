from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import csv
import io
import secrets as py_secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, UploadFile, File, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import requests as httpreq

# --- Config -----------------------------------------------------------------

JWT_ALGORITHM = "HS256"
STUDY_STAGES = ["NL", "CC", "DNP", "SL", "DR", "PR", "RA", "AP", "OL", "RD", "DP", "VS", "EN", "LO", "DF"]
ACCOM_STAGES = ["IN", "OS", "VS", "BK", "CF"]
LOAN_STAGES = ["AS", "DS", "PR", "AP", "DB"]
DEFAULT_PERMS = {
    "see_all_leads": False, "see_analytics": False, "see_website_leads": False,
    "see_team": False, "see_targets": False, "see_integrations": False,
    "manage_tasks_for_others": False,
}
ROLE_PERMS = {
    "admin": {k: True for k in DEFAULT_PERMS},
    "team_lead": {**DEFAULT_PERMS, "see_all_leads": True, "see_analytics": True, "see_website_leads": True, "manage_tasks_for_others": True},
    "counsellor": DEFAULT_PERMS,
}
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "rayvoy-crm")
_storage_key = None

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
    role = u.get("role", "counsellor")
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": role,
        "phone": u.get("phone", ""),
        "created_at": u.get("created_at").isoformat() if isinstance(u.get("created_at"), datetime) else u.get("created_at"),
        "active": u.get("active", True),
        "permissions": {**ROLE_PERMS.get(role, DEFAULT_PERMS), **(u.get("permissions") or {})},
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
    role: Literal["admin", "team_lead", "counsellor"] = "counsellor"

class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["admin", "team_lead", "counsellor"]] = None
    active: Optional[bool] = None
    password: Optional[str] = None
    permissions: Optional[dict] = None

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
        "highest_qualification": l.get("highest_qualification"),
        "profile": l.get("profile", {}),
        "referees": l.get("referees", []),
        "loan_info": l.get("loan_info", {}),
    }

async def _lead_visible_filter(user: dict) -> dict:
    base = {"is_deleted": {"$ne": True}}
    if user.get("role") == "admin" or (user.get("permissions") or {}).get("see_all_leads"):
        return base
    return {**base, "assigned_to": str(user["_id"])}

@api.get("/leads")
async def list_leads(
    pipeline: Optional[str] = None,
    stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    source: Optional[str] = None,
    reviewed: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = await _lead_visible_filter(user)
    if pipeline: q["pipeline"] = pipeline
    if stage: q["stage"] = stage
    if assigned_to: q["assigned_to"] = assigned_to
    if source: q["source"] = source
    if reviewed is not None: q["reviewed"] = reviewed
    if date_from or date_to:
        rng: dict = {}
        if date_from: rng["$gte"] = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        if date_to: rng["$lte"] = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
        q["created_at"] = rng
    leads = await db.leads.find(q).sort("created_at", -1).to_list(2000)
    threshold_days = int(os.environ.get("STALE_LEAD_DAYS", "2"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=threshold_days)
    result = []
    for l in leads:
        s = serialize_lead(l)
        upd = l.get("updated_at") or l.get("created_at")
        if isinstance(upd, datetime) and upd.tzinfo is None:
            upd = upd.replace(tzinfo=timezone.utc)
        s["is_stale"] = bool(isinstance(upd, datetime) and upd < cutoff and l.get("stage") not in ("EN", "LO", "DF", "DNP"))
        result.append(s)
    return result

@api.post("/leads")
async def create_lead(
    payload: LeadCreateIn,
    user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)

    lead_data = payload.model_dump()
    assigned_name = ""

    # When a counsellor creates a lead:
    # 1. Force the source to Referral
    # 2. Automatically assign the lead to that counsellor
    if user.get("role") == "counsellor":
        lead_data["source"] = "referral"
        lead_data["assigned_to"] = str(user["_id"])
        assigned_name = user.get("name", "")

    # Admin or team lead can select an assignee normally
    elif payload.assigned_to:
        assignee = await db.users.find_one(
            {"_id": ObjectId(payload.assigned_to)}
        )

        if assignee:
            assigned_name = assignee.get("name", "")

    doc = {
        **lead_data,
        "stage": default_stage(payload.pipeline),
        "assigned_to_name": assigned_name,
        "created_at": now,
        "updated_at": now,
        "reviewed": True,
        "activity": [
            {
                "type": "created",
                "text": f"Lead created by {user.get('name', 'user')}",
                "at": now.isoformat(),
                "by": user.get("name", ""),
            }
        ],
    }

    res = await db.leads.insert_one(doc)
    doc["_id"] = res.inserted_id

    return serialize_lead(doc)

@api.post("/leads/bulk-upload")
async def bulk_upload_leads(
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
):
    # Only CSV files are accepted
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid CSV file.",
        )

    try:
        file_bytes = await file.read()
        file_text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail=(
                "The CSV file could not be read. "
                "Please save it as a UTF-8 CSV file."
            ),
        )

    csv_reader = csv.DictReader(io.StringIO(file_text))

    if not csv_reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail=(
                "The CSV file is empty or does not contain "
                "column headings."
            ),
        )

    # Remove accidental spaces from column headings
    csv_reader.fieldnames = [
        heading.strip() if heading else ""
        for heading in csv_reader.fieldnames
    ]

    if "name" not in csv_reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="The CSV file must contain a 'name' column.",
        )

    imported_count = 0
    skipped_count = 0
    failed_count = 0
    errors = []

    for row_number, row in enumerate(csv_reader, start=2):
        # Clean spaces from every CSV value
        cleaned_row = {
            str(key).strip(): str(value or "").strip()
            for key, value in row.items()
            if key is not None
        }

        # Ignore completely empty rows
        if not any(cleaned_row.values()):
            continue

        name = cleaned_row.get("name", "")
        email = cleaned_row.get("email", "")
        phone = cleaned_row.get("phone", "")
        country_interest = cleaned_row.get(
            "country_interest",
            "",
        )
        course_interest = cleaned_row.get(
            "course_interest",
            "",
        )
        notes = cleaned_row.get("notes", "")
        assigned_to = (
            cleaned_row.get("assigned_to", "") or None
        )

        source = cleaned_row.get("source", "").lower()
        pipeline = cleaned_row.get("pipeline", "").lower()

        # Default values when CSV cells are blank
        if not source:
            source = "manual"

        if not pipeline:
            pipeline = "study_abroad"

        # Accept common source spellings
        source_aliases = {
            "walk in": "walk-in",
            "walkin": "walk-in",
            "social media": "social",
            "social-media": "social",
        }

        source = source_aliases.get(source, source)

        # Accept common pipeline spellings
        pipeline_aliases = {
            "study abroad": "study_abroad",
            "study-abroad": "study_abroad",
            "accommodation": "accommodation",
            "education loan": "loan",
            "education-loan": "loan",
        }

        pipeline = pipeline_aliases.get(
            pipeline,
            pipeline,
        )

        if not name:
            failed_count += 1
            errors.append({
                "row": row_number,
                "error": "Name is required.",
            })
            continue

        valid_sources = {
            "website",
            "manual",
            "referral",
            "walk-in",
            "social",
        }

        if source not in valid_sources:
            failed_count += 1
            errors.append({
                "row": row_number,
                "name": name,
                "error": (
                    "Invalid source. Use website, manual, "
                    "referral, walk-in, or social."
                ),
            })
            continue

        valid_pipelines = {
            "study_abroad",
            "accommodation",
            "loan",
        }

        if pipeline not in valid_pipelines:
            failed_count += 1
            errors.append({
                "row": row_number,
                "name": name,
                "error": (
                    "Invalid pipeline. Use study_abroad, "
                    "accommodation, or loan."
                ),
            })
            continue

        # Check for duplicate email or phone number
        duplicate_conditions = []

        if email:
            duplicate_conditions.append({
                "email": email,
            })

        if phone:
            duplicate_conditions.append({
                "phone": phone,
            })

        if duplicate_conditions:
            existing_lead = await db.leads.find_one({
                "$or": duplicate_conditions
            })

            if existing_lead:
                skipped_count += 1
                errors.append({
                    "row": row_number,
                    "name": name,
                    "error": (
                        "Duplicate email or phone number."
                    ),
                })
                continue

        assigned_name = ""

        # Validate the assigned counsellor, if provided
        if assigned_to:
            if not ObjectId.is_valid(assigned_to):
                failed_count += 1
                errors.append({
                    "row": row_number,
                    "name": name,
                    "error": (
                        "The assigned_to user ID is invalid."
                    ),
                })
                continue

            assignee = await db.users.find_one({
                "_id": ObjectId(assigned_to)
            })

            if not assignee:
                failed_count += 1
                errors.append({
                    "row": row_number,
                    "name": name,
                    "error": (
                        "The assigned counsellor was not found."
                    ),
                })
                continue

            assigned_name = assignee.get("name", "")

        now = datetime.now(timezone.utc)

        lead_doc = {
            "name": name,
            "email": email,
            "phone": phone,
            "country_interest": country_interest,
            "course_interest": course_interest,
            "source": source,
            "pipeline": pipeline,
            "notes": notes,
            "assigned_to": assigned_to,
            "assigned_to_name": assigned_name,
            "stage": default_stage(pipeline),
            "created_at": now,
            "updated_at": now,
            "reviewed": True,
            "activity": [
                {
                    "type": "created",
                    "text": (
                        f"Lead imported by "
                        f"{user.get('name', 'admin')} "
                        f"through CSV"
                    ),
                    "at": now.isoformat(),
                    "by": user.get("name", ""),
                }
            ],
        }

        await db.leads.insert_one(lead_doc)
        imported_count += 1

    return {
        "message": "CSV bulk upload completed.",
        "imported": imported_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "total_processed": (
            imported_count
            + skipped_count
            + failed_count
        ),
        "errors": errors[:100],
    }


@api.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    q = {"_id": ObjectId(lead_id)}
    if user.get("role") != "admin" and not (user.get("permissions") or {}).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])
    l = await db.leads.find_one(q)
    if not l:
        raise HTTPException(404, "Lead not found")
    return serialize_lead(l)

@api.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, payload: LeadUpdateIn, user: dict = Depends(get_current_user)):
    q = {"_id": ObjectId(lead_id)}
    if user.get("role") != "admin" and not (user.get("permissions") or {}).get("see_all_leads"):
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
    # Soft-delete → move to Bin
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}})
    return {"ok": True}

@api.post("/leads/{lead_id}/restore")
async def restore_lead(lead_id: str, admin: dict = Depends(require_admin)):
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": {"is_deleted": False}, "$unset": {"deleted_at": ""}})
    return {"ok": True}

@api.delete("/leads/{lead_id}/permanent")
async def permanent_delete(lead_id: str, admin: dict = Depends(require_admin)):
    await db.leads.delete_one({"_id": ObjectId(lead_id)})
    await db.documents.update_many({"lead_id": lead_id}, {"$set": {"is_deleted": True}})
    await db.tasks.delete_many({"lead_id": lead_id})
    return {"ok": True}

@api.get("/leads/bin/list")
async def list_bin(admin: dict = Depends(require_admin)):
    leads = await db.leads.find({"is_deleted": True}).sort("deleted_at", -1).to_list(500)
    return [serialize_lead(l) for l in leads]

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

# --- Tasks / Reminders / Notifications ------------------------------------

class TaskIn(BaseModel):
    lead_id: str
    title: str
    description: Optional[str] = ""
    due_at: str  # ISO string
    remind_at: Optional[str] = None
    assigned_to: Optional[str] = None

class TaskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_at: Optional[str] = None
    remind_at: Optional[str] = None
    status: Optional[Literal["pending", "done", "cancelled"]] = None

def serialize_task(t: dict) -> dict:
    return {
        "id": str(t["_id"]), "lead_id": t.get("lead_id"), "title": t.get("title", ""),
        "description": t.get("description", ""), "due_at": t.get("due_at"),
        "remind_at": t.get("remind_at"), "status": t.get("status", "pending"),
        "assigned_to": t.get("assigned_to"), "assigned_to_name": t.get("assigned_to_name", ""),
        "lead_name": t.get("lead_name", ""),
        "created_at": t.get("created_at").isoformat() if isinstance(t.get("created_at"), datetime) else t.get("created_at"),
    }

async def _notify(user_id: str, title: str, body: str, link: Optional[str] = None, kind: str = "info"):
    await db.notifications.insert_one({
        "user_id": user_id, "title": title, "body": body, "link": link,
        "kind": kind, "read": False, "created_at": datetime.now(timezone.utc),
    })

@api.post("/tasks")
async def create_task(payload: TaskIn, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"_id": ObjectId(payload.lead_id)})
    if not lead:
        raise HTTPException(404, "Lead not found")
    assignee_id = payload.assigned_to or lead.get("assigned_to") or str(user["_id"])
    assignee = await db.users.find_one({"_id": ObjectId(assignee_id)}) if assignee_id else None
    doc = {
        "lead_id": payload.lead_id, "lead_name": lead.get("name", ""),
        "title": payload.title, "description": payload.description or "",
        "due_at": payload.due_at, "remind_at": payload.remind_at,
        "assigned_to": assignee_id, "assigned_to_name": assignee.get("name", "") if assignee else "",
        "status": "pending", "created_at": datetime.now(timezone.utc), "created_by": user.get("name", ""),
    }
    res = await db.tasks.insert_one(doc)
    doc["_id"] = res.inserted_id
    if assignee_id and assignee_id != str(user["_id"]):
        await _notify(assignee_id, "New Task Assigned", f"{payload.title} · {lead.get('name', '')}", link=f"/lead/{payload.lead_id}", kind="task")
    # Add to lead activity
    await db.leads.update_one({"_id": ObjectId(payload.lead_id)}, {
        "$push": {"activity": {"type": "task", "text": f"Task: {payload.title} (due {payload.due_at})", "at": datetime.now(timezone.utc).isoformat(), "by": user.get("name", "")}},
        "$set": {"updated_at": datetime.now(timezone.utc)},
    })
    return serialize_task(doc)

@api.get("/tasks")
async def list_tasks(lead_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: dict = {}
    if lead_id:
        q["lead_id"] = lead_id
    elif user.get("role") == "counsellor" and not (user.get("permissions") or {}).get("manage_tasks_for_others"):
        q["assigned_to"] = str(user["_id"])
    if status:
        q["status"] = status
    tasks = await db.tasks.find(q).sort("due_at", 1).to_list(1000)
    return [serialize_task(t) for t in tasks]

@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: TaskUpdateIn, user: dict = Depends(get_current_user)):
    update = payload.model_dump(exclude_none=True)
    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update})
    t = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return serialize_task(t)

@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return {"ok": True}

@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": str(user["_id"])}).sort("created_at", -1).limit(100).to_list(100)
    return [{
        "id": str(i["_id"]), "title": i.get("title"), "body": i.get("body"),
        "link": i.get("link"), "kind": i.get("kind", "info"), "read": i.get("read", False),
        "created_at": i["created_at"].isoformat() if isinstance(i.get("created_at"), datetime) else i.get("created_at"),
    } for i in items]

@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": str(user["_id"]), "read": False}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/{nid}/read")
async def read_one(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"_id": ObjectId(nid)}, {"$set": {"read": True}})
    return {"ok": True}

# --- Documents (Object Storage) --------------------------------------------

def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(500, "Object storage not configured")
    resp = httpreq.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def put_object(path: str, data: bytes, content_type: str):
    key = init_storage()
    resp = httpreq.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = httpreq.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

@api.post("/leads/{lead_id}/documents")
async def upload_doc(lead_id: str, doc_type: str = Query(...), meta: str = Query("{}"), file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(404, "Lead not found")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/leads/{lead_id}/{doc_type}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    import json as _json
    try:
        meta_obj = _json.loads(meta) if meta else {}
    except Exception:
        meta_obj = {}
    doc = {
        "lead_id": lead_id, "doc_type": doc_type, "storage_path": result["path"],
        "original_filename": file.filename, "content_type": file.content_type,
        "size": result.get("size", 0), "is_deleted": False, "meta": meta_obj,
        "uploaded_by": user.get("name", ""),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.documents.insert_one(doc)
    doc["_id"] = res.inserted_id
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {
        "$push": {"activity": {"type": "document", "text": f"Uploaded {doc_type}: {file.filename}", "at": datetime.now(timezone.utc).isoformat(), "by": user.get("name", "")}},
        "$set": {"updated_at": datetime.now(timezone.utc)},
    })
    return {"id": str(doc["_id"]), "doc_type": doc_type, "original_filename": file.filename, "size": doc["size"], "meta": meta_obj}

@api.get("/leads/{lead_id}/documents")
async def list_docs(lead_id: str, user: dict = Depends(get_current_user)):
    docs = await db.documents.find({"lead_id": lead_id, "is_deleted": False}).to_list(500)
    return [{"id": str(d["_id"]), "doc_type": d.get("doc_type"), "original_filename": d.get("original_filename"),
             "size": d.get("size", 0), "meta": d.get("meta", {}),
             "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at")} for d in docs]

@api.get("/documents/{doc_id}/download")
async def download_doc(doc_id: str, user: dict = Depends(get_current_user)):
    d = await db.documents.find_one({"_id": ObjectId(doc_id), "is_deleted": False})
    if not d:
        raise HTTPException(404, "Not found")
    data, ct = get_object(d["storage_path"])
    return Response(content=data, media_type=d.get("content_type") or ct, headers={"Content-Disposition": f'inline; filename="{d.get("original_filename", "file")}"'})

@api.delete("/documents/{doc_id}")
async def delete_doc(doc_id: str, user: dict = Depends(get_current_user)):
    await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"is_deleted": True}})
    return {"ok": True}

# --- Lead extras (referees, loan info, profile) ---------------------------

class LeadExtraIn(BaseModel):
    highest_qualification: Optional[Literal["12th", "UG", "PG"]] = None
    profile: Optional[dict] = None  # name, surname, dob, address, etc.
    referees: Optional[list] = None  # list of {name, profession, relationship, phone, email}
    loan_info: Optional[dict] = None  # co-applicant, cibil, amount, etc.

@api.patch("/leads/{lead_id}/extras")
async def update_extras(lead_id: str, payload: LeadExtraIn, user: dict = Depends(get_current_user)):
    upd = payload.model_dump(exclude_none=True)
    upd["updated_at"] = datetime.now(timezone.utc)
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": upd})
    l = await db.leads.find_one({"_id": ObjectId(lead_id)})
    return {"ok": True, "highest_qualification": l.get("highest_qualification"), "profile": l.get("profile", {}), "referees": l.get("referees", []), "loan_info": l.get("loan_info", {})}

# --- Pipeline Stats & Stale --------------------------------------------------

@api.get("/pipeline/stats")
async def pipeline_stats(user: dict = Depends(get_current_user)):
    q: dict = {"is_deleted": {"$ne": True}}
    if not (user.get("role") == "admin" or (user.get("permissions") or {}).get("see_all_leads")):
        q["assigned_to"] = str(user["_id"])
    total_study = await db.leads.count_documents({**q, "pipeline": "study_abroad"})
    in_pipeline = await db.leads.count_documents({**q, "pipeline": "study_abroad", "stage": {"$nin": ["EN", "LO", "DF", "DNP"]}})
    deposit = await db.leads.count_documents({**q, "pipeline": "study_abroad", "stage": {"$in": ["DP", "VS", "EN"]}})
    visa = await db.leads.count_documents({**q, "pipeline": "study_abroad", "stage": {"$in": ["VS", "EN"]}})
    enrollment = await db.leads.count_documents({**q, "pipeline": "study_abroad", "stage": "EN"})
    accom = await db.leads.count_documents({**q, "pipeline": "accommodation"})
    loan = await db.leads.count_documents({**q, "pipeline": "loan"})
    return {"total": total_study, "in_pipeline": in_pipeline, "deposit": deposit, "visa": visa, "enrollment": enrollment, "accommodation": accom, "loan": loan}

@api.get("/leads/stale/list")
async def stale_leads(user: dict = Depends(get_current_user)):
    threshold_days = int(os.environ.get("STALE_LEAD_DAYS", "2"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=threshold_days)
    q: dict = {"updated_at": {"$lt": cutoff}, "stage": {"$nin": ["EN", "LO", "DF", "DNP"]}}
    if user.get("role") != "admin" and not (user.get("permissions") or {}).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])
    leads = await db.leads.find(q).sort("updated_at", 1).limit(200).to_list(200)
    return {"threshold_days": threshold_days, "leads": [serialize_lead(l) for l in leads]}

class ConfigIn(BaseModel):
    stale_lead_days: Optional[int] = None

@api.get("/config/app")
async def get_config(user: dict = Depends(get_current_user)):
    cfg = await db.app_config.find_one({"_id": "app"}) or {}
    return {"stale_lead_days": cfg.get("stale_lead_days", int(os.environ.get("STALE_LEAD_DAYS", "2")))}

@api.post("/config/app")
async def set_config(payload: ConfigIn, admin: dict = Depends(require_admin)):
    upd = payload.model_dump(exclude_none=True)
    if "stale_lead_days" in upd:
        os.environ["STALE_LEAD_DAYS"] = str(upd["stale_lead_days"])
    await db.app_config.update_one({"_id": "app"}, {"$set": upd}, upsert=True)
    return {"ok": True}

# --- App wiring -------------------------------------------------------------


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://crm-3b52.vercel.app",
        "https://crm.rayvoyoverseas.com",
    ],
    allow_origin_regex=r"https://crm-3b52.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown():
    client.close()
