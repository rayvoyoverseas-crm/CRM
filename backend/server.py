from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import logging
import asyncio
import uuid
import csv
import io
import secrets as py_secrets
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pymongo import ReturnDocument
from typing import List, Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, UploadFile, File, Query

from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import boto3
from botocore.exceptions import BotoCoreError, ClientError

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
APP_NAME = os.environ.get("APP_NAME", "rayvoy-crm")

# --- Google Calendar OAuth --------------------------------------------------

GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "",
)

GOOGLE_CLIENT_SECRET = os.environ.get(
    "GOOGLE_CLIENT_SECRET",
    "",
)

GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI",
    "",
)

FRONTEND_URL = os.environ.get(
    "FRONTEND_URL",
    "https://crm.rayvoyoverseas.com",
).rstrip("/")

GOOGLE_CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events.owned",
]

R2_ACCOUNT_ID = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET_NAME = os.environ["R2_BUCKET_NAME"]
R2_ENDPOINT = os.environ["R2_ENDPOINT"]

s3 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Rayvoy Overseas CRM")
api = APIRouter(prefix="/api")

# --- Utilities --------------------------------------------------------------


def build_google_calendar_flow() -> Flow:
    if (
        not GOOGLE_CLIENT_ID
        or not GOOGLE_CLIENT_SECRET
        or not GOOGLE_REDIRECT_URI
    ):
        raise HTTPException(
            status_code=500,
            detail="Google Calendar integration is not configured.",
        )

    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [
                GOOGLE_REDIRECT_URI,
            ],
        }
    }

    return Flow.from_client_config(
        client_config,
        scopes=GOOGLE_CALENDAR_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
        autogenerate_code_verifier=False,
    )


async def create_google_calendar_event(
    google_user: dict,
    task: dict,
    lead: dict,
):
    refresh_token = google_user.get(
        "google_calendar_refresh_token"
    )

    connected = google_user.get(
        "google_calendar_connected",
        False,
    )

    if not connected or not refresh_token:
        logging.warning(
            "Google Calendar sync skipped: user is not connected"
        )
        return None

    if not GOOGLE_CLIENT_ID:
        logging.error(
            "Google Calendar sync failed: GOOGLE_CLIENT_ID missing"
        )
        return None

    if not GOOGLE_CLIENT_SECRET:
        logging.error(
            "Google Calendar sync failed: GOOGLE_CLIENT_SECRET missing"
        )
        return None

    due_raw = task.get("due_at")

    if not due_raw:
        logging.warning(
            "Google Calendar sync skipped: task has no due_at"
        )
        return None

    try:
        due_at = datetime.fromisoformat(
            str(due_raw).replace(
                "Z",
                "+00:00",
            )
        )

        if due_at.tzinfo is None:
            due_at = due_at.replace(
                tzinfo=ZoneInfo("Asia/Kolkata")
            )

    except Exception:
        logging.exception(
            "Google Calendar sync failed: invalid due_at"
        )
        return None

    end_at = due_at + timedelta(minutes=30)

    description_parts = []

    if task.get("description"):
        description_parts.append(
            task.get("description")
        )

    if lead.get("name"):
        description_parts.append(
            f"Student: {lead.get('name')}"
        )

    if lead.get("phone"):
        description_parts.append(
            f"Phone: {lead.get('phone')}"
        )

    if lead.get("email"):
        description_parts.append(
            f"Email: {lead.get('email')}"
        )

    description_parts.append(
        "Created from Rayvoy Overseas CRM"
    )

    description_parts.append(
        f"Lead: {FRONTEND_URL}/lead/{str(lead['_id'])}"
    )

    reminder_overrides = [
        {
            "method": "popup",
            "minutes": 0,
        }
    ]

    remind_raw = task.get("remind_at")

    if remind_raw:
        try:
            remind_at = datetime.fromisoformat(
                str(remind_raw).replace(
                    "Z",
                    "+00:00",
                )
            )

            if remind_at.tzinfo is None:
                remind_at = remind_at.replace(
                    tzinfo=ZoneInfo("Asia/Kolkata")
                )

            reminder_seconds = (
                due_at - remind_at
            ).total_seconds()

            if reminder_seconds > 0:
                minutes_before = int(
                    reminder_seconds / 60
                )

                if minutes_before > 0:
                    reminder_overrides.insert(
                        0,
                        {
                            "method": "popup",
                            "minutes": minutes_before,
                        },
                    )

            elif reminder_seconds == 0:
                pass

            else:
                logging.warning(
                    "CRM reminder occurs after due time; "
                    "only due-time Google popup will be created."
                )

        except Exception:
            logging.exception(
                "Could not calculate CRM reminder "
                "for Google Calendar"
            )

    event_body = {
        "summary": task.get("title") or "CRM Task",

        "description": "\n".join(
            description_parts
        ),

        "start": {
            "dateTime": due_at.isoformat(),
            "timeZone": "Asia/Kolkata",
        },

        "end": {
            "dateTime": end_at.isoformat(),
            "timeZone": "Asia/Kolkata",
        },

        "reminders": {
            "useDefault": False,
            "overrides": reminder_overrides,
        },
    }

    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_CALENDAR_SCOPES,
    )

    def _insert_event():
        service = build(
            "calendar",
            "v3",
            credentials=credentials,
            cache_discovery=False,
        )

        return (
            service.events()
            .insert(
                calendarId="primary",
                body=event_body,
            )
            .execute()
        )

    try:
        google_event = await asyncio.to_thread(
            _insert_event
        )

        logging.info(
            "Google Calendar event created successfully: %s",
            google_event.get("id"),
        )

        return google_event

    except Exception:
        logging.exception(
            "Failed to create Google Calendar event"
        )
        return None


async def generate_lead_code(intake: str) -> str:
    """
    Generate a permanent sequential Rayvoy student ID.

    Examples:
    RV001/01-27
    RV002/09-27
    RV003/09-27

    The RV number increases globally.
    The /MM-YY suffix comes from the selected intake.
    """

    if not intake:
        raise HTTPException(
            status_code=400,
            detail="Intake is required to generate Student ID.",
        )

    try:
        intake_date = datetime.strptime(
            intake,
            "%B %Y",
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid intake format. Expected format like January 2027.",
        )

    counter = await db.counters.find_one_and_update(
        {
            "_id": "lead_code",
        },
        {
            "$inc": {
                "seq": 1,
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    sequence = int(
        counter.get(
            "seq",
            1,
        )
    )

    month = intake_date.month
    year = intake_date.year % 100

    return (
        f"RV{sequence:03d}/"
        f"{month:02d}-{year:02d}"
    )
    

def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def normalize_phone(phone: str) -> str:
    return re.sub(
        r"[\s\-\(\)]",
        "",
        (phone or "").strip(),
    )


def validate_phone_number(phone: str) -> str:
    phone = normalize_phone(phone)

    if not phone:
        return ""

    if not phone.startswith("+"):
        raise HTTPException(
            status_code=400,
            detail=(
                "Phone number must include country code. "
                "Example: +919876543210"
            ),
        )

    digits = phone[1:]

    if not digits.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Phone number can contain only numbers after +.",
        )

    # Country code = 1 to 3 digits.
    # Actual mobile number = exactly 10 digits.
    if len(digits) < 11 or len(digits) > 13:
        raise HTTPException(
            status_code=400,
            detail=(
                "Phone number must contain a country code "
                "followed by exactly 10 digits."
            ),
        )

    return phone


async def ensure_unique_lead_contact(
    email: str = "",
    phone: str = "",
    exclude_lead_id: Optional[str] = None,
):
    normalized_email = normalize_email(email)
    normalized_phone = validate_phone_number(phone)

    if normalized_email:
        email_query = {
            "email_normalized": normalized_email,
            "is_deleted": {"$ne": True},
        }

        if exclude_lead_id:
            email_query["_id"] = {
                "$ne": ObjectId(exclude_lead_id)
            }

        existing_email = await db.leads.find_one(
            email_query
        )

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This email address is already registered "
                    f"for {existing_email.get('name', 'another lead')}."
                ),
            )

    if normalized_phone:
        phone_query = {
            "phone_normalized": normalized_phone,
            "is_deleted": {"$ne": True},
        }

        if exclude_lead_id:
            phone_query["_id"] = {
                "$ne": ObjectId(exclude_lead_id)
            }

        existing_phone = await db.leads.find_one(
            phone_query
        )

        if existing_phone:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This phone number is already registered "
                    f"for {existing_phone.get('name', 'another lead')}."
                ),
            )

    return (
        normalized_email,
        normalized_phone,
    )


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

