import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { Marathon } from '../database/entities/marathon.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { MailService } from '../mail/mail.service';
import { BIBLE_BOOK_MAP, AT_BOOKS, BIBLE_BOOKS, NT_BOOKS } from './bible-books.data';
import { CreateMarathonDto, MarathonScope, MarathonStatut } from './dto/create-marathon.dto';
import { InscrireMarathonDto } from './dto/inscrire-marathon.dto';
import { UpdateProgressionDto } from './dto/update-progression.dto';
import { generateReadingPlan } from './reading-plan.generator';
import { StorageService } from '../storage/storage.service';

const MILESTONES = [25, 50, 75, 100];

@Injectable()
export class MarathonService {
  private readonly logger = new Logger(MarathonService.name);

  constructor(
    @InjectRepository(Marathon) private marathonRepo: Repository<Marathon>,
    @InjectRepository(MarathonInscription) private inscRepo: Repository<MarathonInscription>,
    private mail: MailService,
    private storage: StorageService,
    private dataSource: DataSource,
  ) {}

  // ─── Admin : CRUD ────────────────────────────────────────────────────────────

  async creer(dto: CreateMarathonDto) {
    const dateDebut = new Date(dto.dateDebut);
    const dateFin   = new Date(dto.dateFin);

    if (dateFin <= dateDebut) {
      throw new BadRequestException('La date de fin doit être après la date de début.');
    }

    const nbJours = Math.round((dateFin.getTime() - dateDebut.getTime()) / 86_400_000) + 1;
    const books   = this.resolveBooks(dto.scope, dto.livresChoisis);
    if (!books.length) throw new BadRequestException('Aucun livre trouvé pour ce scope.');

    const planLecture = generateReadingPlan(books, nbJours, dateDebut);
    const statut = dateDebut <= new Date() ? MarathonStatut.ACTIF : MarathonStatut.PLANIFIE;

    const marathon = this.marathonRepo.create({
      titre: dto.titre,
      description: dto.description ?? '',
      dateDebut: dto.dateDebut,
      dateFin: dto.dateFin,
      scope: dto.scope,
      livresChoisis: dto.livresChoisis ?? [],
      nbJours,
      statut,
      planLecture,
      nbInscrits: 0,
    });

    const saved = await this.marathonRepo.save(marathon);

    this.sendNewsletterToAllParticipants(saved.id, {
      titre: dto.titre,
      description: dto.description ?? '',
      dateDebut: dto.dateDebut,
      dateFin: dto.dateFin,
      flyerUrl: null,
    }).catch(err => this.logger.error('Newsletter nouveau marathon', err));

    return { id: saved.id, nbJours, nbChapitres: planLecture.length };
  }

  private async sendNewsletterToAllParticipants(newMarathonId: string, marathon: {
    titre: string; description: string; dateDebut: string; dateFin: string; flyerUrl?: string | null;
  }) {
    const inscs = await this.inscRepo.find({ select: ['email', 'marathonId'] });
    const emails = new Set<string>();
    inscs.forEach(i => { if (i.marathonId !== newMarathonId) emails.add(i.email); });

    await Promise.all(
      [...emails].map(email =>
        this.mail.sendNewsletterNouveauMarathon(email, marathon)
          .catch(err => this.logger.error('Newsletter email failed', err)),
      ),
    );
  }

  async uploadFlyer(id: string, file: { originalname: string; mimetype: string; buffer: Buffer }) {
    await this.getOrFail(id);
    const path = `marathons/${id}/flyer_${Date.now()}_${file.originalname}`;
    const url  = await this.storage.upload(path, file.buffer, file.mimetype);
    await this.marathonRepo.update(id, { flyerUrl: url });
    return { flyerUrl: url };
  }

  async findAll(adminMode = false) {
    if (adminMode) {
      return this.marathonRepo.find({ order: { dateDebut: 'DESC' } });
    }
    return this.marathonRepo.find({
      where: [
        { statut: MarathonStatut.PLANIFIE },
        { statut: MarathonStatut.ACTIF },
      ],
      order: { dateDebut: 'DESC' },
    });
  }

  async findOne(id: string) {
    const m = await this.marathonRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Marathon introuvable.');
    return m;
  }

  async archiver(id: string) {
    await this.getOrFail(id);
    await this.marathonRepo.update(id, { statut: MarathonStatut.ARCHIVE });
    return { success: true };
  }

  async reactiver(id: string) {
    await this.getOrFail(id);
    await this.marathonRepo.update(id, { statut: MarathonStatut.ACTIF });
    return { success: true };
  }

  async supprimer(id: string) {
    await this.getOrFail(id);
    await this.marathonRepo.delete(id);
    return { success: true };
  }

