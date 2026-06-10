import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Priere } from '../database/entities/priere.entity';
import { MailService } from '../mail/mail.service';

export type PriereStatut = 'en_attente' | 'pris_en_charge' | 'ferme';

@Injectable()
export class PrieresService {
  constructor(
    @InjectRepository(Priere) private repo: Repository<Priere>,
    private mail: MailService,
  ) {}

  async soumettre(data: { prenom?: string; anonyme?: boolean; sujet: string; message: string; email?: string }) {
    const anonyme = data.anonyme ?? false;
    const prenom = data.prenom?.trim() || 'Anonyme';
    const saved = await this.repo.save(this.repo.create({
      prenom:  anonyme ? 'Anonyme' : prenom,
      anonyme,
      sujet:   data.sujet,
      message: data.message,
      email:   anonyme ? undefined : data.email,
      statut:  'en_attente',
    }));

    if (!anonyme && data.email) {
      await this.mail.sendConfirmationPriere(data.email, prenom, data.sujet).catch(() => {});
    }

    return { id: saved.id, success: true };
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatut(id: string, statut: PriereStatut) {
    await this.repo.update(id, { statut });
    return { success: true };
  }

  async supprimer(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }
}
