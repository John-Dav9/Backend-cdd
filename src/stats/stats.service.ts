import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Member } from '../database/entities/member.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant) private participantRepo: Repository<MeetingParticipant>,
  ) {}

  async getOverview() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const [totalMembers, totalMeetings, totalParticipations] = await Promise.all([
      this.memberRepo.count({ where: { isActive: true } }),
      this.meetingRepo.count(),
      this.participantRepo.count(),
    ]);

    const liveMeeting = await this.meetingRepo.findOne({ where: { status: 'live' } });

    const recentMeetings = await this.meetingRepo.find({
      where: [
        { startTime: MoreThanOrEqual(eightWeeksAgo), status: 'ended' },
        { status: 'live' },
      ],
      order: { startTime: 'ASC' },
      take: 12,
    });

    const recentMeetingsData = await Promise.all(
      recentMeetings.map(async (m) => ({
        title: m.title,
        date: m.startTime.toISOString(),
        participants: await this.participantRepo.count({ where: { meetingId: m.id } }),
        status: m.status,
      })),
    );

    const sourceRaw = await this.memberRepo
      .createQueryBuilder('m')
      .select('m.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('m.is_active = :active', { active: true })
      .groupBy('m.source')
      .getRawMany();
    const membersBySource = sourceRaw.map((r) => ({ source: r.source, count: Number(r.count) }));

    const monthRaw = await this.memberRepo
      .createQueryBuilder('m')
      .select("TO_CHAR(m.created_at, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .where('m.created_at >= :from', { from: sixMonthsAgo })
      .groupBy("TO_CHAR(m.created_at, 'YYYY-MM')")
      .orderBy("TO_CHAR(m.created_at, 'YYYY-MM')", 'ASC')
      .getRawMany();
    const membersByMonth = monthRaw.map((r) => ({ month: r.month, count: Number(r.count) }));

    return {
      isLive: !!liveMeeting,
      liveMeetingTitle: liveMeeting?.title ?? null,
      totals: { members: totalMembers, meetings: totalMeetings, participations: totalParticipations },
      recentMeetings: recentMeetingsData,
      membersBySource,
      membersByMonth,
    };
  }
}
