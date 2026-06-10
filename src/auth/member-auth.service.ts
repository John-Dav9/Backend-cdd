import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { CommunitySettings } from '../database/entities/community-settings.entity';
import { Member } from '../database/entities/member.entity';
import { OtpCode } from '../database/entities/otp-code.entity';
import { MailService } from '../mail/mail.service';
import { SmsService } from './sms.service';
import { CheckEmailDto, RegisterDto, VerifyMagicLinkDto, VerifyOtpDto } from './dto/member-auth.dto';

@Injectable()
export class MemberAuthService {
  private readonly logger = new Logger(MemberAuthService.name);

  constructor(
    @InjectRepository(Member) private memberRepo: Repository<Member>,
    @InjectRepository(OtpCode) private otpRepo: Repository<OtpCode>,
    @InjectRepository(CommunitySettings) private settingsRepo: Repository<CommunitySettings>,
    private jwtService: JwtService,
    private mailService: MailService,
    private smsService: SmsService,
    private config: ConfigService,
  ) {}

  async checkEmail(dto: CheckEmailDto) {
    const member = await this.memberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!member) {
      const settings = await this.getSettings();
      return { exists: false, isOpen: settings.isOpen };
    }

    return {
      exists: true,
      hasPhone: !!member.phone,
      method: member.phone ? 'sms' : 'magic_link',
    };
  }

  async sendOtp(email: string) {
    const member = await this.memberRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!member) throw new NotFoundException('Membre non trouvé');

    // Invalider les anciens codes
    await this.otpRepo.update(
      { email: email.toLowerCase(), usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    if (member.phone) {
      const code = randomInt(1000, 10000).toString();
      const codeHash = await bcrypt.hash(code, 10);
      await this.otpRepo.save({ email: email.toLowerCase(), code: codeHash, type: 'sms', expiresAt });
      await this.smsService.sendOtp(member.phone, code);
      return { method: 'sms', message: 'Code envoyé par SMS' };
    } else {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = await bcrypt.hash(token, 10);
      await this.otpRepo.save({
        email: email.toLowerCase(),
        code: tokenHash,
        type: 'magic_link',
        expiresAt,
      });
      const frontendUrl = this.config.get('FRONTEND_URLS', '').split(',')[0].trim();
      const magicLink = `${frontendUrl}/auth/magic-link?token=${token}`;
      await this.mailService.sendMagicLink(member, magicLink);
      return { method: 'magic_link', message: 'Lien de connexion envoyé par email' };
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.otpRepo.findOne({
      where: {
        email: dto.email.toLowerCase(),
        type: 'sms',
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp || !(await bcrypt.compare(dto.code, otp.code))) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    otp.usedAt = new Date();
    await this.otpRepo.save(otp);

    return this.generateMemberToken(dto.email.toLowerCase());
  }

  async verifyMagicLink(dto: VerifyMagicLinkDto) {
    const candidates = await this.otpRepo.find({
      where: {
        type: 'magic_link',
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    let otp: OtpCode | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(dto.token, candidate.code)) {
        otp = candidate;
        break;
      }
    }
    if (!otp) throw new UnauthorizedException('Lien expiré ou déjà utilisé');

    otp.usedAt = new Date();
    await this.otpRepo.save(otp);

    return this.generateMemberToken(otp.email);
  }

  async register(dto: RegisterDto) {
    const settings = await this.getSettings();
    if (!settings.isOpen) {
      throw new BadRequestException('Les inscriptions sont fermées. Contactez-nous.');
    }

    const existing = await this.memberRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new BadRequestException('Email déjà enregistré');

    const member = await this.memberRepo.save({
      email: dto.email.toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      city: dto.city,
      source: 'registration',
      role: 'member',
    });

    return this.generateMemberToken(member.email);
  }

  async getMe(memberId: string) {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Membre non trouvé');
    const { ...safe } = member;
    return safe;
  }

  private async generateMemberToken(email: string) {
    const member = await this.memberRepo.findOne({ where: { email } });
    if (!member || !member.isActive) throw new UnauthorizedException('Compte désactivé');

    member.lastLoginAt = new Date();
    await this.memberRepo.save(member);

    const payload = { sub: member.id, email: member.email, role: member.role, type: 'member' };
    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: member.role,
      },
    };
  }

  private async getSettings(): Promise<CommunitySettings> {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = await this.settingsRepo.save({ isOpen: true });
    }
    return settings;
  }
}
