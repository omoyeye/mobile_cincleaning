import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { staffApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { ListSkeleton } from '../../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../../constants/config';
import type { Staff, DayAvailability } from '../../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePickerModal({
  visible,
  value,
  label,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  label: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  const [hour, setHour] = useState(value.split(':')[0]);
  const [minute, setMinute] = useState(value.split(':')[1] || '00');

  useEffect(() => {
    if (visible) {
      setHour(value.split(':')[0]);
      const m = value.split(':')[1] || '00';
      const closest = MINUTES.reduce((prev, curr) =>
        Math.abs(parseInt(curr) - parseInt(m)) < Math.abs(parseInt(prev) - parseInt(m)) ? curr : prev
      );
      setMinute(closest);
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
          <Text style={styles.modalTitle}>{label}</Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pickerScrollContent}
              >
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerItem, hour === h && styles.pickerItemActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.pickerItemText, hour === h && styles.pickerItemTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.pickerColon}>:</Text>
            <View style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>Min</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pickerScrollContent}
              >
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, minute === m && styles.pickerItemActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.pickerItemText, minute === m && styles.pickerItemTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => { onSelect(`${hour}:${minute}`); onClose(); }}
            >
              <Text style={styles.modalConfirmText}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function RotaScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timePicker, setTimePicker] = useState<{ day: string; field: 'start' | 'end'; value: string } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const profiles = await staffApi.getStaffList();
      const me = profiles.find((s: Staff) => s.email === user?.email);
      if (me) {
        setStaff(me);
        setAvailability(
          me.availability && me.availability.length > 0
            ? me.availability
            : DAYS.map((d) => ({ day: d, isOpen: d !== 'Sunday', start: '08:00', end: '18:00' }))
        );
      }
    } catch {
      showToast('Could not load availability', 'error');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const toggleDay = (day: string) => {
    setAvailability((prev) =>
      prev.map((a) => (a.day === day ? { ...a, isOpen: !a.isOpen } : a))
    );
  };

  const updateTime = (day: string, field: 'start' | 'end', time: string) => {
    setAvailability((prev) =>
      prev.map((a) => {
        if (a.day !== day) return a;
        const updated = { ...a, [field]: time };
        if (field === 'start' && time >= a.end) {
          const h = parseInt(time.split(':')[0]);
          updated.end = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`;
        }
        if (field === 'end' && time <= a.start) {
          const h = parseInt(time.split(':')[0]);
          updated.start = `${String(Math.max(h - 1, 0)).padStart(2, '0')}:00`;
        }
        return updated;
      })
    );
  };

  const handleSave = async () => {
    if (!staff) return;
    setSaving(true);
    try {
      await staffApi.updateProfile(staff.id, { availability });
      showToast('Availability updated', 'success');
    } catch {
      showToast('Could not save availability', 'error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <ListSkeleton count={7} />
      </SafeAreaView>
    );
  }

  const openDays = availability.filter((a) => a.isOpen).length;
  const totalHours = availability
    .filter((a) => a.isOpen)
    .reduce((sum, a) => {
      const s = parseInt(a.start.split(':')[0]) + parseInt(a.start.split(':')[1] || '0') / 60;
      const e = parseInt(a.end.split(':')[0]) + parseInt(a.end.split(':')[1] || '0') / 60;
      return sum + Math.max(0, e - s);
    }, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>My Availability</Text>
          <Text style={styles.subtitle}>{openDays} of 7 days available</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="sunny-outline" size={22} color={COLORS.primary} />
            <Text style={styles.summaryNum}>{openDays}</Text>
            <Text style={styles.summaryLabel}>Working</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="moon-outline" size={22} color={COLORS.textTertiary} />
            <Text style={styles.summaryNum}>{7 - openDays}</Text>
            <Text style={styles.summaryLabel}>Days Off</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="time-outline" size={22} color={COLORS.secondary} />
            <Text style={styles.summaryNum}>{totalHours.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Hrs/Week</Text>
          </View>
        </View>

        {availability.map((day) => (
          <View key={day.day} style={[styles.dayCard, !day.isOpen && styles.dayCardOff]}>
            <View style={styles.dayHeader}>
              <View style={styles.dayLeft}>
                <View style={[styles.dayDot, day.isOpen ? styles.dayDotOn : styles.dayDotOff]} />
                <Text style={[styles.dayName, !day.isOpen && styles.dayNameOff]}>{day.day}</Text>
              </View>
              <Switch
                value={day.isOpen}
                onValueChange={() => toggleDay(day.day)}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={day.isOpen ? COLORS.primary : COLORS.textTertiary}
              />
            </View>
            {day.isOpen && (
              <View style={styles.dayTimes}>
                <TouchableOpacity
                  style={styles.timeBlock}
                  onPress={() => setTimePicker({ day: day.day, field: 'start', value: day.start })}
                  activeOpacity={0.6}
                >
                  <Text style={styles.timeLabel}>Start</Text>
                  <View style={styles.timeValueRow}>
                    <Text style={styles.timeValue}>{day.start}</Text>
                    <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={14} color={COLORS.textTertiary} />
                <TouchableOpacity
                  style={styles.timeBlock}
                  onPress={() => setTimePicker({ day: day.day, field: 'end', value: day.end })}
                  activeOpacity={0.6}
                >
                  <Text style={styles.timeLabel}>End</Text>
                  <View style={styles.timeValueRow}>
                    <Text style={styles.timeValue}>{day.end}</Text>
                    <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <View style={styles.saveBtnInner}>
              <Text style={styles.saveBtnText}>Saving...</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {timePicker && (
        <TimePickerModal
          visible
          value={timePicker.value}
          label={`${timePicker.day} - ${timePicker.field === 'start' ? 'Start' : 'End'} Time`}
          onSelect={(time) => updateTime(timePicker.day, timePicker.field, time)}
          onClose={() => setTimePicker(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  logoRow: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  headerLogo: { width: 140, height: 45 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { paddingTop: SPACING.lg, marginBottom: SPACING.lg },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 4,
  },
  summaryNum: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary },
  dayCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  dayCardOff: { opacity: 0.6 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayDotOn: { backgroundColor: '#22c55e' },
  dayDotOff: { backgroundColor: COLORS.textTertiary },
  dayName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  dayNameOff: { color: COLORS.textTertiary },
  dayTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  timeBlock: { alignItems: 'center' },
  timeLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase' },
  timeValue: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  timeValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.lg },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  pickerCol: { alignItems: 'center', flex: 1 },
  pickerLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase', marginBottom: SPACING.sm },
  pickerScroll: { maxHeight: 200 },
  pickerScrollContent: { paddingVertical: SPACING.xs },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: 4,
    alignItems: 'center',
  },
  pickerItemActive: { backgroundColor: COLORS.primary },
  pickerItemText: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  pickerItemTextActive: { color: COLORS.white },
  pickerColon: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginTop: SPACING.lg },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
