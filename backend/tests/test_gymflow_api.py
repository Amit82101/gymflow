"""GymFlow backend API tests - covers auth, members, attendance, payments, dashboard, analytics."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://gymflow-admin-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@gymflow.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and data.get("admin", {}).get("role") == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============== AUTH ==============
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_login_bad_creds(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"}, timeout=10)
        assert r.status_code == 401

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"}, timeout=10)
        assert r.status_code == 401

    def test_me_ok(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("email") == ADMIN_EMAIL
        assert body.get("role") == "admin"


# ============== MEMBERS ==============
class TestMembers:
    created_id = None

    def test_create_member(self, auth_headers):
        payload = {
            "name": "TEST_John Doe",
            "phone": "+15551112233",
            "email": "test_johndoe@example.com",
            "plan": "monthly",
            "fee_amount": 1500,
            "height_cm": 180,
            "weight_kg": 80,
        }
        r = requests.post(f"{API}/members", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["name"] == payload["name"]
        assert m["plan"] == "monthly"
        # BMI = 80 / 1.8^2 = 24.7
        assert m["bmi"] == 24.7
        # expiry_date should be join_date + 30 days
        join = datetime.fromisoformat(m["join_date"]).date()
        exp = datetime.fromisoformat(m["expiry_date"]).date()
        assert (exp - join).days == 30
        assert m["fee_status"] == "pending"
        TestMembers.created_id = m["id"]

    def test_get_member(self, auth_headers):
        assert TestMembers.created_id
        r = requests.get(f"{API}/members/{TestMembers.created_id}", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == TestMembers.created_id

    def test_list_members_search(self, auth_headers):
        r = requests.get(f"{API}/members", headers=auth_headers, params={"search": "TEST_John"}, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert any(m["id"] == TestMembers.created_id for m in arr)
        for m in arr:
            assert "status" in m and "days_left" in m

    def test_list_members_status_filter(self, auth_headers):
        r = requests.get(f"{API}/members", headers=auth_headers, params={"status": "active"}, timeout=10)
        assert r.status_code == 200
        for m in r.json():
            assert m["status"] == "active"

    def test_update_member_plan_extends_expiry(self, auth_headers):
        r = requests.put(
            f"{API}/members/{TestMembers.created_id}",
            json={"plan": "yearly", "weight_kg": 82},
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200
        m = r.json()
        assert m["plan"] == "yearly"
        join = datetime.fromisoformat(m["join_date"]).date()
        exp = datetime.fromisoformat(m["expiry_date"]).date()
        assert (exp - join).days == 365

    def test_member_unauthorized(self):
        r = requests.get(f"{API}/members", timeout=10)
        assert r.status_code == 401


# ============== ATTENDANCE ==============
class TestAttendance:
    def test_checkin_checkout_flow(self, auth_headers):
        assert TestMembers.created_id
        # ensure no existing open record for test member
        r = requests.post(f"{API}/attendance/check-in", json={"member_id": TestMembers.created_id}, headers=auth_headers, timeout=10)
        # Could be 400 if already checked in from prior test run, accept 200 or 400
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            rec = r.json()
            assert rec["member_id"] == TestMembers.created_id
            assert rec["check_out_time"] is None

            # double check-in must fail
            r2 = requests.post(f"{API}/attendance/check-in", json={"member_id": TestMembers.created_id}, headers=auth_headers, timeout=10)
            assert r2.status_code == 400

            r3 = requests.post(f"{API}/attendance/check-out", json={"member_id": TestMembers.created_id}, headers=auth_headers, timeout=10)
            assert r3.status_code == 200
            assert r3.json()["check_out_time"] is not None

    def test_today(self, auth_headers):
        r = requests.get(f"{API}/attendance/today", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_checkout_no_record(self, auth_headers):
        # Use a random non-existent member id - check-out should 404
        r = requests.post(f"{API}/attendance/check-out", json={"member_id": "non-existent-id-xyz"}, headers=auth_headers, timeout=10)
        assert r.status_code == 404


# ============== PAYMENTS ==============
class TestPayments:
    receipt_id = None

    def test_create_payment_extends_expiry(self, auth_headers):
        assert TestMembers.created_id
        # Get current expiry
        m_before = requests.get(f"{API}/members/{TestMembers.created_id}", headers=auth_headers, timeout=10).json()
        prev_exp = datetime.fromisoformat(m_before["expiry_date"]).date()

        r = requests.post(
            f"{API}/payments",
            json={"member_id": TestMembers.created_id, "amount": 1500, "plan": "monthly", "method": "cash"},
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["receipt_no"].startswith("GF-")
        assert p["amount"] == 1500
        TestPayments.receipt_id = p["id"]

        m_after = requests.get(f"{API}/members/{TestMembers.created_id}", headers=auth_headers, timeout=10).json()
        new_exp = datetime.fromisoformat(m_after["expiry_date"]).date()
        # Should extend by 30 days from prev expiry (since prev > today)
        assert (new_exp - prev_exp).days == 30
        assert m_after["fee_status"] == "paid"

    def test_list_payments(self, auth_headers):
        r = requests.get(f"{API}/payments", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert any(p["id"] == TestPayments.receipt_id for p in arr)

    def test_get_payment_receipt(self, auth_headers):
        r = requests.get(f"{API}/payments/{TestPayments.receipt_id}", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["receipt_no"].startswith("GF-")

    def test_pending_fees(self, auth_headers):
        r = requests.get(f"{API}/payments/pending", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ============== DASHBOARD & ANALYTICS ==============
class TestDashboard:
    def test_stats(self, auth_headers):
        r = requests.get(f"{API}/dashboard/stats", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        s = r.json()
        for k in ["total_members", "active_members", "today_attendance", "expiring_soon", "pending_fees", "monthly_revenue"]:
            assert k in s, f"missing key {k}"

    def test_analytics_revenue(self, auth_headers):
        r = requests.get(f"{API}/analytics/revenue?months=6", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 6
        for b in arr:
            assert "label" in b and "value" in b

    def test_analytics_attendance(self, auth_headers):
        r = requests.get(f"{API}/analytics/attendance?days=7", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 7

    def test_analytics_member_growth(self, auth_headers):
        r = requests.get(f"{API}/analytics/member-growth?months=6", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert len(r.json()) == 6


# ============== CLEANUP ==============
class TestZCleanup:
    def test_delete_member(self, auth_headers):
        if not TestMembers.created_id:
            pytest.skip("nothing to clean")
        r = requests.delete(f"{API}/members/{TestMembers.created_id}", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        # verify gone
        r2 = requests.get(f"{API}/members/{TestMembers.created_id}", headers=auth_headers, timeout=10)
        assert r2.status_code == 404