def create_google_oauth_state(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "google_calendar_oauth",
        "nonce": py_secrets.token_urlsafe(24),
        "exp": (
            datetime.now(timezone.utc)
            + timedelta(minutes=10)
        ),
    }

    return jwt.encode(
        payload,
        jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )


def verify_google_oauth_state(state: str) -> str:
    try:
        payload = jwt.decode(
            state,
            jwt_secret(),
            algorithms=[JWT_ALGORITHM],
        )

        if payload.get("type") != "google_calendar_oauth":
            raise ValueError("Invalid OAuth state")

        user_id = payload.get("sub")

        if not user_id:
            raise ValueError("Missing user")

        return user_id

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired Google Calendar connection.",
        )

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
    intake: Optional[str] = ""
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
    selected_shortlist_id: Optional[str] = None
    selected_shortlist_ids: Optional[List[str]] = None

    # Offer Letter details
    offer_university: Optional[str] = None
    offer_course: Optional[str] = None
    offer_type: Optional[
        Literal[
            "Conditional Offer Letter",
            "Unconditional Offer Letter",
        ]
    ] = None
    deposit_required: Optional[
        Literal[
            "Yes", 
            "No",
    ]
] = None
    deposit_amount: Optional[str] = None
    accepted_for_deposit: Optional[bool] = None
    payment_made: Optional[bool] = None
    
    deposit_payment_method: Optional[
        Literal[
            "Online Bank Transfer",
            "Offline Bank Transfer",
            "Visa Card",
            "Master Card",
            "Cash to Rayvoy",
            "Bank Transfers to Rayvoy",
            "UPI to Rayvoy",
        ]
    ] = None
    
    deposit_payment_amount: Optional[str] = None
    deposit_payment_date: Optional[str] = None
    deposit_payment_id: Optional[str] = None
    deposit_details_saved: Optional[bool] = None

    # Visa Application details
    visa_applied: Optional[bool] = None
    visa_applied_date: Optional[str] = None
    visa_reference_number: Optional[str] = None

    visa_type: Optional[
        Literal[
            "General",
            "Priority",
            "VIP",
        ]
    ] = None

    visa_decision: Optional[
        Literal[
            "Visa Awaited",
            "Visa Granted",
            "Visa Refused",
        ]
    ] = None

    student_enrolment: Optional[
        Literal[
            "Awaiting",
            "Done",
        ]
    ] = None
    
    offer_date: Optional[str] = None
    offer_reference_number: Optional[str] = None
    offer_details_verified: Optional[bool] = None


class NoteIn(BaseModel):
    text: str

class CallHistoryIn(BaseModel):
    call_date: str
    call_time: str
    outcome: Literal[
        "Call Made",
        "No Answer",
        "Busy",
        "Switched Off",
        "Wrong Number",
        "Call Back Requested",
    ]
    notes: str

class ShortlistIn(BaseModel):
    country: str
    intake: str
    level_of_study: str
    university_name: str
    course: str
    course_link: str
    shortlist_status: str
    tuition_fee: Optional[str] = ""
    application_fee: Optional[str] = ""
    counsellor_remarks: Optional[str] = ""

class ApplicationRecordIn(BaseModel):
    shortlist_id: str

    country: str
    level_of_study: str
    university: str
    course: str
    course_link: str
    intake: str

    submission_datetime: str

    submitted_by: Literal[
        "KC",
        "Crizac",
        "SI-UK",
    ]

    application_status: Literal[
        "Draft",
        "Ready to submit",
        "Submitted",
        "Under review",
        "Additional documents requested",
        "Offer Letter Received",
    ]

    priority: Literal[
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
    ]

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
        "lead_code": l.get("lead_code", ""),
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
        "call_history": l.get("call_history", []),
        "shortlists": l.get("shortlists", []),
        "application_records": l.get("application_records", []),
        
        "offer_university": l.get("offer_university", ""),
        "offer_course": l.get("offer_course", ""),
        "offer_type": l.get("offer_type", ""),
        
        "deposit_required": l.get("deposit_required", ""),
        "deposit_amount": l.get("deposit_amount", ""),
        "accepted_for_deposit": l.get("accepted_for_deposit", False),
        "payment_made": l.get("payment_made", False),

        "deposit_payment_method": l.get(
            "deposit_payment_method",
            "",
        ),
        "deposit_payment_amount": l.get(
            "deposit_payment_amount",
            "",
        ),
        "deposit_payment_date": l.get(
            "deposit_payment_date",
            "",
        ),
        "deposit_payment_id": l.get(
            "deposit_payment_id",
            "",
        ),
        "deposit_details_saved": l.get(
            "deposit_details_saved",
            False,
        ),

        "visa_applied": l.get(
            "visa_applied",
            False,
        ),
        "visa_applied_date": l.get(
            "visa_applied_date",
            "",
        ),
        "visa_reference_number": l.get(
            "visa_reference_number",
            "",
        ),
        "visa_type": l.get(
            "visa_type",
            "",
        ),
        "visa_decision": l.get(
            "visa_decision",
            "",
        ),

        "student_enrolment": l.get(
            "student_enrolment",
            "Awaiting",
        ),
        
        "offer_date": l.get("offer_date", ""),
        "offer_reference_number": l.get("offer_reference_number", ""),
        "offer_details_verified": l.get("offer_details_verified", False),
        
        "selected_shortlist_id": l.get("selected_shortlist_id"),
        "selected_shortlist_ids": l.get(
            "selected_shortlist_ids",
            [l.get("selected_shortlist_id")]
            if l.get("selected_shortlist_id")
            else [],
        ),
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

    lead_code = await generate_lead_code(
        payload.intake
    )

    lead_data = payload.model_dump()

    normalized_email, normalized_phone = (
        await ensure_unique_lead_contact(
            email=payload.email or "",
            phone=payload.phone or "",
        )
    )
    
    lead_data["email"] = (
        payload.email or ""
    ).strip()
    
    lead_data["phone"] = normalized_phone
    
    lead_data["email_normalized"] = (
        normalized_email
    )
    
    lead_data["phone_normalized"] = (
        normalized_phone
    )
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
        "lead_code": lead_code,
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
async def get_lead(
    lead_id: str,
    user: dict = Depends(get_current_user),
):
    # Accept either MongoDB ObjectId
    # or public Rayvoy URL ID like RV001-09-27

    if ObjectId.is_valid(lead_id):
        q = {
            "_id": ObjectId(lead_id)
        }

    else:
        parts = lead_id.split("-")

        if (
            len(parts) != 3
            or not parts[0].startswith("RV")
        ):
            raise HTTPException(
                status_code=404,
                detail="Lead not found",
            )

        stored_lead_code = (
            f"{parts[0]}/"
            f"{parts[1]}-"
            f"{parts[2]}"
        )

        q = {
            "lead_code": stored_lead_code
        }

    if (
        user.get("role") != "admin"
        and not (
            user.get("permissions") or {}
        ).get("see_all_leads")
    ):
        q["assigned_to"] = str(
            user["_id"]
        )

    lead = await db.leads.find_one(q)

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    return serialize_lead(lead)
STAGE_TRANSITIONS = {
    "NL": ["CC"],
    "CC": ["SL"],
    "SL": ["DR"],
    "DR": ["RA"],
    "RA": ["AP"],
    "AP": ["OL"],
    "OL": ["RD"],
    "RD": ["DP"],
    "DP": ["VS"],
    "VS": ["EN"],
    "EN": [],
}

