"""GymFlow iteration 3 tests: milestones (birthdays + membership anniversaries) + birth_date on member."""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://gymflow-admin-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@gymflow.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def auth_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _create_member(headers, name, birth_date=None, join_date=None, plan="monthly", fee_amount=1500):
    payload = {
        "name": f"TEST_{name}",
        "phone": f"+1555{int(time.time()*1000) % 10000000:07d}",
        "plan": plan,
        "fee_amount": fee_amount,
    }
    if birth_date:
        payload["birth_date"] = birth_date
    if join_date:
        payload["join_date"] = join_date
    r = requests.post(f"{API}/members", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _delete(headers, mid):
    try:
        requests.delete(f"{API}/members/{mid}", headers=headers, timeout=10)
    except Exception:
        pass


class TestMilestonesAuth:
    def test_milestones_requires_auth(self):
        r = requests.get(f"{API}/members/milestones", timeout=10)
        assert r.status_code == 401

    def test_milestones_route_order_not_404(self, auth_headers):
        """Ensure /members/milestones is NOT caught by /members/{member_id}."""
        r = requests.get(f"{API}/members/milestones", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "birthdays" in body and "anniversaries" in body
        assert isinstance(body["birthdays"], list)
        assert isinstance(body["anniversaries"], list)


class TestBirthDatePersistence:
    created: list = []

    def test_create_with_birth_date(self, auth_headers):
        # Use a birth date far in past so won't pollute the window
        m = _create_member(auth_headers, "BIRTH1", birth_date="1990-06-15")
        TestBirthDatePersistence.created.append(m["id"])
        assert m.get("birth_date") == "1990-06-15"
        # GET verifies persistence
        r = requests.get(f"{API}/members/{m['id']}", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json().get("birth_date") == "1990-06-15"

    def test_update_birth_date(self, auth_headers):
        assert TestBirthDatePersistence.created
        mid = TestBirthDatePersistence.created[0]
        r = requests.put(f"{API}/members/{mid}", json={"birth_date": "1991-07-20"}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        # GET verifies update
        r2 = requests.get(f"{API}/members/{mid}", headers=auth_headers, timeout=10)
        assert r2.status_code == 200
        assert r2.json().get("birth_date") == "1991-07-20"

    @classmethod
    def teardown_class(cls):
        try:
            r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
            tok = r.json()["access_token"]
            h = {"Authorization": f"Bearer {tok}"}
            for mid in cls.created:
                _delete(h, mid)
        except Exception:
            pass


class TestMilestonesContent:
    today_id: str = ""
    upcoming_id: str = ""
    anniv_id: str = ""
    far_id: str = ""

    def test_setup_birthday_today(self, auth_headers):
        today = datetime.now(timezone.utc).date()
        bd = today.replace(year=1995).isoformat()  # turning today
        m = _create_member(auth_headers, "BDAYTODAY", birth_date=bd)
        TestMilestonesContent.today_id = m["id"]

    def test_setup_birthday_in_3_days(self, auth_headers):
        today = datetime.now(timezone.utc).date()
        future = today + timedelta(days=3)
        bd = future.replace(year=2000).isoformat()
        m = _create_member(auth_headers, "BDAY3D", birth_date=bd)
        TestMilestonesContent.upcoming_id = m["id"]

    def test_setup_anniversary_in_2_days(self, auth_headers):
        # join_date last year + 2 days from today this year
        today = datetime.now(timezone.utc).date()
        target = today + timedelta(days=2)
        # use last year for join_date so years >=1
        jd = target.replace(year=today.year - 1).isoformat()
        m = _create_member(auth_headers, "ANNIV2D", join_date=jd)
        TestMilestonesContent.anniv_id = m["id"]

    def test_setup_anniversary_same_year_excluded(self, auth_headers):
        """Member that joined this year should NOT show in anniversaries."""
        today = datetime.now(timezone.utc).date()
        target = today + timedelta(days=1)
        jd = target.replace(year=today.year).isoformat() if target.year == today.year else target.isoformat()
        m = _create_member(auth_headers, "ANNIVSAME", join_date=jd)
        TestMilestonesContent.far_id = m["id"]

    def test_milestones_response_structure(self, auth_headers):
        r = requests.get(f"{API}/members/milestones", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "birthdays" in body and "anniversaries" in body

        # Birthday-today entry
        today_entry = next((b for b in body["birthdays"] if b["member_id"] == TestMilestonesContent.today_id), None)
        assert today_entry is not None, f"today's birthday missing. body={body}"
        for key in ["member_id", "name", "phone", "photo", "days_until", "date", "age_turning"]:
            assert key in today_entry, f"missing {key}"
        assert today_entry["days_until"] == 0
        # age_turning should be current_year - 1995
        assert today_entry["age_turning"] == datetime.now(timezone.utc).year - 1995

        # 3-day birthday
        up = next((b for b in body["birthdays"] if b["member_id"] == TestMilestonesContent.upcoming_id), None)
        assert up is not None
        assert up["days_until"] == 3
        assert up["age_turning"] == datetime.now(timezone.utc).year - 2000

        # Anniversary 2 days
        an = next((a for a in body["anniversaries"] if a["member_id"] == TestMilestonesContent.anniv_id), None)
        assert an is not None
        assert an["days_until"] == 2
        for key in ["member_id", "name", "phone", "photo", "days_until", "date", "years"]:
            assert key in an
        assert an["years"] >= 1

        # Same-year anniversary should be excluded
        excluded = next((a for a in body["anniversaries"] if a["member_id"] == TestMilestonesContent.far_id), None)
        assert excluded is None, "Members joined this year must NOT appear in anniversaries"

    def test_milestones_sorted(self, auth_headers):
        r = requests.get(f"{API}/members/milestones", headers=auth_headers, timeout=15)
        body = r.json()
        bdays = [b["days_until"] for b in body["birthdays"]]
        assert bdays == sorted(bdays)
        anns = [a["days_until"] for a in body["anniversaries"]]
        assert anns == sorted(anns)

    def test_milestones_days_until_in_window(self, auth_headers):
        r = requests.get(f"{API}/members/milestones", headers=auth_headers, timeout=15)
        body = r.json()
        for b in body["birthdays"]:
            assert 0 <= b["days_until"] <= 7
        for a in body["anniversaries"]:
            assert 0 <= a["days_until"] <= 7

    @classmethod
    def teardown_class(cls):
        try:
            r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
            tok = r.json()["access_token"]
            h = {"Authorization": f"Bearer {tok}"}
            for mid in (cls.today_id, cls.upcoming_id, cls.anniv_id, cls.far_id):
                if mid:
                    _delete(h, mid)
        except Exception:
            pass
