// ============================================================
// UNIFIED AUTH — notification.dto.ts
// DTOs des routes /notifications/*.
// ============================================================

export interface ListNotificationsQuery {
  page?: number; // défaut : 1
  limit?: number; // défaut : 20, max : 100
}

/** Vue fusionnée — ciblée ou de groupe, état lu/non-lu résolu par le service. */
export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt?: Date;
  expiresAt?: Date | null;
}

export interface PaginatedNotifications {
  data: NotificationView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
