import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Groq from 'groq-sdk';
import { Recording } from '../database/entities/recording.entity';
import { CreateRecordingDto } from './dto/create-recording.dto';

@Injectable()
export class ReplaysService {
  private groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  constructor(@InjectRepository(Recording) private repo: Repository<Recording>) {}

  findAllPublic() {
    return this.repo.find({
      where: { isPublic: true },
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  findAllAdmin() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Enregistrement introuvable');
    return r;
  }

  async create(dto: CreateRecordingDto) {
    const saved = await this.repo.save(this.repo.create({
      ...dto,
      tags: dto.tags ?? [],
      isPublic: dto.isPublic ?? false,
      publishedAt: dto.isPublic ? new Date() : undefined,
    }));
    return { id: saved.id, message: 'Enregistrement créé' };
  }

  async update(id: string, dto: Partial<CreateRecordingDto>) {
    const r = await this.findOne(id);
    if (dto.isPublic && !r.isPublic) {
      (dto as any).publishedAt = new Date();
    }
    await this.repo.update(id, dto);
    return { message: 'Enregistrement mis à jour' };
  }

  async togglePublic(id: string) {
    const r = await this.findOne(id);
    r.isPublic = !r.isPublic;
    if (r.isPublic) r.publishedAt = new Date();
    await this.repo.save(r);
    return { isPublic: r.isPublic };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Enregistrement supprimé' };
  }

  async summarize(id: string): Promise<{ summary: string }> {
    const r = await this.findOne(id);
    const prompt = `Tu es un assistant pastoral de l'église CMCIEA France.
Voici les informations d'un sermon : "${r.title}" par ${r.speakerName ?? 'le prédicateur'}.
Description : ${r.description ?? 'Non renseignée'}.

Rédige un résumé spirituel en 5 points clés, en français, concis et édifiant.
Format : liste numérotée de 5 points (1 à 2 phrases chacun).`;

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.6,
    });

    const summary = completion.choices[0]?.message?.content ?? 'Résumé non disponible.';

    // Stocker le résumé dans la description si vide
    if (!r.description && summary) {
      await this.repo.update(id, { description: summary });
    }

    return { summary };
  }

  async getRecommendations(id: string, limit = 4): Promise<Recording[]> {
    const r = await this.findOne(id);
    const qb = this.repo.createQueryBuilder('rec')
      .where('rec.isPublic = true AND rec.id != :id', { id })
      .orderBy('rec.publishedAt', 'DESC')
      .take(limit);

    if (r.tags?.length) {
      // Préférer les enregistrements avec des tags communs
      qb.orderBy(`CASE WHEN rec.tags && ARRAY[:...tags]::text[] THEN 0 ELSE 1 END`, 'ASC')
        .setParameter('tags', r.tags);
    }
    return qb.getMany();
  }

  async getPodcastFeed(baseUrl: string): Promise<string> {
    const replays = await this.repo.find({
      where: { isPublic: true },
      order: { publishedAt: 'DESC' },
      take: 50,
    });

    const items = replays.map(r => `
    <item>
      <title><![CDATA[${r.title}]]></title>
      <description><![CDATA[${r.description ?? ''}]]></description>
      <pubDate>${new Date(r.publishedAt ?? r.createdAt).toUTCString()}</pubDate>
      <guid>${baseUrl}/replays/${r.id}</guid>
      <link>${r.videoUrl ?? `${baseUrl}/replays/${r.id}`}</link>
      ${r.durationSeconds ? `<itunes:duration>${Math.floor(r.durationSeconds / 60)}:${String(r.durationSeconds % 60).padStart(2, '0')}</itunes:duration>` : ''}
      ${r.thumbnailUrl ? `<itunes:image href="${r.thumbnailUrl}"/>` : ''}
      ${r.speakerName ? `<itunes:author>${r.speakerName}</itunes:author>` : ''}
    </item>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>CMCIEA France — Sermons &amp; Enseignements</title>
    <description>Sermons, enseignements bibliques et messages de l'église CMCIEA France - Chercheurs de Dieu</description>
    <link>${baseUrl}</link>
    <language>fr</language>
    <itunes:author>CMCIEA France</itunes:author>
    <itunes:category text="Religion &amp; Spirituality">
      <itunes:category text="Christianity"/>
    </itunes:category>
    <itunes:explicit>no</itunes:explicit>
    <itunes:image href="${baseUrl}/assets/podcast-cover.jpg"/>
    ${items}
  </channel>
</rss>`;
  }
}
