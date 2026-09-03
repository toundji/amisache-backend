import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { MAIL_QUEUE } from './mail.types';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { MailFailedJob } from './entities/mail-failed.entity';
import { MailFailedService } from './mail-failed.service';
import { MailController } from './mail.controller';


@Module({
    imports: [

        // ── Entité MailFailedJob ───────────────────────────────
        TypeOrmModule.forFeature([MailFailedJob]),

        // ── Mailer (SMTP + Handlebars) ────────────────────────
        MailerModule.forRootAsync({
            useFactory: () => ({
                transport: {
                    host: process.env.MAIL_HOST,
                    port: parseInt(process.env.MAIL_PORT ?? '587'),
                    secure: process.env.MAIL_SECURE === 'true', // true = port 465
                    auth: {
                        user: process.env.MAIL_USER,
                        pass: process.env.MAIL_PASS,
                    },
                },
                defaults: {
                    from: `"${process.env.APP_NAME ?? 'App'}" <${process.env.MAIL_FROM}>`,
                },
                template: {
                    dir: join(__dirname, 'templates'),
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                        layoutsDir: join(__dirname, 'templates', 'layouts'),
                        defaultLayout: 'main',
                    },
                },
            }),
        }),

        // ── BullMQ Queue ──────────────────────────────────────
        BullModule.registerQueue({
            name: MAIL_QUEUE,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 50,
            },
        }),
    ],
    controllers: [
        MailController,
    ],
    providers: [
        MailService,
        MailProcessor,
        MailFailedService,
    ],
    exports: [
        MailService,
    ],
})
export class MailModule { }
