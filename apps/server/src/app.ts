import Fastify, { type FastifyServerOptions } from 'fastify';
import { CreateConversation, MockSettings, type AppConfig, type StreamEvent } from '@crosstalk/shared';
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

  const controller = new ConversationController(repo, provider, {
    maxTurns: cfg.maxTurns, dailyLimit: cfg.dailyLimit, models: cfg.models, sleep: opts.sleep,
    // Before every real run: settings must be complete, and every model must pass the free-model guard.
    preflight: real ? async () => {
      if (cfg.problems.length) return `Real mode isn't set up yet: ${cfg.problems.join(' ')}`;
      return FreeModelGuard.blockMessage(await checkModels());
    } : undefined,
  });
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

  const view = (id: string) => {
    const v = repo.view(id);
    if (!v) throw new ControllerError('Conversation not found.', 404);
    return v;
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
    repo.listConversations().map(c => ({ ...c, run: repo.latestRun(c.id), turnCount: repo.lastSeq(c.id) })));

  app.post('/api/conversations', async (req, reply) => {
    const parsed = CreateConversation.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid conversation.', 400);
    return reply.status(201).send(controller.create(parsed.data));
  });

  app.get<{ Params: { id: string } }>('/api/conversations/:id', async req => view(req.params.id));
  app.get<{ Params: { id: string } }>('/api/conversations/:id/usage', async req => { view(req.params.id); return repo.listUsage(req.params.id); });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/start', async req => {
    await controller.start(req.params.id);
    return view(req.params.id);
  });
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
    const snapshot = () => { const v = repo.view(id); if (v) send({ type: 'snapshot', conversation: v, live: controller.liveTurn(id) }); };
    snapshot();
    const off = controller.subscribe(id, (e: ControllerEvent) => (e.type === 'changed' ? snapshot() : send(e)));
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.raw.on('close', () => { off(); clearInterval(ping); });
  });

  return { app, controller, repo, guard, setMock: (m: MockSettings) => { mock = m; } };
}
