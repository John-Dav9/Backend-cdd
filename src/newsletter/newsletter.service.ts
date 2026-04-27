import { BadRequestException, Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NewsletterService {
  private readonly col = 'newsletter_subscribers';

  constructor(
    private firebase: FirebaseService,
    private mail: MailService,
  ) {}

  async subscribe(email: string, prenom?: string) {
    const existing = await this.firebase.firestore
      .collection(this.col)
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new BadRequestException('Vous êtes déjà abonné à la newsletter.');
    }

    await this.firebase.firestore.collection(this.col).add({
      email:     email.toLowerCase(),
      prenom:    prenom ?? '',
      createdAt: new Date().toISOString(),
    });

    await this.mail.sendConfirmationNewsletter(email, prenom ?? 'ami(e)')
      .catch(() => {});

    return { success: true };
  }

  async findAll() {
    const snap = await this.firebase.firestore
      .collection(this.col)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async desabonner(id: string) {
    await this.firebase.firestore.collection(this.col).doc(id).delete();
    return { success: true };
  }

  async getEmails(): Promise<string[]> {
    const snap = await this.firebase.firestore.collection(this.col).get();
    return snap.docs.map(d => d.data()['email'] as string).filter(Boolean);
  }
}
