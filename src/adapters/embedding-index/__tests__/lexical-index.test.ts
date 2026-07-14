import { describe, it, expect } from 'vitest';
import { LexicalIndex } from '../lexical-index';
import type { ChatChunk } from '../../../core/entities/chat-chunk';

const chunks: ChatChunk[] = [
  {
    id: '/projects/selfwright#0',
    url: '/projects/selfwright',
    title: 'Selfwright',
    type: 'project',
    text: 'Selfwright is an open-core, local-first personal operating system for career, expertise, influence, and knowledge. Built API-first, hexagonal, DDD.',
  },
  {
    id: '/projects/selfwright#1',
    url: '/projects/selfwright',
    title: 'Selfwright',
    type: 'project',
    heading: 'Architecture',
    text: 'Selfwright is built API-first, Domain-Driven Design, Modular Monolith, Hexagonal ports and adapters, TypeScript-first.',
  },
  {
    id: '/experience#0',
    url: '/experience',
    title: 'Sr. Principal Architect Leader at Cargill',
    type: 'role',
    text: 'Architected the future-state of Cargill data platform, leading enterprise architecture into AI and data strategy across a global trading business.',
  },
  {
    id: '/speaking#0',
    url: '/speaking',
    title: 'Some talk',
    type: 'talk',
    text: 'A talk about platform engineering and developer experience at a conference.',
  },
];

describe('LexicalIndex', () => {
  it('ranks Selfwright chunks first for a query about Selfwright', async () => {
    const index = new LexicalIndex(chunks);
    const results = await index.retrieve('Selfwright', 3);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toBe('/projects/selfwright');
    expect(results.every((r) => r.score > 0)).toBe(true);
  });

  it('ranks the Cargill role chunk first for a query naming Cargill', async () => {
    const index = new LexicalIndex(chunks);
    const results = await index.retrieve('Cargill data platform', 3);

    expect(results[0].url).toBe('/experience');
  });

  it('returns an empty array for a query with no matching terms', async () => {
    const index = new LexicalIndex(chunks);
    const results = await index.retrieve('zzznonexistentqueryterm', 3);
    expect(results).toEqual([]);
  });

  it('respects topK', async () => {
    const index = new LexicalIndex(chunks);
    const results = await index.retrieve('architecture', 1);
    expect(results.length).toBe(1);
  });
});
