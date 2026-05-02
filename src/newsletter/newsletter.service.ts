import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsletterSubscriber } from '../database/entities/newsletter-subscriber.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber) private repo: Repository<NewsletterSubscriber>,
    private mail: MailService,
  ) {}

  async subscribe(email: string, prenom?: string) {
    const existing = await this.repo.findOne({ where: { email: email.toLowerCase() } });
    if (existing) throw new BadRequestException('Vous êtes déjà abonné à la newsletter.');

    await this.repo.save(this.repo.create({ email: email.toLowerCase(), prenom: prenom ?? '' }));
    await this.mail.sendConfirmationNewsletter(email, prenom ?? 'ami(e)').catch(() => {});

    return { success: true };
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async desabonner(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  async getEmails(): Promise<string[]> {
    const all = await this.repo.find({ select: ['email'] });
    return all.map(s => s.email).filter(Boolean);
  }
}
