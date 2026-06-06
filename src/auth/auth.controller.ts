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

  @Public()
  @Post('quick-login')
  quickLogin(@Body() body: { email: string }) {
    return this.memberAuthService.quickLogin(body.email);
  }
}
