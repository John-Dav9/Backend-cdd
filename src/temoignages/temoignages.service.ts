import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateTemoignageDto } from './dto/create-temoignage.dto';

export type StatutTemoignage = 'EN_ATTENTE' | 'APPROUVE' | 'REJETE';

@Injectable()
export class TemoignagesService {
  constructor(private firebase: FirebaseService) {}

  async create(dto: CreateTemoignageDto) {
    const doc = await this.firebase.firestore.collection('temoignages').add({
      ...dto,
      statut: 'EN_ATTENTE' as StatutTemoignage,
      createdAt: new Date().toISOString(),
    });
    return { id: doc.id, message: 'Témoignage soumis, en attente de modération' };
  }

  // Public : uniquement approuvés
  async findApprouves() {
    const snap = await this.firebase.firestore
      .collection('temoignages')
      .where('statut', '==', 'APPROUVE')
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // Admin : tous
  async findAll(statut?: StatutTemoignage) {
    let query: FirebaseFirestore.Query = this.firebase.firestore.collection('temoignages');
    if (statut) query = query.where('statut', '==', statut);
    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async moderer(id: string, statut: StatutTemoignage) {
    const doc = await this.firebase.firestore.collection('temoignages').doc(id).get();
    if (!doc.exists) throw new NotFoundException('Témoignage introuvable');
    await doc.ref.update({ statut, moderéAt: new Date().toISOString() });
    return { message: `Témoignage ${statut.toLowerCase()}` };
  }

  async remove(id: string) {
    await this.firebase.firestore.collection('temoignages').doc(id).delete();
    return { message: 'Témoignage supprimé' };
  }
}
