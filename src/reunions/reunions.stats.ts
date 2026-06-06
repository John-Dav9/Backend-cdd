import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingParticipant } from '../database/entities/meeting-participant.entity';
import { Meeting } from '../database/entities/meeting.entity';
import { Member } from '../database/entities/member.entity';

@Controller('stats')
export class StatsController {
  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingParticipant) private participantRepo: Repository<MeetingParticipant>,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
  ) {}

  @Get('overview')
  async overview() {
    const [totalMeetings, totalMembers, totalParticipations] = await Promise.all([
      this.meetingRepo.count(),
      this.memberRepo.count({ where: { isActive: true } }),
      this.participantRepo.count(),
    ]);

    const liveMeeting = await this.meetingRepo.findOne({ where: { status: 'live' } });

    // Réunions des 8 dernières semaines
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const recentMeetings = await this.meetingRepo
      .createQueryBuilder('m')
      .where('m.startTime >= :from', { from: eightWeeksAgo })
      .andWhere('m.status != :status', { status: 'cancelled' })
      .orderBy('m.startTime', 'ASC')
      .getMany();

    // Participation par réunion
    const meetingsWithCount = await Promise.all(
      recentMeetings.map(async (m) => {
        const count = await this.participantRepo.count({ where: { meetingId: m.id } });
        return {
          id: m.id,
          title: m.title,
          date: m.startTime,
          status: m.status,
          participants: count,
        };
      }),
    );

    // Membres par source
    const membersBySource = await this.memberRepo
      .createQueryBuilder('m')
      .select('m.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.source')
      .getRawMany();

    // Membres rejoints par mois (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const membersByMonth = await this.memberRepo
      .createQueryBuilder('m')
      .select("TO_CHAR(m.created_at, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .where('m.created_at >= :from', { from: sixMonthsAgo })
      .groupBy("TO_CHAR(m.created_at, 'YYYY-MM')")
      .orderBy("TO_CHAR(m.created_at, 'YYYY-MM')", 'ASC')
      .getRawMany();

    return {
      totals: { meetings: totalMeetings, members: totalMembers, participations: totalParticipations },
      isLive: !!liveMeeting,
      liveMeetingTitle: liveMeeting?.title ?? null,
      recentMeetings: meetingsWithCount,
      membersBySource,
      membersByMonth,
    };
  }
}
