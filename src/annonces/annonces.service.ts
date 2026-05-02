import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annonce } from '../database/entities/annonce.entity';
import { Inscription } from '../database/entities/inscription.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { NewsletterSubscriber } from '../database/entities/newsletter-subscriber.entity';
import { MailService } from '../mail/mail.service';
import { CreateAnnonceDto } from './dto/create-annonce.dto';

@Injectable()
export class AnnoncesService {
  constructor(
    @InjectRepository(Annonce) private repo: Repository<Annonce>,
    @InjectRepository(Inscription) private inscRepo: Repository<Inscription>,
    @InjectRepository(MarathonInscription) private marathonInscRepo: Repository<MarathonInscription>,
    @InjectRepository(NewsletterSubscriber) private newsletterRepo: Repository<NewsletterSubscriber>,
    private mail: MailService,
  ) {}

  async create(dto: CreateAnnonceDto) {
    const saved = await this.repo.save(this.repo.create({
      titre: dto.titre,
      contenu: dto.contenu,
      publiee: dto.publiee ?? false,
    }));

    if (dto.envoyerEmail) {
      const [inscs, marathonInscs, newsletterSubs] = await Promise.all([
        this.inscRepo.find({ select: ['email'] }),
        this.marathonInscRepo.find({ select: ['email'] }),
        this.newsletterRepo.find({ select: ['email'] }),
      ]);
      const emails = [
        ...new Set(
          [...inscs, ...marathonInscs, ...newsletterSubs]
            .map(i => (i.email ?? '').toLowerCase().trim())
            .filter(e => e.includes('@')),
        ),
      ];
      // Envoi en arrière-plan : ne bloque pas la réponse HTTP
      this.mail.sendAnnonce(emails, dto.titre, dto.contenu).catch(() => {});
    }

    return { id: saved.id, message: 'Annonce créée' };
  }

  async findAll(publieeOnly = false) {
    return this.repo.find({ where: publieeOnly ? { publiee: true } : {}, order: { createdAt: 'DESC' } });
  }

  async update(id: string, dto: Partial<CreateAnnonceDto>) {
    await this.repo.update(id, { titre: dto.titre, contenu: dto.contenu, publiee: dto.publiee });
    return { message: 'Annonce mise à jour' };
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { message: 'Annonce supprimée' };
  }
}
