// A stand-in for openrouter.ai so tests never touch the network.
import type { ModelInfo } from '../src/guard/freeModelGuard';

export const sse = (chunks: string[], { split = false } = {}) => {
  const body = chunks.map(c => (c.startsWith(':') ? `${c}\n\n` : `data: ${c}\n\n`)).join('');
  const enc = new TextEncoder();
  const parts = split ? body.match(/[\s\S]{1,7}/g)! : [body];
  return new Response(new ReadableStream({
    start(ctrl) { parts.forEach(p => ctrl.enqueue(enc.encode(p))); ctrl.close(); },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
};

export const delta = (content: string) => JSON.stringify({ choices: [{ delta: { content } }] });
export const usageChunk = (i: number, o: number, cost?: number) => JSON.stringify({ choices: [], usage: { prompt_tokens: i, completion_tokens: o, ...(cost === undefined ? {} : { cost }) } });

export const FREE_A = 'example/free-a:free';
export const FREE_B = 'example/free-b:free';
export const PAID = 'example/paid-model';
export const FAKE_FREE_SUFFIX = 'example/sneaky:free';

export const MODEL_LIST: ModelInfo[] = [
  { id: FREE_A, pricing: { prompt: '0', completion: '0', request: '0' } },
  { id: FREE_B, pricing: { prompt: '0', completion: '0' } },
  { id: PAID, pricing: { prompt: '0.000001', completion: '0.000002' } },
  { id: FAKE_FREE_SUFFIX, pricing: { prompt: '0', completion: '0.0000005' } },
  { id: 'example/no-price' },
  { id: 'example/zero-but-not-free', pricing: { prompt: '0', completion: '0' } },
  { id: 'openrouter/free', pricing: { prompt: '0', completion: '0' } },
];

export type Call = { url: string; init: RequestInit; body: Record<string, unknown> | null };

/** A fetch that serves the model list and streams scripted chat replies, recording every call. */
export function fakeFetch(opts: { replies?: (call: Call, n: number) => Response | Promise<Response>; roles?: (call: Call) => Response; listFails?: boolean } = {}) {
  const calls: Call[] = [];
  let chats = 0;
  const f = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const call = { url, init, body };
    calls.push(call);
    if (url.endsWith('/models')) {
      if (opts.listFails) throw new TypeError('fetch failed');
      return Response.json({ data: MODEL_LIST });
    }
    // Non-streaming calls write host roles.
    if (body && body.stream !== true) {
      return opts.roles ? opts.roles(call) : Response.json({ choices: [{ message: { content: '{"A": "Owner of a small accounting firm", "B": "Researcher who studies working hours"}' } }] });
    }
    chats++;
    return opts.replies ? opts.replies(call, chats) : sse([': OPENROUTER PROCESSING', delta('A real '), delta('reply.'), usageChunk(120, 4, 0), '[DONE]']);
  }) as typeof fetch;
  return {
    f, calls,
    /** Turn requests (streamed). */
    chatCalls: () => calls.filter(c => c.url.endsWith('/chat/completions') && c.body?.stream === true),
    roleCalls: () => calls.filter(c => c.url.endsWith('/chat/completions') && c.body?.stream !== true),
  };
}
