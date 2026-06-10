import { Injectable } from '@nestjs/common';

// Données de base des livres bibliques (AT + NT)
const BOOKS = [
  // Ancien Testament
  { id: 'GEN', name: 'Genèse', testament: 'AT', chapters: 50 },
  { id: 'EXO', name: 'Exode', testament: 'AT', chapters: 40 },
  { id: 'LEV', name: 'Lévitique', testament: 'AT', chapters: 27 },
  { id: 'NUM', name: 'Nombres', testament: 'AT', chapters: 36 },
  { id: 'DEU', name: 'Deutéronome', testament: 'AT', chapters: 34 },
  { id: 'JOS', name: 'Josué', testament: 'AT', chapters: 24 },
  { id: 'JDG', name: 'Juges', testament: 'AT', chapters: 21 },
  { id: 'RUT', name: 'Ruth', testament: 'AT', chapters: 4 },
  { id: '1SA', name: '1 Samuel', testament: 'AT', chapters: 31 },
  { id: '2SA', name: '2 Samuel', testament: 'AT', chapters: 24 },
  { id: '1KI', name: '1 Rois', testament: 'AT', chapters: 22 },
  { id: '2KI', name: '2 Rois', testament: 'AT', chapters: 25 },
  { id: 'PSA', name: 'Psaumes', testament: 'AT', chapters: 150 },
  { id: 'PRO', name: 'Proverbes', testament: 'AT', chapters: 31 },
  { id: 'ECC', name: 'Ecclésiaste', testament: 'AT', chapters: 12 },
  { id: 'ISA', name: 'Ésaïe', testament: 'AT', chapters: 66 },
  { id: 'JER', name: 'Jérémie', testament: 'AT', chapters: 52 },
  { id: 'EZK', name: 'Ézéchiel', testament: 'AT', chapters: 48 },
  { id: 'DAN', name: 'Daniel', testament: 'AT', chapters: 12 },
  // Nouveau Testament
  { id: 'MAT', name: 'Matthieu', testament: 'NT', chapters: 28 },
  { id: 'MRK', name: 'Marc', testament: 'NT', chapters: 16 },
  { id: 'LUK', name: 'Luc', testament: 'NT', chapters: 24 },
  { id: 'JHN', name: 'Jean', testament: 'NT', chapters: 21 },
  { id: 'ACT', name: 'Actes', testament: 'NT', chapters: 28 },
  { id: 'ROM', name: 'Romains', testament: 'NT', chapters: 16 },
  { id: '1CO', name: '1 Corinthiens', testament: 'NT', chapters: 16 },
  { id: '2CO', name: '2 Corinthiens', testament: 'NT', chapters: 13 },
  { id: 'GAL', name: 'Galates', testament: 'NT', chapters: 6 },
  { id: 'EPH', name: 'Éphésiens', testament: 'NT', chapters: 6 },
  { id: 'PHP', name: 'Philippiens', testament: 'NT', chapters: 4 },
  { id: 'COL', name: 'Colossiens', testament: 'NT', chapters: 4 },
  { id: '1TH', name: '1 Thessaloniciens', testament: 'NT', chapters: 5 },
  { id: '1TI', name: '1 Timothée', testament: 'NT', chapters: 6 },
  { id: '2TI', name: '2 Timothée', testament: 'NT', chapters: 4 },
  { id: 'HEB', name: 'Hébreux', testament: 'NT', chapters: 13 },
  { id: 'JAS', name: 'Jacques', testament: 'NT', chapters: 5 },
  { id: '1PE', name: '1 Pierre', testament: 'NT', chapters: 5 },
  { id: '2PE', name: '2 Pierre', testament: 'NT', chapters: 3 },
  { id: '1JN', name: '1 Jean', testament: 'NT', chapters: 5 },
  { id: 'REV', name: 'Apocalypse', testament: 'NT', chapters: 22 },
];

