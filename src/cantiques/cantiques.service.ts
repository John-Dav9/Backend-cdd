import { Injectable, NotFoundException } from '@nestjs/common';
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
}
