import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Cantique } from '../database/entities/cantique.entity';
import { SaveCantiqueDto } from './dto/cantique.dto';

@Injectable()
export class CantiquesService {
  constructor(
    @InjectRepository(Cantique) private readonly repo: Repository<Cantique>,
  ) {}

  async search(query = '') {
    const q = query.trim();
    return this.repo.find({
      where: q
        ? [
            { title: ILike(`%${q}%`) },
            { number: ILike(`%${q}%`) },
            { lyrics: ILike(`%${q}%`) },
          ]
        : {},
      order: { title: 'ASC' },
      take: 30,
    });
  }

  async create(dto: SaveCantiqueDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: SaveCantiqueDto) {
    const cantique = await this.repo.findOne({ where: { id } });
    if (!cantique) throw new NotFoundException('Cantique introuvable');
    Object.assign(cantique, dto);
    return this.repo.save(cantique);
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Cantique introuvable');
    return { deleted: true };
  }

  async importMany(
    items: SaveCantiqueDto[],
    rightsConfirmation: string,
  ) {
    if (!/autorisé|autorisee|autorisee|licence|domaine public/i.test(rightsConfirmation ?? '')) {
      throw new BadRequestException(
        'Confirmez la licence, l’autorisation ou le domaine public des paroles importées.',
      );
    }
    if (!Array.isArray(items) || !items.length || items.length > 1000) {
      throw new BadRequestException('Le fichier doit contenir entre 1 et 1000 cantiques.');
    }

    let created = 0;
    let updated = 0;
    for (const raw of items) {
      const title = raw.title?.trim();
      const lyrics = raw.lyrics?.trim();
      if (!title || !lyrics) continue;
      const source = raw.source?.trim() || 'Import autorisé';
      const existing = raw.number
        ? await this.repo.findOne({ where: { source, number: raw.number.trim() } })
        : await this.repo.findOne({ where: { source, title } });
      const value = {
        ...raw,
        title,
        lyrics,
        source,
        rightsNote: raw.rightsNote?.trim() || rightsConfirmation.trim(),
      };
      if (existing) {
        Object.assign(existing, value);
        await this.repo.save(existing);
        updated++;
      } else {
        await this.repo.save(this.repo.create(value));
        created++;
      }
    }
    return { created, updated, total: created + updated };
  }
}
