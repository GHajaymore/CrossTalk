import Fastify from 'fastify';
import { CreateConversation, MockSettings, type AppConfig, type StreamEvent } from '@crosstalk/shared';
import { ConversationController, ControllerError, type ControllerEvent } from './controller/controller';
import { openDb, Repo } from './db/repo';
import { MockProvider, type MockTiming } from './providers/mock';
import type { ServerConfig } from './config';

export function buildApp(cfg: ServerConfig, opts: { timing?: MockTiming; logger?: boolean } = {}) {
  const repo = new Repo(openDb(cfg.dbPath));
  let mock: MockSettings = { failOnce: false, fast: false };
  const provider = new MockProvider(() => mock, opts.timing);
  const controller = new ConversationController(repo, provider, {
    maxTurns: cfg.maxTurns, dailyLimit: cfg.dailyLimit, models: cfg.models,
  });
  const interrupted = controller.recoverInterrupted();

  const app = Fastify({ logger: opts.logger ?? false });
  if (interrupted) app.log.info(`${interrupted} run(s) were interrupted by a restart and are now paused.`);

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

  app.get('/api/config', async (): Promise<AppConfig> => ({
    providerMode: cfg.providerMode,
    models: cfg.models,
    dailyLimit: cfg.dailyLimit,
    requestsToday: controller.requestsToday(),
    nextEpisode: repo.nextEpisode(),
    activeConversationId: controller.activeConversationId,
    mock,
  }));

  app.put('/api/mock', async req => {
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

  app.post<{ Params: { id: string } }>('/api/conversations/:id/start', async req => {
    controller.start(req.params.id);
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

  return { app, controller, repo, setMock: (m: MockSettings) => { mock = m; } };
}