@api.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    payload: LeadUpdateIn,
    user: dict = Depends(get_current_user),
):
    q = {"_id": ObjectId(lead_id)}

    if user.get("role") != "admin" and not (
        user.get("permissions") or {}
    ).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])

    existing = await db.leads.find_one(q)

    if not existing:
        raise HTTPException(404, "Lead not found")

    update = payload.model_dump(exclude_none=True)
    activity_entries = []
    now = datetime.now(timezone.utc)

    # ---------------------------------------------------------
    # Stage change validation
    # ---------------------------------------------------------
    if "stage" in update and update["stage"] != existing.get("stage"):
        current_stage = existing.get("stage")
        requested_stage = update["stage"]

        allowed_stages = STAGE_TRANSITIONS.get(current_stage, [])

        # NL → CC requires a successful call
        if current_stage == "NL" and requested_stage == "CC":
            call_history = existing.get("call_history", [])

            has_successful_call = any(
                call.get("outcome") == "Call Made"
                for call in call_history
            )

            if not has_successful_call:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please record a successful call "
                        "(Outcome: Call Made) before moving this lead "
                        "to Counsellor Contacted."
                    ),
                )

        # CC → SL requires two complete shortlist entries
        if current_stage == "CC" and requested_stage == "SL":
            shortlists = existing.get("shortlists", [])

            required_shortlist_fields = [
                "country",
                "intake",
                "level_of_study",
                "university_name",
                "course",
                "course_link",
                "shortlist_status",
            ]

            complete_shortlists = [
                shortlist
                for shortlist in shortlists
                if all(
                    str(shortlist.get(field, "")).strip()
                    for field in required_shortlist_fields
                )
            ]

            if len(complete_shortlists) < 2:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please save at least 2 complete shortlist entries "
                        "before moving this lead to Shortlisting."
                    ),
                )

        # SL → DR requires mandatory documents
        if current_stage == "SL" and requested_stage == "DR":
            required_doc_types = ["10th", "12th", "cv"]

            uploaded_docs = await db.documents.find(
                {
                    "lead_id": lead_id,
                    "doc_type": {"$in": required_doc_types},
                    "is_deleted": False,
                }
            ).to_list(20)

            uploaded_doc_types = {
                doc.get("doc_type")
                for doc in uploaded_docs
            }

            missing_docs = [
                doc_type
                for doc_type in required_doc_types
                if doc_type not in uploaded_doc_types
            ]

            if missing_docs:
                document_labels = {
                    "10th": "10th Certificate",
                    "12th": "12th / Diploma Certificate",
                    "cv": "CV / Resume",
                }

                missing_labels = [
                    document_labels.get(doc, doc)
                    for doc in missing_docs
                ]

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please upload the required documents before "
                        "moving this lead to Docs Received: "
                        + ", ".join(missing_labels)
                    ),
                )

                # DR → RA requires at least one selected shortlist
        if current_stage == "DR" and requested_stage == "RA":
            selected_shortlist_ids = existing.get(
                "selected_shortlist_ids",
                [],
            )

            # Backward compatibility for old leads
            if (
                not selected_shortlist_ids
                and existing.get("selected_shortlist_id")
            ):
                selected_shortlist_ids = [
                    existing.get("selected_shortlist_id")
                ]

            if not selected_shortlist_ids:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please select at least one shortlist for "
                        "application before moving this lead to "
                        "Ready to Application."
                    ),
                )

            shortlists = existing.get("shortlists", [])

            valid_shortlist_ids = {
                shortlist.get("id")
                for shortlist in shortlists
            }

            invalid_selected_ids = [
                shortlist_id
                for shortlist_id in selected_shortlist_ids
                if shortlist_id not in valid_shortlist_ids
            ]

            if invalid_selected_ids:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "One or more selected shortlists could not "
                        "be found. Please review the selected "
                        "shortlists before continuing."
                    ),
                )

        # RA → AP requires at least one submitted application
        if current_stage == "RA" and requested_stage == "AP":
            application_records = existing.get(
                "application_records",
                [],
            )

            has_submitted_application = any(
                application.get("application_status") == "Submitted"
                for application in application_records
            )

            if not has_submitted_application:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please save at least one application record "
                        "with Application Status = Submitted before "
                        "moving this lead to Application."
                    ),
                )


        # AP → OL requires at least one application
        # to have Application Status = Offer Letter Received
        if current_stage == "AP" and requested_stage == "OL":
            application_records = existing.get(
                "application_records",
                [],
            )

            has_offer_letter_application = any(
                application.get("application_status")
                == "Offer Letter Received"
                for application in application_records
            )

            if not has_offer_letter_application:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Please update at least one application "
                        "with Application Status = Offer Letter Received "
                        "before moving this lead to Offer Letter."
                    ),
                )

        # OL → RD requires BOTH:
        # 1. Unconditional Offer Letter
        # 2. Accepted for Deposit = Yes
        if current_stage == "OL" and requested_stage == "RD":
            offer_type = update.get(
                "offer_type",
                existing.get("offer_type"),
            )

            accepted_for_deposit = update.get(
                "accepted_for_deposit",
                existing.get("accepted_for_deposit"),
            )

            missing_requirements = []

            if offer_type != "Unconditional Offer Letter":
                missing_requirements.append(
                    "Unconditional Offer Letter"
                )

            if accepted_for_deposit is not True:
                missing_requirements.append(
                    "Accepted for Deposit = Yes"
                )

            if missing_requirements:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot move to Ready for Deposit. "
                        "Please complete: "
                        + ", ".join(missing_requirements)
                    ),
                )

        # RD → DP requires ALL THREE:
        # 1. Unconditional Offer Letter
        # 2. Accepted for Deposit = Yes
        # 3. Payment Made = Yes
        if current_stage == "RD" and requested_stage == "DP":
            offer_type = update.get(
                "offer_type",
                existing.get("offer_type"),
            )

            accepted_for_deposit = update.get(
                "accepted_for_deposit",
                existing.get("accepted_for_deposit"),
            )

            payment_made = update.get(
                "payment_made",
                existing.get("payment_made"),
            )

            missing_requirements = []

            if offer_type != "Unconditional Offer Letter":
                missing_requirements.append(
                    "Unconditional Offer Letter"
                )

            if accepted_for_deposit is not True:
                missing_requirements.append(
                    "Accepted for Deposit = Yes"
                )

            if payment_made is not True:
                missing_requirements.append(
                    "Payment Made = Yes"
                )

            if missing_requirements:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot move to Deposit Paid. "
                        "Please complete: "
                        + ", ".join(missing_requirements)
                    ),
                )

        # DP → VS requires complete Deposit Details
        # and an uploaded Payment Receipt
        if current_stage == "DP" and requested_stage == "VS":
            required_deposit_fields = {
                "Payment Method": existing.get(
                    "deposit_payment_method"
                ),
                "Payment Amount": existing.get(
                    "deposit_payment_amount"
                ),
                "Payment Date": existing.get(
                    "deposit_payment_date"
                ),
                "Payment ID": existing.get(
                    "deposit_payment_id"
                ),
            }

            missing_deposit_fields = [
                field_name
                for field_name, value in required_deposit_fields.items()
                if not str(value or "").strip()
            ]

            # Payment Receipt is compulsory
            deposit_receipt = await db.documents.find_one(
                {
                    "lead_id": lead_id,
                    "doc_type": "deposit_receipt",
                    "is_deleted": False,
                }
            )

            if not deposit_receipt:
                missing_deposit_fields.append(
                    "Payment Receipt"
                )

            if not existing.get(
                "deposit_details_saved",
                False,
            ):
                missing_deposit_fields.append(
                    "Save Deposit Details"
                )

            if missing_deposit_fields:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot move to Visa. "
                        "Please complete: "
                        + ", ".join(
                            missing_deposit_fields
                        )
                    ),
                )

        # VS → EN requires:
        # 1. Complete Visa Application
        # 2. Visa Decision = Visa Granted
        # 3. Student Enrolment = Done
        if current_stage == "VS" and requested_stage == "EN":
            visa_applied = update.get(
                "visa_applied",
                existing.get("visa_applied"),
            )

            visa_applied_date = update.get(
                "visa_applied_date",
                existing.get("visa_applied_date"),
            )

            visa_type = update.get(
                "visa_type",
                existing.get("visa_type"),
            )

            visa_decision = update.get(
                "visa_decision",
                existing.get("visa_decision"),
            )

            student_enrolment = update.get(
                "student_enrolment",
                existing.get("student_enrolment"),
            )

            missing_requirements = []

            if visa_applied is not True:
                missing_requirements.append(
                    "Visa Applied = Yes"
                )

            if not str(
                visa_applied_date or ""
            ).strip():
                missing_requirements.append(
                    "Applied Date"
                )

            if not str(
                visa_type or ""
            ).strip():
                missing_requirements.append(
                    "Visa Type"
                )

            if visa_decision != "Visa Granted":
                missing_requirements.append(
                    "Visa Decision = Visa Granted"
                )

            if student_enrolment != "Done":
                missing_requirements.append(
                    "Student Enrolment = Done"
                )

            if missing_requirements:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot move to Enrolment. "
                        "Please complete: "
                        + ", ".join(
                            missing_requirements
                        )
                    ),
                )

        if requested_stage not in allowed_stages:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Stage cannot move from "
                    f"{current_stage} to {requested_stage}"
                ),
            )
        
        activity_entries.append({
            "type": "stage_change",
            "text": (
                f"Stage changed: "
                f"{current_stage} → {requested_stage}"
            ),
            "at": now.isoformat(),
            "by": user.get("name", ""),
        })

    # ---------------------------------------------------------
    # Counsellor assignment
    # ---------------------------------------------------------
    if (
        "assigned_to" in update
        and update["assigned_to"]
        != existing.get("assigned_to")
    ):
        assignee = None

        if update["assigned_to"]:
            if not ObjectId.is_valid(update["assigned_to"]):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid counsellor ID",
                )

            assignee = await db.users.find_one({
                "_id": ObjectId(update["assigned_to"])
            })

            if not assignee:
                raise HTTPException(
                    status_code=404,
                    detail="Counsellor not found",
                )

        update["assigned_to_name"] = (
            assignee.get("name", "") if assignee else ""
        )

        activity_entries.append({
            "type": "assignment",
            "text": (
                f"Assigned to "
                f"{update.get('assigned_to_name') or 'unassigned'}"
            ),
            "at": now.isoformat(),
            "by": user.get("name", ""),
        })

    # ---------------------------------------------------------
    # Save update
    # ---------------------------------------------------------
    update["updated_at"] = now

    operation = {"$set": update}

    if activity_entries:
        operation["$push"] = {
            "activity": {
                "$each": activity_entries
            }
        }

    await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        operation,
    )

    lead = await db.leads.find_one({
        "_id": ObjectId(lead_id)
    })

    return serialize_lead(lead)

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

