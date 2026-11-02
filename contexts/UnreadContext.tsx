import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { customerApi, staffApi } from '../services/api';
import { useAuth } from './AuthContext';
import type { Notification } from '../types';

/** Chat and office messages live behind the message icon; everything else rings the bell. */
export const MESSAGE_TYPES = new Set(['chat_message', 'direct_message']);
export const isMessageAlert = (n: Pick<Notification, 'type'>) => MESSAGE_TYPES.has(n.type);

type Unread = {
  /** Unread alerts for the bell. */
  alerts: number;
  /** Unread booking chat messages plus unread office messages, for the message icon. */
  messages: number;
  /** Unread chat messages per booking reference (CIN-... or the numeric id). */
  chatUnreadByRef: Record<string, number>;
  refresh: () => Promise<void>;
  /** Clears the chat alerts for one booking (by its CIN reference) once its chat is opened. */
  markChatRead: (bookingRef?: string | null) => Promise<void>;
  /** Clears office message alerts once the office chat is opened. */
  markOfficeRead: () => Promise<void>;
};

const UnreadContext = createContext<Unread>({
  alerts: 0,
  messages: 0,
  chatUnreadByRef: {},
  refresh: async () => {},
  markChatRead: async () => {},
  markOfficeRead: async () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [list, setList] = useState<Notification[]>([]);
  const [officeUnread, setOfficeUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setList([]);
      setOfficeUnread(0);
      return;
    }
    try {
      setList(await customerApi.getNotifications());
    } catch {}
    if (user.role === 'staff') {
      try {
        const dms = await staffApi.getDirectMessages();
        setOfficeUnread((Array.isArray(dms) ? dms : []).filter((m) => m.senderRole === 'admin' && !m.isRead).length);
      } catch {}
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  const markRead = useCallback(
    async (match: (n: Notification) => boolean) => {
      const hits = list.filter((n) => !n.isRead && match(n));
      if (!hits.length) return;
      const ids = new Set(hits.map((h) => h.id));
      setList((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, isRead: true } : n)));
      await Promise.all(hits.map((n) => customerApi.markNotificationRead(n.id).catch(() => {})));
    },
    [list],
  );

  const markChatRead = useCallback(
    async (bookingRef?: string | null) => {
      const ref = String(bookingRef || '').toUpperCase();
      await markRead((n) => n.type === 'chat_message' && (!ref || n.message.toUpperCase().includes(ref)));
    },
    [markRead],
  );

  const markOfficeRead = useCallback(async () => {
    setOfficeUnread(0);
    await markRead((n) => n.type === 'direct_message');
  }, [markRead]);

  const value = useMemo<Unread>(() => {
    const unread = list.filter((n) => !n.isRead);
    const chats = unread.filter((n) => n.type === 'chat_message');
    const chatUnread = chats.length;
    const chatUnreadByRef: Record<string, number> = {};
    for (const n of chats) {
      // Server format: "Chat · CIN-AB12CD: Name - text"
      const ref = n.message.match(/^Chat\s*·\s*([^:]+):/)?.[1]?.trim().toUpperCase();
      if (ref) chatUnreadByRef[ref] = (chatUnreadByRef[ref] || 0) + 1;
    }
    return {
      chatUnreadByRef,
      alerts: unread.filter((n) => !isMessageAlert(n)).length,
      messages: chatUnread + officeUnread,
      refresh,
      markChatRead,
      markOfficeRead,
    };
  }, [list, officeUnread, refresh, markChatRead, markOfficeRead]);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
