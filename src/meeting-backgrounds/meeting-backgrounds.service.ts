import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpiritualBackground } from '../database/entities/spiritual-background.entity';
import { StorageService } from '../storage/storage.service';

const DEFAULT_BACKGROUNDS = [
  ['ocean', 'Océan', 'linear-gradient(145deg, #68b9cf, #185f7f 58%, #082f49)'],
  ['dawn', 'Aube', 'linear-gradient(145deg, #f6c177, #b65d66 52%, #46335d)'],
  ['midnight', 'Nuit', 'radial-gradient(circle at 70% 15%, #526585, #111827 48%, #05070c)'],
  ['forest', 'Forêt', 'linear-gradient(145deg, #658568, #234a3a 52%, #102a25)'],
  ['parchment', 'Parchemin', 'linear-gradient(145deg, #e5cf9d, #a57d45 55%, #5d4024)'],
  ['royal', 'Royal', 'linear-gradient(145deg, #59429a, #2c235e 52%, #16132e)'],
] as const;

@Injectable()
export class MeetingBackgroundsService implements OnModuleInit {
  constructor(
    @InjectRepository(SpiritualBackground)
    private readonly repo: Repository<SpiritualBackground>,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit() {
    for (const [slug, label, gradient] of DEFAULT_BACKGROUNDS) {
      const exists = await this.repo.findOne({ where: { slug } });
      if (!exists) {
        await this.repo.save(this.repo.create({
          slug,
          label,
          gradient,
          sortOrder: DEFAULT_BACKGROUNDS.findIndex(item => item[0] === slug),
        }));
      }
    }
  }

  findPublic() {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  findAll() {
    return this.repo.find({ order: { sortOrder: 'ASC', label: 'ASC' } });
  }

  async create(
    data: {
      label: string;
      gradient?: string;
      textColor?: string;
      overlayColor?: string;
      sortOrder?: number;
    },
    file?: Express.Multer.File,
  ) {
    const label = data.label?.trim();
    if (!label) throw new BadRequestException('Le nom du fond est obligatoire.');
    if (!file && !data.gradient?.trim()) {
      throw new BadRequestException('Ajoutez une image ou un dégradé.');
    }
    if (file && (!file.mimetype.startsWith('image/') || file.size > 8 * 1024 * 1024)) {
      throw new BadRequestException('Le fond doit être une image de 8 Mo maximum.');
    }
    if (data.gradient && !/^(linear|radial)-gradient\([#(),.%\sa-z0-9-]+\)$/i.test(data.gradient)) {
      throw new BadRequestException('Le dégradé CSS est invalide.');
    }

    const slugBase = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fond';
    let slug = slugBase;
    let suffix = 1;
    while (await this.repo.findOne({ where: { slug } })) slug = `${slugBase}-${suffix++}`;

    const imageUrl = file
      ? await this.storage.upload(
        `meeting-backgrounds/${Date.now()}-${file.originalname.replace(/[^a-z0-9._-]/gi, '_')}`,
        file.buffer,
        file.mimetype,
      )
      : null;

    return this.repo.save(this.repo.create({
      slug,
      label,
      imageUrl,
      gradient: data.gradient?.trim() || null as any,
      textColor: this.safeColor(data.textColor, '#ffffff'),
      overlayColor: this.safeColor(data.overlayColor, 'rgba(0,0,0,0.35)'),
      sortOrder: Number(data.sortOrder) || 0,
    }));
  }

  async update(id: string, data: Partial<SpiritualBackground>) {
    const background = await this.repo.findOne({ where: { id } });
    if (!background) throw new NotFoundException('Fond introuvable.');
    if (data.label !== undefined) background.label = data.label.trim().slice(0, 100);
    if (data.isActive !== undefined) background.isActive = Boolean(data.isActive);
    if (data.sortOrder !== undefined) background.sortOrder = Number(data.sortOrder) || 0;
    if (data.textColor !== undefined) background.textColor = this.safeColor(data.textColor, background.textColor);
    if (data.overlayColor !== undefined) {
      background.overlayColor = this.safeColor(data.overlayColor, background.overlayColor);
    }
    return this.repo.save(background);
  }

  async remove(id: string) {
    const background = await this.repo.findOne({ where: { id } });
    if (!background) throw new NotFoundException('Fond introuvable.');
    if (DEFAULT_BACKGROUNDS.some(item => item[0] === background.slug)) {
      background.isActive = false;
      await this.repo.save(background);
      return { deleted: false, disabled: true };
    }
    await this.repo.delete(id);
    return { deleted: true };
  }

  private safeColor(value: string | undefined, fallback: string) {
    const color = value?.trim();
    return color && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(color)
      ? color
      : fallback;
  }
}
