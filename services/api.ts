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
  ChatThread,
  CustomerInvoice,
  PublicStaff,
  PaymentEvidenceItem,
  StaffPerformance,
  StaffInvoice,
  DirectMessage,
  BookingTracking,
  LateNotice,
  StaffHoliday,
  StaffHolidayYear,
  ReferralSummary,
} from '../types';

export { getToken, setToken, clearToken };

/** Error from the API. `status` is 0 when the phone could not reach the server. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Long enough for photo uploads on a weak signal, short enough not to hang forever. */
const REQUEST_TIMEOUT_MS = 45000;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch {
    throw new ApiError('No connection. Check your signal and try again.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as any)?.error || (body as any)?.message || `Request failed: ${res.status}`,
      res.status
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
    paymentChoice?: 'deposit' | 'full';
  }) =>
    request<{ id: number; bookingId: string; message: string; stripePaymentLink?: string }>('/api/bookings', {
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

  /** reviewPublic: the customer agreed to show the review on the website. */
  rate: (id: number, rating: number, feedback?: string, reviewPublic = false) =>
    request(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ rating, feedback, reviewPublic: reviewPublic && !!feedback }),
    }),

  getTracking: (id: number) => request<BookingTracking>(`/api/bookings/${id}/tracking`),

  /** Messages plus whether chat is open (older servers returned a bare list). */
  getChat: async (id: number): Promise<ChatThread> => {
    const data = await request<ChatThread | ChatThread['messages']>(`/api/bookings/${id}/chat`);
    if (Array.isArray(data)) return { messages: data, chatClosedByAdmin: false, canChatNow: true };
    return {
      messages: Array.isArray(data?.messages) ? data.messages : [],
      chatClosedByAdmin: !!data?.chatClosedByAdmin,
      canChatNow: data?.canChatNow !== false,
    };
  },

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
  /** Client moves their booking; allowed up to 24 hours before it starts. */
  rescheduleBooking: (id: number, date: string, time: string) =>
    request<{ message: string; date: string; time: string; status: string; cleanerKept: boolean }>(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ date, time }),
    }),

  getServices: () => publicApi.getServices(),
  getExtras: () => publicApi.getExtras(),

  getNotifications: () => request<Notification[]>('/api/notifications'),
  markNotificationRead: (id: number) =>
    request(`/api/notifications/${id}/read`, { method: 'POST' }),
  deleteNotification: (id: number) =>
    request(`/api/notifications/${id}`, { method: 'DELETE' }),

  validateDiscount: (code: string) => publicApi.validateDiscount(code),

  getReferrals: (userId: number) => request<Referral[]>(`/api/referrals?userId=${userId}`),
  getReferralSummary: () => request<ReferralSummary>('/api/referrals/summary'),

  getStaffList: () => request<PublicStaff[]>('/api/staff'),

  /** Invoices the office has sent (drafts are hidden by the server). */
  getInvoices: () => request<CustomerInvoice[]>('/api/my-invoices'),

  /** Records that the client agreed to the deposit and payment terms on an existing booking. */
  acknowledgeDepositTerms: (id: number) =>
    request<{ depositTermsAcceptedAt?: string }>(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ depositTermsAcknowledged: true }),
    }),

  /** Replaces the list of payment proofs on a booking (max 6). */
  savePaymentEvidence: (id: number, items: PaymentEvidenceItem[]) =>
    request<{ paymentFeeEvidence?: { items: PaymentEvidenceItem[] } }>(`/api/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentFeeEvidence: { items } }),
    }),
};

// ─── Staff ──────────────────────────────────────────
export const staffApi = {
  /** Your own performance (same endpoint and numbers as the website staff portal). */
  getMyPerformance: () => request<StaffPerformance>('/api/staff/me/performance'),

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

  /** Clock-in on site: the client is told their cleaner has arrived (once). */
  markArrived: (bookingId: number, body: { lat?: number; lng?: number } = {}) =>
    request<{ arrivedAt: string }>(`/api/staff/jobs/${bookingId}/arrived`, {
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
    /** Approved holiday to add; the server works out the holiday pay itself. */
    holidayIds?: number[];
    /** Unlocked referral bonuses to add; the server checks and prices them. */
    referralRewardIds?: number[];
  }) =>
    request(`/api/staff/${staffId}/invoice`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ─── Holiday (contracted staff) ───
  getHolidays: (staffId: number, year?: number) =>
    request<StaffHolidayYear>(`/api/staff/${staffId}/holidays${year ? `?year=${year}` : ''}`),

  createHoliday: (staffId: number, body: { startDate: string; endDate: string; halfDay?: boolean; note?: string }) =>
    request<StaffHoliday>(`/api/staff/${staffId}/holidays`, { method: 'POST', body: JSON.stringify(body) }),

  updateHoliday: (id: number, body: { startDate?: string; endDate?: string; halfDay?: boolean; note?: string }) =>
    request<StaffHoliday>(`/api/holidays/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  cancelHoliday: (id: number) => request<unknown>(`/api/holidays/${id}`, { method: 'DELETE' }),

  getInvoiceHistory: (staffId: number) =>
    request<StaffInvoice[]>(`/api/staff/${staffId}/invoices-history`),

  getNotifications: () => request<Notification[]>('/api/notifications'),
  markNotificationRead: (id: number) =>
    request(`/api/notifications/${id}/read`, { method: 'POST' }),
  deleteNotification: (id: number) =>
    request(`/api/notifications/${id}`, { method: 'DELETE' }),

  getReferrals: (userId: number) => request<Referral[]>(`/api/referrals?userId=${userId}&type=staff`),
  getReferralSummary: () => request<ReferralSummary>('/api/referrals/summary'),

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
