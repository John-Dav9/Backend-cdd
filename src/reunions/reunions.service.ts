import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Member } from '../database/entities/member.entity';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MailService } from '../mail/mail.service';
import { CreateReunionDto, JoinReunionDto, UpdateReunionDto } from './dto/reunions.dto';
import { JitsiService } from './jitsi.service';
import { randomBytes } from 'crypto';

@Injectable()
export class ReunionsService {
  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant) private participantRepo: Repository<MeetingParticipant>,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    private jitsiService: JitsiService,
    private mailService: MailService,
  ) {}

  async findAll() {
    return this.meetingRepo.find({
      order: { startTime: 'DESC' },
      take: 50,
    });
  }

  async findCurrent() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const live = await this.meetingRepo.findOne({
      where: { status: 'live' },
      order: { startTime: 'DESC' },
    });
    if (live) return live;

    return this.meetingRepo.findOne({
      where: {
        status: 'scheduled',
        startTime: LessThanOrEqual(now),
      },
      order: { startTime: 'DESC' },
    });
  }

  async findUpcoming() {
    const now = new Date();
    return this.meetingRepo.find({
      where: {
        status: 'scheduled',
        startTime: MoreThanOrEqual(now),
      },
      order: { startTime: 'ASC' },
      take: 10,
    });
  }

  async findOne(id: string) {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    return meeting;
  }

  async create(dto: CreateReunionDto, createdById: string) {
    const jitsiRoomId = this.jitsiService.generateRoomId();
    const meeting = await this.meetingRepo.save({
      title: dto.title,
      description: dto.description,
      startTime: new Date(dto.startTime),
      endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      isPublic: dto.isPublic ?? true,
      isRecurring: dto.isRecurring ?? false,
      recurrenceRule: dto.recurrenceRule,
      jitsiRoomId,
      status: 'scheduled',
      createdById,
    });
    return meeting;
  }

  async update(id: string, dto: UpdateReunionDto) {
    const meeting = await this.findOne(id);
    Object.assign(meeting, {
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : meeting.startTime,
      endTime: dto.endTime ? new Date(dto.endTime) : meeting.endTime,
    });
    return this.meetingRepo.save(meeting);
  }

  async remove(id: string) {
    const meeting = await this.findOne(id);
    meeting.status = 'cancelled';
    await this.meetingRepo.save(meeting);
    return { message: 'Réunion annulée' };
  }

  async join(id: string, memberId: string, dto: JoinReunionDto) {
    const meeting = await this.findOne(id);

    if (meeting.status === 'cancelled') {
      throw new ForbiddenException('Cette réunion a été annulée');
    }
    if (meeting.status === 'ended') {
      throw new ForbiddenException('Cette réunion est terminée');
    }

    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Membre non trouvé');

    const isModerator = member.role === 'admin' || member.role === 'super_admin';
    const displayName = dto.displayName || `${member.firstName} ${member.lastName}`;
    const reconnectToken = randomBytes(16).toString('hex');

    // Enregistrer la participation
    const existing = await this.participantRepo.findOne({
      where: { meetingId: id, memberId },
    });

    if (existing) {
      existing.leftAt = null as any;
      existing.lastSeenAt = new Date();
      existing.wasAdmin = isModerator;
      existing.reconnectToken = reconnectToken;
      await this.participantRepo.save(existing);
    } else {
      await this.participantRepo.save({
        meetingId: id,
        memberId,
        displayName,
        wasAdmin: isModerator,
        reconnectToken,
        lastSeenAt: new Date(),
      });

      // Mettre la réunion en live si c'est le premier participant
      if (meeting.status === 'scheduled') {
        meeting.status = 'live';
        await this.meetingRepo.save(meeting);
      }
    }

    const token = this.jitsiService.generateToken(meeting.jitsiRoomId, member, isModerator);
    const jitsiUrl = this.jitsiService.getJitsiUrl();

    return {
      jitsiToken: token,
      jitsiUrl,
      roomId: meeting.jitsiRoomId,
      isModerator,
      reconnectToken,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
      },
    };
  }

  async end(id: string) {
    const meeting = await this.findOne(id);
    meeting.status = 'ended';
    meeting.endTime = new Date();
    await this.meetingRepo.save(meeting);

    await this.participantRepo.update(
      { meetingId: id, leftAt: undefined as any },
      { leftAt: new Date() },
    );

    return { message: 'Réunion terminée' };
  }

  async heartbeat(meetingId: string, memberId: string) {
    await this.participantRepo.update(
      { meetingId, memberId },
      { lastSeenAt: new Date() },
    );
    return { ok: true };
  }

  async reconnect(meetingId: string, memberId: string, token: string) {
    const participant = await this.participantRepo.findOne({
      where: { meetingId, memberId, reconnectToken: token },
    });

    if (!participant) throw new ForbiddenException('Token de reconnexion invalide');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (participant.lastSeenAt < fiveMinutesAgo) {
      throw new ForbiddenException('Session expirée. Rejoignez en tant que membre.');
    }

    participant.leftAt = null as any;
    participant.lastSeenAt = new Date();
    participant.disconnectCount += 1;
    await this.participantRepo.save(participant);

    return {
      restored: true,
      wasAdmin: participant.wasAdmin,
      message: participant.wasAdmin
        ? 'Vos droits de modérateur ont été restaurés'
        : 'Vous avez rejoint à nouveau la réunion',
    };
  }

  async getParticipants(id: string) {
    return this.participantRepo.find({
      where: { meetingId: id, leftAt: undefined as any },
      relations: ['member'],
    });
  }

  async sendReminders(id: string) {
    const meeting = await this.findOne(id);
    const members = await this.memberRepo.find({ where: { isActive: true } });

    let sent = 0;
    for (const member of members) {
      if (!member.email) continue;
      await this.mailService.sendMeetingReminder(
        member.email,
        member.firstName,
        { title: meeting.title, startTime: meeting.startTime },
      );
      sent++;
    }
    return { message: `${sent} rappels envoyés` };
  }
}
