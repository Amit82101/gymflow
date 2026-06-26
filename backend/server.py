from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone, date
import bcrypt
import jwt
import qrcode
import io
import base64
import json as _json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config
JWT_SECRET = os.environ.get('JWT_SECRET', 'gymflow-dev-secret-change-in-prod-please')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_MINUTES = 60 * 24 * 7  # 7 days
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@gymflow.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

app = FastAPI(title="GymFlow Admin API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


# ============== HELPERS ==============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: str) -> str:
    payload = {
        "sub": subject,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_admin(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    user = await db.users.find_one({"email": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def calc_bmi(height_cm: Optional[float], weight_kg: Optional[float]) -> Optional[float]:
    if not height_cm or not weight_kg or height_cm <= 0:
        return None
    h_m = height_cm / 100
    return round(weight_kg / (h_m * h_m), 1)


def plan_duration_days(plan: str) -> int:
    return {"monthly": 30, "quarterly": 90, "yearly": 365}.get(plan, 30)


GYM_NAME = os.environ.get("GYM_NAME", "GymFlow")
DUPLICATE_WINDOW_MIN = int(os.environ.get("DUPLICATE_WINDOW_MIN", "10"))


def make_qr_payload(member_id: str, name: str, expiry: str) -> str:
    return _json.dumps({"v": 1, "g": GYM_NAME, "id": member_id, "n": name, "exp": expiry})


def make_qr_image_b64(payload: str) -> str:
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ============== MODELS ==============
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: dict


class MemberCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: str
    photo: Optional[str] = None  # base64
    plan: str = "monthly"  # monthly | quarterly | yearly
    fee_amount: float = 0
    join_date:str   # ISO date
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    
    address: Optional[str] = None
    


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    photo: Optional[str] = None
    plan: Optional[str] = None
    fee_amount: Optional[float] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
   
    is_active: Optional[bool] = None
    address: Optional[str] = None
    join_date: str # ISO date
    


class CheckInRequest(BaseModel):
    member_id: str


class QRScanRequest(BaseModel):
    qr_data: str  # raw scanned text (JSON payload)


class PaymentCreate(BaseModel):
    member_id: str
    amount: float
    plan: str  # monthly | quarterly | yearly
    method: Optional[str] = "cash"


# ============== AUTH ==============
@api.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not an admin account")
    token = create_access_token(user["email"])
    return TokenResponse(
        access_token=token,
        admin={"email": user["email"], "name": user.get("name", "Admin"), "role": "admin"},
    )


@api.get("/auth/me")
async def me(current=Depends(get_current_admin)):
    return current


# ============== MEMBERS ==============
@api.get("/members")
async def list_members(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),  # active | expiring | expired
    current=Depends(get_current_admin),
):
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    members = await db.members.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    now = datetime.now(timezone.utc).date()
    out = []
    for m in members:
        exp = m.get("expiry_date")
        exp_date = datetime.fromisoformat(exp).date() if exp else None
        days_left = (exp_date - now).days if exp_date else None
        if exp_date is None:
            st = "active"
        elif days_left < 0:
            st = "expired"
        elif days_left <= 7:
            st = "expiring"
        else:
            st = "active"
        m["status"] = st
        m["days_left"] = days_left
        if status_filter and st != status_filter:
            continue
        out.append(m)
    return out


@api.post("/members")
async def create_member(payload: MemberCreate, current=Depends(get_current_admin)):
    join_date = payload.join_date or datetime.now(timezone.utc).date().isoformat()
    join_d = datetime.fromisoformat(join_date).date()
    expiry_d = join_d + timedelta(days=plan_duration_days(payload.plan))
    member_id = str(uuid.uuid4())
    qr_payload = make_qr_payload(member_id, payload.name, expiry_d.isoformat())
    qr_image = make_qr_image_b64(qr_payload)
    member = {
        "id": member_id,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "photo": payload.photo,
        "plan": payload.plan,
        "fee_amount": payload.fee_amount,
        "fee_status": "pending",
        "join_date": join_d.isoformat(),
        "expiry_date": expiry_d.isoformat(),
        "height_cm": payload.height_cm,
        "weight_kg": payload.weight_kg,
        "bmi": calc_bmi(payload.height_cm, payload.weight_kg),
       
    
        "address": payload.address,
        
        "qr_payload": qr_payload,
        "qr_image": qr_image,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.members.insert_one(member.copy())
    return member


@api.get("/members/milestones")
async def member_milestones(window_days: int = 7, current=Depends(get_current_admin)):
    """Today and upcoming-N-days birthdays + membership anniversaries."""
    now = datetime.now(timezone.utc).date()
    members = await db.members.find({}, {"_id": 0}).to_list(2000)

    def days_until_anniversary(iso_date: str) -> Optional[int]:
        try:
            d = datetime.fromisoformat(iso_date).date()
        except Exception:
            return None
        this_year = d.replace(year=now.year)
        if this_year < now:
            this_year = d.replace(year=now.year + 1)
        return (this_year - now).days

    birthdays = []
    anniversaries = []
    for m in members:
        if m.get("birth_date"):
            d = days_until_anniversary(m["birth_date"])
            if d is not None and 0 <= d <= window_days:
                try:
                    bd = datetime.fromisoformat(m["birth_date"]).date()
                    age = now.year - bd.year
                except Exception:
                    age = None
                birthdays.append({
                    "member_id": m["id"],
                    "name": m["name"],
                    "phone": m.get("phone"),
                    "photo": m.get("photo"),
                    "days_until": d,
                    "date": m["birth_date"],
                    "age_turning": age,
                })
        if m.get("join_date"):
            try:
                jd = datetime.fromisoformat(m["join_date"]).date()
            except Exception:
                jd = None
            if jd and jd.year < now.year:
                d = days_until_anniversary(m["join_date"])
                if d is not None and 0 <= d <= window_days:
                    years = now.year - jd.year
                    anniversaries.append({
                        "member_id": m["id"],
                        "name": m["name"],
                        "phone": m.get("phone"),
                        "photo": m.get("photo"),
                        "days_until": d,
                        "date": m["join_date"],
                        "years": years,
                    })

    birthdays.sort(key=lambda x: x["days_until"])
    anniversaries.sort(key=lambda x: x["days_until"])
    return {"birthdays": birthdays, "anniversaries": anniversaries}


@api.get("/members/{member_id}")
async def get_member(member_id: str, current=Depends(get_current_admin)):
    m = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    return m


@api.put("/members/{member_id}")
async def update_member(
    member_id: str,
    payload: MemberUpdate,
    current=Depends(get_current_admin)
):
    existing = await db.members.find_one(
        {"id": member_id},
        {"_id": 0}
    )

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Member not found"
        )

    updates = {
        k: v
        for k, v in payload.model_dump(exclude_unset=True).items()
    }

    # Recalculate expiry if plan or join_date changes
    if "plan" in updates or "join_date" in updates:

        plan = updates.get(
            "plan",
            existing.get("plan", "monthly")
        )

        join_date = updates.get(
            "join_date",
            existing.get("join_date")
        )

        if join_date:
            join_d = datetime.fromisoformat(join_date).date()

            updates["expiry_date"] = (
                join_d +
                timedelta(days=plan_duration_days(plan))
            ).isoformat()

    # Recalculate BMI
    if "height_cm" in updates or "weight_kg" in updates:
        h = updates.get(
            "height_cm",
            existing.get("height_cm")
        )

        w = updates.get(
            "weight_kg",
            existing.get("weight_kg")
        )

        updates["bmi"] = calc_bmi(h, w)

    updates["updated_at"] = datetime.now(
        timezone.utc
    ).isoformat()

    await db.members.update_one(
        {"id": member_id},
        {"$set": updates}
    )

    m = await db.members.find_one(
        {"id": member_id},
        {"_id": 0}
    )

    return m


@api.delete("/members/{member_id}")
async def delete_member(member_id: str, current=Depends(get_current_admin)):
    res = await db.members.delete_one({"id": member_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.attendance.delete_many({"member_id": member_id})
    await db.payments.delete_many({"member_id": member_id})
    return {"ok": True}


@api.get("/members/{member_id}/qr")
async def member_qr(member_id: str, current=Depends(get_current_admin)):
    m = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    if not m.get("qr_image"):
        payload = make_qr_payload(m["id"], m["name"], m.get("expiry_date", ""))
        img = make_qr_image_b64(payload)
        await db.members.update_one({"id": member_id}, {"$set": {"qr_payload": payload, "qr_image": img}})
        m["qr_payload"] = payload
        m["qr_image"] = img
    return {
        "member_id": m["id"],
        "name": m["name"],
        "phone": m.get("phone"),
        "gym": GYM_NAME,
        "expiry_date": m.get("expiry_date"),
        "qr_payload": m["qr_payload"],
        "qr_image": m["qr_image"],
    }


# ============== ATTENDANCE ==============
@api.post("/attendance/scan")
async def scan_attendance(payload: QRScanRequest, current=Depends(get_current_admin)):
    # Parse QR payload — accept JSON or raw member id
    member_id: Optional[str] = None
    try:
        data = _json.loads(payload.qr_data)
        if isinstance(data, dict):
            member_id = data.get("id")
    except Exception:
        member_id = payload.qr_data.strip()

    if not member_id:
        raise HTTPException(status_code=400, detail="Invalid QR code")

    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()

    # Membership validity
    exp = member.get("expiry_date")
    exp_date = datetime.fromisoformat(exp).date() if exp else None
    expired = exp_date is not None and exp_date < now.date()
    if expired:
        return {
            "status": "expired",
            "message": "Membership Expired — attendance blocked",
            "member": member,
            "attendance": None,
        }

    # Duplicate scan window
    recent = await db.attendance.find(
        {"member_id": member_id, "date": today_str},
        {"_id": 0},
    ).sort("check_in_time", -1).to_list(5)
    if recent:
        last = recent[0]
        last_in = datetime.fromisoformat(last["check_in_time"])
        minutes_since = (now - last_in).total_seconds() / 60
        if not last.get("check_out_time") and minutes_since < DUPLICATE_WINDOW_MIN:
            return {
                "status": "duplicate",
                "message": f"Already checked in {int(minutes_since)} min ago",
                "member": member,
                "attendance": last,
            }
        # Auto check-out if still inside and >= duplicate window
        if not last.get("check_out_time"):
            await db.attendance.update_one(
                {"id": last["id"]},
                {"$set": {"check_out_time": now.isoformat()}},
            )
            updated = await db.attendance.find_one({"id": last["id"]}, {"_id": 0})
            return {
                "status": "checked_out",
                "message": "Check-out recorded. See you next time!",
                "member": member,
                "attendance": updated,
            }

    record = {
        "id": str(uuid.uuid4()),
        "member_id": member_id,
        "member_name": member["name"],
        "date": today_str,
        "check_in_time": now.isoformat(),
        "check_out_time": None,
    }
    await db.attendance.insert_one(record.copy())
    return {
        "status": "checked_in",
        "message": "Attendance marked successfully",
        "member": member,
        "attendance": record,
    }

@api.post("/attendance/check-in")
async def check_in(payload: CheckInRequest, current=Depends(get_current_admin)):
    member = await db.members.find_one({"id": payload.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    today_str = datetime.now(timezone.utc).date().isoformat()
    existing = await db.attendance.find_one(
        {"member_id": payload.member_id, "date": today_str, "check_out_time": None}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Member already checked in")
    record = {
        "id": str(uuid.uuid4()),
        "member_id": payload.member_id,
        "member_name": member["name"],
        "date": today_str,
        "check_in_time": datetime.now(timezone.utc).isoformat(),
        "check_out_time": None,
    }
    await db.attendance.insert_one(record.copy())
    return record


@api.post("/attendance/check-out")
async def check_out(payload: CheckInRequest, current=Depends(get_current_admin)):
    today_str = datetime.now(timezone.utc).date().isoformat()
    existing = await db.attendance.find_one(
        {"member_id": payload.member_id, "date": today_str, "check_out_time": None}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="No active check-in found")
    await db.attendance.update_one(
        {"id": existing["id"]},
        {"$set": {"check_out_time": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.attendance.find_one({"id": existing["id"]}, {"_id": 0})


@api.get("/attendance")
async def list_attendance(
    date_filter: Optional[str] = Query(None, alias="date"),
    member_id: Optional[str] = None,
    current=Depends(get_current_admin),
):
    query: dict = {}
    if date_filter:
        query["date"] = date_filter
    if member_id:
        query["member_id"] = member_id
    records = await db.attendance.find(query, {"_id": 0}).sort("check_in_time", -1).to_list(2000)
    return records


@api.get("/attendance/today")
async def today_attendance(current=Depends(get_current_admin)):
    today_str = datetime.now(timezone.utc).date().isoformat()
    records = await db.attendance.find({"date": today_str}, {"_id": 0}).sort("check_in_time", -1).to_list(1000)
    return records


# ============== PAYMENTS / FEES ==============
@api.post("/payments")
async def create_payment(payload: PaymentCreate, current=Depends(get_current_admin)):
    member = await db.members.find_one({"id": payload.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    now = datetime.now(timezone.utc).date()
    period_end = now + timedelta(days=plan_duration_days(payload.plan))
    receipt_no = f"GF-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    payment = {
        "id": str(uuid.uuid4()),
        "member_id": payload.member_id,
        "member_name": member["name"],
        "amount": payload.amount,
        "plan": payload.plan,
        "method": payload.method or "cash",
        "receipt_no": receipt_no,
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "period_start": now.isoformat(),
        "period_end": period_end.isoformat(),
    }
    await db.payments.insert_one(payment.copy())
    # Update member fee status & extend expiry from current expiry or today
    current_expiry = datetime.fromisoformat(member["expiry_date"]).date() if member.get("expiry_date") else now
    base = current_expiry if current_expiry > now else now
    new_expiry = base + timedelta(days=plan_duration_days(payload.plan))
    await db.members.update_one(
        {"id": payload.member_id},
        {"$set": {
            "fee_status": "paid",
            "expiry_date": new_expiry.isoformat(),
            "plan": payload.plan,
            "fee_amount": payload.amount,
        }},
    )
    return payment


@api.get("/payments")
async def list_payments(member_id: Optional[str] = None, current=Depends(get_current_admin)):
    query: dict = {}
    if member_id:
        query["member_id"] = member_id
    payments = await db.payments.find(query, {"_id": 0}).sort("paid_at", -1).to_list(2000)
    return payments


@api.get("/payments/pending")
async def pending_fees(current=Depends(get_current_admin)):
    members = await db.members.find({}, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc).date()
    pending = []
    for m in members:
        exp = m.get("expiry_date")
        if not exp:
            continue
        exp_d = datetime.fromisoformat(exp).date()
        days_left = (exp_d - now).days
        if m.get("fee_status") == "pending" or days_left < 0:
            m["days_overdue"] = -days_left if days_left < 0 else 0
            m["days_left"] = days_left
            pending.append(m)
    return pending


@api.get("/payments/{payment_id}")
async def get_payment(payment_id: str, current=Depends(get_current_admin)):
    p = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    return p


# ============== DASHBOARD ==============
@api.get("/dashboard/stats")
async def dashboard_stats(current=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).date()
    today_str = now.isoformat()
    month_start = now.replace(day=1).isoformat()

    members = await db.members.find({}, {"_id": 0}).to_list(2000)
    active = 0
    expiring = 0
    pending_fee = 0
    for m in members:
        exp = m.get("expiry_date")
        if not exp:
            continue
        exp_d = datetime.fromisoformat(exp).date()
        days_left = (exp_d - now).days
        if days_left >= 0:
            active += 1
        if 0 <= days_left <= 7:
            expiring += 1
        if m.get("fee_status") != "paid" or days_left < 0:
            pending_fee += 1

    today_attendance = await db.attendance.count_documents({"date": today_str})

    payments = await db.payments.find(
        {"paid_at": {"$gte": month_start}}, {"_id": 0, "amount": 1}
    ).to_list(5000)
    monthly_revenue = sum(p.get("amount", 0) for p in payments)

    return {
        "total_members": len(members),
        "active_members": active,
        "today_attendance": today_attendance,
        "expiring_soon": expiring,
        "pending_fees": pending_fee,
        "monthly_revenue": round(monthly_revenue, 2),
    }


@api.get("/analytics/revenue")
async def analytics_revenue(months: int = 6, current=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).date()
    buckets: List[dict] = []
    for i in range(months - 1, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1)
        else:
            end = date(year, month + 1, 1)
        payments = await db.payments.find(
            {"paid_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
            {"_id": 0, "amount": 1},
        ).to_list(5000)
        total = sum(p.get("amount", 0) for p in payments)
        buckets.append({
            "label": start.strftime("%b"),
            "value": round(total, 2),
        })
    return buckets


@api.get("/analytics/attendance")
async def analytics_attendance(days: int = 7, current=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).date()
    buckets = []
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        count = await db.attendance.count_documents({"date": d.isoformat()})
        buckets.append({"label": d.strftime("%a"), "value": count, "date": d.isoformat()})
    return buckets


@api.get("/analytics/member-growth")
async def analytics_member_growth(months: int = 6, current=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).date()
    buckets = []
    for i in range(months - 1, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        if month == 12:
            end = date(year + 1, 1, 1)
        else:
            end = date(year, month + 1, 1)
        count = await db.members.count_documents({"join_date": {"$lt": end.isoformat()}})
        start_label = date(year, month, 1).strftime("%b")
        buckets.append({"label": start_label, "value": count})
    return buckets


@api.get("/analytics/peak-hours")
async def analytics_peak_hours(days: int = 7, current=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).date()
    since = (now - timedelta(days=days - 1)).isoformat()
    records = await db.attendance.find(
        {"date": {"$gte": since}}, {"_id": 0, "check_in_time": 1}
    ).to_list(5000)
    hours = [0] * 24
    for r in records:
        try:
            t = datetime.fromisoformat(r["check_in_time"])
            hours[t.hour] += 1
        except Exception:
            pass
    return [{"label": f"{h:02d}", "value": v} for h, v in enumerate(hours)]


@api.get("/analytics/absent-members")
async def analytics_absent(days: int = 14, current=Depends(get_current_admin)):
    now = datetime.now(timezone.utc).date()
    since = (now - timedelta(days=days)).isoformat()
    members = await db.members.find({}, {"_id": 0}).to_list(2000)
    out = []
    for m in members:
        last = await db.attendance.find_one(
            {"member_id": m["id"]}, {"_id": 0}, sort=[("check_in_time", -1)]
        )
        last_date = last["date"] if last else None
        if not last or last_date < since:
            out.append({
                "id": m["id"],
                "name": m["name"],
                "phone": m.get("phone"),
                "last_visit": last_date,
                "days_absent": (now - datetime.fromisoformat(last_date).date()).days if last_date else None,
            })
    out.sort(key=lambda x: (x["days_absent"] is None, -(x["days_absent"] or 0)))
    return out[:50]



# ============== HEALTH ==============
@api.get("/")
async def root():
    return {"service": "GymFlow Admin API", "ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "name": "Admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user: {ADMIN_EMAIL}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
