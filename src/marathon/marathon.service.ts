import { Injectable, Logger, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';
import { CreateMarathonDto, MarathonScope, MarathonStatut } from './dto/create-marathon.dto';
import { InscrireMarathonDto } from './dto/inscrire-marathon.dto';
import { UpdateProgressionDto } from './dto/update-progression.dto';
import { BIBLE_BOOKS, AT_BOOKS, NT_BOOKS, BIBLE_BOOK_MAP } from './bible-books.data';
import { generateReadingPlan } from './reading-plan.generator';
import * as admin from 'firebase-admin';

const MILESTONES = [25, 50, 75, 100];

@Injectable()
export class MarathonService {
  private readonly logger = new Logger(MarathonService.name);
  private readonly col     = 'marathons';
  private readonly inscCol = 'marathon_inscriptions';

  constructor(
    private firebase: FirebaseService,
    private mail: MailService,
  ) {}

  private assertReady() {
    if (!this.firebase.isReady) {
      throw new ServiceUnavailableException(
        'Firebase non configur\u00e9 \u2014 ajoutez vos identifiants Firebase dans le fichier .env du backend.',
      );
    }
  }

  // ─── Admin : CRUD ────────────────────────────────────────────────────────────

  async creer(dto: CreateMarathonDto) {
    this.assertReady();
    const dateDebut = new Date(dto.dateDebut);
    const dateFin   = new Date(dto.dateFin);

    if (dateFin <= dateDebut) {
      throw new BadRequestException('La date de fin doit être après la date de début.');
    }

    const nbJours = Math.round((dateFin.getTime() - dateDebut.getTime()) / 86_400_000) + 1;

    const books = this.resolveBooks(dto.scope, dto.livresChoisis);
    if (!books.length) {
      throw new BadRequestException('Aucun livre trouvé pour ce scope.');
    }

    const planLecture = generateReadingPlan(books, nbJours, dateDebut);

    const now    = admin.firestore.FieldValue.serverTimestamp();
    const statut = dateDebut <= new Date() ? MarathonStatut.ACTIF : MarathonStatut.PLANIFIE;

    const docRef = await this.firebase.firestore.collection(this.col).add({
      titre: dto.titre,
      description: dto.description ?? '',
      dateDebut: dto.dateDebut,
      dateFin:   dto.dateFin,
      scope:     dto.scope,
      livresChoisis: dto.livresChoisis ?? [],
      nbJours,
      statut,
      planLecture,
      nbInscrits: 0,
      createdAt: now,
    });

    return { id: docRef.id, nbJours, nbChapitres: planLecture.length };
  }

  async findAll(adminMode = false) {
    this.assertReady();
    let query: FirebaseFirestore.Query = this.firebase.firestore.collection(this.col);
    if (!adminMode) query = query.where('statut', 'in', [MarathonStatut.PLANIFIE, MarathonStatut.ACTIF]);
    query = query.orderBy('dateDebut', 'desc');

    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async findOne(id: string) {
    const doc = await this.firebase.firestore.collection(this.col).doc(id).get();
    if (!doc.exists) throw new NotFoundException('Marathon introuvable.');
    return { id: doc.id, ...doc.data() };
  }

  async archiver(id: string) {
    await this.getOrFail(id);
    await this.firebase.firestore.collection(this.col).doc(id).update({
      statut: MarathonStatut.ARCHIVE,
    });
    return { success: true };
  }

  async reactiver(id: string) {
    await this.getOrFail(id);
    await this.firebase.firestore.collection(this.col).doc(id).update({
      statut: MarathonStatut.ACTIF,
    });
    return { success: true };
  }

  async findOrphaned() {
    this.assertReady();
    const inscSnap = await this.firebase.firestore.collection(this.inscCol).get();
    const marathonIds = [...new Set(inscSnap.docs.map(d => d.data()['marathonId'] as string))];

    const docs = await Promise.all(
      marathonIds.map(id => this.firebase.firestore.collection(this.col).doc(id).get()),
    );

    const orphaned: any[] = [];
    for (let i = 0; i < docs.length; i++) {
      if (!docs[i].exists) {
        const count = inscSnap.docs.filter(d => d.data()['marathonId'] === marathonIds[i]).length;
        orphaned.push({ id: marathonIds[i], titre: 'Marathon supprimé', statut: 'SUPPRIME', nbInscrits: count });
      }
    }
    return orphaned;
  }

  async supprimer(id: string) {
    await this.getOrFail(id);
    await this.firebase.firestore.collection(this.col).doc(id).delete();
    return { success: true };
  }

  // ─── Cron : archivage automatique à minuit ────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async archiverExpires() {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const snap = await this.firebase.firestore
      .collection(this.col)
      .where('statut', '==', MarathonStatut.ACTIF)
      .where('dateFin', '<', today)
      .get();

    const batch = this.firebase.firestore.batch();
    snap.docs.forEach(d => batch.update(d.ref, { statut: MarathonStatut.ARCHIVE }));
    await batch.commit();

    if (snap.size > 0) {
      this.logger.log(`${snap.size} marathon(s) archivé(s) automatiquement.`);
    }
  }

  // ─── Inscriptions ─────────────────────────────────────────────────────────

  async inscrire(marathonId: string, dto: InscrireMarathonDto) {
    const marathon = await this.getOrFail(marathonId);

    if (marathon.statut === MarathonStatut.ARCHIVE) {
      throw new BadRequestException('Ce marathon est archivé.');
    }

    // Vérifier doublon
    const existing = await this.firebase.firestore
      .collection(this.inscCol)
      .where('marathonId', '==', marathonId)
      .where('email', '==', dto.email.toLowerCase())
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new BadRequestException('Vous êtes déjà inscrit à ce marathon.');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await this.firebase.firestore.collection(this.inscCol).add({
      marathonId,
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      phone: dto.phone ?? '',
      city:  dto.city  ?? '',
      progress: {},
      progressPercent: 0,
      milestonesReached: [],
      createdAt: now,
    });

    // Incrémenter le compteur (temps réel)
    await this.firebase.firestore.collection(this.col).doc(marathonId).update({
      nbInscrits: admin.firestore.FieldValue.increment(1),
    });

    // Email de bienvenue
    await this.mail.sendBienvenueMarathon(dto.email, dto.fullName, marathon).catch(
      err => this.logger.error('Mail bienvenue marathon', err),
    );

    return { success: true };
  }

  // ─── Progression ──────────────────────────────────────────────────────────

  async mettreAJourProgression(marathonId: string, dto: UpdateProgressionDto) {
    const marathon = await this.getOrFail(marathonId);

    const snap = await this.firebase.firestore
      .collection(this.inscCol)
      .where('marathonId', '==', marathonId)
      .where('email', '==', dto.email.toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) throw new NotFoundException('Inscription introuvable.');

    const inscRef  = snap.docs[0].ref;
    const inscData = snap.docs[0].data();
    const progress: Record<string, boolean> = { ...(inscData.progress ?? {}) };

    progress[String(dto.day)] = dto.checked;

    const totalDays = (marathon as any).nbJours as number;
    const doneCount = Object.values(progress).filter(Boolean).length;
    const percent   = totalDays > 0 ? Math.round((doneCount / totalDays) * 100) : 0;

    const milestonesReached: number[] = [...(inscData.milestonesReached ?? [])];
    const newMilestones = MILESTONES.filter(
      m => percent >= m && !milestonesReached.includes(m),
    );
    milestonesReached.push(...newMilestones);

    await inscRef.update({ progress, progressPercent: percent, milestonesReached });

    // Envoyer emails de milestone
    for (const milestone of newMilestones) {
      if (milestone < 100) {
        await this.mail
          .sendEncouragementMarathon(dto.email, inscData.fullName, marathon, milestone)
          .catch(err => this.logger.error('Mail encouragement marathon', err));
      } else {
        await this.mail
          .sendAttestationMarathon(dto.email, inscData.fullName, marathon)
          .catch(err => this.logger.error('Mail attestation marathon', err));
      }
    }

    return { percent, milestonesReached };
  }

  async getProgression(marathonId: string, email: string) {
    await this.getOrFail(marathonId);

    const snap = await this.firebase.firestore
      .collection(this.inscCol)
      .where('marathonId', '==', marathonId)
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) return null;

    const data = snap.docs[0].data();

    // Calcul du rang parmi tous les participants
    const allSnap = await this.firebase.firestore
      .collection(this.inscCol)
      .where('marathonId', '==', marathonId)
      .orderBy('progressPercent', 'desc')
      .get();

    const rank = allSnap.docs.findIndex(d => d.data().email === email.toLowerCase()) + 1;
    const totalParticipants = allSnap.size;

    return {
      fullName: data.fullName,
      progress: data.progress,
      progressPercent: data.progressPercent,
      milestonesReached: data.milestonesReached,
      rank,
      totalParticipants,
    };
  }

  async getInscrits(marathonId: string) {
    const snap = await this.firebase.firestore
      .collection(this.inscCol)
      .where('marathonId', '==', marathonId)
      .orderBy('progressPercent', 'desc')
      .get();

    return snap.docs.map((d, i) => ({
      id: d.id,
      rank: i + 1,
      fullName: d.data().fullName,
      email: d.data().email,
      progressPercent: d.data().progressPercent,
      milestonesReached: d.data().milestonesReached,
      createdAt: d.data().createdAt,
    }));
  }

  // ─── Attestation annuelle (déclenchée par l'admin) ────────────────────────

  async envoyerAttestationsAnnuelles(annee: number) {
    // Récupérer tous les marathons archivés de l'année
    const debut = `${annee}-01-01`;
    const fin   = `${annee}-12-31`;

    const marathonsSnap = await this.firebase.firestore
      .collection(this.col)
      .where('dateDebut', '>=', debut)
      .where('dateDebut', '<=', fin)
      .get();

    const marathonIds = marathonsSnap.docs.map(d => d.id);
    if (marathonIds.length === 0) return { envoyes: 0 };

    // Trouver les participants ayant complété 100% sur TOUS les marathons de l'année
    const emailCounts = new Map<string, { count: number; fullName: string }>();

    for (const mId of marathonIds) {
      const snap = await this.firebase.firestore
        .collection(this.inscCol)
        .where('marathonId', '==', mId)
        .where('progressPercent', '==', 100)
        .get();

      snap.docs.forEach(d => {
        const { email, fullName } = d.data();
        const cur = emailCounts.get(email) ?? { count: 0, fullName };
        emailCounts.set(email, { count: cur.count + 1, fullName });
      });
    }

    let envoyes = 0;
    for (const [email, { count, fullName }] of emailCounts) {
      if (count === marathonIds.length) {
        await this.mail
          .sendAttestationAnnuelle(email, fullName, annee, count)
          .catch(err => this.logger.error('Mail attestation annuelle', err));
        envoyes++;
      }
    }

    return { envoyes, totalMarathons: marathonIds.length };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getOrFail(id: string) {
    const doc = await this.firebase.firestore.collection(this.col).doc(id).get();
    if (!doc.exists) throw new NotFoundException('Marathon introuvable.');
    return { id: doc.id, ...doc.data() } as any;
  }

  private resolveBooks(scope: MarathonScope, livresChoisis?: string[]) {
    switch (scope) {
      case MarathonScope.BIBLE_COMPLETE:    return BIBLE_BOOKS;
      case MarathonScope.ANCIEN_TESTAMENT:  return AT_BOOKS;
      case MarathonScope.NOUVEAU_TESTAMENT: return NT_BOOKS;
      case MarathonScope.LIVRES_CHOISIS: {
        if (!livresChoisis?.length) return [];
        return (livresChoisis ?? [])
          .map(id => BIBLE_BOOK_MAP.get(id))
          .filter(Boolean) as typeof BIBLE_BOOKS;
      }
    }
  }
}
