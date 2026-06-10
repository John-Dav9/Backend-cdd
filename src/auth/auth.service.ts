import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { OtpCode } from '../database/entities/otp-code.entity';
import { User } from '../database/entities/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(OtpCode) private otpRepo: Repository<OtpCode>,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
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

    const enabled = this.config.get<string>(
      'ADMIN_2FA_ENABLED',
      this.config.get('NODE_ENV') === 'production' ? 'true' : 'false',
    ).toLowerCase() === 'true';
    if (!enabled) return this.generateAccessToken(user);

    await this.otpRepo.update(
      { email: user.email, type: 'admin_login', usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const code = randomInt(100000, 1000000).toString();
    await this.otpRepo.save({
      email: user.email,
      code: await bcrypt.hash(code, 10),
      type: 'admin_login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    try {
      await this.mailService.sendAdminLoginCode(user.email, code);
    } catch (error: any) {
      this.logger.error(`Échec envoi 2FA admin: ${error?.message}`);
      throw new ServiceUnavailableException(
        'Le code de sécurité ne peut pas être envoyé. Vérifiez la configuration email.',
      );
    }

    return {
      requires_2fa: true,
      challenge: await this.jwtService.signAsync(
        { sub: user.id, purpose: 'admin_2fa' },
        { expiresIn: '10m' },
      ),
      email_hint: this.maskEmail(user.email),
    };
  }

  async verifyAdminLogin(challenge: string, code: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(challenge);
    } catch {
      throw new UnauthorizedException('Challenge de connexion invalide ou expiré.');
    }
    if (payload.purpose !== 'admin_2fa') {
      throw new UnauthorizedException('Challenge de connexion invalide.');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      throw new UnauthorizedException('Compte administrateur invalide.');
    }

    const otp = await this.otpRepo.findOne({
      where: {
        email: user.email,
        type: 'admin_login',
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    if (!otp || !(await bcrypt.compare(code, otp.code))) {
      throw new UnauthorizedException('Code de sécurité invalide ou expiré.');
    }

    otp.usedAt = new Date();
    await this.otpRepo.save(otp);
    return this.generateAccessToken(user);
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

  private async generateAccessToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);
    return { access_token: token, role: user.role, email: user.email };
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
  }
}
