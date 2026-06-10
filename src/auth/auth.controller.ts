import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { AuthService } from './auth.service';
import { MemberAuthService } from './member-auth.service';
import { CheckEmailDto, GuestAccessDto, RegisterDto, SendOtpDto, VerifyMagicLinkDto, VerifyOtpDto } from './dto/member-auth.dto';
import { Public } from './public.decorator';
import { AdminOnly } from './roles.decorator';
import { TokenRevocationService } from './token-revocation.service';

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

class VerifyAdminLoginDto {
  @IsString()
  @IsNotEmpty()
  challenge: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private memberAuthService: MemberAuthService,
    private tokenRevocation: TokenRevocationService,
  ) {}

  // ── Admin auth (inchangé) ──────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('login/verify')
  verifyAdminLogin(@Body() dto: VerifyAdminLoginDto) {
    return this.authService.verifyAdminLogin(dto.challenge, dto.code);
  }

  @Post('change-password')
  @AdminOnly()
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }

  @Post('logout')
  @AdminOnly()
  async logout(@Request() req: any) {
    if (req.user.jti && req.user.exp) {
      await this.tokenRevocation.revoke(req.user.jti, req.user.exp);
    }
    return { loggedOut: true };
  }

  // ── Member auth (OTP / magic link) ────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('check-email')
  checkEmail(@Body() dto: CheckEmailDto) {
    return this.memberAuthService.checkEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.memberAuthService.sendOtp(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.memberAuthService.verifyOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('magic-link/verify')
  verifyMagicLink(@Body() dto: VerifyMagicLinkDto) {
    return this.memberAuthService.verifyMagicLink(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.memberAuthService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('guest')
  guest(@Body() dto: GuestAccessDto) {
    return this.memberAuthService.createGuest(dto);
  }

  @Get('me')
  getMe(@Request() req: any) {
    return this.memberAuthService.getMe(req.user.sub);
  }

}
