import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { publicApi, bookingsApi } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../constants/config';
import type { ServiceConfig, Extra, SelectedExtra, PropertyDetails } from '../types';
import { calculateHourlyPrice, hourlyRateFor, londonRateOf, lookupPricingRegion, type PricingRegion } from '../utils/pricing';

/** Mobile materials options -> the keys the website and API use. */
const MATERIALS_KEY: Record<string, string | null> = { none: null, hoover: 'hoover_only', hoover_materials: 'hoover_and_materials' };
const FULL_UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

type Step = 'service' | 'details' | 'extras' | 'datetime' | 'address' | 'summary';
const ALL_STEPS: Step[] = ['service', 'details', 'extras', 'datetime', 'address', 'summary'];

const SERVICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  general: 'sparkles-outline',
  deep: 'flash-outline',
  end_of_tenancy: 'key-outline',
  airbnb: 'bed-outline',
  commercial: 'business-outline',
  jet_washing: 'water-outline',
};

const FREQUENCIES = ['One-time', 'Weekly', 'Fortnightly', 'Monthly'] as const;
const TIP_OPTIONS = [0, 5, 10, 15, 20] as const;
const DEEP_EOT_CALL_OUT_GBP = 30;
const COMMERCIAL_MIN_CHARS = 25;
const PROPERTY_SIZES = ['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom', '4 Bedroom', '5 Bedroom', 'House', 'Flat'];
const SQFT_RANGES = ['1 - 1,200 Sq Ft', '1,201 - 2,000 Sq Ft', '2,001 - 3,000 Sq Ft', '3,001 - 4,000 Sq Ft', '4,001 - 5,000 Sq Ft', '5,001+ Sq Ft'];

type MaterialsOption = 'none' | 'hoover' | 'hoover_materials';
type ServiceTrigger = 'standard' | 'deep' | 'end_of_tenancy' | 'airbnb' | 'commercial' | 'jet_washing' | 'custom';

function getServiceTrigger(svc: ServiceConfig | null): ServiceTrigger {
  if (!svc) return 'standard';
  if (svc.bookingFlow?.trigger) return svc.bookingFlow.trigger as ServiceTrigger;
  const sId = String(svc.id).toLowerCase();
  const sName = String(svc.name || '').toLowerCase();
  if (sId === 'airbnb' || sName.includes('airbnb')) return 'airbnb';
  if (sId === 'commercial' || sName.includes('commercial')) return 'commercial';
  if (sId === 'jet_washing' || sName.includes('jet')) return 'jet_washing';
  if (sId === 'end_of_tenancy' || sName.includes('end of tenancy')) return 'end_of_tenancy';
  if (sId === 'deep' || (sName.includes('deep') && !sName.includes('airbnb'))) return 'deep';
  return 'standard';
}

function resolveAirbnbHours(bedrooms: number): number {
  if (!Number.isFinite(bedrooms) || bedrooms < 1) return 0;
  return bedrooms + 1;
}

function resolveCallOutCharge(svc: ServiceConfig | null): number {
  const c = svc?.callOutCharge;
  if (c != null && Number.isFinite(Number(c))) return Number(c);
  return DEEP_EOT_CALL_OUT_GBP;
}

function isRoomExtra(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('bedroom') || lower.includes('reception') ||
    lower.includes('bathroom') || lower.includes('utility') ||
    lower.includes('cloakroom') || lower.includes('clock') ||
    lower.includes('kitchen') || lower.includes('carpet') ||
    lower.includes('toilet') || /\bwc\b/.test(lower)
  );
}

function resolveToiletExtra(extras: Extra[]): Extra | null {
  return extras.find((e) => {
    const n = e.name.toLowerCase();
    return (n.includes('cloakroom') || n.includes('clockroom') || n.includes('clock room') ||
      (n.includes('toilet') && !n.includes('bathroom'))) || /\bwc\b/.test(n);
  }) || null;
}

interface BreakdownLine {
  label: string;
  amount: number;
  type?: 'discount' | 'tip';
}

