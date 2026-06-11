import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from '../database/entities/member.entity';
import { User } from '../database/entities/user.entity';
import { IS_PUBLIC_KEY } from './public.decorator';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private revokedTokens: TokenRevocationService,
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (await this.revokedTokens.isRevoked(payload.jti)) {
        throw new UnauthorizedException('Session révoquée');
      }
      if (payload.type === 'visitor' && payload.role === 'visitor') {
        payload.name = String(payload.name ?? 'Visiteur').slice(0, 100);
      } else if (payload.type === 'member' && payload.role !== 'meeting_moderator') {
        const member = await this.memberRepo.findOne({ where: { id: payload.sub } });
        if (!member?.isActive) {
          throw new UnauthorizedException('Compte membre inactif');
        }
        payload.role = member.role;
        payload.email = member.email;
        payload.name = `${member.firstName} ${member.lastName}`.trim();
      } else if (payload.type !== 'member') {
        const user = await this.userRepo.findOne({ where: { id: payload.sub } });
        if (!user || !['admin', 'super_admin'].includes(user.role)) {
          throw new UnauthorizedException('Compte administrateur invalide');
        }
        payload.role = user.role;
        payload.email = user.email;
        payload.name = user.fullName;
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
