"""Seed demo data: a few members, attendance, and one payment."""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")
mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = mongo[os.environ["DB_NAME"]]


async def run():
    if await db.members.count_documents({}) > 0:
        print("Demo members already exist, skipping.")
        return
    now = datetime.now(timezone.utc)
    today = now.date()

    demo = [
        {"name": "Rahul Sharma", "phone": "+91 98765 43210", "plan": "monthly", "fee": 1500, "joined_days_ago": 5, "height_cm": 178, "weight_kg": 76},
        {"name": "Priya Patel", "phone": "+91 98321 11122", "plan": "quarterly", "fee": 4000, "joined_days_ago": 35, "height_cm": 165, "weight_kg": 58},
        {"name": "Arjun Mehta", "phone": "+91 99000 22334", "plan": "yearly", "fee": 14000, "joined_days_ago": 200, "height_cm": 181, "weight_kg": 82},
        {"name": "Sneha Iyer", "phone": "+91 90123 45678", "plan": "monthly", "fee": 1500, "joined_days_ago": 28, "height_cm": 160, "weight_kg": 55},
        {"name": "Vikram Singh", "phone": "+91 88765 11223", "plan": "monthly", "fee": 1500, "joined_days_ago": 35, "height_cm": 175, "weight_kg": 88},  # expired
        {"name": "Ananya Rao", "phone": "+91 91111 22233", "plan": "monthly", "fee": 1500, "joined_days_ago": 25, "height_cm": 168, "weight_kg": 62},  # expiring
    ]
    plan_days = {"monthly": 30, "quarterly": 90, "yearly": 365}

    member_ids = []
    for d in demo:
        join_d = today - timedelta(days=d["joined_days_ago"])
        exp_d = join_d + timedelta(days=plan_days[d["plan"]])
        bmi = round(d["weight_kg"] / ((d["height_cm"] / 100) ** 2), 1)
        mid = str(uuid.uuid4())
        member_ids.append((mid, d["name"], exp_d))
        await db.members.insert_one({
            "id": mid,
            "name": d["name"],
            "phone": d["phone"],
            "email": None,
            "photo": None,
            "plan": d["plan"],
            "fee_amount": d["fee"],
            "fee_status": "paid" if d["joined_days_ago"] < plan_days[d["plan"]] - 7 else "pending",
            "join_date": join_d.isoformat(),
            "expiry_date": exp_d.isoformat(),
            "height_cm": d["height_cm"],
            "weight_kg": d["weight_kg"],
            "bmi": bmi,
            "notes": None,
            "is_active": True,
            "created_at": now.isoformat(),
        })

    # Sample attendance — today 3 check-ins (1 still in)
    for i, (mid, name, _) in enumerate(member_ids[:3]):
        ci = now - timedelta(hours=3 - i)
        co = None if i == 0 else now - timedelta(hours=2 - i, minutes=15)
        await db.attendance.insert_one({
            "id": str(uuid.uuid4()),
            "member_id": mid,
            "member_name": name,
            "date": today.isoformat(),
            "check_in_time": ci.isoformat(),
            "check_out_time": co.isoformat() if co else None,
        })

    # Past attendance for chart
    for d in range(1, 7):
        for j in range(min(5, d + 1)):
            mid, name, _ = member_ids[j % len(member_ids)]
            day = today - timedelta(days=d)
            ci = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=7 + j)
            await db.attendance.insert_one({
                "id": str(uuid.uuid4()),
                "member_id": mid,
                "member_name": name,
                "date": day.isoformat(),
                "check_in_time": ci.isoformat(),
                "check_out_time": (ci + timedelta(hours=1)).isoformat(),
            })

    # One sample payment
    mid, name, _ = member_ids[0]
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "member_id": mid,
        "member_name": name,
        "amount": 1500,
        "plan": "monthly",
        "method": "cash",
        "receipt_no": f"GF-{now.strftime('%Y%m%d')}-DEMO01",
        "paid_at": now.isoformat(),
        "period_start": today.isoformat(),
        "period_end": (today + timedelta(days=30)).isoformat(),
    })

    print(f"Seeded {len(demo)} members, attendance, and 1 payment.")


asyncio.run(run())