// Versets classiques intégrés localement pour fonctionnement sans API
const CLASSIC_VERSES: Record<string, string> = {
  'jean 3:16': 'Car Dieu a tant aimé le monde qu\'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu\'il ait la vie éternelle.',
  'jean 14:6': 'Jésus lui dit : Je suis le chemin, la vérité, et la vie. Nul ne vient au Père que par moi.',
  'philippiens 4:13': 'Je puis tout par celui qui me fortifie.',
  'romains 8:28': 'Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein.',
  'psaumes 23:1': 'L\'Éternel est mon berger : je ne manquerai de rien.',
  'matthieu 6:33': 'Cherchez premièrement le royaume et la justice de Dieu ; et toutes ces choses vous seront données par-dessus.',
  'proverbes 3:5': 'Confie-toi en l\'Éternel de tout ton cœur, et ne t\'appuie pas sur ta sagesse.',
  'ésaïe 40:31': 'Mais ceux qui se confient en l\'Éternel renouvellent leur force. Ils prennent le vol comme les aigles ; ils courent, et ne se lassent point ; ils marchent, et ne se fatiguent point.',
  'hébreux 11:1': 'Or la foi est une ferme assurance des choses qu\'on espère, une démonstration de celles qu\'on ne voit pas.',
  '2 timothée 3:16': 'Toute Écriture est inspirée de Dieu, et utile pour enseigner, pour convaincre, pour corriger, pour instruire dans la justice.',
  'galates 5:22': 'Mais le fruit de l\'Esprit, c\'est l\'amour, la joie, la paix, la patience, la bonté, la bénignité, la fidélité, la douceur, la tempérance.',
  'matthieu 28:19': 'Allez, faites de toutes les nations des disciples, les baptisant au nom du Père, du Fils et du Saint Esprit.',
  'actes 1:8': 'Mais vous recevrez une puissance, le Saint Esprit survenant sur vous, et vous serez mes témoins à Jérusalem, dans toute la Judée, dans la Samarie, et jusqu\'aux extrémités de la terre.',
  'éphésiens 2:8': 'Car c\'est par la grâce que vous êtes sauvés, par le moyen de la foi. Et cela ne vient pas de vous, c\'est le don de Dieu.',
  'apocalypse 3:20': 'Voici, je me tiens à la porte, et je frappe. Si quelqu\'un entend ma voix et ouvre la porte, j\'entrerai chez lui, je souperai avec lui, et lui avec moi.',
};

@Injectable()
export class BibleService {
  getBooks() {
    return BOOKS;
  }

  getBooksByTestament(testament: 'AT' | 'NT') {
    return BOOKS.filter(b => b.testament === testament);
  }

  search(query: string): { reference: string; text: string; book?: string }[] {
    const q = query.toLowerCase().trim();
    const results: { reference: string; text: string; book?: string }[] = [];

    // Recherche dans les versets classiques intégrés
    for (const [ref, text] of Object.entries(CLASSIC_VERSES)) {
      if (ref.includes(q) || text.toLowerCase().includes(q)) {
        results.push({
          reference: this.formatReference(ref),
          text,
        });
      }
    }

    // Recherche exacte par référence (ex: "Jean 3:16")
    const exact = CLASSIC_VERSES[q];
    if (exact && !results.find(r => r.text === exact)) {
      results.unshift({ reference: this.formatReference(q), text: exact });
    }

    return results.slice(0, 10);
  }

  getVerse(reference: string): { reference: string; text: string } | null {
    const key = reference.toLowerCase().trim();
    const text = CLASSIC_VERSES[key];
    if (!text) return null;
    return { reference: this.formatReference(key), text };
  }

  getClassicVerses(): { reference: string; text: string }[] {
    return Object.entries(CLASSIC_VERSES).map(([ref, text]) => ({
      reference: this.formatReference(ref),
      text,
    }));
  }

  getQuiz(count = 5) {
    const verses = this.getClassicVerses();
    return [...verses]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((verse, index) => {
        const alternatives = verses
          .filter(item => item.reference !== verse.reference)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(item => item.reference);
        const options = [...alternatives, verse.reference].sort(() => Math.random() - 0.5);
        return {
          id: `${index}-${verse.reference}`,
          question: `Quelle est la référence de ce verset ?`,
          excerpt: verse.text,
          options,
          answerIndex: options.indexOf(verse.reference),
        };
      });
  }

  private formatReference(ref: string): string {
    return ref.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
