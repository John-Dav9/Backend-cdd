import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunitySettings } from '../database/entities/community-settings.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { Member } from '../database/entities/member.entity';
import { NewsletterSubscriber } from '../database/entities/newsletter-subscriber.entity';
import { UpdateMembreDto, UpdateRoleDto, UpdateSettingsDto } from './dto/membres.dto';

@Injectable()
export class MembresService {
  constructor(
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    @InjectRepository(MarathonInscription) private marathonRepo: Repository<MarathonInscription>,
    @InjectRepository(NewsletterSubscriber) private newsletterRepo: Repository<NewsletterSubscriber>,
    @InjectRepository(CommunitySettings) private settingsRepo: Repository<CommunitySettings>,
  ) {}

  async findAll(search?: string) {
    const qb = this.memberRepo.createQueryBuilder('m').orderBy('m.created_at', 'DESC').take(500);
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      qb.where(
        'LOWER(m.first_name) LIKE :q OR LOWER(m.last_name) LIKE :q OR LOWER(m.email) LIKE :q',
        { q },
      );
    }
    return qb.getMany();
  }

  async findAnnuaire() {
    const members = await this.memberRepo.find({
      where: { isActive: true },
      order: { firstName: 'ASC' },
      select: ['id', 'firstName', 'lastName', 'city', 'role', 'createdAt'],
    });
    return members;
  }

  async findOne(id: string) {
    const member = await this.memberRepo.findOne({ where: { id } });
    if (!member) throw new NotFoundException('Membre non trouvé');
    return member;
  }

  async update(id: string, dto: UpdateMembreDto) {
    const member = await this.findOne(id);
    Object.assign(member, dto);
    return this.memberRepo.save(member);
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const member = await this.findOne(id);
    member.role = dto.role;
    return this.memberRepo.save(member);
  }

  async deactivate(id: string) {
    const member = await this.findOne(id);
    member.isActive = false;
    await this.memberRepo.save(member);
    return { message: 'Membre désactivé' };
  }

  async mergeExistingBases() {
    let created = 0;
    let updated = 0;

    // 1. Importer les inscrits au marathon
    const marathonInscrits = await this.marathonRepo
      .createQueryBuilder('mi')
      .select(['mi.email', 'mi.fullName', 'mi.phone', 'mi.city'])
      .distinctOn(['mi.email'])
      .getMany();

    for (const inscrit of marathonInscrits) {
      const existing = await this.memberRepo.findOne({ where: { email: inscrit.email.toLowerCase() } });
      if (existing) {
        if (!existing.phone && inscrit.phone) {
          existing.phone = inscrit.phone;
          await this.memberRepo.save(existing);
          updated++;
        }
        continue;
      }
      const parts = inscrit.fullName?.trim().split(' ') ?? ['', ''];
      const firstName = parts[0] ?? '';
      const lastName = parts.slice(1).join(' ') || firstName;
      await this.memberRepo.save({
        email: inscrit.email.toLowerCase(),
        firstName,
        lastName,
        phone: inscrit.phone,
        city: inscrit.city,
        source: 'marathon',
        role: 'member',
      });
      created++;
    }

    // 2. Importer les abonnés newsletter
    const subscribers = await this.newsletterRepo.find();
    for (const sub of subscribers) {
      const existing = await this.memberRepo.findOne({ where: { email: sub.email.toLowerCase() } });
      if (existing) continue;
      await this.memberRepo.save({
        email: sub.email.toLowerCase(),
        firstName: sub.prenom ?? '',
        lastName: '',
        source: 'newsletter',
        role: 'member',
      });
      created++;
    }

    return { created, updated, message: `Fusion terminée : ${created} créés, ${updated} mis à jour` };
  }

  async getSettings() {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) settings = await this.settingsRepo.save({ isOpen: true });
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto, memberId: string) {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create({ isOpen: dto.isOpen, updatedById: memberId });
    } else {
      settings.isOpen = dto.isOpen;
      settings.updatedById = memberId;
    }
    return this.settingsRepo.save(settings);
  }
}
