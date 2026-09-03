// ============================================================
// UNIFIED AUTH — in-app.channel.ts
// La persistance (dédup + lecture via GET /notifications) est faite par
// NotificationService.notify() AVANT la résolution des channels — ce
// channel ne fait donc rien de plus. Il existe pour que le mapping
// type -> channels puisse exprimer explicitement "stocker sans pousser
// en live" (ex. channelsByType: { 'some-type': ['in-app'] }).
// ============================================================
import type { NotificationChannel } from '../notification.types';

export class InAppChannel implements NotificationChannel {
  readonly key = 'in-app';

  supports(): boolean {
    return true;
  }

  // no-op — déjà persisté par NotificationService.notify()
  send(): Promise<void> {
    return Promise.resolve();
  }
}
