export type ServiceType =
  | 'general'
  | 'deep'
  | 'end_of_tenancy'
  | 'airbnb'
  | 'commercial'
  | 'jet_washing';

export interface DayAvailability {
  day: string;
  isOpen: boolean;
  start: string;
  end: string;
}

export interface Extra {
  id: number;
  name: string;
  price: number;
  type?: 'fixed' | 'hourly' | 'range';
  duration?: number;
  active?: boolean;
}

export interface SelectedExtra {
  id: number;
  quantity: number;
}

export interface PropertyDetails {
  bedrooms: number;
  bathrooms: number;
  toilets?: number;
  livingRooms?: number;
  kitchens?: number;
  duration?: number;
  frequency?: string;
  size?: string;
  sqft?: number;
  surfaceType?: string;
  propertyType?: string;
  notifyIfMoreTimeNeeded?: boolean;
  utilityRooms?: number;
  receptionRooms?: number;
  clockRoomToilets?: number;
  sqftRange?: string;
  carpetSteamCleaning?: number;
  callOutCharge?: number;
  commercialDetails?: string;
  smsUpdatesOptIn?: boolean;
}

export interface Booking {
  id: number;
  bookingId?: string | null;
  customerId?: number | null;
  serviceType: string;
  date: string;
  time: string;
  status: string;
  totalPrice: number;
  address: {
    line1: string;
    city: string;
    postcode: string;
  };
  contact: {
    name: string;
    email: string;
    phone?: string;
  };
  propertyDetails?: PropertyDetails;
  extras?: SelectedExtra[];
  frequency?: string;
  instructions?: string;
  assignedStaffId?: number | null;
  assignedStaffIds?: number[];
  discountCode?: string;
  discountAmount?: number;
  pointsEarned?: number;
  rating?: number | null;
  feedback?: string | null;
  workCompletion?: WorkCompletionData | null;
  chatClosedByAdmin?: boolean;
  chatClosedAt?: string | null;
  invoicePaid?: boolean;
  /** Pay the deposit now or pay in full (chosen when booking). */
  paymentChoice?: 'deposit' | 'full';
  /** Server-calculated: paid so far, what is left, and where the booking is in paying. */
  amountPaid?: number;
  balanceDue?: number;
  paymentStage?: 'unpaid' | 'deposit_paid' | 'paid';
  depositAmount?: number;
  paidInFullAt?: string | null;
  adminNotes?: string;
  stripePaymentLink?: string;
  priceRegion?: 'london' | 'standard' | null;
  hourlyRate?: number | string | null;
  /** ISO time the cleaner tapped "Start travel". */
  enRouteAt?: string | null;
  depositTermsAcceptedAt?: string | null;
  shortNoticeCancelFeeConsentedAt?: string | null;
  paymentFeeEvidence?: { items?: PaymentEvidenceItem[] } | null;
  cleanerLocation?: CleanerLocation | null;
  lateNotices?: LateNotice[] | null;
  createdAt?: string;
}

export interface CleanerLocation {
  lat: number;
  lng: number;
  at?: string;
  staffId?: number;
  staffName?: string;
}

export interface LateNotice {
  id: string;
  staffId: number;
  staffName: string;
  reason: string;
  etaTime: string | null;
  minutesLate: number | null;
  message: string;
  sentAt: string;
  notified: { client: boolean; admin: boolean };
}

export interface BookingTracking {
  id: number;
  bookingId?: string | null;
  status: string;
  enRouteAt: string | null;
  cleanerLocation: CleanerLocation | null;
  lateNotices: LateNotice[];
}

export interface ServiceConfig {
  id: number;
  name: string;
  baseRate: number;
  /** Hourly rate for Greater London postcodes (Standard cleaning); null = baseRate everywhere. */
  londonRate?: number | string | null;
  pricingModel?: 'hourly' | 'flat' | 'size_based' | 'room_based' | 'quote';
  features?: string[];
  minDuration?: number;
  minNotice?: number;
  callOutCharge?: number | null;
  description?: string;
  icon?: string;
  active: boolean;
  bookingFlow?: {
    trigger: string;
    steps: string[];
  };
}

