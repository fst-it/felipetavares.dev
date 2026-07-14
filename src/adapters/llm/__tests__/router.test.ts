import { describe, it, expect } from 'vitest';
import { LlmRouter } from '../router';
import type { LlmProvider } from '../../../core/ports/llm-provider';
import type { ChatMessage } from '../../../core/entities/chat-message';

function fakeProvider(name: string, chunks: string[]): LlmProvider {
  return {
    name,
    async *complete() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

function failingProvider(name: string, failAfter: string[] = []): LlmProvider {
  return {
    name,
    async *complete() {
      for (const chunk of failAfter) yield chunk;
      throw new Error(`${name} failed`);
    },
  };
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of iterable) out.push(chunk);
  return out;
}

const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

describe('LlmRouter', () => {
  it('streams from the primary provider when it succeeds', async () => {
    const router = new LlmRouter(fakeProvider('primary', ['hello', ' world']));
    const chunks = await collect(router.complete(messages));
    expect(chunks).toEqual(['hello', ' world']);
  });

  it('falls through to the next provider when the primary fails before yielding anything', async () => {
    const router = new LlmRouter(failingProvider('primary'), [fakeProvider('fallback', ['ok'])]);
    const chunks = await collect(router.complete(messages));
    expect(chunks).toEqual(['ok']);
  });

  it('falls through multiple providers in order until one succeeds', async () => {
    const router = new LlmRouter(failingProvider('primary'), [
      failingProvider('fallback-1'),
      fakeProvider('fallback-2', ['last resort']),
    ]);
    const chunks = await collect(router.complete(messages));
    expect(chunks).toEqual(['last resort']);
  });

  it('throws once all providers in the chain have failed', async () => {
    const router = new LlmRouter(failingProvider('primary'), [failingProvider('fallback')]);
    await expect(collect(router.complete(messages))).rejects.toThrow('fallback failed');
  });

  it('does not retry a different provider once the failing one already yielded partial output', async () => {
    const router = new LlmRouter(failingProvider('primary', ['partial ']), [
      fakeProvider('fallback', ['should not be used']),
    ]);
    await expect(collect(router.complete(messages))).rejects.toThrow('primary failed');
  });
});
