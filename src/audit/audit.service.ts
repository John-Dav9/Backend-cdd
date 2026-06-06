import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
  ) {}

  async log(data: {
    userId?: string;
    userEmail?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }): Promise<void> {
    await this.repo.save(data);
  }

  async findAll(filters?: { action?: string; resourceType?: string; userId?: string; limit?: number }) {
    const qb = this.repo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');
    if (filters?.action) qb.andWhere('log.action ILIKE :action', { action: `%${filters.action}%` });
    if (filters?.resourceType) qb.andWhere('log.resourceType = :resourceType', { resourceType: filters.resourceType });
    if (filters?.userId) qb.andWhere('log.userId = :userId', { userId: filters.userId });
    qb.take(filters?.limit ?? 100);
    return qb.getMany();
  }
}
