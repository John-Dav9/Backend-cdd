import { Injectable } from '@nestjs/common';

@Injectable()
export class MessagesService {
  findAll() {
    return [
      {
        id: 1,
        title: 'Espérer en Dieu en toute saison',
        speaker: 'Pasteur Fernand',
        date: '2026-01-07',
        videoId: 'dQw4w9WgXcQ',
      },
    ];
  }
}