@api.post("/leads/{lead_id}/call-history")
async def add_call_history(
    lead_id: str,
    payload: CallHistoryIn,
    user: dict = Depends(get_current_user),
):
    q = {"_id": ObjectId(lead_id)}

    if user.get("role") != "admin":
        q["assigned_to"] = str(user["_id"])

    lead = await db.leads.find_one(q)

    if not lead:
        raise HTTPException(404, "Lead not found")

    if not payload.call_date.strip():
        raise HTTPException(400, "Call date is required")

    if not payload.call_time.strip():
        raise HTTPException(400, "Call time is required")

    if not payload.notes.strip():
        raise HTTPException(400, "Call notes are required")

    now = datetime.now(timezone.utc)

    entry = {
        "type": "call_history",
        "call_date": payload.call_date,
        "call_time": payload.call_time,
        "outcome": payload.outcome,
        "notes": payload.notes.strip(),
        "at": now.isoformat(),
        "by": user.get("name", ""),
        "by_user_id": str(user["_id"]),
    }

    await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        {
            "$push": {
                "call_history": entry,
                "activity": entry,
            },
            "$set": {"updated_at": now},
        },
    )

    return {"ok": True, "entry": entry}

@api.post("/leads/{lead_id}/shortlists")
async def add_shortlist(
    lead_id: str,
    payload: ShortlistIn,
    user: dict = Depends(get_current_user),
):
    q = {"_id": ObjectId(lead_id)}

    if user.get("role") != "admin" and not (
        user.get("permissions") or {}
    ).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])

    lead = await db.leads.find_one(q)

    if not lead:
        raise HTTPException(404, "Lead not found")

    required_fields = {
        "country": payload.country,
        "intake": payload.intake,
        "level_of_study": payload.level_of_study,
        "university_name": payload.university_name,
        "course": payload.course,
        "course_link": payload.course_link,
        "shortlist_status": payload.shortlist_status,
    }

    missing_fields = [
        field_name
        for field_name, value in required_fields.items()
        if not value or not value.strip()
    ]

    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please complete all compulsory shortlist fields: "
                + ", ".join(missing_fields)
            ),
        )

    existing_shortlists = lead.get("shortlists", [])

    if len(existing_shortlists) >= 10:
        raise HTTPException(
            status_code=400,
            detail="A maximum of 10 shortlist entries is allowed.",
        )

    now = datetime.now(timezone.utc)

    entry = {
        "id": str(uuid.uuid4()),
        "country": payload.country.strip(),
        "intake": payload.intake.strip(),
        "level_of_study": payload.level_of_study.strip(),
        "university_name": payload.university_name.strip(),
        "course": payload.course.strip(),
        "course_link": payload.course_link.strip(),
        "shortlist_status": payload.shortlist_status.strip(),
        "tuition_fee": (payload.tuition_fee or "").strip(),
        "application_fee": (payload.application_fee or "").strip(),
        "counsellor_remarks": (
            payload.counsellor_remarks or ""
        ).strip(),
        "saved_at": now.isoformat(),
        "saved_by": user.get("name", ""),
        "saved_by_user_id": str(user["_id"]),
    }

    activity_entry = {
        "type": "shortlist",
        "text": (
            f"Shortlist saved: "
            f"{entry['university_name']} · {entry['course']}"
        ),
        "at": now.isoformat(),
        "by": user.get("name", ""),
    }

    await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        {
            "$push": {
                "shortlists": entry,
                "activity": activity_entry,
            },
            "$set": {
                "updated_at": now,
            },
        },
    )

    return {
        "ok": True,
        "entry": entry,
    }