export interface Staff {
  id: number;
  userId?: number;
  name: string;
  email: string;
  role: string;
  status: string;
  hourlyRate?: number;
  skills?: string[];
  /** Shared weekly format { Mon: { active, start, end } }; older app versions stored a DayAvailability list. */
  availability?: DayAvailability[] | Record<string, { active: boolean; start: string; end: string }>;
  phone?: string;
  address?: string;
  postcode?: string;
  imageUrl?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  sortCode?: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Referral {
  id: number | string;
  referrerId: number;
  referrerName: string;
  referrerType: 'staff' | 'customer';
  referredClientName: string;
  dateReferred: string;
  status: 'Pending' | 'Completed' | 'Paid Out';
  rewardAmount: number;
}

export interface WorkCompletionData {
  notes?: string;
  issues?: string;
  photos?: string[];
  signature?: string;
  clockInTime: string;
  clockInAtIso?: string;
  clockOutTime: string;
  clockOutAtIso?: string;
  submittedByStaffUserId?: number;
  submittedByStaffProfileId?: number;
  earlyClockOutReason?: string;
  location?: { lat: number; lng: number };
}

export interface UserAccount {
  id: number;
  name: string;
  email: string;
  /** Promotions by email/SMS; stored on the account so the website shows the same choice. */
  marketingOptIn?: boolean;
  role?: string;
  isSuperadmin?: boolean;
  adminTabs?: string[];
  isVerified: boolean;
  loyaltyPoints?: number;
  referralCode?: string;
  referredBy?: string;
  phone?: string | null;
  address?: string | null;
  postcode?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
}

export interface ChatMessage {
  id: number | string;
  bookingId?: number;
  /** The server sends ids as strings. */
  senderId: number | string;
  senderRole: string;
  senderName: string;
  text: string;
  /** Server field; older builds used createdAt. */
  timestamp?: string;
  createdAt?: string;
}

/** GET /api/bookings/:id/chat */
export interface ChatThread {
  messages: ChatMessage[];
  chatClosedByAdmin: boolean;
  /** Opens 10 minutes before the start once a cleaner is assigned (same rule as the website). */
  canChatNow: boolean;
}

export interface PaymentEvidenceItem {
  kind: 'deposit' | 'cancellation_fee';
  dataUrl: string;
  uploadedAt: string;
  fileName?: string;
  note?: string;
}

/** Invoice the office sends a client (GET /api/my-invoices). */
export interface CustomerInvoice {
  id: number;
  invoiceNumber: string;
  bookingId?: number | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'pending' | string;
  subtotal?: number | string;
  vatAmount?: number | string;
  total: number | string;
  dueDate?: string | null;
  notes?: string | null;
  stripePaymentUrl?: string | null;
  items?: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  createdAt?: string;
  paidAt?: string | null;
}

/** Cleaner details a client may see (GET /api/staff as a client). */
export interface PublicStaff {
  id: number;
  name: string;
  role?: string;
  status?: string;
  imageUrl?: string | null;
  profilePhoto?: string | null;
  rating?: number;
  isVerified?: boolean;
}

export interface DiscountCode {
  id: number;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  minOrderValue?: number;
  expiresAt?: string;
  isActive: boolean;
  usageLimit?: number | null;
  usedCount: number;
  createdAt?: string;
}

export interface DirectMessage {
  id: number;
  senderUserId: number;
  senderName: string;
  senderRole: string;
  recipientRole: string;
  recipientUserId: number;
  text: string;
  isRead: boolean;
  createdAt: string;
}

export interface StaffInvoice {
  id: number;
  staffId: number;
  staffName?: string;
  weekLabel: string;
  weekStart?: string;
  weekEnd?: string;
  totalAmount: number;
  weekTotalHours?: number;
  weekJobCount?: number;
  jobsJson: any;
  bankJson?: any;
  status: string;
  adminNotes?: string;
  createdAt?: string;
}

/** GET /api/staff/me/performance (same numbers in the website staff portal and the app). */
export interface StaffPerformanceJob {
  id: number;
  ref: string | null;
  date: string;
  time: string;
  service: string;
  client: string;
  status: string;
  hours: number;
  pay: number;
  minutesLate: number | null;
  onTime: boolean | null;
  rating: number | null;
  feedback: string | null;
  lateNotices: number;
}

export interface StaffPerformance {
  staff: { id: number; name: string; role: string; status: string; hourlyRate: number; joinedAt: string | null };
  summary: {
    completed: number;
    upcoming: number;
    cancelled: number;
    hoursWorked: number;
    totalEarned: number;
    todayEarned: number;
    todayScheduled: number;
    weekEarned: number;
    monthEarned: number;
    avgClientRating: number | null;
    reviewCount: number;
    compliments: number;
    complaints: number;
    punctualityPercent: number | null;
    timedJobs: number;
    lateNotices: number;
    completionRate: number | null;
    supervisorScore: number | null;
    assessmentCount: number;
    supervisorBreakdown: { punctuality: number | null; quality: number | null; professionalism: number | null };
  };
  months: { month: string; label: string; jobs: number; earned: number; hours: number; avgRating: number | null }[];
  reviews: { id: number; ref: string | null; date: string; client: string; service: string; rating: number | null; feedback: string | null }[];
  assessments: {
    id: number;
    bookingId: number | null;
    assessorName: string;
    rating: number;
    punctuality: number | null;
    quality: number | null;
    professionalism: number | null;
    remark: string;
    createdAt: string | null;
  }[];
  recentJobs: StaffPerformanceJob[];
}
