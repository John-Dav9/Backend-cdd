import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { createReadStream } from 'fs';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;
  private privateBucket: string;
  private readonly logger = new Logger(StorageService.name);
  private publicBaseUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'cmciea');
    this.privateBucket = `${this.bucket}-private`;
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
      if (!await this.client.bucketExists(this.privateBucket)) {
        await this.client.makeBucket(this.privateBucket);
        this.logger.log(`Bucket privé "${this.privateBucket}" créé.`);
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

  async deletePrivate(path: string): Promise<void> {
    await this.client.removeObject(this.privateBucket, path).catch(() => null);
  }

  async uploadPrivateFile(path: string, localPath: string, size: number, mimetype: string) {
    await this.client.putObject(
      this.privateBucket,
      path,
      createReadStream(localPath),
      size,
      { 'Content-Type': mimetype },
    );
  }

  getPrivateUrl(path: string, expiresSeconds = 3600) {
    return this.client.presignedGetObject(this.privateBucket, path, expiresSeconds);
  }

  getUrl(path: string): string {
    return `${this.publicBaseUrl}/${path}`;
  }
}