@api.patch("/leads/{lead_id}/shortlists/{shortlist_id}")
async def edit_shortlist(
    lead_id: str,
    shortlist_id: str,
    payload: ShortlistIn,
    user: dict = Depends(get_current_user),
):
    q = {
        "_id": ObjectId(lead_id),
        "shortlists.id": shortlist_id,
    }

    if user.get("role") != "admin" and not (
        user.get("permissions") or {}
    ).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])

    lead = await db.leads.find_one(q)

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Shortlist entry not found",
        )

    required_fields = {
        "country": payload.country,
        "intake": payload.intake,
        "level_of_study": payload.level_of_study,
        "university_name": payload.university_name,
        "course": payload.course,
        "course_link": payload.course_link,
        "shortlist_status": payload.shortlist_status,
    }

    missing_fields = [
        field_name
        for field_name, value in required_fields.items()
        if not value or not value.strip()
    ]

    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please complete all compulsory shortlist fields: "
                + ", ".join(missing_fields)
            ),
        )

    now = datetime.now(timezone.utc)

    updated_entry = {
        "id": shortlist_id,
        "country": payload.country.strip(),
        "intake": payload.intake.strip(),
        "level_of_study": payload.level_of_study.strip(),
        "university_name": payload.university_name.strip(),
        "course": payload.course.strip(),
        "course_link": payload.course_link.strip(),
        "shortlist_status": payload.shortlist_status.strip(),
        "tuition_fee": (payload.tuition_fee or "").strip(),
        "application_fee": (payload.application_fee or "").strip(),
        "counsellor_remarks": (
            payload.counsellor_remarks or ""
        ).strip(),
        "updated_at": now.isoformat(),
        "updated_by": user.get("name", ""),
        "updated_by_user_id": str(user["_id"]),
    }

    activity_entry = {
        "type": "shortlist_update",
        "text": (
            f"Shortlist updated: "
            f"{updated_entry['university_name']} · "
            f"{updated_entry['course']}"
        ),
        "at": now.isoformat(),
        "by": user.get("name", ""),
    }

    await db.leads.update_one(
        q,
        {
            "$set": {
                "shortlists.$": updated_entry,
                "updated_at": now,
            },
            "$push": {
                "activity": activity_entry,
            },
        },
    )

    return {
        "ok": True,
        "entry": updated_entry,
    }

@api.delete("/leads/{lead_id}/shortlists/{shortlist_id}")
async def delete_shortlist(
    lead_id: str,
    shortlist_id: str,
    user: dict = Depends(get_current_user),
):
    q = {"_id": ObjectId(lead_id)}

    if user.get("role") != "admin" and not (
        user.get("permissions") or {}
    ).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])

    lead = await db.leads.find_one(q)

    if not lead:
        raise HTTPException(404, "Lead not found")

    shortlist = next(
        (
            item
            for item in lead.get("shortlists", [])
            if item.get("id") == shortlist_id
        ),
        None,
    )

    if not shortlist:
        raise HTTPException(404, "Shortlist entry not found")

    now = datetime.now(timezone.utc)

    activity_entry = {
        "type": "shortlist_delete",
        "text": (
            f"Shortlist deleted: "
            f"{shortlist.get('university_name', '')} · "
            f"{shortlist.get('course', '')}"
        ),
        "at": now.isoformat(),
        "by": user.get("name", ""),
    }

    await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        {
            "$pull": {
                "shortlists": {
                    "id": shortlist_id
                }
            },
            "$push": {
                "activity": activity_entry
            },
            "$set": {
                "updated_at": now
            },
        },
    )

    return {"ok": True}

@api.post("/leads/{lead_id}/applications")
async def add_application_record(
    lead_id: str,
    payload: ApplicationRecordIn,
    user: dict = Depends(get_current_user),
):
    q = {"_id": ObjectId(lead_id)}

    if user.get("role") != "admin" and not (
        user.get("permissions") or {}
    ).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])

    lead = await db.leads.find_one(q)

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    required_fields = {
    "shortlist_id": payload.shortlist_id,
    "country": payload.country,
    "level_of_study": payload.level_of_study,
    "university": payload.university,
    "course": payload.course,
    "course_link": payload.course_link,
    "intake": payload.intake,
    "submission_datetime": payload.submission_datetime,
    "submitted_by": payload.submitted_by,
    "application_status": payload.application_status,
    "priority": payload.priority,
}

    missing_fields = [
        field_name
        for field_name, value in required_fields.items()
        if not str(value or "").strip()
    ]

    if missing_fields:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please complete all compulsory application fields: "
                + ", ".join(missing_fields)
            ),
        )

    now = datetime.now(timezone.utc)

    entry = {
    "id": str(uuid.uuid4()),
    "shortlist_id": payload.shortlist_id.strip(),
    "country": payload.country.strip(),
    "level_of_study": payload.level_of_study.strip(),
    "university": payload.university.strip(),
    "course": payload.course.strip(),
    "course_link": payload.course_link.strip(),
    "intake": payload.intake.strip(),
    "submission_datetime": payload.submission_datetime.strip(),
    "submitted_by": payload.submitted_by,
    "application_status": payload.application_status,
    "priority": payload.priority,
    "created_at": now.isoformat(),
    "created_by": user.get("name", ""),
    "created_by_user_id": str(user["_id"]),
}

    activity_entry = {
        "type": "application",
        "text": (
            f"Application saved: "
            f"{entry['university']} · {entry['course']} · "
            f"{entry['application_status']}"
        ),
        "at": now.isoformat(),
        "by": user.get("name", ""),
    }

    await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        {
            "$push": {
                "application_records": entry,
                "activity": activity_entry,
            },
            "$set": {
                "updated_at": now,
            },
        },
    )

    return {
        "ok": True,
        "entry": entry,
    }

