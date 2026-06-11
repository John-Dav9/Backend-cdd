import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use((req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // ── Sécurité HTTP ──────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://meet.cmciea-france.com'],
          frameSrc: ["'self'", 'https://meet.cmciea-france.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          mediaSrc: ["'self'", 'https:', 'blob:'],
          workerSrc: ["'self'", 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────────────
  const frontendUrls = (
    process.env.FRONTEND_URLS
      ? process.env.FRONTEND_URLS.split(',').map((url) => url.trim()).filter(Boolean)
      : [process.env.FRONTEND_URL || 'http://localhost:4200']
  ).filter(Boolean);

  const allowedOrigins = new Set(frontendUrls);
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim().toLowerCase();
  const firebasePreviewOriginPattern = firebaseProjectId
    ? new RegExp(
      `^${firebaseProjectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--[a-z0-9-]+)?\\.(web\\.app|firebaseapp\\.com)$`,
      'i',
    )
    : null;

  const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;

    try {
      const { hostname } = new URL(origin);
      const normalizedHost = hostname.toLowerCase();

      if (
        process.env.NODE_ENV !== 'production' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(normalizedHost)
      ) {
        return true;
      }

      return firebasePreviewOriginPattern?.test(normalizedHost) ?? false;
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin non autorisée par CORS: ${origin}`));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend CMCIEA démarré sur 0.0.0.0:${port}`);
}

bootstrap();
