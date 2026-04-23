import { BibleBook } from './bible-books.data';

export interface ReadingDay {
  day: number;
  date: string; // "DD/MM"
  reading: string;
}

interface ChapterRef {
  bookNom: string;
  chapter: number;
}

/**
 * Distributes `books` chapters evenly over `nbJours` days starting from `dateDebut`.
 * Uses proportional rounding so every chapter is assigned exactly once.
 */
export function generateReadingPlan(
  books: BibleBook[],
  nbJours: number,
  dateDebut: Date,
): ReadingDay[] {
  const allChapters: ChapterRef[] = [];
  for (const book of books) {
    for (let ch = 1; ch <= book.chapitres; ch++) {
      allChapters.push({ bookNom: book.nom, chapter: ch });
    }
  }

  const total = allChapters.length;
  if (total === 0 || nbJours <= 0) return [];

  const plan: ReadingDay[] = [];

  for (let day = 1; day <= nbJours; day++) {
    const startIdx = Math.round(((day - 1) / nbJours) * total);
    const endIdx   = Math.round((day        / nbJours) * total);

    const dayChapters = allChapters.slice(startIdx, endIdx);
    if (dayChapters.length === 0) continue;

    const date = new Date(dateDebut);
    date.setDate(date.getDate() + (day - 1));
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');

    plan.push({ day, date: `${dd}/${mm}`, reading: formatChapters(dayChapters) });
  }

  return plan;
}

function formatChapters(chapters: ChapterRef[]): string {
  type Group = { bookNom: string; from: number; to: number };
  const groups: Group[] = [];

  for (const ch of chapters) {
    const last = groups[groups.length - 1];
    if (last && last.bookNom === ch.bookNom && last.to === ch.chapter - 1) {
      last.to = ch.chapter;
    } else {
      groups.push({ bookNom: ch.bookNom, from: ch.chapter, to: ch.chapter });
    }
  }

  return groups
    .map(g => (g.from === g.to ? `${g.bookNom} ${g.from}` : `${g.bookNom} ${g.from}\u2013${g.to}`))
    .join(' ; ');
}