@api.patch("/leads/{lead_id}/applications/{application_id}")
async def update_application_record(
    lead_id: str,
    application_id: str,
    payload: ApplicationRecordIn,
    user: dict = Depends(get_current_user),
):
    q = {"_id": ObjectId(lead_id)}

    if user.get("role") != "admin" and not (
        user.get("permissions") or {}
    ).get("see_all_leads"):
        q["assigned_to"] = str(user["_id"])

    lead = await db.leads.find_one(q)

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    application_records = lead.get(
        "application_records",
        [],
    )

    application_exists = any(
        application.get("id") == application_id
        for application in application_records
    )

    if not application_exists:
        raise HTTPException(
            status_code=404,
            detail="Application record not found",
        )

    updated_application = {
        "id": application_id,
        "shortlist_id": payload.shortlist_id.strip(),
        "country": payload.country.strip(),
        "level_of_study": payload.level_of_study.strip(),
        "university": payload.university.strip(),
        "course": payload.course.strip(),
        "course_link": payload.course_link.strip(),
        "intake": payload.intake.strip(),
        "submission_datetime": payload.submission_datetime.strip(),
        "submitted_by": payload.submitted_by,
        "application_status": payload.application_status,
        "priority": payload.priority,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user.get("name", ""),
    }

    await db.leads.update_one(
        {
            "_id": ObjectId(lead_id),
            "application_records.id": application_id,
        },
        {
            "$set": {
                "application_records.$": updated_application,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "ok": True,
        "entry": updated_application,
    }
    
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

# --- Revenue / Finance ------------------------------------------------------

class RevenueSaveIn(BaseModel):
    revenue: dict
    totals: dict


@api.get("/revenue/{lead_id}")
async def get_student_revenue(
    lead_id: str,
    admin: dict = Depends(require_admin),
):
    if not ObjectId.is_valid(lead_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid student ID",
        )

    lead = await db.leads.find_one(
        {"_id": ObjectId(lead_id)}
    )

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    record = await db.student_revenue.find_one(
        {"lead_id": lead_id}
    )

    if not record:
        return {
            "exists": False,
            "lead_id": lead_id,
            "student_name": lead.get("name", ""),
            "revenue": None,
            "totals": None,
        }

    return {
        "exists": True,
        "id": str(record["_id"]),
        "lead_id": record.get("lead_id"),
        "student_name": record.get(
            "student_name",
            lead.get("name", ""),
        ),
        "revenue": record.get("revenue", {}),
        "totals": record.get("totals", {}),
        "created_at": (
            record["created_at"].isoformat()
            if isinstance(
                record.get("created_at"),
                datetime,
            )
            else record.get("created_at")
        ),
        "updated_at": (
            record["updated_at"].isoformat()
            if isinstance(
                record.get("updated_at"),
                datetime,
            )
            else record.get("updated_at")
        ),
    }


@api.post("/revenue/{lead_id}")
async def save_student_revenue(
    lead_id: str,
    payload: RevenueSaveIn,
    admin: dict = Depends(require_admin),
):
    if not ObjectId.is_valid(lead_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid student ID",
        )

    lead = await db.leads.find_one(
        {"_id": ObjectId(lead_id)}
    )

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    now = datetime.now(timezone.utc)

    existing = await db.student_revenue.find_one(
        {"lead_id": lead_id}
    )

    update_data = {
        "lead_id": lead_id,
        "student_name": lead.get("name", ""),
        "student_email": lead.get("email", ""),
        "revenue": payload.revenue,
        "totals": payload.totals,
        "updated_at": now,
        "updated_by": str(admin["_id"]),
        "updated_by_name": admin.get("name", ""),
    }

    if not existing:
        update_data["created_at"] = now

    await db.student_revenue.update_one(
        {"lead_id": lead_id},
        {
            "$set": update_data,
        },
        upsert=True,
    )

    saved = await db.student_revenue.find_one(
        {"lead_id": lead_id}
    )

    return {
        "ok": True,
        "id": str(saved["_id"]),
        "lead_id": lead_id,
        "student_name": lead.get("name", ""),
        "revenue": saved.get("revenue", {}),
        "totals": saved.get("totals", {}),
    }


@api.get("/revenue")
async def revenue_ledger(
    admin: dict = Depends(require_admin),
):
    records = await db.student_revenue.find(
        {}
    ).sort(
        "updated_at",
        -1,
    ).to_list(2000)

    result = []

    for record in records:
        totals = record.get(
            "totals",
            {},
        )

        result.append(
            {
                "id": str(
                    record["_id"]
                ),

                "lead_id": record.get(
                    "lead_id"
                ),

                "student_name": record.get(
                    "student_name",
                    "",
                ),

                "student_email": record.get(
                    "student_email",
                    "",
                ),

                # Full saved finance information.
                # Revenue.jsx will use this to calculate
                # each ledger column.
                "revenue": record.get(
                    "revenue",
                    {},
                ),

                "expected_inr": totals.get(
                    "expected_inr",
                    0,
                ),

                "received_inr": totals.get(
                    "received_inr",
                    0,
                ),

                "balance_inr": totals.get(
                    "balance_inr",
                    0,
                ),

                "updated_at": (
                    record[
                        "updated_at"
                    ].isoformat()
                    if isinstance(
                        record.get(
                            "updated_at"
                        ),
                        datetime,
                    )
                    else record.get(
                        "updated_at"
                    )
                ),
            }
        )

    return result

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

# --- Google Calendar Integration -------------------------------------------

@api.get("/google/calendar/connect")
async def connect_google_calendar(
    user: dict = Depends(get_current_user),
):
    if user.get("role") not in ("counsellor", "team_lead"):
        raise HTTPException(
            status_code=403,
            detail=(
                "Google Calendar connection is available "
                "only for counsellors and team leads."
            ),
        )

    flow = build_google_calendar_flow()

    state = create_google_oauth_state(
        str(user["_id"])
    )

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )

    return {
        "authorization_url": authorization_url,
    }
    

@api.get("/google/calendar/callback")
async def google_calendar_callback(
    request: Request,
):
    error = request.query_params.get("error")

    if error:
        return RedirectResponse(
            url=(
                f"{FRONTEND_URL}/tasks"
                "?google_calendar=cancelled"
            )
        )

    state = request.query_params.get("state")
    code = request.query_params.get("code")

    if not state or not code:
        return RedirectResponse(
            url=(
                f"{FRONTEND_URL}/tasks"
                "?google_calendar=error"
            )
        )

    try:
        user_id = verify_google_oauth_state(state)

        flow = build_google_calendar_flow()

        flow.fetch_token(
            code=code,
        )

        credentials = flow.credentials

        refresh_token = credentials.refresh_token

        if not refresh_token:
            raise ValueError(
                "Google did not return a refresh token."
            )

        await db.users.update_one(
            {
                "_id": ObjectId(user_id),
                "role": {"$in": ["counsellor", "team_lead"]},
            },
            {
                "$set": {
                    "google_calendar_connected": True,
                    "google_calendar_refresh_token": refresh_token,
                    "google_calendar_connected_at": (
                        datetime.now(timezone.utc)
                    ),
                }
            },
        )

        return RedirectResponse(
            url=(
                f"{FRONTEND_URL}/tasks"
                "?google_calendar=connected"
            )
        )

    except Exception:
        logging.exception(
            "Google Calendar OAuth callback failed"
        )

        return RedirectResponse(
            url=(
                f"{FRONTEND_URL}/tasks"
                "?google_calendar=error"
            )
        )

@api.get("/google/calendar/status")
async def google_calendar_status(
    user: dict = Depends(get_current_user),
):
    if user.get("role") not in ("counsellor", "team_lead"):
        return {
            "available": False,
            "connected": False,
        }

    fresh_user = await db.users.find_one(
        {
            "_id": user["_id"],
        }
    )

    return {
        "available": True,
        "connected": bool(
            fresh_user
            and fresh_user.get(
                "google_calendar_connected",
                False,
            )
        ),
    }


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
async def create_task(
    payload: TaskIn,
    user: dict = Depends(get_current_user),
):
    lead = await db.leads.find_one(
        {
            "_id": ObjectId(
                payload.lead_id
            )
        }
    )

    if not lead:
        raise HTTPException(
            404,
            "Lead not found",
        )

    assignee_id = (
        payload.assigned_to
        or lead.get("assigned_to")
        or str(user["_id"])
    )

    assignee = None

    if assignee_id:
        assignee = await db.users.find_one(
            {
                "_id": ObjectId(
                    assignee_id
                )
            }
        )

    doc = {
        "lead_id": payload.lead_id,

        "lead_name": lead.get(
            "name",
            "",
        ),

        "title": payload.title,

        "description": (
            payload.description
            or ""
        ),

        "due_at": payload.due_at,

        "remind_at": (
            payload.remind_at
        ),

        "assigned_to": (
            assignee_id
        ),

        "assigned_to_name": (
            assignee.get(
                "name",
                "",
            )
            if assignee
            else ""
        ),

        "status": "pending",

        "created_at": (
            datetime.now(
                timezone.utc
            )
        ),

        "created_by": user.get(
            "name",
            "",
        ),

        # Initially false.
        # Changed to true after Google confirms creation.
        "google_calendar_synced": False,
    }

    result = await db.tasks.insert_one(
        doc
    )

    doc["_id"] = (
        result.inserted_id
    )

    # ---------------------------------------------------------
    # GOOGLE CALENDAR SYNC
    # ---------------------------------------------------------
    #
    # Only Counsellors and Team Leads have
    # personal Google Calendar connections.
    #
    # The logged-in person creating the CRM task
    # gets the event in THEIR connected calendar.
    # ---------------------------------------------------------

    if user.get("role") in (
        "counsellor",
        "team_lead",
    ):
        fresh_google_user = (
            await db.users.find_one(
                {
                    "_id": user["_id"],
                }
            )
        )

        if (
            fresh_google_user
            and fresh_google_user.get(
                "google_calendar_connected",
                False,
            )
            and fresh_google_user.get(
                "google_calendar_refresh_token"
            )
        ):
            google_event = (
                await create_google_calendar_event(
                    fresh_google_user,
                    doc,
                    lead,
                )
            )

            if google_event:
                google_event_id = (
                    google_event.get(
                        "id"
                    )
                )

                google_event_link = (
                    google_event.get(
                        "htmlLink"
                    )
                )

                google_update = {
                    "google_calendar_synced": True,
                    "google_calendar_event_id": (
                        google_event_id
                    ),
                    "google_calendar_event_link": (
                        google_event_link
                    ),
                    "google_calendar_synced_at": (
                        datetime.now(
                            timezone.utc
                        )
                    ),
                }

                await db.tasks.update_one(
                    {
                        "_id": doc["_id"],
                    },
                    {
                        "$set": (
                            google_update
                        )
                    },
                )

                doc.update(
                    google_update
                )

            else:
                logging.error(
                    "CRM task %s was created but "
                    "Google Calendar event creation failed.",
                    str(doc["_id"]),
                )

        else:
            logging.info(
                "CRM task created without Google sync "
                "because the user has no active "
                "Google Calendar connection."
            )

    # ---------------------------------------------------------
    # EXISTING CRM NOTIFICATION
    # ---------------------------------------------------------

    if (
        assignee_id
        and assignee_id
        != str(user["_id"])
    ):
        await _notify(
            assignee_id,
            "New Task Assigned",
            (
                f"{payload.title} · "
                f"{lead.get('name', '')}"
            ),
            link=(
                f"/lead/"
                f"{payload.lead_id}"
            ),
            kind="task",
        )

    # ---------------------------------------------------------
    # ADD TASK TO LEAD ACTIVITY
    # ---------------------------------------------------------

    await db.leads.update_one(
        {
            "_id": ObjectId(
                payload.lead_id
            )
        },
        {
            "$push": {
                "activity": {
                    "type": "task",

                    "text": (
                        f"Task: "
                        f"{payload.title} "
                        f"(due "
                        f"{payload.due_at})"
                    ),

                    "at": (
                        datetime.now(
                            timezone.utc
                        ).isoformat()
                    ),

                    "by": user.get(
                        "name",
                        "",
                    ),
                }
            },

            "$set": {
                "updated_at": (
                    datetime.now(
                        timezone.utc
                    )
                )
            },
        },
    )

    return serialize_task(
        doc
    )

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
def put_object(path: str, data: bytes, content_type: str):
    try:
        s3.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=path,
            Body=data,
            ContentType=content_type,
        )
        return {
            "path": path,
            "size": len(data),
        }
    except (BotoCoreError, ClientError) as e:
        raise HTTPException(500, f"Failed to upload to Cloudflare R2: {str(e)}")


