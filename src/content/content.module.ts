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

import { ContactController } from './controllers/contact.controller';
import { FaqController } from './controllers/faq.controller';
import { SettingController } from './controllers/setting.controller';

import { ContactService } from './services/contact.service';
import { FaqService } from './services/faq.service';
import { SettingService } from './services/setting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactMessage, Faq, Setting]),
    MailModule,
  ],
  controllers: [ContactController, FaqController, SettingController],
  providers: [ContactService, FaqService, SettingService],
  exports: [ContactService, FaqService, SettingService],
})
export class ContentModule {}
