// ============================================================
// UNIFIED AUTH — fcm-topic.channel.ts
// Push FCM vers un topic — utilisé pour les notifications de groupe
// (userId = null). Le topic est dérivé de `notif-${type}` par défaut ;
// personnalisable via le second paramètre du constructeur.
// Firebase est injecté via FcmSender — jamais importé en dur ici.
// ============================================================
import { Logger } from '@nestjs/common';
import {
  FcmSender,
  NotificationChannel,
  NotifyPayload,
} from '../notification.types';

export class FcmTopicChannel implements NotificationChannel {
  readonly key = 'fcm-topic';
  private readonly logger = new Logger(FcmTopicChannel.name);

  constructor(
    private readonly sender: FcmSender,
    private readonly resolveTopic: (payload: NotifyPayload) => string = (
      payload,
    ) => `notif-${payload.type}`,
  ) {}

  supports(payload: NotifyPayload): boolean {
    return !payload.userId;
  }

  async send(payload: NotifyPayload): Promise<void> {
    if (payload.userId) return;

    try {
      await this.sender.sendToTopic(this.resolveTopic(payload), {
        title: payload.title,
        body: payload.body,
        data: stringifyData(payload.data),
      });
    } catch (err) {
      this.logger.error(`FCM topic push failed: ${err}`);
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
