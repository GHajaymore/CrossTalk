import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { randomUUID } from 'node:crypto';
import { CreateConversation, IrisFeedbackInput, MockSettings, type AppConfig, type ConversationView, type EpisodeAudio, type StreamEvent } from '@crosstalk/shared';
import { Iris, mockArtist, type ArtistBackend } from './artist/iris';
import { ConversationController, ControllerError, type ControllerEvent } from './controller/controller';
import { openDb, Repo } from './db/repo';
import { FreeModelGuard } from './guard/freeModelGuard';
import { MockProvider, type MockTiming } from './providers/mock';
import { OpenRouterProvider } from './providers/openrouter';
import type { Provider } from './providers/types';
import type { ServerConfig } from './config';

export type AppOptions = {
  timing?: MockTiming;
  logger?: FastifyServerOptions['logger'];
  /** Replaces the network in tests. */
  fetch?: typeof fetch;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
};

export function buildApp(cfg: ServerConfig, opts: AppOptions = {}) {
  const repo = new Repo(openDb(cfg.dbPath));
  const real = cfg.providerMode === 'openrouter';
  let mock: MockSettings = { failOnce: false, fast: false };
  const f = opts.fetch ?? fetch;

  const provider: Provider = real
    ? new OpenRouterProvider({ apiKey: cfg.apiKey, maxOutputTokens: cfg.maxOutputTokens, timeoutMs: cfg.requestTimeoutMs, fetch: f })
    : new MockProvider(() => mock, opts.timing);
  const guard = real ? new FreeModelGuard(f, cfg.allowPaidModels) : null;
  const guardedModels = [cfg.models.A, cfg.models.B, ...(cfg.artistModel ? [cfg.artistModel] : [])].filter(Boolean);
  const checkModels = async () => (guard ? guard.check(guardedModels) : []);

  // Iris, the Artist. Real mode uses ARTIST_MODEL (a free model, checked like the speakers'); mock mode draws from a script.
  const artistBackend: ArtistBackend | null = real
    ? (cfg.artistModel
      ? { modelId: cfg.artistModel, draw: ({ system, user }) => (provider as OpenRouterProvider).complete(cfg.artistModel!, system, user, 3000) }
      : null)
    : mockArtist;
  let controllerRef: ConversationController | null = null;
  const iris = new Iris(repo, artistBackend, {
    canRequest: () => !!controllerRef && controllerRef.requestsToday() < cfg.dailyLimit,
    countRequest: () => controllerRef?.countRequest(),
    preflight: real ? async () => {
      if (cfg.problems.length) return `Real mode isn't set up yet: ${cfg.problems.join(' ')}`;
      const v = (await checkModels()).find(x => x.modelId === cfg.artistModel);
      return v && !v.ok ? `Blocked by the free-model check: ${v.modelId}: ${v.reason}` : null;
    } : undefined,
    onChange: id => controllerRef?.notify(id),
  });

  const controller = new ConversationController(repo, provider, {
    maxTurns: cfg.maxTurns, dailyLimit: cfg.dailyLimit, models: cfg.models, sleep: opts.sleep,
    onCompleted: id => { void iris.listen(id); },
    // Before every real run: settings must be complete, and every model must pass the free-model guard.
    preflight: real ? async () => {
      if (cfg.problems.length) return `Real mode isn't set up yet: ${cfg.problems.join(' ')}`;
      return FreeModelGuard.blockMessage(await checkModels());
    } : undefined,
  });
  controllerRef = controller;
  const interrupted = controller.recoverInterrupted();

  // Never log request headers or bodies: the key travels only from this server to OpenRouter.
  const app = Fastify({ logger: opts.logger ?? false });
  if (interrupted) app.log.info(`${interrupted} run(s) were interrupted by a restart and are now paused.`);
  // Check models once at start-up so Settings can show the verdicts straight away.
  if (real && !cfg.problems.length) void checkModels();

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ControllerError) return reply.status(err.status).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send({ error: status === 500 ? 'Something went wrong on the server.' : (err as Error).message });
  });

  // Rendered recordings (tools/voice) live next to the database: data/audio/<id>.mp3 and <id>.json.
  const audioDir = cfg.dbPath === ':memory:' ? null : join(dirname(cfg.dbPath), 'audio');
  const safeId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
  const audioFor = (id: string): EpisodeAudio | null => {
    if (!audioDir || !safeId(id)) return null;
    const mp3 = join(audioDir, `${id}.mp3`), meta = join(audioDir, `${id}.json`);
    if (!existsSync(mp3) || !existsSync(meta)) return null;
    try {
      const m = JSON.parse(readFileSync(meta, 'utf8')) as Omit<EpisodeAudio, 'url'>;
      return { url: `/api/conversations/${id}/audio.mp3`, durationSec: m.durationSec, voices: m.voices, timings: m.timings };
    } catch { return null; }
  };
  const withAudio = (v: ConversationView): ConversationView => ({ ...v, audio: audioFor(v.id) });

  const view = (id: string) => {
    const v = repo.view(id);
    if (!v) throw new ControllerError('Conversation not found.', 404);
    return withAudio(v);
  };

  const config = (): AppConfig => ({
    providerMode: cfg.providerMode,
    models: cfg.models,
    artistModel: cfg.artistModel,
    dailyLimit: cfg.dailyLimit,
    requestsToday: controller.requestsToday(),
    nextEpisode: repo.nextEpisode(),
    activeConversationId: controller.activeConversationId,
    mock,
    apiKeySet: !!cfg.apiKey,
    allowPaidModels: cfg.allowPaidModels,
    maxOutputTokens: cfg.maxOutputTokens,
    problems: cfg.problems,
    guard: { checkedAt: guard?.checkedAt ?? null, verdicts: guard?.verdicts ?? [] },
    usageToday: repo.usageOn(controller.today()),
  });

  app.get('/api/config', async () => config());

  app.post('/api/guard/check', async () => {
    if (real && !cfg.problems.length) await checkModels();
    return config();
  });

  app.put('/api/mock', async req => {
    if (real) throw new ControllerError('Mock controls only work in mock mode.', 409);
    const parsed = MockSettings.safeParse(req.body);
    if (!parsed.success) throw new ControllerError('Invalid mock settings.', 400);
    mock = parsed.data;
    return mock;
  });

  app.get('/api/conversations', async () =>
    repo.listConversations().map(c => ({ ...c, run: repo.latestRun(c.id), turnCount: repo.lastSeq(c.id), artist: repo.getArtist(c.id) })));

  app.post('/api/conversations', async (req, reply) => {
    const parsed = CreateConversation.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid conversation.', 400);
    // Real mode: one free request writes host roles that fit this topic. Any problem falls back to
    // the keyword rule, and creating a conversation never fails because of it.
    let roles: [string, string] | undefined;
    const wantsRoles = parsed.data.speakers.A.autoRole || parsed.data.speakers.B.autoRole;
    if (real && wantsRoles && !cfg.problems.length && controller.requestsToday() < cfg.dailyLimit) {
      const verdicts = await checkModels();
      if (!FreeModelGuard.blockMessage(verdicts)) {
        controller.countRequest();
        roles = (await (provider as OpenRouterProvider).generateRoles(parsed.data.topic, parsed.data.audience, cfg.models.A)) ?? undefined;
      }
    }
    return reply.status(201).send(controller.create(parsed.data, roles));
  });

  app.get<{ Params: { id: string } }>('/api/conversations/:id', async req => view(req.params.id));
  app.get<{ Params: { id: string } }>('/api/conversations/:id/audio.mp3', (req, reply) => {
    const id = req.params.id;
    const file = audioDir && safeId(id) ? join(audioDir, `${id}.mp3`) : null;
    if (!file || !existsSync(file)) return reply.status(404).send({ error: 'No recording for this episode.' });
    // Byte ranges let the player seek: skip a turn, jump 15 seconds, scrub.
    const size = statSync(file).size;
    reply.header('Content-Type', 'audio/mpeg').header('Accept-Ranges', 'bytes');
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (!m || (!m[1] && !m[2])) return reply.header('Content-Length', size).send(createReadStream(file));
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) return reply.status(416).header('Content-Range', `bytes */${size}`).send();
    return reply.status(206).header('Content-Range', `bytes ${start}-${end}/${size}`).header('Content-Length', end - start + 1)
      .send(createReadStream(file, { start, end }));
  });
  app.get<{ Params: { id: string } }>('/api/conversations/:id/usage', async req => { view(req.params.id); return repo.listUsage(req.params.id); });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/start', async req => {
    await controller.start(req.params.id);
    return view(req.params.id);
  });
  // Ask Iris again: a fresh listen and drawing for a completed episode (one more request).
  app.post<{ Params: { id: string } }>('/api/conversations/:id/artist', async req => {
    const v = view(req.params.id);
    if (v.run?.state !== 'completed') throw new ControllerError('Iris listens once an episode is complete.', 409);
    void iris.listen(req.params.id, true);
    return view(req.params.id);
  });

  // What the listener tells Iris about her work. She reads the latest notes before every drawing.
  app.post('/api/iris/feedback', async (req, reply) => {
    const parsed = IrisFeedbackInput.safeParse(req.body);
    if (!parsed.success) throw new ControllerError('Invalid feedback.', 400);
    const f = parsed.data;
    const art = f.conversationId ? repo.getArtist(f.conversationId) : null;
    repo.addFeedback({ ...f, id: randomUUID(), artTitle: art?.artTitle ?? null, createdAt: new Date().toISOString() });
    return reply.status(201).send(repo.listFeedback(20));
  });
  app.get('/api/iris/feedback', async () => repo.listFeedback(20));
  app.delete<{ Params: { id: string } }>('/api/iris/feedback/:id', async req => { repo.deleteFeedback(req.params.id); return repo.listFeedback(20); });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/pause', async req => {
    controller.pause(req.params.id);
    return view(req.params.id);
  });
  app.post<{ Params: { id: string } }>('/api/conversations/:id/stop', async req => {
    controller.stop(req.params.id);
    return view(req.params.id);
  });

  // Server-Sent Events: a snapshot on connect and after every change, plus live tokens in between.
  app.get<{ Params: { id: string } }>('/api/conversations/:id/events', (req, reply) => {
    const id = req.params.id;
    view(id);
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const send = (e: StreamEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    const snapshot = () => { const v = repo.view(id); if (v) send({ type: 'snapshot', conversation: withAudio(v), live: controller.liveTurn(id) }); };
    snapshot();
    const off = controller.subscribe(id, (e: ControllerEvent) => (e.type === 'changed' ? snapshot() : send(e)));
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.raw.on('close', () => { off(); clearInterval(ping); });
  });

  return { app, controller, repo, guard, iris, setMock: (m: MockSettings) => { mock = m; } };
}
