import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CellGroup } from '../database/entities/cell-group.entity';

@Injectable()
export class CellGroupsService {
  constructor(
    @InjectRepository(CellGroup) private repo: Repository<CellGroup>,
  ) {}

  findAll() {
    return this.repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Groupe non trouvé');
    return g;
  }

  async create(dto: Partial<CellGroup>) {
    const group = this.repo.create({
      ...dto,
      jitsiRoomId: `cellule-${Math.random().toString(36).slice(2, 10)}`,
    });
    return this.repo.save(group);
  }

  async update(id: string, dto: Partial<CellGroup>) {
    const group = await this.findOne(id);
    Object.assign(group, dto);
    return this.repo.save(group);
  }

  async addMember(groupId: string, memberId: string) {
    const group = await this.findOne(groupId);
    if (!group.memberIds) group.memberIds = [];
    if (!group.memberIds.includes(memberId)) {
      group.memberIds.push(memberId);
      await this.repo.save(group);
    }
    return group;
  }

  async removeMember(groupId: string, memberId: string) {
    const group = await this.findOne(groupId);
    group.memberIds = (group.memberIds ?? []).filter(id => id !== memberId);
    return this.repo.save(group);
  }

  async remove(id: string) {
    const group = await this.findOne(id);
    group.isActive = false;
    await this.repo.save(group);
    return { message: 'Groupe supprimé' };
  }
}
