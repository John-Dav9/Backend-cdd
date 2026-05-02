import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actualite } from './entities/actualite.entity';
import { Annonce } from './entities/annonce.entity';
import { Bibliotheque } from './entities/bibliotheque.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { Inscription } from './entities/inscription.entity';
import { Marathon } from './entities/marathon.entity';
import { MarathonInscription } from './entities/marathon-inscription.entity';
import { NewsletterSubscriber } from './entities/newsletter-subscriber.entity';
import { Priere } from './entities/priere.entity';
import { Setting } from './entities/setting.entity';
import { Temoignage } from './entities/temoignage.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'cmciea_db'),
        username: config.get('DB_USER', 'cmciea_user'),
        password: config.get('DB_PASSWORD'),
        entities: [
          User, Marathon, MarathonInscription, Inscription,
          Actualite, Annonce, Temoignage, Priere,
          NewsletterSubscriber, Bibliotheque, EmailTemplate, Setting,
        ],
        synchronize: true,
        logging: config.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
