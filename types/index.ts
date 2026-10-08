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
  adminNotes?: string;
  stripePaymentLink?: string;
  priceRegion?: 'london' | 'standard' | null;
  hourlyRate?: number | string | null;
  /** ISO time the cleaner tapped "Start travel". */
  enRouteAt?: string | null;
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
  availability?: DayAvailability[];
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
  id: number;
  bookingId: number;
  senderId: number;
  senderRole: string;
  senderName: string;
  text: string;
  createdAt: string;
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
