import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreRepository } from '../firebase/firestore.repository';
import { CreateActualiteDto } from './dto/create-actualite.dto';

@Injectable()
export class ActualitesService {
  constructor(private readonly repo: FirestoreRepository) {}

  async create(dto: CreateActualiteDto) {
    const doc = await this.repo.add('actualites', {
      ...dto,
      publiee: dto.publiee ?? false,
      createdAt: new Date().toISOString(),
    });
    return { id: doc.id, message: 'Actualité créée' };
  }

  async findAll(publieeOnly = false) {
    let query: FirebaseFirestore.Query = this.repo.collection('actualites');
    if (publieeOnly) query = query.where('publiee', '==', true);
    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async findOne(id: string) {
    const doc = await this.repo.getById('actualites', id);
    if (!doc.exists) throw new NotFoundException('Actualité introuvable');
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, data: Partial<CreateActualiteDto>) {
    await this.repo.update('actualites', id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { message: 'Actualité mise à jour' };
  }

  async remove(id: string) {
    await this.repo.remove('actualites', id);
    return { message: 'Actualité supprimée' };
  }
}
