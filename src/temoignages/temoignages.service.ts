import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Temoignage } from '../database/entities/temoignage.entity';
import { CreateTemoignageDto } from './dto/create-temoignage.dto';

export type StatutTemoignage = 'EN_ATTENTE' | 'APPROUVE' | 'REJETE';

@Injectable()
export class TemoignagesService {
  constructor(@InjectRepository(Temoignage) private repo: Repository<Temoignage>) {}

  async create(dto: CreateTemoignageDto) {
    const saved = await this.repo.save(this.repo.create({ ...dto, statut: 'EN_ATTENTE' }));
    return { id: saved.id, message: 'Témoignage soumis, en attente de modération' };
  }

  async findApprouves() {
    return this.repo.find({ where: { statut: 'APPROUVE' }, order: { createdAt: 'DESC' } });
  }

  async findAll(statut?: StatutTemoignage) {
    return this.repo.find({ where: statut ? { statut } : {}, order: { createdAt: 'DESC' } });
  }

  async moderer(id: string, statut: StatutTemoignage) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Témoignage introuvable');
    await this.repo.update(id, { statut });
    return { message: `Témoignage ${statut.toLowerCase()}` };
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { message: 'Témoignage supprimé' };
  }
}
