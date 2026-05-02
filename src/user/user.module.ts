import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marathon } from '../database/entities/marathon.entity';
import { MarathonInscription } from '../database/entities/marathon-inscription.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarathonInscription, Marathon])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
