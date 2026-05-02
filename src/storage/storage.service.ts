import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;
  private readonly logger = new Logger(StorageService.name);
  private publicBaseUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'cmciea');
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.config.get<number>('MINIO_PORT', 9000);
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', ''),
    });

    const protocol = useSSL ? 'https' : 'http';
    this.publicBaseUrl = `${protocol}://${endpoint}:${port}/${this.bucket}`;
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        const policy = JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          }],
        });
        await this.client.setBucketPolicy(this.bucket, policy);
        this.logger.log(`Bucket "${this.bucket}" créé avec politique publique.`);
      }
    } catch (err) {
      this.logger.error('MinIO init error', err);
    }
  }

  async upload(path: string, buffer: Buffer, mimetype: string): Promise<string> {
    await this.client.putObject(this.bucket, path, buffer, buffer.length, { 'Content-Type': mimetype });
    return `${this.publicBaseUrl}/${path}`;
  }

  async delete(path: string): Promise<void> {
    await this.client.removeObject(this.bucket, path).catch(() => null);
  }

  getUrl(path: string): string {
    return `${this.publicBaseUrl}/${path}`;
  }
}
