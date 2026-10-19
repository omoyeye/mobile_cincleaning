import { useEffect, useState } from 'react';
import { publicApi } from '../services/api';

/** Used until the live settings load (same values the website shows). */
export const SUPPORT_EMAIL = 'support@cleanitneatly.com';
export const SUPPORT_PHONE = '07909565925';

export type BankAccount = { accountName: string; accountNumber: string; sortCode: string; bankName?: string; notes?: string };

/** Same fallback the website shows when no bank account is set in admin settings. */
const FALLBACK_BANK: BankAccount[] = [{ accountName: 'Surpluslink & co LTD', accountNumber: '27847158', sortCode: '04-06-05' }];

export type BusinessContact = {
  /** Brand name and postal address for documents (admin: Settings > brand). */
  companyName: string;
  companyAddress: string;
  phone: string;
  email: string;
  whatsapp: string;
  /** Deposit asked for on every booking (admin: Settings > deposit policy). */
  depositPercent: number;
  depositMessage: string;
  /** Cancelling inside this window means a fee of shortNoticeFeePercent of the total. */
  shortNoticeHours: number;
  shortNoticeFeePercent: number;
  cancellationMessage: string;
  /** Accounts for paying the deposit or a cancellation fee by bank transfer (admin: Settings > bank details). */
  bankDetails: BankAccount[];
  /** Google Business Profile review link, offered after a 4 or 5 star rating (admin: Settings > Social links). */
  googleReviewUrl: string;
};

/** wa.me needs digits only in international format. */
function toWhatsApp(raw: string): string {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
}

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Same defaults as the website's BusinessSettingsContext. */
const DEFAULTS: BusinessContact = {
  companyName: 'CiN Cleaning',
  companyAddress: '',
  phone: SUPPORT_PHONE,
  email: SUPPORT_EMAIL,
  whatsapp: toWhatsApp(SUPPORT_PHONE),
  depositPercent: 40,
  depositMessage: 'A 40% deposit is required to secure your booking and guarantee your cleaner arrives at the scheduled time.',
  shortNoticeHours: 24,
  shortNoticeFeePercent: 10,
  cancellationMessage:
    'If you choose to cancel within 24 hours of your appointment, you agree to a short-notice cancellation fee of 10% of the booking total.',
  bankDetails: FALLBACK_BANK,
  googleReviewUrl: '',
};

function parseBanks(raw: unknown): BankAccount[] {
  const list = Array.isArray(raw) ? raw : [];
  const banks = list
    .map((entry) => {
      const e = asObject(entry);
      const accountName = String(e.accountName || '').trim();
      const accountNumber = String(e.accountNumber || '').trim();
      const sortCode = String(e.sortCode || '').trim();
      if (!accountName || !accountNumber || !sortCode || e.active === false) return null;
      return { accountName, accountNumber, sortCode, bankName: String(e.bankName || ''), notes: String(e.notes || '') };
    })
    .filter(Boolean) as BankAccount[];
  return banks.length ? banks : FALLBACK_BANK;
}

function normalize(s: Record<string, unknown>): BusinessContact {
  const phone = String(s?.phone || '').trim() || DEFAULTS.phone;
  const email = String(s?.email || '').trim() || DEFAULTS.email;
  const deposit = asObject(s?.depositPolicy);
  const cancel = asObject(s?.cancellationPolicy);
  const pct = Number(deposit.requiredPercent);
  const hours = Number(cancel.shortNoticeWindowHours);
  const fee = Number(cancel.shortNoticeFeePercent);
  return {
    companyName: String(s?.companyName || '').trim() || DEFAULTS.companyName,
    companyAddress: typeof s?.address === 'string' ? s.address.trim() : '',
    phone,
    email,
    whatsapp: toWhatsApp(String(s?.whatsappNumber || '') || phone),
    depositPercent: Number.isFinite(pct) ? clamp(pct, 0, 100) : DEFAULTS.depositPercent,
    depositMessage: typeof deposit.message === 'string' && deposit.message.trim() ? deposit.message.trim() : DEFAULTS.depositMessage,
    shortNoticeHours: Number.isFinite(hours) ? Math.max(1, hours) : DEFAULTS.shortNoticeHours,
    shortNoticeFeePercent: Number.isFinite(fee) ? clamp(fee, 0, 100) : DEFAULTS.shortNoticeFeePercent,
    cancellationMessage:
      typeof cancel.consentMessage === 'string' && cancel.consentMessage.trim() ? cancel.consentMessage.trim() : DEFAULTS.cancellationMessage,
    bankDetails: parseBanks(s?.bankDetails),
    googleReviewUrl: /^https?:\/\//i.test(String(s?.googleReviewUrl || '').trim()) ? String(s?.googleReviewUrl).trim() : '',
  };
}

let cache: BusinessContact | null = null;

/** Phone, email, WhatsApp and payment policies from the admin's business settings. */
export function useBusinessContact(): BusinessContact {
  const [contact, setContact] = useState<BusinessContact>(cache ?? DEFAULTS);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    publicApi
      .getBusinessSettings()
      .then((s) => {
        cache = normalize(s || {});
        if (alive) setContact(cache);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return contact;
}