  // ─── Cron : archivage automatique ─────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async archiverExpires() {
    const today = new Date().toISOString().split('T')[0];
    const result = await this.marathonRepo
      .createQueryBuilder()
      .update(Marathon)
      .set({ statut: MarathonStatut.ARCHIVE })
      .where('statut = :s', { s: MarathonStatut.ACTIF })
      .andWhere('date_fin < :today', { today })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`${result.affected} marathon(s) archivé(s) automatiquement.`);
    }
  }

  // ─── Cron : rappels de lecture ─────────────────────────────────────────────

  @Cron('0 9 * * *')
  async envoyerRappelsLecture() {
    const marathons = await this.marathonRepo.find({ where: { statut: MarathonStatut.ACTIF } });
    if (!marathons.length) return;

    const marathonIds = marathons.map(m => m.id);
    const allInscs = await this.inscRepo.find({ where: { marathonId: In(marathonIds) } });
    const marathonMap = new Map(marathons.map(m => [m.id, m]));
    const todayMs = Date.now();

    for (const insc of allInscs) {
      if (Number(insc.progressPercent) >= 100) continue;
      if (!insc.lastActivityAt) continue;

      const daysSince = (todayMs - new Date(insc.lastActivityAt).getTime()) / 86_400_000;
      if (daysSince >= 3 && daysSince < 4) {
        const marathon = marathonMap.get(insc.marathonId)!;
        await this.mail.sendRappelLecture(
          insc.email, insc.fullName, marathon, Math.floor(daysSince), Number(insc.progressPercent),
        ).catch((err: any) => this.logger.error('Rappel lecture', err));
      }
    }
  }

  // ─── Inscriptions ─────────────────────────────────────────────────────────

  async inscrire(marathonId: string, dto: InscrireMarathonDto) {
    const marathon = await this.getOrFail(marathonId);

    if (marathon.statut === MarathonStatut.ARCHIVE) {
      throw new BadRequestException('Ce marathon est archivé.');
    }

    const existing = await this.inscRepo.findOne({
      where: { marathonId, email: dto.email.toLowerCase() },
    });
    if (existing) throw new BadRequestException('Vous êtes déjà inscrit à ce marathon.');

    try {
      await this.inscRepo.save({
        marathonId,
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? '',
        city: dto.city ?? '',
        progress: {},
        progressPercent: 0,
        milestonesReached: [],
      });
    } catch (err: unknown) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new BadRequestException('Vous êtes déjà inscrit à ce marathon.');
      }
      throw err;
    }

    await this.marathonRepo.increment({ id: marathonId }, 'nbInscrits', 1);

    await this.mail.sendBienvenueMarathon(dto.email, dto.fullName, marathon).catch(
      err => this.logger.error('Mail bienvenue marathon', err),
    );

    return { success: true };
  }

  // ─── Progression ──────────────────────────────────────────────────────────

  async mettreAJourProgression(marathonId: string, dto: UpdateProgressionDto) {
    const marathon = await this.getOrFail(marathonId);
    const email    = dto.email.toLowerCase();

    let resultPercent    = 0;
    let resultMilestones: number[] = [];
    let newMilestones:    number[] = [];
    let inscFullName     = '';

    await this.dataSource.transaction(async (manager) => {
      const insc = await manager.findOne(MarathonInscription, {
        where: { marathonId, email },
        lock: { mode: 'pessimistic_write' },
      });
      if (!insc) throw new NotFoundException('Inscription introuvable.');

      inscFullName = insc.fullName;
      const progress = { ...(insc.progress ?? {}) };
      progress[String(dto.day)] = dto.checked;

      const doneCount   = Object.values(progress).filter(Boolean).length;
      resultPercent     = marathon.nbJours > 0 ? Math.round((doneCount / marathon.nbJours) * 100) : 0;
      resultMilestones  = [...(insc.milestonesReached ?? [])];
      newMilestones     = MILESTONES.filter(m => resultPercent >= m && !resultMilestones.includes(m));
      resultMilestones.push(...newMilestones);

      const todayStr    = new Date().toISOString().split('T')[0];
      let currentStreak = insc.currentStreak ?? 0;
      let maxStreak     = insc.maxStreak ?? 0;
      const streakUpdate: Partial<MarathonInscription> = {};

      if (dto.checked) {
        const yesterday    = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (insc.lastActivityAt === todayStr) {
          // déjà lu aujourd'hui
        } else if (insc.lastActivityAt === yesterdayStr) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
        maxStreak = Math.max(currentStreak, maxStreak);
        streakUpdate.currentStreak  = currentStreak;
        streakUpdate.maxStreak      = maxStreak;
        streakUpdate.lastActivityAt = todayStr;
      }

      await manager.update(MarathonInscription, insc.id, {
        progress,
        progressPercent: resultPercent,
        milestonesReached: resultMilestones,
        ...streakUpdate,
      });
    });

    for (const milestone of newMilestones) {
      if (milestone < 100) {
        await this.mail
          .sendEncouragementMarathon(dto.email, inscFullName, marathon, milestone)
          .catch(err => this.logger.error('Mail encouragement', err));
      } else {
        const all    = await this.inscRepo.find({ where: { marathonId } });
        const sorted = all.sort((a, b) => Number(b.progressPercent) - Number(a.progressPercent));
        const rank   = sorted.findIndex(i => i.email === email) + 1;
        await this.mail
          .sendAttestationMarathon(dto.email, inscFullName, marathon, rank, all.length)
          .catch(err => this.logger.error('Mail attestation', err));
      }
    }

    return { percent: resultPercent, milestonesReached: resultMilestones };
  }

  // ─── Leaderboard ──────────────────────────────────────────────────────────

  async getLeaderboard(marathonId: string) {
    const inscs = await this.inscRepo.find({ where: { marathonId } });
    return inscs
      .sort((a, b) => Number(b.progressPercent) - Number(a.progressPercent))
      .map((d, i) => ({
        rank: i + 1,
        name: this.anonymizeName(d.fullName),
        progressPercent: Number(d.progressPercent),
        milestonesReached: d.milestonesReached,
        currentStreak: d.currentStreak,
        maxStreak: d.maxStreak,
      }));
  }

  private anonymizeName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  async getProgression(marathonId: string, email: string) {
    await this.getOrFail(marathonId);
    const insc = await this.inscRepo.findOne({ where: { marathonId, email: email.toLowerCase() } });
    if (!insc) return null;

    const all    = await this.inscRepo.find({ where: { marathonId } });
    const sorted = all.sort((a, b) => Number(b.progressPercent) - Number(a.progressPercent));
    const rank   = sorted.findIndex(i => i.email === email.toLowerCase()) + 1;

    return {
      fullName:          insc.fullName,
      progress:          insc.progress,
      progressPercent:   Number(insc.progressPercent),
      milestonesReached: insc.milestonesReached,
      currentStreak:     insc.currentStreak,
      maxStreak:         insc.maxStreak,
      lastActivityAt:    insc.lastActivityAt,
      rank,
      totalParticipants: all.length,
    };
  }

  async getInscrits(marathonId: string) {
    const inscs = await this.inscRepo.find({ where: { marathonId } });
    return inscs
      .sort((a, b) => Number(b.progressPercent) - Number(a.progressPercent))
      .map((d, i) => ({
        id: d.id,
        rank: i + 1,
        fullName: d.fullName,
        email: d.email,
        progressPercent: Number(d.progressPercent),
        milestonesReached: d.milestonesReached,
        currentStreak: d.currentStreak,
        maxStreak: d.maxStreak,
        lastActivityAt: d.lastActivityAt,
        createdAt: d.createdAt,
      }));
  }

  async envoyerAttestationsAnnuelles(annee: number) {
    const debut = `${annee}-01-01`;
    const fin   = `${annee}-12-31`;

    const marathons = await this.marathonRepo
      .createQueryBuilder('m')
      .where('m.date_debut >= :debut', { debut })
      .andWhere('m.date_debut <= :fin', { fin })
      .getMany();

    if (!marathons.length) return { envoyes: 0 };

    const emailCounts = new Map<string, { count: number; fullName: string }>();

    for (const m of marathons) {
      const inscs = await this.inscRepo.find({ where: { marathonId: m.id } });
      inscs.filter(i => Number(i.progressPercent) === 100).forEach(i => {
        const cur = emailCounts.get(i.email) ?? { count: 0, fullName: i.fullName };
        emailCounts.set(i.email, { count: cur.count + 1, fullName: i.fullName });
      });
    }

    let envoyes = 0;
    for (const [email, { count, fullName }] of emailCounts) {
      if (count === marathons.length) {
        await this.mail.sendAttestationAnnuelle(email, fullName, annee, count)
          .catch(err => this.logger.error('Mail attestation annuelle', err));
        envoyes++;
      }
    }

    return { envoyes, totalMarathons: marathons.length };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getOrFail(id: string): Promise<Marathon> {
    const m = await this.marathonRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Marathon introuvable.');
    return m;
  }

  private resolveBooks(scope: MarathonScope, livresChoisis?: string[]) {
    switch (scope) {
      case MarathonScope.BIBLE_COMPLETE:    return BIBLE_BOOKS;
      case MarathonScope.ANCIEN_TESTAMENT:  return AT_BOOKS;
      case MarathonScope.NOUVEAU_TESTAMENT: return NT_BOOKS;
      case MarathonScope.LIVRES_CHOISIS:
        return (livresChoisis ?? []).map(id => BIBLE_BOOK_MAP.get(id)).filter(Boolean) as typeof BIBLE_BOOKS;
    }
  }
}
