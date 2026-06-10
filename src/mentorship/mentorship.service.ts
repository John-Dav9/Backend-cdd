import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from '../database/entities/member.entity';
import { MentorshipRequest, MentorshipStatus } from '../database/entities/mentorship-request.entity';

@Injectable()
export class MentorshipService {
  constructor(
    @InjectRepository(MentorshipRequest) private readonly repo: Repository<MentorshipRequest>,
    @InjectRepository(Member) private readonly memberRepo: Repository<Member>,
  ) {}

  async create(requesterId: string, body: { topic: string; message: string }) {
    const topic = body.topic?.trim();
    const message = body.message?.trim();
    if (!topic || !message || topic.length > 160 || message.length > 3000) {
      throw new BadRequestException('Sujet ou message de mentorat invalide.');
    }
    return this.repo.save(this.repo.create({ requesterId, topic, message, status: 'pending' }));
  }

  findMine(requesterId: string) {
    return this.repo.find({
      where: { requesterId },
      relations: ['mentor'],
      order: { createdAt: 'DESC' },
    });
  }

  findAll() {
    return this.repo.find({
      relations: ['requester', 'mentor'],
      order: { createdAt: 'DESC' },
    });
  }

  async assign(id: string, mentorId: string) {
    const request = await this.findOne(id);
    const mentor = await this.memberRepo.findOne({ where: { id: mentorId, isActive: true } });
    if (!mentor) throw new NotFoundException('Mentor introuvable');
    request.mentorId = mentor.id;
    request.status = 'assigned';
    return this.repo.save(request);
  }

  async updateStatus(id: string, status: MentorshipStatus) {
    if (!['pending', 'assigned', 'closed'].includes(status)) {
      throw new BadRequestException('Statut de mentorat invalide.');
    }
    const request = await this.findOne(id);
    request.status = status;
    return this.repo.save(request);
  }

  private async findOne(id: string) {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Demande de mentorat introuvable');
    return request;
  }
}
