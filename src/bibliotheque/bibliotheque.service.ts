import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bibliotheque } from '../database/entities/bibliotheque.entity';
import { StorageService } from '../storage/storage.service';
import { CreateLivreDto } from './dto/create-livre.dto';

type UploadFile = { originalname: string; mimetype: string; buffer: Buffer };

@Injectable()
export class BibliothequeService {
  constructor(
    @InjectRepository(Bibliotheque) private repo: Repository<Bibliotheque>,
    private storage: StorageService,
  ) {}

  async create(dto: CreateLivreDto, pdfFile: UploadFile, coverFile?: UploadFile) {
    const ts      = Date.now();
    const pdfPath = `bibliotheque/${ts}_${pdfFile.originalname}`;
    const pdfUrl  = await this.storage.upload(pdfPath, pdfFile.buffer, 'application/pdf');

    let coverUrl: string | undefined;
    let coverPath: string | undefined;
    if (coverFile) {
      coverPath = `bibliotheque/covers/${ts}_${coverFile.originalname}`;
      coverUrl  = await this.storage.upload(coverPath, coverFile.buffer, coverFile.mimetype);
    }

    const saved = await this.repo.save(this.repo.create({ ...dto, pdfUrl, pdfPath, coverUrl, coverPath }));
    return { id: saved.id, pdfUrl, coverUrl, message: 'Livre ajouté' };
  }

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const b = await this.repo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Livre introuvable');
    return b;
  }

  async remove(id: string) {
    const b = await this.repo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Livre introuvable');
    if (b.pdfPath)   await this.storage.delete(b.pdfPath);
    if (b.coverPath) await this.storage.delete(b.coverPath);
    await this.repo.delete(id);
    return { message: 'Livre supprimé' };
  }
}
