"""GymFlow backend tests for iteration 2: QR generation, /attendance/scan, peak-hours, absent-members."""
import os
import json
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


# Helper: create a fresh test member; returns dict
def _create_member(auth_headers, name_suffix="QR", plan="monthly", join_date=None, address=None, emergency=None):
    payload = {
        "name": f"TEST_{name_suffix}",
        "phone": f"+1555{int(time.time()*1000) % 10000000:07d}",
        "plan": plan,
        "fee_amount": 1500,
    }
    if join_date:
        payload["join_date"] = join_date
    if address:
        payload["address"] = address
    if emergency:
        payload["emergency_contact"] = emergency
    r = requests.post(f"{API}/members", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ============== QR ON CREATE ==============
class TestMemberQROnCreate:
    created_ids: list = []

    def test_create_member_returns_qr_fields(self, auth_headers):
        m = _create_member(auth_headers, "QRCREATE", address="123 Test St", emergency="Jane 9999999999")
        TestMemberQROnCreate.created_ids.append(m["id"])
        assert "qr_payload" in m and "qr_image" in m
        assert m["qr_image"].startswith("data:image/png;base64,")
        # qr_payload should be JSON containing id, name, exp
        payload_json = json.loads(m["qr_payload"])
        assert payload_json["id"] == m["id"]
        assert payload_json["n"] == m["name"]
        assert payload_json["exp"] == m["expiry_date"]
        # new optional fields persisted
        assert m["address"] == "123 Test St"
        assert m["emergency_contact"] == "Jane 9999999999"

    def test_get_member_qr_endpoint(self, auth_headers):
        assert TestMemberQROnCreate.created_ids
        mid = TestMemberQROnCreate.created_ids[0]
        r = requests.get(f"{API}/members/{mid}/qr", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ["member_id", "name", "gym", "expiry_date", "qr_payload", "qr_image"]:
            assert k in body, f"missing key {k}"
        assert body["member_id"] == mid
        assert body["qr_image"].startswith("data:image/png;base64,")

    def test_get_member_qr_lazy_generates(self, auth_headers):
        """Verify endpoint still returns qr_image even if we wipe it from DB (lazy regen).
        Simulated by creating a member and clearing qr via update is not possible (no API),
        so we just verify the endpoint returns same fields for a brand-new member created above."""
        # Create another member and ensure QR is returned
        m = _create_member(auth_headers, "QRLAZY")
        TestMemberQROnCreate.created_ids.append(m["id"])
        r = requests.get(f"{API}/members/{m['id']}/qr", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["qr_image"].startswith("data:image/png;base64,")

    def test_get_member_qr_not_found(self, auth_headers):
        r = requests.get(f"{API}/members/not-a-real-id/qr", headers=auth_headers, timeout=10)
        assert r.status_code == 404

    @classmethod
    def teardown_class(cls):
        # Cleanup
        try:
            r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
            tok = r.json()["access_token"]
            h = {"Authorization": f"Bearer {tok}"}
            for mid in cls.created_ids:
                requests.delete(f"{API}/members/{mid}", headers=h, timeout=10)
        except Exception:
            pass


# ============== ATTENDANCE SCAN ==============
class TestAttendanceScan:
    member_id: str = ""
    expired_id: str = ""

    def test_setup_member(self, auth_headers):
        m = _create_member(auth_headers, "SCAN")
        TestAttendanceScan.member_id = m["id"]
        # Clear any existing attendance for today by attempting check-out (idempotent enough — but skip if none)

    def test_scan_with_json_payload_checks_in(self, auth_headers):
        assert TestAttendanceScan.member_id
        qr_data = json.dumps({"v": 1, "g": "GymFlow", "id": TestAttendanceScan.member_id, "n": "TEST_SCAN", "exp": "2099-01-01"})
        r = requests.post(f"{API}/attendance/scan", json={"qr_data": qr_data}, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # Could be checked_in (first scan) or duplicate (if previous test left attendance). Accept both.
        assert body["status"] in ("checked_in", "duplicate"), body
        if body["status"] == "checked_in":
            assert body["attendance"]["member_id"] == TestAttendanceScan.member_id
            assert body["attendance"]["check_out_time"] is None

    def test_scan_duplicate_within_window(self, auth_headers):
        # Scan again immediately -> should be duplicate
        qr_data = json.dumps({"id": TestAttendanceScan.member_id})
        r = requests.post(f"{API}/attendance/scan", json={"qr_data": qr_data}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "duplicate"

    def test_scan_with_raw_member_id(self, auth_headers):
        # Raw (non-JSON) string should be treated as member_id; still duplicate
        r = requests.post(f"{API}/attendance/scan", json={"qr_data": TestAttendanceScan.member_id}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] in ("duplicate", "checked_in", "checked_out")

    def test_scan_invalid_member(self, auth_headers):
        r = requests.post(f"{API}/attendance/scan", json={"qr_data": "some-non-existent-id"}, headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_scan_expired_member_blocked(self, auth_headers):
        # Create a member with a join_date that makes membership already expired
        past = (datetime.now(timezone.utc).date() - timedelta(days=60)).isoformat()
        m = _create_member(auth_headers, "EXPIRED", plan="monthly", join_date=past)
        TestAttendanceScan.expired_id = m["id"]
        # Verify expiry is in the past
        exp_d = datetime.fromisoformat(m["expiry_date"]).date()
        assert exp_d < datetime.now(timezone.utc).date()
        r = requests.post(f"{API}/attendance/scan", json={"qr_data": m["id"]}, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "expired"
        assert body["attendance"] is None

    @classmethod
    def teardown_class(cls):
        try:
            r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
            tok = r.json()["access_token"]
            h = {"Authorization": f"Bearer {tok}"}
            for mid in (cls.member_id, cls.expired_id):
                if mid:
                    requests.delete(f"{API}/members/{mid}", headers=h, timeout=10)
        except Exception:
            pass


# ============== ANALYTICS: peak-hours + absent ==============
class TestNewAnalytics:
    def test_peak_hours_default(self, auth_headers):
        r = requests.get(f"{API}/analytics/peak-hours", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 24
        labels = [b["label"] for b in arr]
        assert labels[0] == "00" and labels[23] == "23"
        for b in arr:
            assert isinstance(b["value"], int)

    def test_peak_hours_days_param(self, auth_headers):
        r = requests.get(f"{API}/analytics/peak-hours?days=14", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert len(r.json()) == 24

    def test_absent_members_default(self, auth_headers):
        r = requests.get(f"{API}/analytics/absent-members?days=14", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        for m in arr:
            assert "id" in m and "name" in m
            assert "last_visit" in m and "days_absent" in m

    def test_peak_hours_unauth(self):
        r = requests.get(f"{API}/analytics/peak-hours", timeout=10)
        assert r.status_code == 401

    def test_absent_unauth(self):
        r = requests.get(f"{API}/analytics/absent-members", timeout=10)
        assert r.status_code == 401
