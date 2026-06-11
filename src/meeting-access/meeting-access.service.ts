import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { MeetingAccessLink } from '../database/entities/meeting-access-link.entity';
import { Meeting } from '../database/entities/meeting.entity';

@Injectable()
export class MeetingAccessService {
  constructor(
    @InjectRepository(MeetingAccessLink)
    private readonly accessRepo: Repository<MeetingAccessLink>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    private readonly jwtService: JwtService,
  ) {}

  async create(meetingId: string, data: { label?: string; validHours?: number; maxUses?: number }) {
    const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Réunion introuvable.');
    const secret = randomBytes(32).toString('base64url');
    const validHours = Math.max(1, Math.min(24 * 90, Number(data.validHours) || 168));
    const link = await this.accessRepo.save(this.accessRepo.create({
      meetingId,
      tokenHash: await bcrypt.hash(secret, 10),
      label: data.label?.trim().slice(0, 100) || 'Accès simplifié',
      expiresAt: new Date(Date.now() + validHours * 60 * 60 * 1000),
      maxUses: data.maxUses ? Math.max(1, Math.min(1000, Number(data.maxUses))) : null as any,
    }));
    return { ...link, token: `${link.id}.${secret}` };
  }

  list(meetingId: string) {
    return this.accessRepo.find({
      where: { meetingId },
      order: { createdAt: 'DESC' },
      select: ['id', 'label', 'expiresAt', 'revokedAt', 'maxUses', 'useCount', 'createdAt'],
    });
  }

  async revoke(meetingId: string, linkId: string) {
    const link = await this.accessRepo.findOne({ where: { id: linkId, meetingId } });
    if (!link) throw new NotFoundException('Lien introuvable.');
    link.revokedAt = new Date();
    await this.accessRepo.save(link);
    return { revoked: true };
  }

  async accept(rawToken: string, displayName: string) {
    const [id, secret] = rawToken?.split('.') ?? [];
    const name = displayName?.trim().slice(0, 100);
    if (!id || !secret || !name) throw new ForbiddenException('Lien d’accès invalide.');
    const link = await this.accessRepo.findOne({ where: { id }, relations: ['meeting'] });
    if (
      !link ||
      link.revokedAt ||
      new Date(link.expiresAt) <= new Date() ||
      (link.maxUses && link.useCount >= link.maxUses) ||
      !await bcrypt.compare(secret, link.tokenHash)
    ) {
      throw new ForbiddenException('Ce lien a expiré ou a été révoqué.');
    }
    if (link.meeting.status === 'ended' || link.meeting.status === 'cancelled') {
      throw new ForbiddenException('Cette réunion est terminée.');
    }

    link.useCount += 1;
    await this.accessRepo.save(link);
    const guestId = `access-${randomBytes(16).toString('hex')}`;
    const accessToken = await this.jwtService.signAsync({
      sub: guestId,
      name,
      email: '',
      role: 'visitor',
      type: 'visitor',
      meetingAccessFor: link.meetingId,
    }, { expiresIn: '12h' });
    const [firstName, ...lastName] = name.split(/\s+/);
    return {
      access_token: accessToken,
      meetingId: link.meetingId,
      member: {
        id: guestId,
        firstName,
        lastName: lastName.join(' '),
        email: '',
        role: 'visitor',
        meetingAccessFor: link.meetingId,
      },
    };
  }
}
