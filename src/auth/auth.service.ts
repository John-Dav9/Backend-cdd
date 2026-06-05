import { BadRequestException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) return;

    const exists = await this.userRepo.findOne({ where: { email: adminEmail } });
    if (!exists) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await this.userRepo.save({ email: adminEmail, passwordHash: hash, fullName: 'Administrateur', role: 'admin' });
      this.logger.log(`Compte admin créé : ${adminEmail}`);
    }
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return { access_token: token, role: user.role, email: user.email };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Mot de passe actuel incorrect');

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.save(user);
    return { message: 'Mot de passe mis à jour' };
  }

  // ═══════════════════════════════════════════════════════════
// À AJOUTER dans auth.controller.ts
// ═══════════════════════════════════════════════════════════

// Importer au début du fichier si pas déjà présent :
// import { Body, Post, Controller } from '@nestjs/common';

@Post('quick-login')
@Public()  // décoratuer @Public() si ton guard est global
async quickLogin(@Body() body: { email: string }) {
  return this.authService.quickLogin(body.email);
}


// ═══════════════════════════════════════════════════════════
// À AJOUTER dans auth.service.ts
// ═══════════════════════════════════════════════════════════

// Importer au début si pas déjà présent :
// import { JwtService } from '@nestjs/jwt';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Member } from '../database/entities/member.entity';
// import { Repository } from 'typeorm';

async quickLogin(email: string): Promise<{ access_token: string; member: any }> {
  // Chercher le membre en base
  const member = await this.memberRepository.findOne({
    where: { email: email.toLowerCase().trim() },
  });

  if (!member) {
    throw new UnauthorizedException('Email non trouvé');
  }

  if (!member.isActive) {
    throw new UnauthorizedException('Compte désactivé');
  }

  // Générer le JWT directement sans OTP
  const payload = {
    sub: member.id,
    email: member.email,
    role: member.role,
  };

  const access_token = this.jwtService.sign(payload);

  // Mettre à jour la date de dernière connexion
  await this.memberRepository.update(member.id, {
    lastLoginAt: new Date(),
  });

  return {
    access_token,
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
    },
  };
}

}
