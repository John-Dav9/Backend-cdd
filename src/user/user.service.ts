import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

const BADGE_META: Record<string, { label: string; icon: string; desc: string }> = {
  PREMIERE_LECTURE:  { label: 'Premier marathon',     icon: '📖', desc: 'A complet\u00e9 son premier marathon biblique' },
  MI_CHEMIN:         { label: '\u00c0 mi-chemin',       icon: '\ud83c\udfaf', desc: 'A atteint 50% dans un marathon' },
  TRIPLE_MARATHON:   { label: 'Triple champion',      icon: '\ud83c\udfc6', desc: 'A complet\u00e9 3 marathons' },
  CHAMPION_LECTURE:  { label: 'Champion de lecture',  icon: '\u2b50', desc: 'A complet\u00e9 5 marathons ou plus' },
    TOP_1:             { label: '#1 du classement',      icon: '🥇', desc: 'Rang #1 dans un marathon actif' },
  TOP_3:             { label: 'Top 3',                icon: '\ud83e\udd47', desc: 'Dans le top 3 d\u2019un marathon actif' },
  TOP_10:            { label: 'Top 10',               icon: '\ud83d\udc4f', desc: 'Dans le top 10 d\u2019un marathon actif' },
  FIDELE_ANNEE:      { label: 'Fid\u00e8le de l\u2019ann\u00e9e', icon: '\ud83c\udf1f', desc: 'A particip\u00e9 \u00e0 tous les marathons d\u2019une ann\u00e9e' },
};

@Injectable()
export class UserService {
  constructor(private firebase: FirebaseService) {}

  async getDashboard(email: string) {
    const lowerEmail = email.trim().toLowerCase();

    // 1. Toutes les inscriptions de l'utilisateur
    const inscSnap = await this.firebase.firestore
      .collection('marathon_inscriptions')
      .where('email', '==', lowerEmail)
      .orderBy('createdAt', 'desc')
      .get();

    if (inscSnap.empty) throw new NotFoundException('Aucune inscription trouv\u00e9e pour cet email.');

    const inscriptions = inscSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    // 2. Charger les marathons associés
    const marathonIds = [...new Set(inscriptions.map(i => i.marathonId as string))];
    const marathonDocs = await Promise.all(
      marathonIds.map(id => this.firebase.firestore.collection('marathons').doc(id).get()),
    );
    const marathonMap = new Map<string, any>(
      marathonDocs.filter(d => d.exists).map(d => [d.id, { id: d.id, ...d.data() }]),
    );

    // 3. Construire les entrées dashboard avec rang
    const entries = await Promise.all(
      inscriptions.map(async (insc) => {
        const marathon = marathonMap.get(insc.marathonId);
        if (!marathon) {
          const daysRead = Object.values(insc.progress ?? {}).filter(Boolean).length;
          return {
            marathonId:        insc.marathonId,
            titre:             'Marathon biblique (archivé)',
            statut:            'ARCHIVE',
            scope:             null,
            dateDebut:         null,
            dateFin:           null,
            nbJours:           null,
            progressPercent:   insc.progressPercent ?? 0,
            milestonesReached: insc.milestonesReached ?? [],
            rank:              null,
            totalParticipants: null,
            daysRead,
            inscritLe:         insc.createdAt,
          };
        }

        let rank: number | null = null;
        let totalParticipants = marathon.nbInscrits ?? 0;

        if (marathon.statut === 'ACTIF') {
          const allInsc = await this.firebase.firestore
            .collection('marathon_inscriptions')
            .where('marathonId', '==', marathon.id)
            .orderBy('progressPercent', 'desc')
            .get();
          rank = allInsc.docs.findIndex(d => d.data()['email'] === lowerEmail) + 1;
          totalParticipants = allInsc.size;
        }

        const daysRead = Object.values(insc.progress ?? {}).filter(Boolean).length;

        return {
          marathonId:        marathon.id,
          titre:             marathon.titre,
          statut:            marathon.statut,
          scope:             marathon.scope,
          dateDebut:         marathon.dateDebut,
          dateFin:           marathon.dateFin,
          nbJours:           marathon.nbJours,
          progressPercent:   insc.progressPercent ?? 0,
          milestonesReached: insc.milestonesReached ?? [],
          rank,
          totalParticipants,
          daysRead,
          inscritLe:         insc.createdAt,
        };
      }),
    );

    const valid = entries.filter(Boolean) as any[];

    // 4. Statistiques globales
    const completed  = valid.filter(e => e.progressPercent === 100).length;
    const inProgress = valid.filter(e => e.statut === 'ACTIF').length;
    const totalDaysRead = valid.reduce((s, e) => s + (e.daysRead ?? 0), 0);

    // 5. Badges
    const badges = this.computeBadges(valid);

    // 6. Données courbe de fidélité (chronologique)
    const fideliteData = [...valid]
      .sort((a, b) => (a.dateDebut > b.dateDebut ? 1 : -1))
      .map(e => ({
        label:   e.titre.length > 22 ? e.titre.slice(0, 22) + '\u2026' : e.titre,
        percent: e.progressPercent,
        statut:  e.statut,
      }));

    return {
      fullName: inscriptions[0].fullName,
      email:    lowerEmail,
      stats: { totalMarathons: valid.length, completed, inProgress, totalDaysRead },
      marathonsActifs: valid.filter(e => e.statut === 'ACTIF'),
      historique:      valid.filter(e => e.statut !== 'ACTIF'),
      fideliteData,
      badges: badges.map(id => ({ id, ...BADGE_META[id] })),
    };
  }

  private computeBadges(entries: any[]): string[] {
    const badges: string[] = [];
    const completed = entries.filter(e => e.progressPercent === 100);

    if (completed.length >= 1) badges.push('PREMIERE_LECTURE');
    if (entries.some(e => e.progressPercent >= 50))  badges.push('MI_CHEMIN');
    if (completed.length >= 3) badges.push('TRIPLE_MARATHON');
    if (completed.length >= 5) badges.push('CHAMPION_LECTURE');

    const actifs = entries.filter(e => e.statut === 'ACTIF' && e.rank != null);
    if      (actifs.some(e => e.rank === 1))   badges.push('TOP_1');
    else if (actifs.some(e => e.rank <= 3))    badges.push('TOP_3');
    else if (actifs.some(e => e.rank <= 10))   badges.push('TOP_10');

    return badges;
  }
}
