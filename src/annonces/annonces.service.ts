import { Injectable } from '@nestjs/common';
import { FirestoreRepository } from '../firebase/firestore.repository';
import { MailService } from '../mail/mail.service';
import { CreateAnnonceDto } from './dto/create-annonce.dto';

@Injectable()
export class AnnoncesService {
  constructor(
    private readonly repo: FirestoreRepository,
    private mail: MailService,
  ) {}

  async create(dto: CreateAnnonceDto) {
    const doc = await this.repo.add('annonces', {
      titre: dto.titre,
      contenu: dto.contenu,
      publiee: dto.publiee ?? false,
      createdAt: new Date().toISOString(),
    });

    if (dto.envoyerEmail) {
      const inscritsSnap = await this.repo.collection('inscriptions').get();
      const emails = [
        ...new Set(inscritsSnap.docs.map((d) => d.data().email as string)),
      ];
      await this.mail.sendAnnonce(emails, dto.titre, dto.contenu);
    }

    return { id: doc.id, message: 'Annonce créée' };
  }

  async findAll(publieeOnly = false) {
    let query: FirebaseFirestore.Query = this.repo.collection('annonces');
    if (publieeOnly) query = query.where('publiee', '==', true);
    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async update(id: string, data: Partial<CreateAnnonceDto>) {
    await this.repo.update('annonces', id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { message: 'Annonce mise à jour' };
  }

  async remove(id: string) {
    await this.repo.remove('annonces', id);
    return { message: 'Annonce supprimée' };
  }
}
