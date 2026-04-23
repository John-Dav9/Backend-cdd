import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateLivreDto } from './dto/create-livre.dto';

@Injectable()
export class BibliothequeService {
  constructor(private firebase: FirebaseService) {}

  async create(
    dto: CreateLivreDto,
    pdfFile: Express.Multer.File,
    coverFile?: Express.Multer.File,
  ) {
    const bucket = this.firebase.storage.bucket();
    const timestamp = Date.now();

    // Upload PDF
    const pdfPath = `bibliotheque/${timestamp}_${pdfFile.originalname}`;
    const pdfRef = bucket.file(pdfPath);
    await pdfRef.save(pdfFile.buffer, { contentType: 'application/pdf' });
    await pdfRef.makePublic();
    const pdfUrl = pdfRef.publicUrl();

    // Upload couverture (optionnel)
    let coverUrl: string | null = null;
    if (coverFile) {
      const coverPath = `bibliotheque/covers/${timestamp}_${coverFile.originalname}`;
      const coverRef = bucket.file(coverPath);
      await coverRef.save(coverFile.buffer, { contentType: coverFile.mimetype });
      await coverRef.makePublic();
      coverUrl = coverRef.publicUrl();
    }

    const doc = await this.firebase.firestore.collection('bibliotheque').add({
      ...dto,
      pdfUrl,
      coverUrl,
      pdfPath,
      createdAt: new Date().toISOString(),
    });

    return { id: doc.id, pdfUrl, coverUrl, message: 'Livre ajouté' };
  }

  async findAll() {
    const snap = await this.firebase.firestore
      .collection('bibliotheque')
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async findOne(id: string) {
    const doc = await this.firebase.firestore.collection('bibliotheque').doc(id).get();
    if (!doc.exists) throw new NotFoundException('Livre introuvable');
    return { id: doc.id, ...doc.data() };
  }

  async remove(id: string) {
    const doc = await this.firebase.firestore.collection('bibliotheque').doc(id).get();
    if (!doc.exists) throw new NotFoundException('Livre introuvable');

    const data = doc.data();
    if (data?.pdfPath) {
      await this.firebase.storage.bucket().file(data.pdfPath).delete().catch(() => null);
    }

    await this.firebase.firestore.collection('bibliotheque').doc(id).delete();
    return { message: 'Livre supprimé' };
  }
}
