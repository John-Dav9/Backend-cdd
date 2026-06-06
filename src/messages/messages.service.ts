import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../database/entities/message.entity';

export interface CreateMessageDto {
  title: string;
  speaker: string;
  date: string;
  videoId: string;
  publie?: boolean;
}

@Injectable()
export class MessagesService {
  constructor(@InjectRepository(Message) private repo: Repository<Message>) {}

  findAll() {
    return this.repo.find({ where: { publie: true }, order: { date: 'DESC' } });
  }

  findAllAdmin() {
    return this.repo.find({ order: { date: 'DESC' } });
  }

  async create(dto: CreateMessageDto) {
    const saved = await this.repo.save(this.repo.create({ ...dto, publie: dto.publie ?? true }));
    return { id: saved.id, message: 'Message créé' };
  }

  async update(id: string, dto: Partial<CreateMessageDto>) {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException('Message introuvable');
    await this.repo.update(id, dto);
    return { message: 'Message mis à jour' };
  }

  async remove(id: string) {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException('Message introuvable');
    await this.repo.delete(id);
    return { message: 'Message supprimé' };
  }
}
