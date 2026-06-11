import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { SignOptions } from 'jsonwebtoken';
import { CommunitySettings } from '../database/entities/community-settings.entity';
import { Member } from '../database/entities/member.entity';
import { OtpCode } from '../database/entities/otp-code.entity';
import { User } from '../database/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MemberAuthService } from './member-auth.service';
import { RolesGuard } from './roles.guard';
import { SmsService } from './sms.service';
import { AdminSessionService } from './admin-session.service';
import { TokenRevocationService } from './token-revocation.service';
import { MeetingScopeGuard } from './meeting-scope.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Member, OtpCode, CommunitySettings]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as SignOptions['expiresIn'],
        },
      }),
      inject: [ConfigService],
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MemberAuthService,
    SmsService,
    AdminSessionService,
    TokenRevocationService,
    MeetingScopeGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MeetingScopeGuard,
    },
  ],
  exports: [JwtModule, MemberAuthService, AdminSessionService, TokenRevocationService],
})
export class AuthModule {}
