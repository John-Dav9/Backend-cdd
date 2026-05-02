import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actualite } from '../database/entities/actualite.entity';
import { CreateActualiteDto } from './dto/create-actualite.dto';

@Injectable()
export class ActualitesService {
  constructor(@InjectRepository(Actualite) private repo: Repository<Actualite>) {}

  private parseTags(tags?: string): string[] {
    if (!tags) return [];
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  async create(dto: CreateActualiteDto) {
    const entity = this.repo.create({
      titre: dto.titre,
      contenu: dto.contenu,
      auteur: dto.auteur,
      imageUrl: dto.imageUrl,
      videoId: dto.videoId,
      publiee: dto.publiee ?? false,
      tags: this.parseTags(dto.tags),
    });
    const saved = await this.repo.save(entity);
    return { id: saved.id, message: 'Actualité créée' };
  }

  async findAll(publieeOnly = false) {
    return this.repo.find({ where: publieeOnly ? { publiee: true } : {}, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Actualité introuvable');
    return a;
  }

  async update(id: string, dto: Partial<CreateActualiteDto>) {
    const { tags, ...rest } = dto;
    const data: Partial<Actualite> = { ...rest };
    if (tags !== undefined) data.tags = this.parseTags(tags);
    await this.repo.update(id, data);
    return { message: 'Actualité mise à jour' };
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { message: 'Actualité supprimée' };
  }
}
