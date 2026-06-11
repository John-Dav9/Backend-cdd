import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Between, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Member } from '../database/entities/member.entity';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MailService } from '../mail/mail.service';
import { CreateReunionDto, JoinReunionDto, UpdateReunionDto } from './dto/reunions.dto';
import { JitsiService } from './jitsi.service';
import { randomBytes, randomUUID } from 'crypto';
import { AdminSessionService } from '../auth/admin-session.service';
import { MeetingInvite } from '../database/entities/meeting-invite.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ReunionsService {
  private readonly logger = new Logger(ReunionsService.name);

  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant) private participantRepo: Repository<MeetingParticipant>,
    @InjectRepository(MeetingInvite) private inviteRepo: Repository<MeetingInvite>,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    private jitsiService: JitsiService,
    private mailService: MailService,
    private adminSessions: AdminSessionService,
    private jwtService: JwtService,
  ) {}

  async findAll() {
    return this.meetingRepo.find({
      where: { isPublic: true },
      order: { startTime: 'DESC' },
      take: 50,
    });
  }

  async findAllAdmin() {
    return this.meetingRepo.find({
      order: { startTime: 'DESC' },
      take: 100,
    });
  }

  async findCurrent() {
    const now = new Date();

    const live = await this.meetingRepo.findOne({
      where: { status: 'live', isPublic: true },
      order: { startTime: 'DESC' },
    });
    if (live) return live;

    return this.meetingRepo.findOne({
      where: {
        status: 'scheduled',
        isPublic: true,
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
        isPublic: true,
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

  async findCalendar(from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start ||
      end.getTime() - start.getTime() > 370 * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException('Période de calendrier invalide.');
    }
    return this.meetingRepo.find({
      where: {
        isPublic: true,
        startTime: Between(start, end),
      },
      order: { startTime: 'ASC' },
    });
  }

  async findOnePublic(id: string) {
    const meeting = await this.meetingRepo.findOne({ where: { id, isPublic: true } });
    if (!meeting) throw new NotFoundException('Réunion non trouvée');
    return meeting;
  }

  async create(dto: CreateReunionDto, createdById: string | null) {
    const recurrenceRule = dto.isRecurring
      ? this.normalizeRecurrenceRule(dto.recurrenceRule)
      : null;
    const jitsiRoomId = this.jitsiService.generateRoomId();
    const meeting = await this.meetingRepo.save({
      title: dto.title,
      description: dto.description,
      startTime: new Date(dto.startTime),
      endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      isPublic: dto.isPublic ?? true,
      isRecurring: dto.isRecurring ?? false,
      lobbyEnabled: dto.lobbyEnabled ?? false,
      recurrenceRule,
      recurrenceSeriesId: dto.isRecurring ? randomUUID() : null,
      jitsiRoomId,
      status: 'scheduled',
      ...(createdById ? { createdById } : {}),
    });
    if (meeting.isRecurring) await this.ensureRecurringOccurrences(meeting);
    return meeting;
  }

  async update(id: string, dto: UpdateReunionDto) {
    const meeting = await this.findOne(id);
    let recurrenceRule = meeting.recurrenceRule;
    if (dto.isRecurring) {
      recurrenceRule = this.normalizeRecurrenceRule(
        dto.recurrenceRule ?? meeting.recurrenceRule,
      );
      meeting.recurrenceSeriesId ??= randomUUID();
    } else if (dto.isRecurring === false) {
      recurrenceRule = null;
      meeting.recurrenceSeriesId = null;
    }
    Object.assign(meeting, {
      ...dto,
      recurrenceRule,
      startTime: dto.startTime ? new Date(dto.startTime) : meeting.startTime,
      endTime: dto.endTime ? new Date(dto.endTime) : meeting.endTime,
    });
    const saved = await this.meetingRepo.save(meeting);
    if (saved.isRecurring) await this.ensureRecurringOccurrences(saved);
    return saved;
  }

  async remove(id: string) {
    const meeting = await this.findOne(id);
    meeting.status = 'cancelled';
    await this.meetingRepo.save(meeting);
    return { message: 'Réunion annulée' };
  }

  async join(id: string, userId: string, dto: JoinReunionDto, jwtUser?: any) {
    const meeting = await this.findOne(id);
    if (meeting.status === 'cancelled') throw new ForbiddenException('Cette réunion a été annulée');
    if (meeting.status === 'ended') throw new ForbiddenException('Cette réunion est terminée');
    if (
      jwtUser?.role === 'visitor' &&
      jwtUser?.meetingModeratorFor !== id &&
      !meeting.isPublic
    ) {
      throw new ForbiddenException('Cette réunion est réservée aux membres.');
    }
    if (
      jwtUser?.role === 'meeting_moderator' &&
      jwtUser?.meetingModeratorFor !== id
    ) {
      throw new ForbiddenException('Ce lien est limité à une autre réunion.');
    }

    const isAdminUser = jwtUser?.type !== 'member';
    const persistedMember = await this.memberRepo.findOne({ where: { id: userId } });
    let member = persistedMember;
    if (!member) {
      if (!isAdminUser) throw new NotFoundException('Membre non trouvé');
      const adminName = (jwtUser?.name || 'Administrateur principal').trim();
      const [firstName, ...lastNameParts] = adminName.split(/\s+/);
      member = {
        id: userId,
        firstName,
        lastName: lastNameParts.join(' '),
        email: jwtUser?.email ?? '',
        role: jwtUser?.role === 'super_admin' ? 'super_admin' : 'admin',
        isActive: true,
      } as Member;
    }

    const isModerator = member.role === 'admin' || member.role === 'super_admin'
      || jwtUser?.role === 'admin' || jwtUser?.role === 'super_admin'
      || jwtUser?.meetingModeratorFor === id;
    const displayName = dto.displayName || `${member.firstName} ${member.lastName}`.trim();
    const realMemberId = persistedMember ? userId : null;
    const authSubject = persistedMember ? null : userId;
    const requiresAdmission = meeting.lobbyEnabled && !isModerator;
    let existing = realMemberId
      ? await this.participantRepo.findOne({
        where: { meetingId: id, memberId: realMemberId },
      })
      : await this.participantRepo.findOne({
        where: { meetingId: id, authSubject },
      });

    if (!existing && authSubject && isModerator) {
      const legacyRows = await this.participantRepo.find({
        where: {
          meetingId: id,
          memberId: IsNull(),
          displayName,
          wasAdmin: true,
          leftAt: IsNull(),
        },
        order: { lastSeenAt: 'DESC', joinedAt: 'DESC' },
      });
      existing = legacyRows[0] ?? null;
      if (existing) {
        existing.authSubject = authSubject;
        const duplicateRows = legacyRows.slice(1);
        if (duplicateRows.length > 0) {
          const disconnectedAt = new Date();
          await this.participantRepo.save(
            duplicateRows.map(row => ({ ...row, leftAt: disconnectedAt })),
          );
        }
      }
    }

    let participant: MeetingParticipant;
    if (existing) {
      existing.leftAt = null as any;
      existing.lastSeenAt = new Date();
      existing.wasAdmin = isModerator;
      existing.displayName = displayName;
      existing.admissionStatus = requiresAdmission ? 'pending' : 'admitted';
      existing.admittedAt = requiresAdmission ? null as any : new Date();
      existing.reconnectToken = null as any;
      participant = await this.participantRepo.save(existing);
    } else {
      participant = await this.participantRepo.save({
        meetingId: id,
        ...(realMemberId ? { memberId: realMemberId } : {}),
        ...(authSubject ? { authSubject } : {}),
        displayName,
        wasAdmin: isModerator,
        admissionStatus: requiresAdmission ? 'pending' : 'admitted',
        admittedAt: requiresAdmission ? undefined : new Date(),
        lastSeenAt: new Date(),
      });
    }

    if (requiresAdmission) {
      return {
        waitingRoom: true,
        participantId: participant.id,
        meeting: { id: meeting.id, title: meeting.title, status: meeting.status },
      };
    }

    return this.completeAdmission(meeting, participant, member, isModerator, userId, jwtUser);
  }

  async createModeratorInvite(meetingId: string, memberId: string) {
    const meeting = await this.findOne(meetingId);
    const member = await this.memberRepo.findOne({ where: { id: memberId, isActive: true } });
    if (!member) throw new NotFoundException('Responsable introuvable');

    const secret = randomBytes(32).toString('base64url');
    const fallbackExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const meetingExpiry = meeting.endTime
      ? new Date(new Date(meeting.endTime).getTime() + 12 * 60 * 60 * 1000)
      : fallbackExpiry;
    const expiresAt = meetingExpiry > new Date() ? meetingExpiry : fallbackExpiry;
    const invite = await this.inviteRepo.save({
      meetingId,
      memberId,
      tokenHash: await bcrypt.hash(secret, 10),
      expiresAt,
    });
    return {
      id: invite.id,
      token: `${invite.id}.${secret}`,
      expiresAt,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
      },
    };
  }

  async listModeratorInvites(meetingId: string) {
    await this.findOne(meetingId);
    const invites = await this.inviteRepo.find({
      where: { meetingId },
      order: { createdAt: 'DESC' },
    });
    const members = await this.memberRepo.findByIds(invites.map(invite => invite.memberId));
    return invites.map(invite => ({
      id: invite.id,
      expiresAt: invite.expiresAt,
      revokedAt: invite.revokedAt,
      lastUsedAt: invite.lastUsedAt,
      member: members.find(member => member.id === invite.memberId),
    }));
  }

  async revokeModeratorInvite(meetingId: string, inviteId: string) {
    const invite = await this.inviteRepo.findOne({ where: { id: inviteId, meetingId } });
    if (!invite) throw new NotFoundException('Invitation introuvable');
    invite.revokedAt = new Date();
    await this.inviteRepo.save(invite);
    return { revoked: true };
  }

  async acceptModeratorInvite(rawToken: string) {
    const [inviteId, secret] = rawToken?.split('.') ?? [];
    if (!inviteId || !secret) throw new ForbiddenException('Invitation invalide');
    const invite = await this.inviteRepo.findOne({ where: { id: inviteId } });
    if (
      !invite ||
      invite.revokedAt ||
      new Date(invite.expiresAt) <= new Date() ||
      !await bcrypt.compare(secret, invite.tokenHash)
    ) {
      throw new ForbiddenException('Invitation invalide, expirée ou révoquée');
    }
    const meeting = await this.findOne(invite.meetingId);
    if (meeting.status === 'cancelled' || meeting.status === 'ended') {
      throw new ForbiddenException('Cette réunion n’est plus accessible');
    }
    const member = await this.memberRepo.findOne({ where: { id: invite.memberId, isActive: true } });
    if (!member) throw new NotFoundException('Responsable introuvable');

    invite.lastUsedAt = new Date();
    await this.inviteRepo.save(invite);
    const accessToken = await this.jwtService.signAsync({
      sub: member.id,
      email: member.email,
      role: 'meeting_moderator',
      type: 'member',
      meetingModeratorFor: meeting.id,
      jti: randomUUID(),
    }, { expiresIn: '12h' });
    return {
      access_token: accessToken,
      meetingId: meeting.id,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: 'meeting_moderator',
      },
    };
  }

  async getAdmissionStatus(meetingId: string, participantId: string, user: any) {
    const meeting = await this.findOne(meetingId);
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, meetingId },
      relations: ['member'],
    });
    if (!participant) throw new NotFoundException('Demande d’admission introuvable');
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
      || user?.meetingModeratorFor === meetingId;
    if (!isAdmin && participant.memberId !== user?.sub) {
      throw new ForbiddenException('Cette demande ne vous appartient pas.');
    }
    if (participant.admissionStatus === 'rejected') {
      return { waitingRoom: false, rejected: true };
    }
    if (participant.admissionStatus === 'pending') {
      return { waitingRoom: true, participantId: participant.id };
    }
    const member = participant.member ?? await this.memberRepo.findOne({ where: { id: user.sub } });
    if (!member) throw new NotFoundException('Membre non trouvé');
    return this.completeAdmission(
      meeting,
      participant,
      member,
      participant.wasAdmin,
      user.sub,
      user,
    );
  }

  async getWaitingParticipants(id: string) {
    await this.findOne(id);
    return this.participantRepo.find({
      where: { meetingId: id, admissionStatus: 'pending' },
      relations: ['member'],
      order: { joinedAt: 'ASC' },
    });
  }

  async admitParticipant(meetingId: string, participantId: string) {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, meetingId, admissionStatus: 'pending' },
    });
    if (!participant) throw new NotFoundException('Demande d’admission introuvable');
    participant.admissionStatus = 'admitted';
    participant.admittedAt = new Date();
    participant.lastSeenAt = new Date();
    await this.participantRepo.save(participant);
    return { admitted: true };
  }

  async rejectParticipant(meetingId: string, participantId: string) {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, meetingId, admissionStatus: 'pending' },
    });
    if (!participant) throw new NotFoundException('Demande d’admission introuvable');
    participant.admissionStatus = 'rejected';
    participant.leftAt = new Date();
    await this.participantRepo.save(participant);
    return { rejected: true };
  }

  private async completeAdmission(
    meeting: Meeting,
    participant: MeetingParticipant,
    member: Member,
    isModerator: boolean,
    userId: string,
    jwtUser?: any,
  ) {
    const reconnectToken = randomBytes(32).toString('base64url');
    participant.admissionStatus = 'admitted';
    participant.admittedAt ??= new Date();
    participant.leftAt = null as any;
    participant.lastSeenAt = new Date();
    participant.reconnectToken = await bcrypt.hash(reconnectToken, 10);
    await this.participantRepo.save(participant);

    if (meeting.status === 'scheduled') {
      meeting.status = 'live';
      await this.meetingRepo.save(meeting);
    }
    await this.syncParticipantCount(meeting.id);
    if (isModerator) {
      await this.adminSessions.save({
        meetingId: meeting.id,
        participantId: participant.id,
        userId,
        role: jwtUser?.role ?? member.role,
      });
    }

    return {
      jitsiToken: this.jitsiService.generateToken(meeting.jitsiRoomId, member, isModerator),
      jitsiUrl: this.jitsiService.getJitsiUrl(),
      roomId: meeting.jitsiRoomId,
      dialIn: this.jitsiService.getDialIn(),
      isModerator,
      displayName: participant.displayName,
      email: member.email,
      role: jwtUser?.role ?? member.role,
      reconnectToken,
      participantId: participant.id,
      meeting: { id: meeting.id, title: meeting.title, status: meeting.status },
    };
  }

  async end(id: string) {
    const meeting = await this.findOne(id);
    meeting.status = 'ended';
    meeting.endTime = new Date();
    await this.meetingRepo.save(meeting);

    await this.participantRepo.update(
      { meetingId: id, leftAt: IsNull() },
      { leftAt: new Date() },
    );
    meeting.participantCount = 0;
    await this.meetingRepo.save(meeting);

    return { message: 'Réunion terminée' };
  }

  async heartbeat(meetingId: string, participantId: string, user: any) {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, meetingId },
    });
    if (!participant) throw new NotFoundException('Participation introuvable');
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
      || user?.meetingModeratorFor === meetingId;
    if (!isAdmin && participant.memberId !== user?.sub) {
      throw new ForbiddenException('Cette participation ne vous appartient pas.');
    }
    participant.lastSeenAt = new Date();
    await this.participantRepo.save(participant);
    if (participant.wasAdmin) {
      await this.adminSessions.refresh(meetingId, participant.id);
    }
    return { ok: true };
  }

  async registerJitsiParticipant(
    meetingId: string,
    participantId: string,
    jitsiParticipantId: string,
    user: any,
  ) {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, meetingId },
    });
    if (!participant) throw new NotFoundException('Participation introuvable');

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
      || user?.meetingModeratorFor === meetingId;
    if (!isAdmin && participant.memberId !== user?.sub) {
      throw new ForbiddenException('Cette participation ne vous appartient pas.');
    }
    participant.jitsiParticipantId = jitsiParticipantId;
    participant.lastSeenAt = new Date();
    await this.participantRepo.save(participant);
    if (participant.wasAdmin) {
      await this.adminSessions.save({
        meetingId,
        participantId: participant.id,
        userId: user.sub,
        role: user.role,
        jitsiParticipantId,
      });
    }
    return { registered: true };
  }

  async reconnect(meetingId: string, user: any, token: string) {
    const candidates = await this.participantRepo.find({
      where: { meetingId },
      order: { lastSeenAt: 'DESC' },
      take: 50,
    });

    let participant: MeetingParticipant | undefined;
    for (const candidate of candidates) {
      if (candidate.reconnectToken && await bcrypt.compare(token, candidate.reconnectToken)) {
        participant = candidate;
        break;
      }
    }
    if (!participant) {
      throw new ForbiddenException('Token de reconnexion invalide');
    }
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
      || user?.meetingModeratorFor === meetingId;
    if (!isAdmin && participant.memberId !== user?.sub) {
      throw new ForbiddenException('Cette session ne vous appartient pas.');
    }
    if (participant.wasAdmin) {
      const adminSession = await this.adminSessions.get(meetingId, participant.id);
      if (!adminSession) {
        throw new ForbiddenException('Session administrateur expirée.');
      }
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (participant.lastSeenAt < fiveMinutesAgo) {
      throw new ForbiddenException('Session expirée. Rejoignez en tant que membre.');
    }

    participant.leftAt = null as any;
    participant.lastSeenAt = new Date();
    participant.disconnectCount += 1;
    await this.participantRepo.save(participant);
    await this.syncParticipantCount(meetingId);
    if (participant.wasAdmin) {
      await this.adminSessions.refresh(meetingId, participant.id);
      if (participant.jitsiParticipantId) {
        const meeting = await this.findOne(meetingId);
        await this.jitsiService.grantModerator(
          meeting.jitsiRoomId,
          participant.jitsiParticipantId,
        );
      }
    }

    return {
      restored: true,
      wasAdmin: participant.wasAdmin,
      message: participant.wasAdmin
        ? 'Vos droits de modérateur ont été restaurés'
        : 'Vous avez rejoint à nouveau la réunion',
    };
  }

  async getParticipants(id: string) {
    const participants = await this.participantRepo.find({
      where: { meetingId: id, leftAt: IsNull(), admissionStatus: 'admitted' },
      relations: ['member'],
      order: { lastSeenAt: 'DESC', joinedAt: 'DESC' },
    });
    return this.distinctParticipants(participants);
  }

  async getAttendance(id: string) {
    const participants = await this.participantRepo.find({
      where: { meetingId: id, admissionStatus: 'admitted' },
      relations: ['member'],
      order: { joinedAt: 'ASC' },
    });

    return participants.map(p => ({
      id: p.id,
      displayName: p.displayName,
      member: p.member ? {
        id: p.member.id,
        firstName: p.member.firstName,
        lastName: p.member.lastName,
        email: p.member.email,
      } : null,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      durationMinutes: p.leftAt && p.joinedAt
        ? Math.round((new Date(p.leftAt).getTime() - new Date(p.joinedAt).getTime()) / 60000)
        : null,
      wasAdmin: p.wasAdmin,
    }));
  }

  async muteParticipant(meetingId: string, participantJitsiId: string) {
    const meeting = await this.findOne(meetingId);
    await this.jitsiService.muteParticipant(meeting.jitsiRoomId, participantJitsiId);
    return { message: 'Participant coupé' };
  }

  async kickParticipant(meetingId: string, participantId: string) {
    const meeting = await this.findOne(meetingId);
    const participant = await this.participantRepo.findOne({
      where: [
        { meetingId, id: participantId },
        { meetingId, jitsiParticipantId: participantId },
      ],
    });
    if (participant) {
      participant.leftAt = new Date();
      await this.participantRepo.save(participant);
    }
    await this.jitsiService.kickParticipant(
      meeting.jitsiRoomId,
      participant?.jitsiParticipantId ?? participantId,
    );
    await this.syncParticipantCount(meetingId);
    return { message: 'Participant exclu' };
  }

  async grantModerator(meetingId: string, memberId: string) {
    const meeting = await this.findOne(meetingId);
    const participant = await this.participantRepo.findOne({
      where: { meetingId, memberId },
    });
    if (!participant) throw new NotFoundException('Participant introuvable');
    participant.wasAdmin = true;
    await this.participantRepo.save(participant);
    await this.jitsiService.grantModerator(
      meeting.jitsiRoomId,
      participant.jitsiParticipantId ?? memberId,
    );
    return { message: 'Droits modérateur accordés' };
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

  private async syncParticipantCount(meetingId: string) {
    const participants = await this.participantRepo.find({
      where: { meetingId, leftAt: IsNull(), admissionStatus: 'admitted' },
    });
    const participantCount = this.distinctParticipants(participants).length;
    await this.meetingRepo.update(meetingId, { participantCount });
    return participantCount;
  }

  private distinctParticipants(participants: MeetingParticipant[]) {
    const identities = new Set<string>();
    return participants.filter(participant => {
      const identity = participant.memberId
        ? `member:${participant.memberId}`
        : participant.authSubject
          ? `auth:${participant.authSubject}`
          : participant.wasAdmin
            ? `legacy-admin:${participant.displayName.trim().toLocaleLowerCase('fr')}`
            : participant.jitsiParticipantId
              ? `jitsi:${participant.jitsiParticipantId}`
              : `participant:${participant.id}`;

      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    });
  }

  async generateRecurringOccurrences() {
    const recurringMeetings = await this.meetingRepo.find({
      where: { isRecurring: true },
      order: { startTime: 'ASC' },
    });
    const series = new Map<string, Meeting>();

    for (const meeting of recurringMeetings) {
      if (!meeting.recurrenceRule || meeting.status === 'cancelled') continue;
      if (!meeting.recurrenceSeriesId) {
        meeting.recurrenceSeriesId = randomUUID();
        await this.meetingRepo.save(meeting);
      }
      const current = series.get(meeting.recurrenceSeriesId);
      if (!current || new Date(meeting.startTime) > new Date(current.startTime)) {
        series.set(meeting.recurrenceSeriesId, meeting);
      }
    }

    for (const latest of series.values()) {
      await this.ensureRecurringOccurrences(latest);
    }
  }

  private async ensureRecurringOccurrences(seed: Meeting) {
    if (!seed.isRecurring || !seed.recurrenceRule || !seed.recurrenceSeriesId) return;

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 90);
    let latest = await this.meetingRepo.findOne({
      where: { recurrenceSeriesId: seed.recurrenceSeriesId },
      order: { startTime: 'DESC' },
    }) ?? seed;
    let created = 0;

    while (new Date(latest.startTime) < horizon && created < 24) {
      const nextStart = this.nextOccurrence(new Date(latest.startTime), seed.recurrenceRule);
      if (nextStart > horizon) break;

      const duration = latest.endTime
        ? new Date(latest.endTime).getTime() - new Date(latest.startTime).getTime()
        : null;
      latest = await this.meetingRepo.save({
        title: seed.title,
        description: seed.description,
        startTime: nextStart,
        endTime: duration && duration > 0 ? new Date(nextStart.getTime() + duration) : null,
        isPublic: seed.isPublic,
        lobbyEnabled: seed.lobbyEnabled,
        isRecurring: true,
        recurrenceRule: seed.recurrenceRule,
        recurrenceSeriesId: seed.recurrenceSeriesId,
        jitsiRoomId: this.jitsiService.generateRoomId(),
        status: 'scheduled',
        createdById: seed.createdById,
      });
      created++;
    }

    if (created) {
      this.logger.log(`${created} occurrence(s) créée(s) pour "${seed.title}"`);
    }
  }

  private normalizeRecurrenceRule(rule?: string) {
    const normalized = rule?.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Une fréquence de récurrence est requise.');
    }
    const match = normalized.match(/^FREQ=(DAILY|WEEKLY|MONTHLY)(?:;INTERVAL=(\d{1,2}))?$/);
    if (!match) {
      throw new BadRequestException(
        'Récurrence invalide. Utilisez DAILY, WEEKLY ou MONTHLY avec un intervalle optionnel.',
      );
    }
    const interval = Number(match[2] ?? 1);
    if (interval < 1 || interval > 12) {
      throw new BadRequestException('L’intervalle de récurrence doit être compris entre 1 et 12.');
    }
    return `FREQ=${match[1]};INTERVAL=${interval}`;
  }

  private nextOccurrence(from: Date, rule: string) {
    const normalized = this.normalizeRecurrenceRule(rule);
    const frequency = normalized.match(/FREQ=(DAILY|WEEKLY|MONTHLY)/)![1];
    const interval = Number(normalized.match(/INTERVAL=(\d+)/)![1]);
    const next = new Date(from);

    if (frequency === 'DAILY') next.setDate(next.getDate() + interval);
    if (frequency === 'WEEKLY') next.setDate(next.getDate() + (7 * interval));
    if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + interval);
    return next;
  }
}
