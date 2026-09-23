// ============================================================
// content.module.ts
// Contenu public non-métier : formulaire de contact + FAQ + settings.
// Regroupés dans un seul module — chacun est trop petit (une entité,
// un controller) pour justifier son propre module au sens de la règle
// de dépendance à sens unique (voir CLAUDE.md § Architecture) ; contact/,
// faq/ et settings/ ne dépendent pas l'un de l'autre, seulement de mail/
// (contact) et de shared/core/database comme le reste du template.
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';

import { ContactMessage } from './entities/contact-message.entity';
import { Faq } from './entities/faq.entity';
import { Setting } from './entities/setting.entity';
import { LiturgicalPeriod } from './entities/liturgical-period.entity';

import { ContactController } from './controllers/contact.controller';
import { FaqController } from './controllers/faq.controller';
import { SettingController } from './controllers/setting.controller';
import { LiturgicalPeriodController } from './controllers/liturgical-period.controller';

import { ContactService } from './services/contact.service';
import { FaqService } from './services/faq.service';
import { SettingService } from './services/setting.service';
import { LiturgicalPeriodService } from './services/liturgical-period.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactMessage, Faq, Setting, LiturgicalPeriod]),
    MailModule,
  ],
  controllers: [ContactController, FaqController, SettingController, LiturgicalPeriodController],
  providers: [ContactService, FaqService, SettingService, LiturgicalPeriodService],
  exports: [ContactService, FaqService, SettingService, LiturgicalPeriodService],
})
export class ContentModule {}