export default function BookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const drawerAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const [selectedService, setSelectedService] = useState<ServiceConfig | null>(null);
  const [property, setProperty] = useState<PropertyDetails>({
    bedrooms: 1, bathrooms: 1, toilets: 0, livingRooms: 1, kitchens: 1,
    receptionRooms: 0, utilityRooms: 0, clockRoomToilets: 0, carpetSteamCleaning: 0,
    size: 'Studio', sqftRange: '1 - 1,200 Sq Ft',
  });
  const [durationHours, setDurationHours] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [materials, setMaterials] = useState<MaterialsOption>('none');
  const [selectedExtras, setSelectedExtras] = useState<SelectedExtra[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>('One-time');
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', postcode: '' });
  const [pricingRegion, setPricingRegion] = useState<PricingRegion | null>(null);
  const [regionChecking, setRegionChecking] = useState(false);
  const [postcodeResults, setPostcodeResults] = useState<{ line1: string; city: string }[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [contactName, setContactName] = useState(user?.name || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [instructions, setInstructions] = useState('');
  const [commercialDetails, setCommercialDetails] = useState('');
  const [notifyIfMoreTimeNeeded, setNotifyIfMoreTimeNeeded] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string; type: 'fixed' | 'percentage'; value: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
  const [tipPercent, setTipPercent] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [useCustomTip, setUseCustomTip] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);

  const trigger = getServiceTrigger(selectedService);
  const isQuoteBased = trigger === 'commercial' || trigger === 'jet_washing';
  const isDeepOrEOT = trigger === 'deep' || trigger === 'end_of_tenancy';
  const isAirbnb = trigger === 'airbnb';
  const isGeneral = trigger === 'standard' || trigger === 'custom';
  const isStandard = trigger === 'standard';
  /** Standard cleans with a London rate need the postcode before a price can be shown. */
  const usesRegionalRate = isStandard && londonRateOf(selectedService) !== null;
  const effectiveRate = selectedService
    ? isStandard
      ? hourlyRateFor(selectedService, pricingRegion)
      : Number(selectedService.baseRate) || 0
    : 0;
  const regionReady = !usesRegionalRate || (pricingRegion !== null && !regionChecking);

  useEffect(() => {
    const pc = address.postcode.trim();
    if (!FULL_UK_POSTCODE.test(pc)) {
      setPricingRegion(null);
      setRegionChecking(false);
      return;
    }
    let cancelled = false;
    setRegionChecking(true);
    const timer = setTimeout(() => {
      lookupPricingRegion(pc).then((r) => {
        if (cancelled) return;
        setPricingRegion(r?.region ?? null);
        setRegionChecking(false);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address.postcode]);

  const activeSteps = useMemo((): Step[] => {
    if (!selectedService) return ALL_STEPS;
    if (isQuoteBased || isAirbnb) {
      return ['service', 'details', 'datetime', 'address', 'summary'];
    }
    return ALL_STEPS;
  }, [selectedService, isQuoteBased, isAirbnb]);

  const currentIdx = activeSteps.indexOf(step);

  useEffect(() => {
    if (user) {
      if (!contactName) setContactName(user.name || '');
      if (!contactEmail) setContactEmail(user.email || '');
      if (!contactPhone) setContactPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const [svc, ext] = await Promise.all([publicApi.getServices(), publicApi.getExtras()]);
        setServices(svc.filter((s) => s.active));
        setExtras(ext);
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const idx = activeSteps.indexOf(step);
    Animated.timing(progress, {
      toValue: (idx + 1) / activeSteps.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setSummaryExpanded(false);
    drawerAnim.setValue(0);
  }, [step, activeSteps]);

  useEffect(() => {
    if (selectedService) {
      const t = getServiceTrigger(selectedService);
      if (t === 'airbnb') {
        setProperty((p) => ({ ...p, bedrooms: 0 }));
        setDurationHours(0);
        setDurationMinutes(0);
      } else if (t === 'deep' || t === 'end_of_tenancy') {
        const minH = Math.max(3, Number(selectedService.minDuration) || 3);
        setDurationHours(minH);
        setDurationMinutes(0);
      } else {
        const minDur = Number(selectedService.minDuration) || 2;
        setDurationHours(Math.max(2, minDur));
        setDurationMinutes(0);
      }
      setSelectedExtras([]);
      setMaterials('none');
      setCommercialDetails('');
    }
  }, [selectedService]);

  const findExtraByName = useCallback((nameFragment: string): Extra | undefined => {
    return extras.find((e) =>
      e.name.toLowerCase().includes(nameFragment.toLowerCase())
    );
  }, [extras]);

  const getExtraQty = useCallback((nameFragment: string): number => {
    const ex = findExtraByName(nameFragment);
    if (!ex) return 0;
    return selectedExtras.find((s) => s.id === ex.id)?.quantity || 0;
  }, [findExtraByName, selectedExtras]);

  const updateRoomExtra = useCallback((nameFragment: string, count: number) => {
    const ex = findExtraByName(nameFragment);
    if (!ex) return;
    setSelectedExtras((prev) => {
      const others = prev.filter((p) => p.id !== ex.id);
      return count > 0 ? [...others, { id: ex.id, quantity: count }] : others;
    });
  }, [findExtraByName]);

  const breakdown = useMemo((): { lines: BreakdownLine[]; total: number; tipAmount: number } => {
    if (!selectedService) return { lines: [], total: 0, tipAmount: 0 };
    const lines: BreakdownLine[] = [];
    const baseRate = Number(selectedService.baseRate) || 0;
    let calculated = 0;

    if (isStandard) {
      const totalHrs = durationHours + durationMinutes / 60;
      const durLabel = durationMinutes > 0 ? `${durationHours}h 30m` : `${durationHours}h`;
      const chosen = selectedExtras
        .map((se) => {
          const ex = extras.find((e) => e.id === se.id);
          return ex ? { ex, se } : null;
        })
        .filter(Boolean) as Array<{ ex: Extra; se: SelectedExtra }>;
      const p = calculateHourlyPrice({
        hourlyRate: effectiveRate,
        hours: totalHrs,
        extras: chosen.map(({ ex, se }) => ({ price: ex.price, quantity: se.quantity })),
        cleaningMaterials: MATERIALS_KEY[materials],
        discount: appliedDiscount ? { type: appliedDiscount.type, value: appliedDiscount.value } : null,
        tip: useCustomTip ? { amount: parseFloat(customTip) || 0 } : { percent: tipPercent },
      });
      lines.push({
        label: `${selectedService.name} (${durLabel} × £${effectiveRate.toFixed(2)}/hr${pricingRegion === 'london' ? ', London rate' : ''})`,
        amount: p.base,
      });
      chosen.forEach(({ ex, se }) => {
        lines.push({ label: `${ex.name}${se.quantity > 1 ? ` x${se.quantity}` : ''}`, amount: Number(ex.price) * se.quantity });
      });
      if (p.materials > 0) {
        lines.push({ label: materials === 'hoover' ? 'Hoover only' : 'Hoover + materials', amount: p.materials });
      }
      if (p.discount > 0 && appliedDiscount) {
        lines.push({ label: `Discount (${appliedDiscount.code})`, amount: -p.discount, type: 'discount' });
      }
      if (p.tip > 0) {
        lines.push({ label: useCustomTip ? 'Tip' : `Tip (${tipPercent}%)`, amount: p.tip, type: 'tip' });
      }
      return { lines, total: p.total, tipAmount: p.tip };
    }

    if (isQuoteBased) {
      lines.push({ label: 'Quote-based service', amount: 0 });
    } else if (isAirbnb) {
      const hours = resolveAirbnbHours(property.bedrooms || 0);
      calculated = baseRate * hours;
      if (hours > 0) {
        lines.push({ label: `AirBnB Clean (${hours}hrs)`, amount: calculated });
      } else {
        lines.push({ label: 'AirBnB Clean', amount: 0 });
      }
    } else if (isDeepOrEOT) {
      const callOut = resolveCallOutCharge(selectedService);
      lines.push({ label: 'Call-out charge', amount: callOut });
      let extrasTotal = 0;
      selectedExtras.forEach((se) => {
        const ex = extras.find((e) => e.id === se.id);
        if (ex) {
          const cost = Number(ex.price) * se.quantity;
          extrasTotal += cost;
          lines.push({ label: `${ex.name}${se.quantity > 1 ? ` x${se.quantity}` : ''}`, amount: cost });
        }
      });
      calculated = callOut + extrasTotal;
    } else {
      const totalHrs = durationHours + durationMinutes / 60;
      const baseCost = baseRate * totalHrs;
      const durLabel = durationMinutes > 0 ? `${durationHours}h 30m` : `${durationHours}h`;
      lines.push({ label: `${selectedService.name} (${durLabel})`, amount: baseCost });

      let extrasTotal = 0;
      selectedExtras.forEach((se) => {
        const ex = extras.find((e) => e.id === se.id);
        if (ex) {
          const cost = Number(ex.price) * se.quantity;
          extrasTotal += cost;
          lines.push({ label: `${ex.name}${se.quantity > 1 ? ` x${se.quantity}` : ''}`, amount: cost });
        }
      });

      let materialsCost = 0;
      if (materials === 'hoover') materialsCost = 3;
      else if (materials === 'hoover_materials') materialsCost = 6;
      if (materialsCost > 0) {
        lines.push({
          label: materials === 'hoover' ? 'Hoover only' : 'Hoover + materials',
          amount: materialsCost,
        });
      }

      calculated = baseCost + extrasTotal + materialsCost;
    }

    let discountAmount = 0;
    if (appliedDiscount) {
      if (appliedDiscount.type === 'percentage') {
        discountAmount = calculated * (appliedDiscount.value / 100);
      } else {
        discountAmount = appliedDiscount.value;
      }
      discountAmount = Math.min(discountAmount, calculated);
      lines.push({ label: `Discount (${appliedDiscount.code})`, amount: -discountAmount, type: 'discount' });
    }

    const afterDiscount = Math.max(0, calculated - discountAmount);

    let tipAmount = 0;
    if (useCustomTip) {
      tipAmount = parseFloat(customTip) || 0;
    } else if (tipPercent > 0) {
      tipAmount = afterDiscount * (tipPercent / 100);
    }
    if (tipAmount > 0) {
      lines.push({
        label: useCustomTip ? 'Tip' : `Tip (${tipPercent}%)`,
        amount: tipAmount,
        type: 'tip',
      });
    }

    return { lines, total: afterDiscount + tipAmount, tipAmount };
  }, [selectedService, trigger, property.bedrooms, durationHours, durationMinutes,
      selectedExtras, extras, materials, appliedDiscount, tipPercent, customTip, useCustomTip,
      isQuoteBased, isAirbnb, isDeepOrEOT, isStandard, effectiveRate, pricingRegion]);

  const toggleDrawer = useCallback(() => {
    const toValue = summaryExpanded ? 0 : 1;
    setSummaryExpanded(!summaryExpanded);
    Animated.timing(drawerAnim, { toValue, duration: 250, useNativeDriver: false }).start();
  }, [summaryExpanded, drawerAnim]);

  const canNext = () => {
    switch (step) {
      case 'service': return !!selectedService;
      case 'details': {
        if (isAirbnb) return (property.bedrooms || 0) >= 1;
        if (isQuoteBased) return commercialDetails.trim().length >= COMMERCIAL_MIN_CHARS;
        if (usesRegionalRate) return FULL_UK_POSTCODE.test(address.postcode.trim()) && regionReady;
        return true;
      }
      case 'extras': return true;
      case 'datetime': return date.length > 0 && time.length > 0;
      case 'address':
        return address.line1.length > 0 && address.postcode.length > 0
          && contactName.length > 0 && contactEmail.length > 0 && regionReady;
      case 'summary': return true;
      default: return false;
    }
  };

  const next = () => {
    const idx = activeSteps.indexOf(step);
    if (idx < activeSteps.length - 1) setStep(activeSteps[idx + 1]);
  };

  const prev = () => {
    const idx = activeSteps.indexOf(step);
    if (idx > 0) setStep(activeSteps[idx - 1]);
    else router.back();
  };

  const toggleExtra = (id: number) => {
    setSelectedExtras((prev) => {
      const existing = prev.find((e) => e.id === id);
      if (existing) return prev.filter((e) => e.id !== id);
      return [...prev, { id, quantity: 1 }];
    });
  };

  const setExtraQuantity = (id: number, delta: number) => {
    setSelectedExtras((prev) =>
      prev.map((se) => se.id === id ? { ...se, quantity: Math.max(1, se.quantity + delta) } : se),
    );
  };

  const handleApplyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) return;
    setDiscountError('');
    setIsValidatingDiscount(true);
    try {
      const result = await publicApi.validateDiscount(code);
      if (result.valid && result.discount) {
        setAppliedDiscount({ code: result.discount.code, type: result.discount.type, value: result.discount.value });
        setDiscountError('');
      } else {
        setDiscountError('Invalid or expired code');
      }
    } catch {
      setDiscountError('Could not validate code');
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError('');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const totalDuration = durationHours + durationMinutes / 60;
      const discountLine = breakdown.lines.find((l) => l.type === 'discount');
      const discountAmt = discountLine ? Math.abs(discountLine.amount) : 0;

      await bookingsApi.create({
        serviceType: selectedService?.name || 'General/Standard Cleaning',
        date,
        time,
        totalPrice: breakdown.total,
        depositTermsAccepted: true,
        address: { line1: address.line1, city: address.city, postcode: address.postcode },
        contact: { name: contactName, email: contactEmail, phone: contactPhone },
        propertyDetails: {
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          toilets: property.toilets,
          livingRooms: property.livingRooms,
          kitchens: property.kitchens,
          receptionRooms: property.receptionRooms,
          utilityRooms: property.utilityRooms,
          clockRoomToilets: property.clockRoomToilets,
          carpetSteamCleaning: property.carpetSteamCleaning,
          sqftRange: property.sqftRange,
          size: property.size,
          frequency,
          duration: totalDuration,
          notifyIfMoreTimeNeeded,
          commercialDetails: isQuoteBased ? commercialDetails : undefined,
          callOutCharge: isDeepOrEOT ? resolveCallOutCharge(selectedService) : undefined,
          smsUpdatesOptIn: smsOptIn,
          cleaningMaterials: MATERIALS_KEY[materials] ?? undefined,
        },
        extras: selectedExtras.map((se) => ({ id: se.id, quantity: se.quantity })),
        instructions,
        frequency,
        duration: totalDuration,
        discountCode: appliedDiscount?.code || undefined,
        discountAmount: discountAmt > 0 ? discountAmt : undefined,
        tipAmount: Number(breakdown.tipAmount.toFixed(2)),
      });
      Alert.alert(
        'Booking Confirmed!',
        'Your cleaning has been booked. You will receive a confirmation shortly.',
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } catch (err) {
      Alert.alert('Booking Failed', err instanceof Error ? err.message : 'Could not create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let h = 7; h <= 19; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      if (h < 19) slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const generateDates = () => {
    const dates: { value: string; label: string; day: string }[] = [];
    for (let i = 1; i <= 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        value: d.toISOString().split('T')[0],
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      });
    }
    return dates;
  };

  const visibleExtras = useMemo(() => {
    if (isDeepOrEOT) {
      return extras.filter((e) => !isRoomExtra(e.name));
    }
    return extras;
  }, [extras, isDeepOrEOT]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prev} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Image source={require('../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <Text style={styles.stepIndicator}>{currentIdx + 1}/{activeSteps.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step: Service */}
          {step === 'service' && (
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>What type of clean?</Text>
              <Text style={styles.stepSub}>Choose the service that fits your needs</Text>
              <View style={styles.serviceGrid}>
                {services.map((svc) => {
                  const active = selectedService?.id === svc.id;
                  const svcTrigger = getServiceTrigger(svc);
                  const priceLabel = (svcTrigger === 'commercial' || svcTrigger === 'jet_washing')
                    ? 'Quote based'
                    : (svcTrigger === 'deep' || svcTrigger === 'end_of_tenancy')
                      ? `From ${'£'}${resolveCallOutCharge(svc).toFixed(0)} call-out`
                      : svcTrigger === 'standard' && londonRateOf(svc) !== null
                        ? `From ${'£'}${Number(svc.baseRate).toFixed(2)}/hr · London ${'£'}${londonRateOf(svc)!.toFixed(2)}/hr`
                        : `From ${'£'}${Number(svc.baseRate).toFixed(2)}/hr`;
                  return (
                    <TouchableOpacity
                      key={svc.id}
                      style={[styles.serviceCard, active && styles.serviceCardActive]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedService(svc)}
                    >
                      <View style={[styles.serviceIcon, active && styles.serviceIconActive]}>
                        <Ionicons
                          name={SERVICE_ICONS[svc.id] || SERVICE_ICONS[svcTrigger] || 'sparkles-outline'}
                          size={24}
                          color={active ? COLORS.white : COLORS.primary}
                        />
                      </View>
                      <Text style={[styles.serviceName, active && styles.serviceNameActive]}>{svc.name}</Text>
                      <Text style={styles.servicePrice}>{priceLabel}</Text>
                      {active && (
                        <View style={styles.checkMark}>
                          <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step: Details (service-specific) */}
          {step === 'details' && (
            <View style={styles.stepBody}>
              {/* AirBnB: bedroom count with fixed duration */}
              {isAirbnb && (
                <>
                  <Text style={styles.stepTitle}>Number of Bedrooms</Text>
                  <Text style={styles.stepSub}>Duration is set automatically based on bedroom count</Text>
                  <View style={styles.durationRow}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = property.bedrooms === n;
                      return (
                        <TouchableOpacity
                          key={n}
                          style={[styles.durChip, active && styles.durChipActive, { paddingHorizontal: SPACING.lg }]}
                          onPress={() => {
                            setProperty((p) => ({ ...p, bedrooms: n }));
                            const hrs = resolveAirbnbHours(n);
                            setDurationHours(hrs);
                            setDurationMinutes(0);
                          }}
                        >
                          <Text style={[styles.durText, active && styles.durTextActive]}>
                            {n} Bed{n > 1 ? 's' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {(property.bedrooms || 0) > 0 && (
                    <View style={styles.infoBox}>
                      <Ionicons name="time-outline" size={20} color="#2563eb" />
                      <Text style={styles.infoBoxText}>
                        Fixed duration: {resolveAirbnbHours(property.bedrooms || 0)} hours
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Commercial / Jet Washing: details textarea */}
              {isQuoteBased && (
                <>
                  <Text style={styles.stepTitle}>
                    {trigger === 'jet_washing' ? 'Surface Details' : 'Commercial Property Details'}
                  </Text>
                  <Text style={styles.stepSub}>
                    {trigger === 'jet_washing'
                      ? 'Describe the surfaces to be cleaned so we can prepare an accurate quote'
                      : 'Describe your commercial property and cleaning requirements'}
                  </Text>
                  <TextInput
                    style={[styles.textArea, { minHeight: 120 }]}
                    value={commercialDetails}
                    onChangeText={setCommercialDetails}
                    placeholder={trigger === 'jet_washing'
                      ? 'E.g. driveway, patio, deck, specific requirements...'
                      : 'E.g. office space, retail store, cleaning requirements...'}
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    numberOfLines={5}
                  />
                  <Text style={[styles.charCount, commercialDetails.trim().length >= COMMERCIAL_MIN_CHARS && styles.charCountOk]}>
                    {commercialDetails.trim().length} / {COMMERCIAL_MIN_CHARS} characters minimum
                  </Text>
                  <View style={styles.infoBox}>
                    <Ionicons name="briefcase-outline" size={20} color="#2563eb" />
                    <Text style={styles.infoBoxText}>
                      This is a bespoke service. We will prepare a personalised quote based on your description.
                    </Text>
                  </View>
                </>
              )}

              {/* Deep / EOT: room grid linked to extras catalog */}
              {isDeepOrEOT && (
                <>
                  <Text style={styles.stepTitle}>Property Details</Text>
                  <Text style={styles.stepSub}>Each room type has individual pricing</Text>
                  {([
                    { label: 'Bedrooms', fragment: 'bedroom', key: 'bedrooms' as const, icon: 'bed-outline' as const },
                    { label: 'Reception Rooms', fragment: 'reception', key: 'receptionRooms' as const, icon: 'tv-outline' as const },
                    { label: 'Bathrooms', fragment: 'bathroom', key: 'bathrooms' as const, icon: 'water-outline' as const },
                    { label: 'Utility Rooms', fragment: 'utility', key: 'utilityRooms' as const, icon: 'construct-outline' as const },
                    { label: 'Kitchens', fragment: 'kitchen', key: 'kitchens' as const, icon: 'cafe-outline' as const },
                    { label: 'Carpet Steam Cleaning', fragment: 'carpet', key: 'carpetSteamCleaning' as const, icon: 'layers-outline' as const },
                  ]).map((room) => {
                    const ex = findExtraByName(room.fragment);
                    const qty = ex ? (selectedExtras.find((s) => s.id === ex.id)?.quantity || 0) : (property[room.key] || 0);
                    const price = ex ? Number(ex.price) : 0;
                    return (
                      <View key={room.key} style={styles.counterRow}>
                        <View style={styles.counterLabel}>
                          <Ionicons name={room.icon} size={18} color={COLORS.textSecondary} />
                          <View>
                            <Text style={styles.counterText}>{room.label}</Text>
                            {price > 0 && <Text style={styles.counterPrice}>{'£'}{price.toFixed(0)} each</Text>}
                          </View>
                        </View>
                        <View style={styles.counterControls}>
                          <TouchableOpacity
                            style={styles.counterBtn}
                            onPress={() => {
                              const newQty = Math.max(0, qty - 1);
                              if (ex) updateRoomExtra(room.fragment, newQty);
                              setProperty((p) => ({ ...p, [room.key]: newQty }));
                            }}
                          >
                            <Ionicons name="remove" size={18} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.counterBtn}
                            onPress={() => {
                              const newQty = qty + 1;
                              if (ex) updateRoomExtra(room.fragment, newQty);
                              setProperty((p) => ({ ...p, [room.key]: newQty }));
                            }}
                          >
                            <Ionicons name="add" size={18} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  {/* Clockroom Toilet (special handling) */}
                  {(() => {
                    const toiletEx = resolveToiletExtra(extras);
                    const toiletQty = toiletEx
                      ? (selectedExtras.find((s) => s.id === toiletEx.id)?.quantity || 0)
                      : (property.clockRoomToilets || 0);
                    const toiletPrice = toiletEx ? Number(toiletEx.price) : 15;
                    return (
                      <View style={styles.counterRow}>
                        <View style={styles.counterLabel}>
                          <Ionicons name="water-outline" size={18} color={COLORS.textSecondary} />
                          <View>
                            <Text style={styles.counterText}>Cloakroom Toilet</Text>
                            {toiletPrice > 0 && <Text style={styles.counterPrice}>{'£'}{toiletPrice.toFixed(0)} each</Text>}
                          </View>
                        </View>
                        <View style={styles.counterControls}>
                          <TouchableOpacity
                            style={styles.counterBtn}
                            onPress={() => {
                              const newQty = Math.max(0, toiletQty - 1);
                              if (toiletEx) {
                                setSelectedExtras((prev) => {
                                  const others = prev.filter((p) => p.id !== toiletEx.id);
                                  return newQty > 0 ? [...others, { id: toiletEx.id, quantity: newQty }] : others;
                                });
                              }
                              setProperty((p) => ({ ...p, clockRoomToilets: newQty, toilets: newQty }));
                            }}
                          >
                            <Ionicons name="remove" size={18} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{toiletQty}</Text>
                          <TouchableOpacity
                            style={styles.counterBtn}
                            onPress={() => {
                              const newQty = toiletQty + 1;
                              if (toiletEx) {
                                setSelectedExtras((prev) => {
                                  const others = prev.filter((p) => p.id !== toiletEx.id);
                                  return [...others, { id: toiletEx.id, quantity: newQty }];
                                });
                              }
                              setProperty((p) => ({ ...p, clockRoomToilets: newQty, toilets: newQty }));
                            }}
                          >
                            <Ionicons name="add" size={18} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()}

                  <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Square Footage</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
                      {SQFT_RANGES.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.durChip, property.sqftRange === r && styles.durChipActive]}
                          onPress={() => setProperty((p) => ({ ...p, sqftRange: r }))}
                        >
                          <Text style={[styles.durText, property.sqftRange === r && styles.durTextActive, { fontSize: 11 }]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* General/Standard: property size + duration */}
              {isGeneral && (
                <>
                  <Text style={styles.stepTitle}>Property & Duration</Text>
                  <Text style={styles.stepSub}>Tell us about your space and how long you need</Text>

                  {usesRegionalRate && (
                    <>
                      <Text style={styles.fieldLabel}>Property postcode</Text>
                      <TextInput
                        style={styles.input}
                        value={address.postcode}
                        onChangeText={(t) => setAddress((a) => ({ ...a, postcode: t.toUpperCase() }))}
                        placeholder="e.g. E2 7NX or M3 2BW"
                        placeholderTextColor={COLORS.textTertiary}
                        autoCapitalize="characters"
                      />
                      <Text style={[styles.stepSub, { marginTop: SPACING.xs, marginBottom: SPACING.md }]}>
                        {regionChecking
                          ? 'Checking your area...'
                          : pricingRegion === 'london'
                            ? `London postcode: £${effectiveRate.toFixed(2)} per hour`
                            : pricingRegion === 'standard'
                              ? `£${effectiveRate.toFixed(2)} per hour for this postcode`
                              : `We use your postcode for the right hourly rate (London £${(londonRateOf(selectedService) ?? 0).toFixed(2)}/hr).`}
                      </Text>
                    </>
                  )}

                  <Text style={styles.fieldLabel}>Property Size</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: SPACING.xs }}>
                      {PROPERTY_SIZES.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.durChip, property.size === s && styles.durChipActive]}
                          onPress={() => setProperty((p) => ({ ...p, size: s }))}
                        >
                          <Text style={[styles.durText, property.size === s && styles.durTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Duration</Text>
                  <View style={styles.durationRow}>
                    {[2, 3, 4, 5, 6, 7, 8].map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.durChip, durationHours === h && durationMinutes === 0 && styles.durChipActive]}
                        onPress={() => { setDurationHours(h); setDurationMinutes(0); }}
                      >
                        <Text style={[styles.durText, durationHours === h && durationMinutes === 0 && styles.durTextActive]}>{h}h</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.durationRow}>
                    {[
                      { label: '+ 0 min', mins: 0 },
                      { label: '+ 30 min', mins: 30 },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.mins}
                        style={[styles.durChip, durationMinutes === opt.mins && styles.durChipActive]}
                        onPress={() => setDurationMinutes(opt.mins)}
                      >
                        <Text style={[styles.durText, durationMinutes === opt.mins && styles.durTextActive]}>
                          {opt.mins === 0 ? 'No extra' : '+30 min'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.checkRow}
                    onPress={() => setNotifyIfMoreTimeNeeded(!notifyIfMoreTimeNeeded)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.smsCheckbox, notifyIfMoreTimeNeeded && styles.smsCheckboxChecked]}>
                      {notifyIfMoreTimeNeeded && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                    </View>
                    <Text style={styles.checkRowText}>Notify me if the job requires more time</Text>
                  </TouchableOpacity>

                  <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Cleaning Materials</Text>
                  {([
                    { key: 'none' as const, label: 'No materials needed', price: '' },
                    { key: 'hoover' as const, label: 'Hoover only', price: '+£3' },
                    { key: 'hoover_materials' as const, label: 'Hoover + materials', price: '+£6' },
                  ]).map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.materialRow, materials === opt.key && styles.materialRowActive]}
                      onPress={() => setMaterials(opt.key)}
                    >
                      <View style={[styles.radioOuter, materials === opt.key && styles.radioOuterActive]}>
                        {materials === opt.key && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.materialLabel, materials === opt.key && styles.materialLabelActive]}>
                        {opt.label}
                      </Text>
                      {opt.price !== '' && <Text style={styles.materialPrice}>{opt.price}</Text>}
                    </TouchableOpacity>
                  ))}

                  <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Special Instructions (optional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={instructions}
                    onChangeText={setInstructions}
                    placeholder="E.g. pet in the house, avoid certain rooms..."
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}
            </View>
          )}

          {/* Step: Extras */}
          {step === 'extras' && (
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Additional Services</Text>
              <Text style={styles.stepSub}>Optional add-on services</Text>
              {visibleExtras.length === 0 && (
                <Text style={styles.noExtras}>No extras available at the moment</Text>
              )}
              {visibleExtras.map((ex) => {
                const sel = selectedExtras.find((s) => s.id === ex.id);
                const isSelected = !!sel;
                return (
                  <View key={ex.id} style={[styles.extraCard, isSelected && styles.extraCardActive]}>
                    <TouchableOpacity
                      style={styles.extraLeft}
                      activeOpacity={0.7}
                      onPress={() => toggleExtra(ex.id)}
                    >
                      <View style={[styles.extraCheck, isSelected && styles.extraCheckActive]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.extraName}>{ex.name}</Text>
                        <Text style={styles.extraPrice}>+{'£'}{Number(ex.price).toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                    {isSelected && (
                      <View style={styles.extraQtyControls}>
                        <TouchableOpacity onPress={() => setExtraQuantity(ex.id, -1)} style={styles.extraQtyBtn}>
                          <Ionicons name="remove-circle-outline" size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.extraQtyText}>{sel!.quantity}</Text>
                        <TouchableOpacity onPress={() => setExtraQuantity(ex.id, 1)} style={styles.extraQtyBtn}>
                          <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={styles.freqSection}>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <View style={styles.freqRow}>
                  {FREQUENCIES.map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                      onPress={() => setFrequency(f)}
                    >
                      <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Instructions for non-general services */}
              {!isGeneral && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Special Instructions (optional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={instructions}
                    onChangeText={setInstructions}
                    placeholder="E.g. pet in the house, avoid certain rooms..."
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}
            </View>
          )}

          {/* Step: Date & Time */}
          {step === 'datetime' && (
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Pick a date & time</Text>
              <Text style={styles.stepSub}>Choose when you'd like your clean</Text>
              <Text style={styles.fieldLabel}>Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                {generateDates().map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.dateChip, date === d.value && styles.dateChipActive]}
                    onPress={() => setDate(d.value)}
                  >
                    <Text style={[styles.dateDay, date === d.value && styles.dateDayActive]}>{d.day}</Text>
                    <Text style={[styles.dateLabel, date === d.value && styles.dateLabelActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Time</Text>
              <View style={styles.timeGrid}>
                {generateTimeSlots().map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.timeChip, time === t && styles.timeChipActive]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[styles.timeText, time === t && styles.timeTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step: Address & Contact */}
          {step === 'address' && (
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Where should we come?</Text>
              <Text style={styles.stepSub}>Enter the property address and your details</Text>

              <Text style={styles.fieldLabel}>Address Line 1 *</Text>
              <TextInput
                style={styles.input}
                value={address.line1}
                onChangeText={(t) => setAddress((a) => ({ ...a, line1: t }))}
                placeholder="123 High Street"
                placeholderTextColor={COLORS.textTertiary}
              />
              <Text style={styles.fieldLabel}>Address Line 2</Text>
              <TextInput
                style={styles.input}
                value={address.line2}
                onChangeText={(t) => setAddress((a) => ({ ...a, line2: t }))}
                placeholder="Flat, Floor, etc."
                placeholderTextColor={COLORS.textTertiary}
              />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={address.city}
                    onChangeText={(t) => setAddress((a) => ({ ...a, city: t }))}
                    placeholder="London"
                    placeholderTextColor={COLORS.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Postcode *</Text>
                  <View style={styles.postcodeRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={address.postcode}
                      onChangeText={(t) => {
                        setAddress((a) => ({ ...a, postcode: t.toUpperCase() }));
                        setPostcodeResults([]);
                      }}
                      placeholder="SW1A 1AA"
                      placeholderTextColor={COLORS.textTertiary}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={styles.lookupBtn}
                      activeOpacity={0.7}
                      onPress={async () => {
                        const pc = address.postcode.trim().replace(/\s/g, '');
                        if (pc.length < 5) return;
                        setLookingUp(true);
                        try {
                          const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`);
                          const json = await res.json();
                          if (json.status === 200 && json.result) {
                            const r = json.result;
                            setAddress((a) => ({
                              ...a,
                              city: r.admin_district || r.parish || '',
                              postcode: r.postcode || a.postcode,
                            }));
                          }
                        } catch {}
                        setLookingUp(false);
                      }}
                    >
                      {lookingUp ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Ionicons name="search" size={16} color={COLORS.white} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.contactDivider}>
                <View style={styles.contactDividerLine} />
                <Text style={styles.contactDividerText}>Your Details</Text>
                <View style={styles.contactDividerLine} />
              </View>

              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={contactName}
                onChangeText={setContactName}
                placeholder="Your full name"
                placeholderTextColor={COLORS.textTertiary}
              />
              <Text style={styles.fieldLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+44 7700 900000"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
              />
            </View>
          )}

          {/* Step: Summary */}
          {step === 'summary' && (
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Booking Summary</Text>
              <Text style={styles.stepSub}>Review your booking before confirming</Text>
              <View style={styles.summaryCard}>
                <SummaryRow label="Service" value={selectedService?.name || ''} />
                <SummaryRow
                  label="Date"
                  value={date ? new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
                />
                <SummaryRow label="Time" value={time} />
                <SummaryRow label="Frequency" value={frequency} />
                {(isGeneral || isAirbnb) && (
                  <SummaryRow
                    label="Duration"
                    value={
                      isAirbnb
                        ? `${resolveAirbnbHours(property.bedrooms || 0)} hours (fixed)`
                        : durationMinutes > 0 ? `${durationHours}h 30m` : `${durationHours} hours`
                    }
                  />
                )}
                {isDeepOrEOT && (
                  <>
                    <SummaryRow label="Bedrooms" value={String(getExtraQty('bedroom') || property.bedrooms || 0)} />
                    <SummaryRow label="Bathrooms" value={String(getExtraQty('bathroom') || property.bathrooms || 0)} />
                    <SummaryRow label="Kitchens" value={String(getExtraQty('kitchen') || property.kitchens || 0)} />
                    {(property.receptionRooms || 0) > 0 && <SummaryRow label="Reception Rooms" value={String(property.receptionRooms)} />}
                    {(property.utilityRooms || 0) > 0 && <SummaryRow label="Utility Rooms" value={String(property.utilityRooms)} />}
                    {(property.clockRoomToilets || 0) > 0 && <SummaryRow label="Cloakroom Toilets" value={String(property.clockRoomToilets)} />}
                    {(property.carpetSteamCleaning || 0) > 0 && <SummaryRow label="Carpet Steam Cleaning" value={String(property.carpetSteamCleaning)} />}
                  </>
                )}
                {isGeneral && property.size && <SummaryRow label="Property" value={property.size} />}
                {isQuoteBased && commercialDetails && (
                  <SummaryRow label="Details" value={commercialDetails.substring(0, 80) + (commercialDetails.length > 80 ? '...' : '')} />
                )}
                <SummaryRow label="Address" value={`${address.line1}, ${address.postcode}`} />
                <SummaryRow label="Name" value={contactName} />
                <SummaryRow label="Email" value={contactEmail} />
                {contactPhone ? <SummaryRow label="Phone" value={contactPhone} /> : null}
                {selectedExtras.length > 0 && !isDeepOrEOT && (
                  <SummaryRow
                    label="Extras"
                    value={selectedExtras.map((se) => {
                      const name = extras.find((e) => e.id === se.id)?.name;
                      return se.quantity > 1 ? `${name} x${se.quantity}` : name;
                    }).filter(Boolean).join(', ')}
                  />
                )}
                {materials !== 'none' && (
                  <SummaryRow
                    label="Materials"
                    value={materials === 'hoover' ? 'Hoover only (+£3)' : 'Hoover + materials (+£6)'}
                  />
                )}
                {instructions ? <SummaryRow label="Instructions" value={instructions} /> : null}
              </View>

              {/* Discount code */}
              <Text style={styles.fieldLabel}>Promo Code</Text>
              {appliedDiscount ? (
                <View style={styles.discountApplied}>
                  <View style={styles.discountAppliedLeft}>
                    <Ionicons name="pricetag" size={16} color="#059669" />
                    <Text style={styles.discountAppliedText}>
                      {appliedDiscount.code} ({appliedDiscount.type === 'percentage'
                        ? `${appliedDiscount.value}% off`
                        : `£${appliedDiscount.value} off`})
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveDiscount}>
                    <Text style={styles.discountRemove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.discountRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={discountCode}
                    onChangeText={(t) => { setDiscountCode(t); setDiscountError(''); }}
                    placeholder="Enter code"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={[styles.applyBtn, (!discountCode.trim() || isValidatingDiscount) && styles.applyBtnDisabled]}
                    onPress={handleApplyDiscount}
                    disabled={!discountCode.trim() || isValidatingDiscount}
                  >
                    {isValidatingDiscount ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.applyBtnText}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {discountError !== '' && <Text style={styles.discountErrorText}>{discountError}</Text>}

              {/* Tip */}
              <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Tip (optional)</Text>
              <View style={styles.tipRow}>
                {TIP_OPTIONS.map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.tipChip, !useCustomTip && tipPercent === pct && styles.tipChipActive]}
                    onPress={() => { setTipPercent(pct); setUseCustomTip(false); }}
                  >
                    <Text style={[styles.tipText, !useCustomTip && tipPercent === pct && styles.tipTextActive]}>
                      {pct === 0 ? 'None' : `${pct}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.tipChip, useCustomTip && styles.tipChipActive]}
                  onPress={() => setUseCustomTip(true)}
                >
                  <Text style={[styles.tipText, useCustomTip && styles.tipTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>
              {useCustomTip && (
                <TextInput
                  style={[styles.input, { marginTop: SPACING.sm }]}
                  value={customTip}
                  onChangeText={setCustomTip}
                  placeholder="Tip amount (£)"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="decimal-pad"
                />
              )}

              {/* Price breakdown */}
              <View style={styles.breakdownCard}>
                {breakdown.lines.map((line, i) => (
                  <View key={i} style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, line.type === 'discount' && styles.breakdownGreen]}>
                      {line.label}
                    </Text>
                    <Text style={[styles.breakdownAmount, line.type === 'discount' && styles.breakdownGreen]}>
                      {line.amount < 0 ? '-' : ''}{'£'}{Math.abs(line.amount).toFixed(2)}
                    </Text>
                  </View>
                ))}
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownTotalLabel}>Total</Text>
                  <Text style={styles.breakdownTotalAmount}>
                    {isQuoteBased ? 'Quote' : `£${breakdown.total.toFixed(2)}`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.smsOptRow}
                onPress={() => setSmsOptIn(!smsOptIn)}
                activeOpacity={0.7}
              >
                <View style={[styles.smsCheckbox, smsOptIn && styles.smsCheckboxChecked]}>
                  {smsOptIn && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                </View>
                <Text style={styles.smsOptText}>Receive SMS updates & reminders about my booking</Text>
              </TouchableOpacity>

              {!user && (
                <View style={styles.guestNote}>
                  <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.guestNoteText}>
                    Booking as guest. Create a free account to track your bookings and earn rewards.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom area: expandable drawer + price + button */}
      <View style={styles.bottomArea}>
        {selectedService && !isQuoteBased && (
          <Animated.View
            style={[styles.summaryDrawer, {
              maxHeight: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 350] }),
              opacity: drawerAnim,
            }]}
          >
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {breakdown.lines.map((line, i) => (
                <View key={i} style={styles.drawerRow}>
                  <Text style={[styles.drawerLabel, line.type === 'discount' && styles.breakdownGreen]}>
                    {line.label}
                  </Text>
                  <Text style={[styles.drawerAmount, line.type === 'discount' && styles.breakdownGreen]}>
                    {line.amount < 0 ? '-' : ''}{'£'}{Math.abs(line.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.drawerDivider} />
              <View style={styles.drawerRow}>
                <Text style={styles.drawerTotalLabel}>Total</Text>
                <Text style={styles.drawerTotalAmount}>{'£'}{breakdown.total.toFixed(2)}</Text>
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {selectedService && !isQuoteBased && (
          <TouchableOpacity onPress={toggleDrawer} style={styles.priceRow} activeOpacity={0.7}>
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>EST. TOTAL</Text>
              <Text style={styles.priceAmount}>{'£'}{breakdown.total.toFixed(2)}</Text>
            </View>
            <View style={styles.drawerToggle}>
              <Ionicons
                name={summaryExpanded ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={COLORS.primary}
              />
            </View>
          </TouchableOpacity>
        )}

        {selectedService && isQuoteBased && (
          <View style={styles.priceRow}>
            <View style={styles.priceInfo}>
              <Text style={styles.priceLabel}>PRICING</Text>
              <Text style={[styles.priceAmount, { fontSize: 16 }]}>Quote Based</Text>
            </View>
          </View>
        )}

        <View style={styles.bottomBar}>
          {step === 'summary' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isQuoteBased ? 'Request Quote' : 'Confirm Booking'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, !canNext() && styles.primaryBtnDisabled]}
              onPress={next}
              disabled={!canNext()}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={summaryStyles.value}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  label: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  value: { fontSize: 14, fontWeight: '500', color: COLORS.text, flex: 2, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLogo: { width: 120, height: 40 },
  stepIndicator: { fontSize: 13, color: COLORS.textTertiary, minWidth: 36, textAlign: 'right' },

  progressTrack: {
    height: 3, backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.lg, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  content: { paddingBottom: 160 },
  stepBody: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  stepTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  stepSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.lg },

  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  serviceCard: {
    width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.base, borderWidth: 1.5, borderColor: COLORS.borderLight, position: 'relative',
  },
  serviceCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  serviceIcon: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  serviceIconActive: { backgroundColor: COLORS.primary },
  serviceName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  serviceNameActive: { color: COLORS.primary },
  servicePrice: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  checkMark: { position: 'absolute', top: 10, right: 10 },

  counterRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, paddingVertical: 12,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  counterLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  counterText: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  counterPrice: { fontSize: 11, color: COLORS.textTertiary, marginTop: 1 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  counterBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt, justifyContent: 'center', alignItems: 'center',
  },
  counterValue: { fontSize: 17, fontWeight: '700', color: COLORS.text, minWidth: 20, textAlign: 'center' },

  durationRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.sm },
  durChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  durChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  durTextActive: { color: COLORS.white },

  materialRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, paddingVertical: 14,
    marginBottom: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.borderLight,
  },
  materialRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioOuterActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  materialLabel: { fontSize: 14, fontWeight: '500', color: COLORS.text, flex: 1 },
  materialLabelActive: { color: COLORS.primary },
  materialPrice: { fontSize: 13, fontWeight: '600', color: COLORS.textTertiary },

  extraCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, paddingVertical: 14,
    marginBottom: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.borderLight,
  },
  extraCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  extraLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  extraCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  extraCheckActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  extraName: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  extraPrice: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  noExtras: { fontSize: 14, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: SPACING.xl },
  extraQtyControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  extraQtyBtn: { padding: 2 },
  extraQtyText: { fontSize: 16, fontWeight: '700', color: COLORS.text, minWidth: 22, textAlign: 'center' },

  freqSection: { marginTop: SPACING.lg },
  freqRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  freqChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  freqChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  freqText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  freqTextActive: { color: COLORS.white },

  dateScroll: { marginBottom: SPACING.sm },
  dateChip: {
    width: 64, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderLight,
    alignItems: 'center', marginRight: SPACING.sm,
  },
  dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateDay: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary },
  dateDayActive: { color: 'rgba(255,255,255,0.8)' },
  dateLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  dateLabelActive: { color: COLORS.white },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  timeChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  timeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  timeTextActive: { color: COLORS.white },

  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12, fontSize: 16, color: COLORS.text,
  },
  textArea: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: 12,
    fontSize: 15, color: COLORS.text, minHeight: 80, textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: SPACING.md },
  postcodeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  lookupBtn: {
    width: 42, height: 42, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },

  contactDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: SPACING.xl, marginBottom: SPACING.sm, gap: SPACING.md,
  },
  contactDividerLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  contactDividerText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  summaryCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.base, borderWidth: 1, borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },

  discountRow: { flexDirection: 'row', gap: SPACING.sm },
  applyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, justifyContent: 'center', alignItems: 'center',
  },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  discountApplied: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ecfdf5', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, paddingVertical: 12,
    borderWidth: 1, borderColor: '#a7f3d0',
  },
  discountAppliedLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  discountAppliedText: { fontSize: 14, fontWeight: '600', color: '#059669' },
  discountRemove: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  discountErrorText: { fontSize: 12, color: '#dc2626', marginTop: SPACING.xs },

  tipRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  tipChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tipChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tipTextActive: { color: COLORS.white },

  breakdownCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.base, marginTop: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  breakdownLabel: { fontSize: 13, color: COLORS.textSecondary },
  breakdownAmount: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  breakdownGreen: { color: '#059669' },
  breakdownDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 6 },
  breakdownTotalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  breakdownTotalAmount: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  guestNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.primary + '08', borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
  },
  guestNoteText: { fontSize: 13, color: COLORS.textSecondary, flex: 1, lineHeight: 18 },

  smsOptRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#f8fafc', borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.lg,
  },
  smsCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.borderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  smsCheckboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  smsOptText: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#f8fafc', borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.sm,
  },
  checkRowText: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },

  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#eff6ff', borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  infoBoxText: { fontSize: 13, fontWeight: '500', color: '#1e40af', flex: 1, lineHeight: 18 },

  charCount: {
    fontSize: 11, fontWeight: '700', color: '#b45309',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.xs,
  },
  charCountOk: { color: '#059669' },

  bottomArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  summaryDrawer: {
    overflow: 'hidden', paddingHorizontal: SPACING.lg,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  drawerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  drawerLabel: { fontSize: 13, color: COLORS.textSecondary },
  drawerAmount: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  drawerDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 4 },
  drawerTotalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  drawerTotalAmount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  priceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  priceInfo: { flex: 1 },
  priceLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, letterSpacing: 0.8 },
  priceAmount: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  drawerToggle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center', alignItems: 'center',
  },

  bottomBar: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
});
