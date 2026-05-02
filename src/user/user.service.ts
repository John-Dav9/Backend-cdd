import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Marathon } from '../database/entities/marathon.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';

const BADGE_META: Record<string, { label: string; icon: string; desc: string }> = {
  PREMIERE_LECTURE: { label: 'Premier marathon',     icon: '📖', desc: 'A complété son premier marathon biblique' },
  MI_CHEMIN:        { label: 'À mi-chemin',           icon: '🎯', desc: 'A atteint 50% dans un marathon' },
  TRIPLE_MARATHON:  { label: 'Triple champion',       icon: '🏆', desc: 'A complété 3 marathons' },
  CHAMPION_LECTURE: { label: 'Champion de lecture',   icon: '⭐', desc: 'A complété 5 marathons ou plus' },
  TOP_1:            { label: '#1 du classement',       icon: '🥇', desc: 'Rang #1 dans un marathon actif' },
  TOP_3:            { label: 'Top 3',                 icon: '🥈', desc: 'Dans le top 3 d\'un marathon actif' },
  TOP_10:           { label: 'Top 10',                icon: '👏', desc: 'Dans le top 10 d\'un marathon actif' },
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(MarathonInscription) private inscRepo: Repository<MarathonInscription>,
    @InjectRepository(Marathon) private marathonRepo: Repository<Marathon>,
  ) {}

  async getDashboard(email: string) {
    const lowerEmail = email.trim().toLowerCase();

    const inscriptions = await this.inscRepo.find({
      where: { email: lowerEmail },
      order: { createdAt: 'DESC' },
    });

    if (!inscriptions.length) throw new NotFoundException('Aucune inscription trouvée pour cet email.');

    const marathonIds = [...new Set(inscriptions.map(i => i.marathonId))];
    const marathons   = await this.marathonRepo.find({ where: { id: In(marathonIds) } });
    const marathonMap = new Map(marathons.map(m => [m.id, m]));

    const entries = await Promise.all(inscriptions.map(async (insc) => {
      const marathon = marathonMap.get(insc.marathonId);
      const daysRead = Object.values(insc.progress ?? {}).filter(Boolean).length;

      if (!marathon) {
        return {
          marathonId: insc.marathonId, titre: 'Marathon biblique (archivé)', statut: 'ARCHIVE',
          scope: null, dateDebut: null, dateFin: null, nbJours: null,
          progressPercent: Number(insc.progressPercent), milestonesReached: insc.milestonesReached,
          rank: null, totalParticipants: null, daysRead, inscritLe: insc.createdAt,
        };
      }

      let rank: number | null = null;
      let totalParticipants   = marathon.nbInscrits ?? 0;

      if (marathon.statut === 'ACTIF') {
        const all    = await this.inscRepo.find({ where: { marathonId: marathon.id } });
        const sorted = all.sort((a, b) => Number(b.progressPercent) - Number(a.progressPercent));
        rank             = sorted.findIndex(i => i.email === lowerEmail) + 1;
        totalParticipants = all.length;
      }

      return {
        marathonId: marathon.id, titre: marathon.titre, statut: marathon.statut,
        scope: marathon.scope, dateDebut: marathon.dateDebut, dateFin: marathon.dateFin,
        nbJours: marathon.nbJours, progressPercent: Number(insc.progressPercent),
        milestonesReached: insc.milestonesReached, rank, totalParticipants,
        daysRead, inscritLe: insc.createdAt,
      };
    }));

    const completed     = entries.filter(e => e.progressPercent === 100).length;
    const inProgress    = entries.filter(e => e.statut === 'ACTIF').length;
    const totalDaysRead = entries.reduce((s, e) => s + (e.daysRead ?? 0), 0);
    const badges        = this.computeBadges(entries);

    const fideliteData = [...entries]
      .sort((a, b) => (a.dateDebut ?? '') > (b.dateDebut ?? '') ? 1 : -1)
      .map(e => ({
        label:   e.titre.length > 22 ? e.titre.slice(0, 22) + '…' : e.titre,
        percent: e.progressPercent,
        statut:  e.statut,
      }));

    return {
      fullName: inscriptions[0].fullName,
      email:    lowerEmail,
      stats: { totalMarathons: entries.length, completed, inProgress, totalDaysRead },
      marathonsActifs: entries.filter(e => e.statut === 'ACTIF'),
      historique:      entries.filter(e => e.statut !== 'ACTIF'),
      fideliteData,
      badges: badges.map(id => ({ id, ...BADGE_META[id] })),
    };
  }

  private computeBadges(entries: any[]): string[] {
    const badges    = [];
    const completed = entries.filter(e => e.progressPercent === 100);
    if (completed.length >= 1) badges.push('PREMIERE_LECTURE');
    if (entries.some(e => e.progressPercent >= 50)) badges.push('MI_CHEMIN');
    if (completed.length >= 3) badges.push('TRIPLE_MARATHON');
    if (completed.length >= 5) badges.push('CHAMPION_LECTURE');
    const actifs = entries.filter(e => e.statut === 'ACTIF' && e.rank != null);
    if      (actifs.some(e => e.rank === 1)) badges.push('TOP_1');
    else if (actifs.some(e => e.rank <= 3))  badges.push('TOP_3');
    else if (actifs.some(e => e.rank <= 10)) badges.push('TOP_10');
    return badges;
  }
}
