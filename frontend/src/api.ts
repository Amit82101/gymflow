import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "gymflow_admin_token";
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export type ApiError = { detail: string };

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (withAuth) {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const data = await res.json();
      detail = data?.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    request<{ access_token: string; admin: any }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    ),
  me: () => request<any>("/auth/me"),

  // members
  listMembers: (search?: string, status?: string) => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    return request<any[]>(`/members${p.toString() ? `?${p}` : ""}`);
  },
  getMember: (id: string) => request<any>(`/members/${id}`),
  createMember: (data: any) =>
    request<any>("/members", { method: "POST", body: JSON.stringify(data) }),
  updateMember: (id: string, data: any) =>
    request<any>(`/members/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMember: (id: string) =>
    request<any>(`/members/${id}`, { method: "DELETE" }),

  // attendance
  todayAttendance: () => request<any[]>("/attendance/today"),
  listAttendance: (date?: string, memberId?: string) => {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    if (memberId) p.set("member_id", memberId);
    return request<any[]>(`/attendance${p.toString() ? `?${p}` : ""}`);
  },
  checkIn: (memberId: string) =>
    request<any>("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ member_id: memberId }),
    }),
  checkOut: (memberId: string) =>
    request<any>("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({ member_id: memberId }),
    }),
  scanQR: (qrData: string) =>
    request<any>("/attendance/scan", {
      method: "POST",
      body: JSON.stringify({ qr_data: qrData }),
    }),
  memberQR: (memberId: string) => request<any>(`/members/${memberId}/qr`),
  milestones: (windowDays = 7) => request<{ birthdays: any[]; anniversaries: any[] }>(`/members/milestones?window_days=${windowDays}`),
  peakHours: (days = 7) => request<any[]>(`/analytics/peak-hours?days=${days}`),
  absentMembers: (days = 14) => request<any[]>(`/analytics/absent-members?days=${days}`),

  // payments
  listPayments: (memberId?: string) => {
    const p = new URLSearchParams();
    if (memberId) p.set("member_id", memberId);
    return request<any[]>(`/payments${p.toString() ? `?${p}` : ""}`);
  },
  pendingFees: () => request<any[]>("/payments/pending"),
  createPayment: (data: { member_id: string; amount: number; plan: string; method?: string }) =>
    request<any>("/payments", { method: "POST", body: JSON.stringify(data) }),
  getPayment: (id: string) => request<any>(`/payments/${id}`),

  // dashboard / analytics
  dashboardStats: () => request<any>("/dashboard/stats"),
  revenueAnalytics: (months = 6) =>
    request<any[]>(`/analytics/revenue?months=${months}`),
  attendanceAnalytics: (days = 7) =>
    request<any[]>(`/analytics/attendance?days=${days}`),
  memberGrowth: (months = 6) =>
    request<any[]>(`/analytics/member-growth?months=${months}`),
};

export async function saveToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}
export async function getToken() {
  return storage.secureGet<string>(TOKEN_KEY, "");
}
