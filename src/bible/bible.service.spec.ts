import { BibleService } from './bible.service';

describe('BibleService local Louis Segond library', () => {
  let service: BibleService;

  beforeAll(() => {
    service = new BibleService();
  });

  it('loads the complete offline Louis Segond 1910 dataset', () => {
    expect(service.getMetadata()).toEqual(expect.objectContaining({
      version: 'lsg',
      language: 'fr',
      license: 'public-domain',
      offline: true,
      books: 66,
      verses: 31102,
    }));
  });

  it('resolves a French verse reference with clean typography', () => {
    const [verse] = service.search('Jean 3:16');

    expect(verse.reference).toBe('Jean 3:16');
    expect(verse.text).toContain("qu'il");
    expect(verse.text).not.toContain("qu''il");
  });

  it('resolves a verse range', () => {
    const verses = service.search('1 Corinthiens 13:4-7');

    expect(verses).toHaveLength(4);
    expect(verses[0].reference).toBe('1 Corinthiens 13:4');
    expect(verses[3].reference).toBe('1 Corinthiens 13:7');
  });
});
