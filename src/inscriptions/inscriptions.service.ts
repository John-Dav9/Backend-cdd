import { Injectable } from '@nestjs/common';
import { FirestoreRepository } from '../firebase/firestore.repository';
import { MailService } from '../mail/mail.service';
import { CreateInscriptionDto, InscriptionType } from './dto/create-inscription.dto';

@Injectable()
export class InscriptionsService {
  constructor(
    private readonly repo: FirestoreRepository,
    private mail: MailService,
  ) {}

  async create(dto: CreateInscriptionDto) {
    const doc = await this.repo.add('inscriptions', {
      ...dto,
      statut: 'CONFIRME',
      createdAt: new Date().toISOString(),
    });

    await this.mail.sendConfirmationInscription(dto);

    return { id: doc.id, message: 'Inscription enregistrée avec succès' };
  }

  async findAll(type?: InscriptionType) {
    let query: FirebaseFirestore.Query = this.repo.collection('inscriptions');
    if (type) query = query.where('type', '==', type);

    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async remove(id: string) {
    await this.repo.remove('inscriptions', id);
    return { message: 'Inscription supprimée' };
  }
}
