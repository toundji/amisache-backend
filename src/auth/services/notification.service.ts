// ============================================================
// UNIFIED AUTH — notification.service.ts
// Firebase Cloud Messaging — mobile uniquement.
// Service optionnel : ne pas importer si le projet est web only.
//
// Initialisation Firebase via FIREBASE_SDK (JSON string en .env).
// Génerer une clé : Firebase Console → Paramètres → Comptes de service
// ============================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private initialized = false;

  // ── Initialisation Firebase ───────────────────────────────

  /**
   * Appelé automatiquement par NestJS au démarrage du module.
   * Initialise Firebase Admin SDK depuis la variable FIREBASE_SDK.
   *
   * FIREBASE_SDK doit contenir le JSON complet du compte de service :
   *   FIREBASE_SDK={"type":"service_account","project_id":"..."}
   */
  onModuleInit(): void {
    const sdk = process.env.FIREBASE_SDK;

    if (!sdk) {
      this.logger.warn('FIREBASE_SDK not set — push notifications disabled.');
      return;
    }

    try {
      // Éviter la double initialisation si le module est rechargé
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(sdk)),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized.');
    } catch (err) {
      this.logger.error(`Firebase initialization failed: ${err}`);
    }
  }

  // ── Topics ────────────────────────────────────────────────

  /**
   * Abonne un équipement aux topics de l'utilisateur.
   * Appelé lors du login mobile (setImmediate — non bloquant).
   */
  async subscribeToUserTopics(
    userId: string,
    fcmToken: string,
    extraTopics: string[] = [],
  ): Promise<void> {
    if (!this.initialized) return;

    const topics = [`user-${userId}`, 'global-notifications', ...extraTopics];

    const messaging = admin.messaging();

    await Promise.allSettled(
      topics.map((topic) =>
        messaging
          .subscribeToTopic(fcmToken, topic)
          .catch((err) =>
            this.logger.error(`Subscribe to topic "${topic}" failed: ${err}`),
          ),
      ),
    );
  }

  async unsubscribeFromUserTopics(
    userId: string,
    fcmToken: string,
  ): Promise<void> {
    if (!this.initialized) return;

    const topics = [`user-${userId}`, 'global-notifications'];
    const messaging = admin.messaging();

    await Promise.allSettled(
      topics.map((topic) =>
        messaging
          .unsubscribeFromTopic(fcmToken, topic)
          .catch((err) =>
            this.logger.error(
              `Unsubscribe from topic "${topic}" failed: ${err}`,
            ),
          ),
      ),
    );
  }

  // ── Envoi notification ────────────────────────────────────

  /** Envoie une notification à tous les équipements d'un utilisateur */
  async sendToUser(
    userId: string,
    notification: FcmNotification,
  ): Promise<void> {
    if (!this.initialized) return;
    const message = this.buildMessage(notification, {
      topic: `user-${userId}`,
    });
    await this.sendMessage(message);
  }

  /** Envoie une notification à un topic global */
  async sendToTopic(
    topic: string,
    notification: FcmNotification,
  ): Promise<void> {
    if (!this.initialized) return;
    const message = this.buildMessage(notification, { topic });
    await this.sendMessage(message);
  }

  /** Envoie une notification à un équipement spécifique (fcmToken direct) */
  async sendToDevice(
    fcmToken: string,
    notification: FcmNotification,
  ): Promise<void> {
    if (!this.initialized) return;
    const message = this.buildMessage(notification, { token: fcmToken });
    await this.sendMessage(message);
  }

  // ── Privé ─────────────────────────────────────────────────

  private buildMessage(
    notification: FcmNotification,
    target: { topic?: string; token?: string },
  ): admin.messaging.Message {
    return {
      ...target,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data,
      android: {
        notification: {
          icon: process.env.FCM_ICON_URL,
        },
      },
      webpush: notification.webLink
        ? {
            fcmOptions: { link: notification.webLink },
          }
        : undefined,
    } as admin.messaging.Message;
  }

  private async sendMessage(message: admin.messaging.Message): Promise<void> {
    await admin
      .messaging()
      .send(message)
      .catch((err) => {
        this.logger.error(`FCM send failed: ${err}`);
      });
  }
}

// ── Types ─────────────────────────────────────────────────────

export interface FcmNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  webLink?: string;
}
