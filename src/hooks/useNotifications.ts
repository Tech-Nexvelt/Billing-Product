import { useCallback } from 'react';
import { useNotificationStore, NotificationType } from '@/stores/notification.store';

export function useNotifications() {
  const store = useNotificationStore();

  const notify = useCallback((type: NotificationType, title: string, message: string, actionLabel?: string, actionCallback?: () => void) => {
    store.addNotification({ type, title, message, action_label: actionLabel, action_callback: actionCallback });
  }, [store]);

  const notifySuccess = useCallback((title: string, message: string) => notify('success', title, message), [notify]);
  const notifyError = useCallback((title: string, message: string) => notify('error', title, message), [notify]);
  const notifyWarning = useCallback((title: string, message: string) => notify('warning', title, message), [notify]);
  const notifyInfo = useCallback((title: string, message: string) => notify('info', title, message), [notify]);

  return {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    markRead: store.markRead,
    markAllRead: store.markAllRead,
    removeNotification: store.removeNotification,
    clearAll: store.clearAll,
  };
}