def get_object(path: str):
    try:
        obj = s3.get_object(
            Bucket=R2_BUCKET_NAME,
            Key=path,
        )
        return (
            obj["Body"].read(),
            obj.get("ContentType", "application/octet-stream"),
        )
    except (BotoCoreError, ClientError) as e:
        raise HTTPException(404, f"Document not found: {str(e)}")

@api.post("/leads/{lead_id}/documents")
async def upload_doc(
    lead_id: str,
    doc_type: str = Query(...),
    meta: str = Query("{}"),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    lead = await db.leads.find_one({"_id": ObjectId(lead_id)})

    if not lead:
        raise HTTPException(404, "Lead not found")

    ext = (
        file.filename.rsplit(".", 1)[-1].lower()
        if "." in file.filename
        else "bin"
    )

    path = (
        f"{APP_NAME}/leads/{lead_id}/"
        f"{doc_type}/{uuid.uuid4()}.{ext}"
    )

    data = await file.read()

    result = put_object(
        path,
        data,
        file.content_type or "application/octet-stream",
    )

    import json as _json

    try:
        meta_obj = _json.loads(meta) if meta else {}
    except Exception:
        meta_obj = {}

    now = datetime.now(timezone.utc)

    existing_doc = await db.documents.find_one({
        "lead_id": lead_id,
        "doc_type": doc_type,
        "is_deleted": False,
    })

    document_data = {
        "lead_id": lead_id,
        "doc_type": doc_type,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", 0),
        "is_deleted": False,
        "meta": meta_obj,
        "uploaded_by": user.get("name", ""),
        "updated_at": now,
    }

    if existing_doc:
        await db.documents.update_one(
            {"_id": existing_doc["_id"]},
            {"$set": document_data},
        )

        document_id = existing_doc["_id"]

    else:
        document_data["created_at"] = now

        res = await db.documents.insert_one(document_data)

        document_id = res.inserted_id

    await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        {
            "$push": {
                "activity": {
                    "type": "document",
                    "text": f"Uploaded {doc_type}: {file.filename}",
                    "at": now.isoformat(),
                    "by": user.get("name", ""),
                }
            },
            "$set": {
                "updated_at": now,
            },
        },
    )

    return {
        "id": str(document_id),
        "doc_type": doc_type,
        "original_filename": file.filename,
        "size": result.get("size", 0),
        "meta": meta_obj,
    }
