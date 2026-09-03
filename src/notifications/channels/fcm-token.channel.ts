// ============================================================
// UNIFIED AUTH — fcm-token.channel.ts
// Push FCM vers les équipements d'un utilisateur ciblé.
// Firebase est injecté via FcmSender — jamais importé en dur ici.
// ============================================================
import { Logger } from '@nestjs/common';
import {
  FcmSender,
  NotificationChannel,
  NotifyPayload,
} from '../notification.types';

export class FcmTokenChannel implements NotificationChannel {
  readonly key = 'fcm-token';
  private readonly logger = new Logger(FcmTokenChannel.name);

  constructor(private readonly sender: FcmSender) {}

  supports(payload: NotifyPayload): boolean {
    return !!payload.userId;
  }

  async send(payload: NotifyPayload): Promise<void> {
    if (!payload.userId) return;

    try {
      await this.sender.sendToUser(payload.userId, {
        title: payload.title,
        body: payload.body,
        data: stringifyData(payload.data),
      });
    } catch (err) {
      this.logger.error(`FCM token push failed: ${err}`);
    }
  }
}

function stringifyData(
  data?: Record<string, any>,
): Record<string, string> | undefined {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)]),
  );
}
