import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import {
  ApiKeyGuard,
  RequireClientTypeGuard,
  RequireAuthGuard,
  RequireUserStatusGuard,
  RequireRoleGuard,
} from './core/guards/jwt-auth.guard';
import { ApiDeserializationMiddleware } from './core/middleware/api-middleware';
import {
  UserAuditInterceptor,
  UserAuditSubscriber,
} from './core/interceptors/api-audit';
import { ApiErrorFilter } from './core/filters/api-error-filter';
import { baseOrmConfig } from './database/base_orm_config';
import { MailModule } from './mail/mail.module';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContentModule } from './content/content.module';
import { ChatModule } from './chat/chat.module';
import { FileSystemStoredFile, NestjsFormDataModule } from 'nestjs-form-data';
import { NotificationModule } from './notifications/notification.module';
import { InAppChannel } from './notifications/channels/in-app.channel';

@Module({
  imports: [
    // ── Upload multipart/form-data (avatars, pièces jointes) ─
    NestjsFormDataModule.config({
      storage: FileSystemStoredFile,
      fileSystemStoragePath: './tmp/storage',
      isGlobal: true,
    }),

    ConfigModule.forRoot({ isGlobal: true }),
    // ── TypeORM (MySQL) ───────────────────────────────────
    TypeOrmModule.forRoot(baseOrmConfig),

    // ── Redis (ioredis — pour les guards et les services) ─
    RedisModule.forRoot({
      type: 'single',
      options: {
        port: parseInt(process.env.REDIS_PORT || '17215'),
        host: process.env.REDIS_HOST,
        username: process.env.REDIS_USER || 'default',
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 10_000,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      },
    }),

    // ── BullMQ (queues Redis) ─────────────────────────────
    BullModule.forRoot({
      prefix: process.env.REDIS_PREFIX || 'bull', // ← option BullMQ native, pas keyPrefix ioredis
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        skipVersionCheck: true, // BullMQ ignore le check de version
        // ⚠️ PAS de keyPrefix ici — les scripts Lua internes de BullMQ (ex. moveToDelayed)
        // ne le connaissent pas et cherchent la clé sans préfixe → "Missing key for job N"
      },
    }),

    // // ── Bull Board (dashboard /queues) ────────────────────
    // BullBoardModule.forRoot({
    //   route: '/queues',
    //   adapter: ExpressAdapter,
    //   middleware: basicAuth({
    //     challenge: true,
    //     users: { admin: process.env.DOC_PASSWORD as string },
    //   }),
    // }),

    // ── JWT (global) ──────────────────────────────────────
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: (process.env.JWT_TOKEN_EXPIRES_IN ?? '15m') as any,
      },
    }),

    // ── Context local storage (ClsService → audit trail) ──
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),

    // ── Events ────────────────────────────────────────────
    EventEmitterModule.forRoot(),

    // ── Cron jobs ─────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Feature Modules ───────────────────────────────────
    MailModule,
    AuthModule,
    UsersModule,
    ContentModule,
    ChatModule,

    // Notifications : module abstrait, channels enregistrés par le projet.
    // Défaut = in-app uniquement (persistance + GET /notifications). Pour
    // brancher FCM (token/topic) ou WebSocket, ajouter FcmTokenChannel /
    // FcmTopicChannel / WebSocketChannel ci-dessous avec un FcmSender /
    // WebSocketEmitter propre au projet — voir src/notifications/notification.types.ts.
    NotificationModule.forRoot({
      channels: [new InAppChannel()],
    }),
    // VotreModule, // ← ajoutez vos modules métier ici
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // ── Guards globaux (ordre important) ─────────────────
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: RequireClientTypeGuard },
    { provide: APP_GUARD, useClass: RequireAuthGuard },
    { provide: APP_GUARD, useClass: RequireUserStatusGuard },
    { provide: APP_GUARD, useClass: RequireRoleGuard },

    // ── Intercepteur audit (CLS → createdBy/updatedBy) ───
    { provide: APP_INTERCEPTOR, useClass: UserAuditInterceptor },

    // ── Filtre d'erreurs global ────────────────────────────
    { provide: APP_FILTER, useClass: ApiErrorFilter },

    // ── Subscriber TypeORM audit ──────────────────────────
    UserAuditSubscriber,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiDeserializationMiddleware).forRoutes('*');
  }
}
