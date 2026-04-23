import { Injectable } from '@nestjs/common';

@Injectable()
export class PagesService {
  getHome() {
    return {
      heroTagline: 'Bienvenue à la CMCIEA-FRANCE',
      heroTitle: 'Une église pour tous, une église enracinée dans la Parole',
      heroText:
        'Découvre une communauté de chercheurs de Dieu qui aiment Jésus, aiment les gens et désirent voir l’Évangile transformer des vies.',
    };
  }

  getAbout() {
    return {
      histoire: {
        title: 'Notre histoire',
        content:
          'La CMCIEA France est une communauté chrétienne engagée dans la prière, l’enseignement biblique et la mission.',
      },
      vision: {
        title: 'Notre vision',
        content:
          'Former des disciples du Seigneur Jésus-Christ enracinés dans la Parole de Dieu et engagés dans leur génération.',
      },
    };
  }

  getChurchLife() {
    return {
      pageTitle: "Vie de l'église",
      actusIntro:
        'Retrouvez nos temps forts, rendez-vous hebdomadaires et informations utiles pour marcher ensemble dans la foi.',
      adresse: 'France (en ligne et en présentiel selon les activités)',
      horaires:
        'Consultez la section Horaires/Cultes pour les rencontres mises à jour.',
      devenirMembre:
        'Vous souhaitez vous engager davantage ? Contactez-nous pour être accompagné.',
      contactIntro: 'Nous contacter',
    };
  }
}
