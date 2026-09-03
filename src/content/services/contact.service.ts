// ============================================================
// UNIFIED AUTH — contact.service.ts
// Réception du formulaire de contact public + gestion admin.
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ContactMessage } from '../entities/contact-message.entity';
import { MailService } from '../../mail/mail.service';
import { ApiErrorNotFoundById } from '../../utils/api-error';
import { ContactMessageStatus } from '../../shared/common.enum';
import {
  CreateContactMessageDto,
  ListContactMessagesQuery,
  ListContactMessagesSortBy,
  PaginatedContactMessages,
  UpdateContactStatusDto,
} from '../dto/contact.dto';

const SORTABLE_COLUMNS: Record<ListContactMessagesSortBy, string> = {
  createdAt: 'm.createdAt',
  status: 'm.status',
};

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepo: Repository<ContactMessage>,
    private readonly mailService: MailService,
  ) {}

  // ── Formulaire public ──────────────────────────────────────

  async create(
    body: CreateContactMessageDto,
    ip?: string,
  ): Promise<{ success: boolean }> {
    const entity = this.contactRepo.create({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      subject: body.subject?.trim(),
      message: body.message.trim(),
      ip,
    });
    await this.contactRepo.save(entity);

    const adminEmail = process.env.CONTACT_ADMIN_EMAIL;
    if (adminEmail) {
      await this.mailService.sendContactNotification({
        adminEmail,
        senderName: entity.name,
        senderEmail: entity.email,
        subject: entity.subject,
        message: entity.message,
      });
    }

    await this.mailService.sendContactAcknowledgement(
      { email: entity.email, firstName: entity.name },
      entity.subject,
    );

    return { success: true };
  }

  // ── Admin — liste / détail ────────────────────────────────

  async list(
    query: ListContactMessagesQuery,
  ): Promise<PaginatedContactMessages> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const sortColumn =
      SORTABLE_COLUMNS[query.sortBy!] ?? SORTABLE_COLUMNS.createdAt;
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    let qb = this.contactRepo
      .createQueryBuilder('m')
      .skip(skip)
      .take(limit)
      .orderBy(sortColumn, sortOrder);

    if (query.status) {
      qb = qb.andWhere('m.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb = qb.andWhere(
        '(m.email LIKE :term OR m.name LIKE :term OR m.subject LIKE :term)',
        { term },
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string): Promise<ContactMessage> {
    const message = await this.contactRepo.findOne({ where: { id } });
    if (!message) throw new ApiErrorNotFoundById('contact_messages', id);
    return message;
  }

  // ── Admin — mise à jour statut ────────────────────────────

  async updateStatus(
    id: string,
    body: UpdateContactStatusDto,
  ): Promise<{ success: boolean }> {
    const message = await this.getById(id);

    const patch: Partial<ContactMessage> = {
      status: body.status,
      adminNote: body.adminNote,
    };
    if (body.status === ContactMessageStatus.read && !message.readAt) {
      patch.readAt = new Date();
    }
    if (body.status === ContactMessageStatus.treated && !message.answeredAt) {
      patch.answeredAt = new Date();
    }

    await this.contactRepo.update(message.id, patch);
    return { success: true };
  }

  // ── Admin — suppression ───────────────────────────────────

  async delete(id: string): Promise<{ success: boolean }> {
    const message = await this.getById(id);
    await this.contactRepo.delete(message.id);
    return { success: true };
  }
}
