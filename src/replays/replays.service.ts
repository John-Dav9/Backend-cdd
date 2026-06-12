import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Groq from 'groq-sdk';
import { stat } from 'fs/promises';
import { basename, extname, resolve, sep } from 'path';
import { Repository } from 'typeorm';
import { Meeting } from '../database/entities/meeting.entity';
import { Recording } from '../database/entities/recording.entity';
import { StorageService } from '../storage/storage.service';
import { CreateRecordingDto } from './dto/create-recording.dto';

@Injectable()
export class ReplaysService {
  private groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  constructor(
    @InjectRepository(Recording) private repo: Repository<Recording>,
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    private storage: StorageService,
    private config: ConfigService,
  ) {}

  async findAllPublic(limit = 100) {
    const recordings = await this.repo.find({
      where: { isPublic: true },
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
    return Promise.all(recordings.map(recording => this.withAccessUrl(recording)));
  }

  async findAllAdmin() {
    const recordings = await this.repo.find({ order: { createdAt: 'DESC' } });
    return Promise.all(recordings.map(recording => this.withAccessUrl(recording)));
  }

  async findOne(id: string) {
    const recording = await this.repo.findOne({ where: { id } });
    if (!recording) throw new NotFoundException('Enregistrement introuvable');
    return recording;
  }

  async findOnePublic(id: string) {
    const recording = await this.repo.findOne({ where: { id, isPublic: true } });
    if (!recording) throw new NotFoundException('Enregistrement introuvable');
    return this.withAccessUrl(recording);
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
    const recording = await this.findOne(id);
    if (dto.isPublic && !recording.isPublic) (dto as any).publishedAt = new Date();
    await this.repo.update(id, dto);
    return { message: 'Enregistrement mis à jour' };
  }

  async togglePublic(id: string) {
    const recording = await this.findOne(id);
    recording.isPublic = !recording.isPublic;
    if (recording.isPublic) recording.publishedAt = new Date();
    await this.repo.save(recording);
    return { isPublic: recording.isPublic };
  }

  async remove(id: string) {
    const recording = await this.findOne(id);
    if (recording.storagePath) await this.storage.deletePrivate(recording.storagePath);
    await this.repo.delete(id);
    return { message: 'Enregistrement supprimé' };
  }

  async summarize(id: string): Promise<{ summary: string }> {
    const recording = await this.findOne(id);
    const prompt = `Tu es un assistant pastoral de l'église CMCIEA France.
Voici les informations d'un sermon : "${recording.title}" par ${recording.speakerName ?? 'le prédicateur'}.
Description : ${recording.description ?? 'Non renseignée'}.

Rédige un résumé spirituel en 5 points clés, en français, concis et édifiant.
Format : liste numérotée de 5 points (1 à 2 phrases chacun).`;
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.6,
    });
    const summary = completion.choices[0]?.message?.content ?? 'Résumé non disponible.';
    if (!recording.description && summary) await this.repo.update(id, { description: summary });
    return { summary };
  }

  async getPublicRecommendations(id: string, limit = 4): Promise<any[]> {
    const recording = await this.findOnePublic(id);
    const qb = this.repo.createQueryBuilder('rec')
      .where('rec.isPublic = true AND rec.id != :id', { id })
      .orderBy('rec.publishedAt', 'DESC')
      .take(limit);
    if (recording.tags?.length) {
      qb.orderBy(`CASE WHEN rec.tags && ARRAY[:...tags]::text[] THEN 0 ELSE 1 END`, 'ASC')
        .setParameter('tags', recording.tags);
    }
    const recommendations = await qb.getMany();
    return Promise.all(recommendations.map(item => this.withAccessUrl(item)));
  }

  async getPodcastFeed(baseUrl: string): Promise<string> {
    const recordings = await this.repo.find({
      where: { isPublic: true },
      order: { publishedAt: 'DESC' },
      take: 50,
    });
    const replays = await Promise.all(recordings.map(recording => this.withAccessUrl(recording)));
    const items = replays.map(recording => `
    <item>
      <title><![CDATA[${recording.title}]]></title>
      <description><![CDATA[${recording.description ?? ''}]]></description>
      <pubDate>${new Date(recording.publishedAt ?? recording.createdAt).toUTCString()}</pubDate>
      <guid>${baseUrl}/replays/${recording.id}</guid>
      <link>${recording.videoUrl ?? `${baseUrl}/replays/${recording.id}`}</link>
      ${recording.durationSeconds ? `<itunes:duration>${Math.floor(recording.durationSeconds / 60)}:${String(recording.durationSeconds % 60).padStart(2, '0')}</itunes:duration>` : ''}
      ${recording.thumbnailUrl ? `<itunes:image href="${recording.thumbnailUrl}"/>` : ''}
      ${recording.speakerName ? `<itunes:author>${recording.speakerName}</itunes:author>` : ''}
    </item>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>CMCIEA France — Sermons &amp; Enseignements</title>
    <description>Sermons et enseignements bibliques de CMCIEA France</description>
    <link>${baseUrl}</link><language>fr</language>
    ${items}
  </channel>
</rss>`;
  }

  async finalizeJibri(recordingPath: string, roomId: string) {
    const root = resolve(this.config.get<string>('JIBRI_RECORDINGS_PATH', '/recordings'));
    const localPath = resolve(recordingPath);
    if (localPath !== root && !localPath.startsWith(`${root}${sep}`)) {
      throw new NotFoundException('Chemin d’enregistrement invalide');
    }
    const file = await stat(localPath).catch(() => null);
    if (!file?.isFile()) throw new NotFoundException('Fichier Jibri introuvable');
    const meeting = await this.meetingRepo.findOne({ where: { jitsiRoomId: roomId } });
    if (!meeting) throw new NotFoundException('Réunion Jitsi introuvable');

    const extension = extname(localPath).toLowerCase() || '.mp4';
    const storagePath = `replays/${meeting.id}/${Date.now()}${extension}`;
    await this.storage.uploadPrivateFile(
      storagePath,
      localPath,
      file.size,
      extension === '.webm' ? 'video/webm' : 'video/mp4',
    );
    meeting.recordingPath = storagePath;
    await this.meetingRepo.save(meeting);
    const existing = await this.repo.findOne({ where: { meetingId: meeting.id } });
    const recording = existing ?? this.repo.create({
      meetingId: meeting.id,
      title: meeting.title,
      description: meeting.description,
      tags: [],
      isPublic: false,
    });
    recording.storagePath = storagePath;
    recording.videoUrl = null as any;
    const saved = await this.repo.save(recording);
    return { imported: true, recordingId: saved.id, file: basename(localPath) };
  }

  async getDownloadStream(id: string) {
    const recording = await this.findOne(id);
    if (!recording.storagePath) throw new NotFoundException('Aucun fichier associé à cet enregistrement');
    const stream = await this.storage.getPrivateStream(recording.storagePath);
    const filename = basename(recording.storagePath);
    return { stream, filename };
  }

  private async withAccessUrl(recording: Recording): Promise<any> {
    if (!recording.storagePath) return recording;
    return {
      ...recording,
      videoUrl: await this.storage.getPrivateUrl(recording.storagePath),
    };
  }
}
