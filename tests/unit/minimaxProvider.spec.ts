import { test, expect } from '@playwright/test';
import { MiniMaxProvider } from '../../src/providers/minimax';

type FetchCall = { url: string; init: RequestInit };

function mockFetch(
  responseBody: unknown,
  status = 200,
  calls: FetchCall[] = [],
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

const SUCCESS_RESPONSE = {
  id: 'msg_123',
  type: 'message',
  role: 'assistant',
  model: 'MiniMax-M2.7',
  content: [{ type: 'text', text: 'hello from minimax' }],
  usage: { input_tokens: 10, output_tokens: 5 },
};

test('complete returns text from Anthropic-messages response', async () => {
  const provider = new MiniMaxProvider('key', 'https://api.test', 'MiniMax-M2.7', mockFetch(SUCCESS_RESPONSE));
  const result = await provider.complete('prompt text');
  expect(result.text).toBe('hello from minimax');
  expect(result.model).toBe('MiniMax-M2.7');
  expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
});

test('complete sends correct endpoint, headers and body', async () => {
  const calls: FetchCall[] = [];
  const provider = new MiniMaxProvider('my-key', 'https://api.minimaxi.com/anthropic', 'MiniMax-M2.7', mockFetch(SUCCESS_RESPONSE, 200, calls));

  await provider.complete('hello');

  expect(calls).toHaveLength(1);
  const { url, init } = calls[0];
  expect(url).toBe('https://api.minimaxi.com/anthropic/v1/messages');
  expect(init.method).toBe('POST');
  expect(init.headers).toMatchObject({
    'content-type': 'application/json',
    'x-api-key': 'my-key',
    'anthropic-version': '2023-06-01',
  });
  const body = JSON.parse(init.body as string);
  expect(body).toEqual({
    model: 'MiniMax-M2.7',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'hello' }],
  });
});

test('complete supports system prompt and options', async () => {
  const calls: FetchCall[] = [];
  const provider = new MiniMaxProvider('key', 'https://api.test', 'default-model', mockFetch(SUCCESS_RESPONSE, 200, calls));

  await provider.complete('question', {
    system: 'you are a test engineer',
    maxTokens: 256,
    model: 'Other-Model',
    temperature: 0.5,
  });

  const body = JSON.parse(calls[0].init.body as string);
  expect(body.system).toBe('you are a test engineer');
  expect(body.max_tokens).toBe(256);
  expect(body.model).toBe('Other-Model');
  expect(body.temperature).toBe(0.5);
});

test('complete throws when API key is missing', async () => {
  const provider = new MiniMaxProvider('');
  await expect(provider.complete('x')).rejects.toThrow(/requires an API key/);
});

test('complete throws on API error response', async () => {
  const provider = new MiniMaxProvider('key', 'https://api.test', 'MiniMax-M2.7', mockFetch(
    { error: { type: 'auth_error', message: 'invalid api key' } },
    401,
  ));
  await expect(provider.complete('x')).rejects.toThrow(/invalid api key/);
});

test('complete throws on network failure', async () => {
  const failingFetch: typeof fetch = (async () => {
    throw new Error('net::ERR_CONNECTION_REFUSED');
  }) as unknown as typeof fetch;
  const provider = new MiniMaxProvider('key', 'https://api.test', 'MiniMax-M2.7', failingFetch);
  await expect(provider.complete('x')).rejects.toThrow(/MiniMax request failed/);
});

test('complete handles response without text content', async () => {
  const provider = new MiniMaxProvider('key', 'https://api.test', 'MiniMax-M2.7', mockFetch({
    ...SUCCESS_RESPONSE,
    content: [],
  }));
  const result = await provider.complete('x');
  expect(result.text).toBe('');
});
