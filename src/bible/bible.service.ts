import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

const { bcv_parser } = require('bible-passage-reference-parser/cjs/fr_bcv_parser');

export interface BibleVerse {
  number: number;
  text: string;
}

interface BibleChapter {
  chapter: number;
  verses: BibleVerse[];
}

interface BibleBook {
  book: string;
  bookId: number;
  englishName: string;
  testament: 'OT' | 'NT';
  chapters: BibleChapter[];
}

interface BibleData {
  version: string;
  name: string;
  language: string;
  license: string;
  books: BibleBook[];
}

export interface IndexedVerse {
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
  normalizedText: string;
}

const FRENCH_BOOK_NAMES: Record<string, string> = {
  Gen: 'Genèse', Exod: 'Exode', Lev: 'Lévitique', Num: 'Nombres',
  Deut: 'Deutéronome', Josh: 'Josué', Judg: 'Juges', Ruth: 'Ruth',
  '1Sam': '1 Samuel', '2Sam': '2 Samuel', '1Kgs': '1 Rois', '2Kgs': '2 Rois',
  '1Chr': '1 Chroniques', '2Chr': '2 Chroniques', Ezra: 'Esdras', Neh: 'Néhémie',
  Esth: 'Esther', Job: 'Job', Ps: 'Psaumes', Prov: 'Proverbes',
  Eccl: 'Ecclésiaste', Song: 'Cantique des Cantiques', Isa: 'Ésaïe', Jer: 'Jérémie',
  Lam: 'Lamentations', Ezek: 'Ézéchiel', Dan: 'Daniel', Hos: 'Osée',
  Joel: 'Joël', Amos: 'Amos', Obad: 'Abdias', Jonah: 'Jonas',
  Mic: 'Michée', Nah: 'Nahum', Hab: 'Habacuc', Zeph: 'Sophonie',
  Hag: 'Aggée', Zech: 'Zacharie', Mal: 'Malachie', Matt: 'Matthieu',
  Mark: 'Marc', Luke: 'Luc', John: 'Jean', Acts: 'Actes',
  Rom: 'Romains', '1Cor': '1 Corinthiens', '2Cor': '2 Corinthiens', Gal: 'Galates',
  Eph: 'Éphésiens', Phil: 'Philippiens', Col: 'Colossiens',
  '1Thess': '1 Thessaloniciens', '2Thess': '2 Thessaloniciens',
  '1Tim': '1 Timothée', '2Tim': '2 Timothée', Titus: 'Tite', Phlm: 'Philémon',
  Heb: 'Hébreux', Jas: 'Jacques', '1Pet': '1 Pierre', '2Pet': '2 Pierre',
  '1John': '1 Jean', '2John': '2 Jean', '3John': '3 Jean', Jude: 'Jude',
  Rev: 'Apocalypse',
};

const CLASSIC_REFERENCES = [
  'Jean 3:16', 'Jean 14:6', 'Philippiens 4:13', 'Romains 8:28',
  'Psaumes 23:1', 'Matthieu 6:33', 'Proverbes 3:5', 'Ésaïe 40:31',
  'Hébreux 11:1', '2 Timothée 3:16', 'Galates 5:22', 'Matthieu 28:19',
  'Actes 1:8', 'Éphésiens 2:8', 'Apocalypse 3:20',
];

@Injectable()
export class BibleService {
  private readonly bible: BibleData;
  private readonly books = new Map<string, BibleBook>();
  private readonly verses: IndexedVerse[] = [];
  private readonly parser = new bcv_parser();

  constructor() {
    const dataPath = join(__dirname, 'data', 'lsg.json');
    this.bible = JSON.parse(readFileSync(dataPath, 'utf8')) as BibleData;

    for (const book of this.bible.books) {
      this.books.set(book.book, book);
      for (const chapter of book.chapters) {
        for (const verse of chapter.verses) {
          const text = verse.text.replace(/''/g, '\'');
          this.verses.push({
            reference: this.reference(book.book, chapter.chapter, verse.number),
            text,
            book: book.book,
            chapter: chapter.chapter,
            verse: verse.number,
            normalizedText: this.normalize(text),
          });
        }
      }
    }
  }

  getMetadata() {
    return {
      version: this.bible.version,
      name: this.bible.name,
      language: this.bible.language,
      license: this.bible.license,
      offline: true,
      books: this.bible.books.length,
      verses: this.verses.length,
    };
  }

  getBooks() {
    return this.bible.books.map(book => ({
      id: book.book,
      name: FRENCH_BOOK_NAMES[book.book] ?? book.englishName,
      testament: book.testament === 'OT' ? 'AT' : 'NT',
      chapters: book.chapters.length,
    }));
  }

  getChapters(bookId: string) {
    const book = this.books.get(bookId);
    if (!book) return [];
    return book.chapters.map(chapter => ({
      chapter: chapter.chapter,
      verses: chapter.verses,
    }));
  }

  search(query: string): IndexedVerse[] {
    const trimmed = query.trim();
    const osis = this.parser.parse(trimmed).osis();
    if (osis) return this.resolveOsis(osis).slice(0, 50);

    const terms = this.normalize(trimmed).split(/\s+/).filter(term => term.length >= 2);
    if (!terms.length) return [];

    return this.verses
      .filter(verse => terms.every(term => verse.normalizedText.includes(term)))
      .slice(0, 20)
      .map(({ normalizedText, ...verse }) => verse as IndexedVerse);
  }

  getClassicVerses() {
    return CLASSIC_REFERENCES.flatMap(reference => this.search(reference).slice(0, 1));
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
          question: 'Quelle est la référence de ce verset ?',
          excerpt: verse.text,
          options,
          answerIndex: options.indexOf(verse.reference),
        };
      });
  }

  private resolveOsis(osis: string): IndexedVerse[] {
    const [startRaw, endRaw] = osis.split('-');
    const start = this.parseOsisPoint(startRaw);
    if (!start) return [];
    const end = this.parseOsisPoint(endRaw ?? startRaw) ?? start;

    return this.verses
      .filter(verse => {
        if (verse.book !== start.book || verse.book !== end.book) return false;
        const value = verse.chapter * 1000 + verse.verse;
        return value >= start.chapter * 1000 + start.verse
          && value <= end.chapter * 1000 + end.verse;
      })
      .slice(0, 50)
      .map(({ normalizedText, ...verse }) => verse as IndexedVerse);
  }

  private parseOsisPoint(value: string) {
    const match = value?.match(/^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    const book = this.books.get(match[1]);
    const chapter = Number(match[2]);
    const verse = Number(match[3] ?? 1);
    if (!book?.chapters.find(item => item.chapter === chapter)) return null;
    return { book: match[1], chapter, verse };
  }

  private reference(book: string, chapter: number, verse: number) {
    return `${FRENCH_BOOK_NAMES[book] ?? book} ${chapter}:${verse}`;
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
