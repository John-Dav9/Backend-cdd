import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inscription } from '../database/entities/inscription.entity';
import { MailService } from '../mail/mail.service';
import { CreateInscriptionDto, InscriptionType } from './dto/create-inscription.dto';

@Injectable()
export class InscriptionsService {
  constructor(
    @InjectRepository(Inscription) private repo: Repository<Inscription>,
    private mail: MailService,
  ) {}

  async create(dto: CreateInscriptionDto) {
    const saved = await this.repo.save(this.repo.create({ ...dto, statut: 'CONFIRME' }));
    await this.mail.sendConfirmationInscription(dto);
    return { id: saved.id, message: 'Inscription enregistrée avec succès' };
  }

  async findAll(type?: InscriptionType) {
    return this.repo.find({ where: type ? { type } : {}, order: { createdAt: 'DESC' } });
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { message: 'Inscription supprimée' };
  }
}
