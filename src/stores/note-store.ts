import { randomUUID } from 'node:crypto';

export type Note = {
  content: string;
  createdAt: string;
  id: string;
  title: string;
};

export class InMemoryNoteStore {
  readonly #notes = new Map<string, Note>();

  public constructor(seed: Note[] = []) {
    for (const note of seed) {
      this.#notes.set(note.id, structuredClone(note));
    }
  }

  public create(title: string, content: string): Note {
    const note: Note = {
      content,
      createdAt: new Date().toISOString(),
      id: randomUUID(),
      title
    };
    this.#notes.set(note.id, note);
    return structuredClone(note);
  }

  public list(): Note[] {
    return [...this.#notes.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(note => structuredClone(note));
  }
}
