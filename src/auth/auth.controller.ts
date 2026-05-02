import { Body, Controller, Post, Request } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
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
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('change-password')
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }
}
