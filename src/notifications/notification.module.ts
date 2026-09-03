// ============================================================
// UNIFIED AUTH — notification.module.ts
// Module abstrait et réutilisable. Chaque projet consommateur enregistre
// ses propres channels + son mapping type -> channel via forRoot()/
// forRootAsync() — voir notification.types.ts pour le contrat.
// ============================================================
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './entities/notification.entity';
import { NotificationState } from './entities/notification-state.entity';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MODULE_OPTIONS,
  NotificationModuleAsyncOptions,
  NotificationModuleOptions,
} from './notification.types';

@Module({})
export class NotificationModule {
  static forRoot(options: NotificationModuleOptions): DynamicModule {
    return {
      module: NotificationModule,
      imports: [TypeOrmModule.forFeature([Notification, NotificationState])],
      controllers: [NotificationController],
      providers: [
        NotificationService,
        { provide: NOTIFICATION_MODULE_OPTIONS, useValue: options },
        { provide: NOTIFICATION_CHANNELS, useValue: options.channels },
      ],
      exports: [NotificationService],
    };
  }

  static forRootAsync(options: NotificationModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: NOTIFICATION_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };
    const channelsProvider: Provider = {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (moduleOptions: NotificationModuleOptions) =>
        moduleOptions.channels,
      inject: [NOTIFICATION_MODULE_OPTIONS],
    };

    return {
      module: NotificationModule,
      imports: [
        ...(options.imports ?? []),
        TypeOrmModule.forFeature([Notification, NotificationState]),
      ],
      controllers: [NotificationController],
      providers: [NotificationService, optionsProvider, channelsProvider],
      exports: [NotificationService],
    };
  }
}