@api.get("/leads/{lead_id}/documents")
async def list_docs(lead_id: str, user: dict = Depends(get_current_user)):
    docs = await db.documents.find({"lead_id": lead_id, "is_deleted": False}).to_list(500)
    return [{"id": str(d["_id"]), "doc_type": d.get("doc_type"), "original_filename": d.get("original_filename"),
             "size": d.get("size", 0), "meta": d.get("meta", {}),
             "created_at": d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at")} for d in docs]

@api.put("/leads/{lead_id}/documents/{doc_type}/meta")
async def save_document_meta(
    lead_id: str,
    doc_type: str,
    payload: dict,
    user: dict = Depends(get_current_user),
):
    lead = await db.leads.find_one({"_id": ObjectId(lead_id)})

    if not lead:
        raise HTTPException(404, "Lead not found")

    now = datetime.now(timezone.utc)

    existing_doc = await db.documents.find_one({
        "lead_id": lead_id,
        "doc_type": doc_type,
        "is_deleted": False,
    })

    if existing_doc:
        await db.documents.update_one(
            {"_id": existing_doc["_id"]},
            {
                "$set": {
                    "meta": payload,
                    "updated_at": now,
                }
            },
        )

        return {
            "id": str(existing_doc["_id"]),
            "doc_type": doc_type,
            "original_filename": existing_doc.get("original_filename"),
            "size": existing_doc.get("size", 0),
            "meta": payload,
        }

    document = {
        "lead_id": lead_id,
        "doc_type": doc_type,
        "storage_path": None,
        "original_filename": None,
        "content_type": None,
        "size": 0,
        "is_deleted": False,
        "meta": payload,
        "uploaded_by": user.get("name", ""),
        "created_at": now,
        "updated_at": now,
    }

    result = await db.documents.insert_one(document)

    return {
        "id": str(result.inserted_id),
        "doc_type": doc_type,
        "original_filename": None,
        "size": 0,
        "meta": payload,
    }


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

# --- Lead Contact Data Audit ------------------------------------------------

@api.get("/admin/lead-contact-audit")
async def audit_lead_contacts(
    admin: dict = Depends(require_admin),
):
    leads = await db.leads.find(
        {}
    ).to_list(10000)

    email_map = {}
    phone_map = {}

    invalid_phones = []
    missing_contact = []

    for lead in leads:
        lead_id = str(lead["_id"])
        lead_name = lead.get("name", "")

        raw_email = (
            lead.get("email") or ""
        ).strip()

        raw_phone = (
            lead.get("phone") or ""
        ).strip()

        # ------------------------------------
        # Email
        # ------------------------------------

        normalized_email = normalize_email(
            raw_email
        )

        if normalized_email:
            email_map.setdefault(
                normalized_email,
                [],
            ).append(
                {
                    "lead_id": lead_id,
                    "lead_code": lead.get(
                        "lead_code",
                        "",
                    ),
                    "name": lead_name,
                    "email": raw_email,
                }
            )

        # ------------------------------------
        # Phone
        # ------------------------------------

        normalized_phone = normalize_phone(
            raw_phone
        )

        if normalized_phone:
            try:
                valid_phone = validate_phone_number(
                    raw_phone
                )

                phone_map.setdefault(
                    valid_phone,
                    [],
                ).append(
                    {
                        "lead_id": lead_id,
                        "lead_code": lead.get(
                            "lead_code",
                            "",
                        ),
                        "name": lead_name,
                        "phone": raw_phone,
                    }
                )

            except HTTPException as exc:
                invalid_phones.append(
                    {
                        "lead_id": lead_id,
                        "lead_code": lead.get(
                            "lead_code",
                            "",
                        ),
                        "name": lead_name,
                        "phone": raw_phone,
                        "reason": exc.detail,
                    }
                )

        # ------------------------------------
        # No email and no phone
        # ------------------------------------

        if (
            not normalized_email
            and not normalized_phone
        ):
            missing_contact.append(
                {
                    "lead_id": lead_id,
                    "lead_code": lead.get(
                        "lead_code",
                        "",
                    ),
                    "name": lead_name,
                }
            )

    duplicate_emails = [
        {
            "email": email,
            "leads": items,
        }
        for email, items
        in email_map.items()
        if len(items) > 1
    ]

    duplicate_phones = [
        {
            "phone": phone,
            "leads": items,
        }
        for phone, items
        in phone_map.items()
        if len(items) > 1
    ]

    return {
        "total_leads": len(leads),

        "duplicate_email_count":
            len(duplicate_emails),

        "duplicate_phone_count":
            len(duplicate_phones),

        "invalid_phone_count":
            len(invalid_phones),

        "missing_contact_count":
            len(missing_contact),

        "duplicate_emails":
            duplicate_emails,

        "duplicate_phones":
            duplicate_phones,

        "invalid_phones":
            invalid_phones,

        "missing_contact":
            missing_contact,
    }

    @api.get("/admin/lead-contact-normalization-preview")
    async def preview_lead_contact_normalization(
        admin: dict = Depends(require_admin),
    ):
        leads = await db.leads.find({}).to_list(10000)
    
        preview = []
        normalized_email_map = {}
        normalized_phone_map = {}
    
        for lead in leads:
            lead_id = str(lead["_id"])
            name = lead.get("name", "")
            lead_code = lead.get("lead_code", "")
    
            raw_email = (lead.get("email") or "").strip()
            raw_phone = (lead.get("phone") or "").strip()
    
            normalized_email = normalize_email(raw_email)
    
            compact_phone = normalize_phone(raw_phone)
    
            proposed_phone = ""
    
            if compact_phone:
                if compact_phone.startswith("+"):
                    proposed_phone = compact_phone
    
                elif (
                    compact_phone.isdigit()
                    and len(compact_phone) == 10
                ):
                    proposed_phone = "+91" + compact_phone
    
                else:
                    proposed_phone = compact_phone
    
            if normalized_email:
                normalized_email_map.setdefault(
                    normalized_email,
                    [],
                ).append(
                    {
                        "lead_id": lead_id,
                        "lead_code": lead_code,
                        "name": name,
                    }
                )
    
            if proposed_phone:
                normalized_phone_map.setdefault(
                    proposed_phone,
                    [],
                ).append(
                    {
                        "lead_id": lead_id,
                        "lead_code": lead_code,
                        "name": name,
                    }
                )
    
            preview.append(
                {
                    "lead_id": lead_id,
                    "lead_code": lead_code,
                    "name": name,
                    "current_email": raw_email,
                    "proposed_email_normalized": normalized_email,
                    "current_phone": raw_phone,
                    "proposed_phone_normalized": proposed_phone,
                }
            )
    
        duplicate_emails_after_normalization = [
            {
                "email": email,
                "leads": items,
            }
            for email, items
            in normalized_email_map.items()
            if len(items) > 1
        ]
    
        duplicate_phones_after_normalization = [
            {
                "phone": phone,
                "leads": items,
            }
            for phone, items
            in normalized_phone_map.items()
            if len(items) > 1
        ]
    
        return {
            "total_leads": len(leads),
            "preview": preview,
            "duplicate_emails_after_normalization":
                duplicate_emails_after_normalization,
            "duplicate_phones_after_normalization":
                duplicate_phones_after_normalization,
        }

# --- App wiring -------------------------------------------------------------


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://crm.rayvoyoverseas.com",
        "https://crm-3b52.vercel.app",
    ],
    allow_origin_regex=r"https://crm-3b52.*\.vercel\.app",
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api)



logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown():
    client.close()
