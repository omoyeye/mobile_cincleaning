import { API_BASE_URL } from '../constants/config';
import { getToken, setToken, clearToken } from './tokenStorage';
import type {
  Booking,
  ServiceConfig,
  Extra,
  Staff,
  Notification,
  Referral,
  UserAccount,
  DiscountCode,
  ChatMessage,
  StaffInvoice,
  DirectMessage,
  BookingTracking,
  LateNotice,
} from '../types';

export { getToken, setToken, clearToken };

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as any)?.error || (body as any)?.message || `Request failed: ${res.status}`
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: UserAccount; token: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { name: string; email: string; password: string; phone?: string; referredBy?: string }) =>
    request<{ id: number; referralCode: string; token: string; user: UserAccount }>('/api/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => request<UserAccount>('/api/me'),

  logout: async () => {
    try {
      await request('/api/logout', { method: 'POST' });
    } catch {}
    await clearToken();
  },

  forgotPassword: (email: string) =>
    request('/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request('/api/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  updateProfile: (userId: number, data: Partial<UserAccount> & { currentPassword?: string; password?: string }) =>
    request<UserAccount>(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAccount: (userId: number) =>
    request('/api/account/delete', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  requestDataExport: (userId: number) =>
    request('/api/account/data-export', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

// ─── Bookings (shared by customer & staff) ──────────
export const bookingsApi = {
  getAll: () => request<Booking[]>('/api/bookings'),

  getOne: (id: number) => request<Booking>(`/api/bookings/${id}`),

  create: (data: {
    serviceType: string;
    date: string;
    time: string;
    totalPrice: number;
    depositTermsAccepted: boolean;
    address: { line1: string; city: string; postcode: string };
    contact: { name: string; email: string; phone?: string };
    propertyDetails?: Record<string, any>;
    extras?: { id: number; quantity?: number }[];
    instructions?: string;
    discountCode?: string;
    discountAmount?: number;
    frequency?: string;
    duration?: number;
    tipAmount?: number;
  }) =>
    request<{ id: number; bookingId: string; message: string }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Record<string, any>) =>
    request<Booking>(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  cancel: (id: number, shortNoticeConsent?: boolean) =>
    request(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'Cancelled',
        ...(shortNoticeConsent ? { shortNoticeConsent: true } : {}),
      }),
    }),

  rate: (id: number, rating: number, feedback?: string) =>
    request(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, feedback }),
    }),

  getTracking: (id: number) => request<BookingTracking>(`/api/bookings/${id}/tracking`),

  getChat: (id: number) => request<ChatMessage[]>(`/api/bookings/${id}/chat`),

  sendChat: (id: number, text: string) =>
    request(`/api/bookings/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};

// ─── Public / Guest ─────────────────────────────────
export const publicApi = {
  getServices: () => request<ServiceConfig[]>('/api/services'),

  getExtras: () => request<Extra[]>('/api/extra-services'),

  validateDiscount: (code: string) =>
    request<{ valid: boolean; discount?: DiscountCode }>('/api/validate-discount', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getBusinessSettings: () => request<Record<string, any>>('/api/business-settings'),
};

// ─── Customer ───────────────────────────────────────
export const customerApi = {
  getBookings: () => bookingsApi.getAll(),
  getBooking: (id: number) => bookingsApi.getOne(id),
  createBooking: (data: Parameters<typeof bookingsApi.create>[0]) => bookingsApi.create(data),
  cancelBooking: (id: number, shortNoticeConsent?: boolean) => bookingsApi.cancel(id, shortNoticeConsent),
  rateBooking: (id: number, rating: number, feedback?: string) => bookingsApi.rate(id, rating, feedback),
  rescheduleBooking: (id: number, date: string, time: string) =>
    request(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ date, time }) }),

  getServices: () => publicApi.getServices(),
  getExtras: () => publicApi.getExtras(),

  getNotifications: () => request<Notification[]>('/api/notifications'),
  markNotificationRead: (id: number) =>
    request(`/api/notifications/${id}/read`, { method: 'POST' }),
  deleteNotification: (id: number) =>
    request(`/api/notifications/${id}`, { method: 'DELETE' }),

  validateDiscount: (code: string) => publicApi.validateDiscount(code),

  getReferrals: (userId: number) => request<Referral[]>(`/api/referrals?userId=${userId}`),

  getStaffList: () => request<Pick<Staff, 'id' | 'name' | 'role' | 'status' | 'imageUrl'>[]>('/api/staff'),
};

// ─── Staff ──────────────────────────────────────────
export const staffApi = {
  getBookings: () => bookingsApi.getAll(),
  getBooking: (id: number) => bookingsApi.getOne(id),

  completeJob: (bookingId: number, data: {
    clockInTime: string;
    clockInAtIso?: string;
    clockOutTime: string;
    clockOutAtIso?: string;
    notes?: string;
    issues?: string;
    photos?: string[];
    earlyClockOutReason?: string;
    location?: { lat: number; lng: number };
    signature?: string;
  }) =>
    request(`/api/bookings/${bookingId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  startTravel: (bookingId: number, body: { lat?: number; lng?: number; silent?: boolean } = {}) =>
    request<{ enRouteAt: string }>(`/api/staff/jobs/${bookingId}/en-route`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateLocation: (bookingId: number, coords: { lat: number; lng: number }) =>
    request<{ ok: boolean }>(`/api/staff/jobs/${bookingId}/location`, {
      method: 'POST',
      body: JSON.stringify(coords),
    }),

  sendRunningLate: (bookingId: number, body: {
    reason: string;
    etaTime?: string;
    minutesLate?: number;
    note?: string;
    notifyClient: boolean;
    notifyAdmin: boolean;
  }) =>
    request<{ notice: LateNotice }>(`/api/staff/jobs/${bookingId}/running-late`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  requestCancellation: (bookingId: number, reason?: string) =>
    request(`/api/bookings/${bookingId}/staff-cancel-request`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getStaffList: () => request<Staff[]>('/api/staff'),

  getProfile: async (userId: number): Promise<Staff> => {
    const list = await request<Staff[]>('/api/staff');
    const me = list.find((s) => s.userId === userId || s.id === userId);
    if (!me) throw new Error('Staff profile not found');
    return me;
  },

  getReviews: (staffId: number) =>
    request<any[]>(`/api/staff/${staffId}/reviews`),

  updateProfile: (staffId: number, data: Partial<Pick<Staff,
    'phone' | 'address' | 'postcode' | 'imageUrl' | 'bankName' | 'accountHolder' | 'accountNumber' | 'sortCode' | 'availability'
  >>) =>
    request<Staff>(`/api/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getWeeklyInvoice: (staffId: number) =>
    request<any>(`/api/staff/${staffId}/weekly-invoice`),

  submitInvoice: (staffId: number, data: {
    totalAmount: number;
    jobs: any[];
    week: string;
    bankDetails: any;
    weekTotalHours?: number;
    weekJobCount?: number;
  }) =>
    request(`/api/staff/${staffId}/invoice`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getInvoiceHistory: (staffId: number) =>
    request<StaffInvoice[]>(`/api/staff/${staffId}/invoices-history`),

  getNotifications: () => request<Notification[]>('/api/notifications'),
  markNotificationRead: (id: number) =>
    request(`/api/notifications/${id}/read`, { method: 'POST' }),
  deleteNotification: (id: number) =>
    request(`/api/notifications/${id}`, { method: 'DELETE' }),

  getReferrals: (userId: number) => request<Referral[]>(`/api/referrals?userId=${userId}&type=staff`),

  getChat: (bookingId: number) => bookingsApi.getChat(bookingId),
  sendChat: (bookingId: number, text: string) => bookingsApi.sendChat(bookingId, text),

  getDirectMessages: () => request<DirectMessage[]>('/api/direct-messages'),
  sendDirectMessage: (text: string, recipientUserId?: number) =>
    request<DirectMessage>('/api/direct-messages', {
      method: 'POST',
      body: JSON.stringify({ text, recipientUserId }),
    }),
  markDirectMessagesRead: () =>
    request('/api/direct-messages/read', { method: 'PUT' }),
};

// ─── Maps ───────────────────────────────────────────
export const mapsApi = {
  getKey: () => request<{ key: string }>('/api/maps/key'),

  geocode: (address: string) =>
    request<{ lat: number; lng: number }>('/api/maps/geocode', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  directions: (origin: string, destination: string) =>
    request<any>('/api/maps/directions', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    }),
};

// ─── Push Notifications ─────────────────────────────
export const pushApi = {
  registerToken: (token: string, platform: 'ios' | 'android') =>
    request('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  unregisterToken: (token: string) =>
    request('/api/push/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};
