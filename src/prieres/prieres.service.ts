import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';

export type PriereStatut = 'en_attente' | 'pris_en_charge' | 'ferme';

@Injectable()
export class PrieresService {
  private readonly col = 'prieres';

  constructor(
    private firebase: FirebaseService,
    private mail: MailService,
  ) {}

  async soumettre(data: {
    prenom: string;
    anonyme: boolean;
    sujet: string;
    message: string;
    email?: string;
  }) {
    const doc = await this.firebase.firestore.collection(this.col).add({
      prenom:   data.anonyme ? 'Anonyme' : data.prenom,
      anonyme:  data.anonyme,
      sujet:    data.sujet,
      message:  data.message,
      email:    data.anonyme ? null : (data.email ?? null),
      statut:   'en_attente' as PriereStatut,
      createdAt: new Date().toISOString(),
    });

    // Confirmation email si email fourni et non anonyme
    if (!data.anonyme && data.email) {
      await this.mail.sendConfirmationPriere(data.email, data.prenom, data.sujet)
        .catch(() => {});
    }

    return { id: doc.id, success: true };
  }

  async findAll() {
    const snap = await this.firebase.firestore
      .collection(this.col)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async updateStatut(id: string, statut: PriereStatut) {
    await this.firebase.firestore.collection(this.col).doc(id).update({ statut });
    return { success: true };
  }

  async supprimer(id: string) {
    await this.firebase.firestore.collection(this.col).doc(id).delete();
    return { success: true };
  }
}
