import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { MemberAuthService } from './member-auth.service';
import { CheckEmailDto, RegisterDto, SendOtpDto, VerifyMagicLinkDto, VerifyOtpDto } from './dto/member-auth.dto';
import { Public } from './public.decorator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private memberAuthService: MemberAuthService,
  ) {}

  // ── Admin auth (inchangé) ──────────────────────────────────────────────────

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('change-password')
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }

  // ── Member auth (OTP / magic link) ────────────────────────────────────────

  @Public()
  @Post('check-email')
  checkEmail(@Body() dto: CheckEmailDto) {
    return this.memberAuthService.checkEmail(dto);
  }

  @Public()
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.memberAuthService.sendOtp(dto.email);
  }

  @Public()
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.memberAuthService.verifyOtp(dto);
  }

  @Public()
  @Post('magic-link/verify')
  verifyMagicLink(@Body() dto: VerifyMagicLinkDto) {
    return this.memberAuthService.verifyMagicLink(dto);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.memberAuthService.register(dto);
  }

  @Get('me')
  getMe(@Request() req: any) {
    return this.memberAuthService.getMe(req.user.sub);
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
