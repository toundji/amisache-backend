// ============================================================
// UNIFIED AUTH — websocket.channel.ts
// Channel transitoire — pas de persistance propre (voir §5 du spec :
// "un channel peut être purement transitoire sans persistance").
// Stub tant qu'aucun WebSocketEmitter n'est fourni : send() est un no-op.
// Le projet consommateur branche sa passerelle (Gateway) en implémentant
// WebSocketEmitter et en la passant au constructeur.
// ============================================================
import type {
  NotificationChannel,
  NotifyPayload,
  WebSocketEmitter,
} from '../notification.types';

export class WebSocketChannel implements NotificationChannel {
  readonly key = 'websocket';

  constructor(
    private readonly emitter?: WebSocketEmitter,
    private readonly event: string = 'notification',
  ) {}

  supports(): boolean {
    return true;
  }

  send(payload: NotifyPayload): Promise<void> {
    if (!this.emitter) return Promise.resolve(); // stub — aucune gateway branchée

    if (payload.userId) {
      this.emitter.emitToUser?.(payload.userId, this.event, payload);
    } else {
      this.emitter.emitBroadcast?.(this.event, payload);
    }
    return Promise.resolve();
  }
}
