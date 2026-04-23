import {
  CanActivate,
  ForbiddenException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../firebase/firebase.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private firebase: FirebaseService,
    private reflector: Reflector,
    private config: ConfigService,
  ) {}

  private isLocalRequest(request: any): boolean {
    const forwarded = (request.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim();

    const candidates = [
      forwarded,
      request.ip,
      request.socket?.remoteAddress,
      request.connection?.remoteAddress,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    return candidates.some(
      (ip) =>
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '::ffff:127.0.0.1' ||
        ip === 'localhost',
    );
  }

  private isDevAdminAllowed(token: string, request: any): boolean {
    const enabled = this.config.get<string>('DEV_ADMIN_ENABLED', 'false') === 'true';
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const expectedToken = this.config.get<string>('DEV_ADMIN_TOKEN');
    const isLocal = this.isLocalRequest(request);

    if (!enabled || nodeEnv === 'production' || !expectedToken || !isLocal) {
      return false;
    }

    return token === expectedToken;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.split(' ')[1];

    if (this.isDevAdminAllowed(token, request)) {
      const request = context.switchToHttp().getRequest();
      request.user = {
        uid: 'dev-admin',
        email: this.config.get<string>('DEV_ADMIN_EMAIL') || 'admin-dev@local.test',
        role: 'admin',
        dev: true,
      };
      return true;
    }

    try {
      const decoded = await this.firebase.auth.verifyIdToken(token);
      request.user = decoded;
      return true;
    } catch {
      if (this.config.get<string>('DEV_ADMIN_ENABLED', 'false') === 'true') {
        throw new ForbiddenException('Token invalide (ni Firebase ni dev-admin)');
      }
      throw new UnauthorizedException('Token invalide');
    }
  }
}
