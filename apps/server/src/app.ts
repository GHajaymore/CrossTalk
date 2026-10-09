import { createReadStream, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { randomUUID } from 'node:crypto';
import { BranchInput, CreateConversation, CueInput, DEFAULT_RULES, cleanStyles, episodeStyles, ReactionInput, REACTIONS_MAX, isSensitive, NoteInput, PAINT_STYLES, RenameInput, Rules, SCOUT_CATS, ScoutPrefs, type Overview, IrisFeedbackInput, MockSettings, type AppConfig, type ConversationView, type EpisodeAudio, type StreamEvent } from '@crosstalk/shared';
import { Iris, mockArtist, type ArtistBackend } from './artist/iris';
import { ConversationController, ControllerError, type ControllerEvent } from './controller/controller';
import { openDb, Repo } from './db/repo';
import { FreeModelGuard } from './guard/freeModelGuard';
import { MockProvider, type MockTiming } from './providers/mock';
import { OpenRouterProvider, SERVICES } from './providers/openrouter';
import { GroqModelGuard } from './guard/groqModelGuard';
import type { Provider } from './providers/types';
import type { ServerConfig } from './config';
import { registerAccess, registerAdmin, registerWeb } from './access';
import { exportJson, exportMarkdown, exportName } from './export';
import { exportHtml } from './episodePage';
import { SerialQueue } from './freeImages';
import { IrisPictures } from './pictures';
import { Portraits } from './portraits';
import { SAMPLE_HN, SAMPLE_NEWS, SAMPLE_RANKING, SAMPLE_REDDIT, SAMPLE_RSS, SAMPLE_SOCIAL, SAMPLE_TRENDS, SAMPLE_WIKIPEDIA } from './scout/samples';
import { Scout, ScoutError } from './scout/scout';
import { assertPublicUrl, GoogleTrendsSource, HackerNewsSource, newsSource, OpenSocialSource, redditSource, RssSource, SampleSource, WikipediaSource, type TopicSource } from './scout/sources';

export type AppOptions = {
  timing?: MockTiming;
  logger?: FastifyServerOptions['logger'];
  /** Replaces the network in tests. */
  fetch?: typeof fetch;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Run the Scout's daily timer (the real server does; tests drive it by hand). */
  scheduler?: boolean;
  /** Replaces the Scout's sources in tests. */
  scoutSources?: TopicSource[];
  now?: () => Date;
};

export function buildApp(cfg: ServerConfig, opts: AppOptions = {}) {
  const repo = new Repo(openDb(cfg.dbPath));
  const real = cfg.providerMode !== 'mock';
  let mock: MockSettings = { failOnce: false, fast: false };
  const f = opts.fetch ?? fetch;

  const provider: Provider = real
    ? new OpenRouterProvider({ apiKey: cfg.apiKey, maxOutputTokens: cfg.maxOutputTokens, timeoutMs: cfg.requestTimeoutMs, fetch: f, service: SERVICES[cfg.providerMode === 'groq' ? 'groq' : 'openrouter'] })
    : new MockProvider(() => mock, opts.timing);
  // Every real model must pass its service's free check before anything runs.
  const guard = !real ? null : cfg.providerMode === 'groq' ? new GroqModelGuard(f, cfg.apiKey) : new FreeModelGuard(f, cfg.allowPaidModels);
  const guardedModels = [cfg.models.A, cfg.models.B, ...(cfg.artistModel ? [cfg.artistModel] : [])].filter(Boolean);
  const checkModels = async () => (guard ? guard.check(guardedModels) : []);

  // Iris, the Artist. Real mode uses ARTIST_MODEL (a free model, checked like the speakers'); mock mode draws from a script.
  const artistBackend: ArtistBackend | null = real
    ? (cfg.artistModel
      ? { modelId: cfg.artistModel, draw: ({ system, user }) => (provider as OpenRouterProvider).complete(cfg.artistModel!, system, user, 3000) }
      : null)
    : mockArtist;
  let controllerRef: ConversationController | null = null;
  // Styles saved before her Picture existed gain it once (it's her richest work); untick it any time.
  if (!repo.getSetting('iris_styles_v2')) {
    const saved = repo.getSetting<string[]>('iris_styles');
    if (Array.isArray(saved) && !saved.includes('picture')) repo.setSetting('iris_styles', ['picture', ...saved]);
    repo.setSetting('iris_styles_v2', true);
  }
  const iris = new Iris(repo, artistBackend, {
    canRequest: () => !!controllerRef && controllerRef.requestsToday() < cfg.dailyLimit,
    countRequest: () => controllerRef?.countRequest(),
    preflight: real ? async () => {
      if (cfg.problems.length) return `Real mode isn't set up yet: ${cfg.problems.join(' ')}`;
      const v = (await checkModels()).find(x => x.modelId === cfg.artistModel);
      return v && !v.ok ? `Blocked by the free-model check: ${v.modelId}: ${v.reason}` : null;
    } : undefined,
    onChange: id => controllerRef?.notify(id),
    pictures: cfg.irisPictures,
  });

  // The Control room's rules, saved with the app's settings.
  const rules = (): Rules => { const r = Rules.safeParse(repo.getSetting('rules')); return r.success ? r.data : DEFAULT_RULES; };

  const controller = new ConversationController(repo, provider, {
    rules,
    maxTurns: cfg.maxTurns, dailyLimit: cfg.dailyLimit, models: cfg.models, sleep: opts.sleep,
    onCompleted: id => { void iris.listen(id); },
    // Before every real run: settings must be complete, and every model must pass the free-model guard.
    preflight: real ? async () => {
      if (cfg.problems.length) return `Real mode isn't set up yet: ${cfg.problems.join(' ')}`;
      return FreeModelGuard.blockMessage(await checkModels());
    } : undefined,
  });
  controllerRef = controller;

  // Topic Scout. Mock mode reads saved samples and never touches the network.
  const scout: Scout = new Scout(repo, {
    sources: opts.scoutSources ?? (real
      ? [
          newsSource(f, () => scout.prefs()), new GoogleTrendsSource(f, () => scout.prefs()), redditSource(f), new OpenSocialSource(f),
          new HackerNewsSource(f), new WikipediaSource(f, () => new Date()), ...(cfg.scoutFeeds.length ? [new RssSource(f, cfg.scoutFeeds)] : []),
        ]
      : [
          new SampleSource('News sites', SAMPLE_NEWS, false, 'news'), new SampleSource('Google Trends', SAMPLE_TRENDS, false, 'trends'),
          new SampleSource('Reddit', SAMPLE_REDDIT, false, 'reddit'), new SampleSource('Bluesky & Mastodon', SAMPLE_SOCIAL, false, 'social'),
          new SampleSource('Hacker News', SAMPLE_HN), new SampleSource('Wikipedia most-read', SAMPLE_WIKIPEDIA, false, 'wikipedia'), new SampleSource('RSS', SAMPLE_RSS, false, 'news'),
        ]),
    rank: real
      ? ({ system, user }) => (provider as OpenRouterProvider).complete(cfg.models.A, system, user, 3000)
      : async () => JSON.stringify(SAMPLE_RANKING),
    preflight: real ? async () => {
      if (cfg.problems.length) return `Real mode isn't set up yet: ${cfg.problems.join(' ')}`;
      const v = (await checkModels()).find(x => x.modelId === cfg.models.A);
      return v && !v.ok ? `Blocked by the free-model check: ${v.modelId}: ${v.reason}` : null;
    } : undefined,
    counts: real,
    requestsLeft: () => cfg.dailyLimit - controller.requestsToday(),
    countRequest: () => controller.countRequest(),
    // Autopilot: the top pick as a Friendly Debate with automatic hosts, Iris included.
    autopilot: async topic => {
      const auto = { name: '', autoName: true, lens: '', role: '', autoRole: true, autoPersona: true };
      const v = controller.create({
        topic: topic.question, mode: 'debate', format: 'recorded', audience: 'general', temperature: 'lively', scoutTopicId: topic.id,
        speakers: { A: { ...auto, persona: 'optimist' }, B: { ...auto, persona: 'skeptic' } },
      });
      await controller.start(v.id);
      return v.id;
    },
    now: opts.now,
    today: () => controller.today(),
    time: cfg.scoutTime,
    rules,
  });
  const scoutView = () => ({ prefs: scout.prefs(), status: scout.status(), topics: scout.tray() });
  const interrupted = controller.recoverInterrupted();

  // Never log request headers or bodies: the key travels only from this server to the AI service.
  // Behind a host's proxy (only when locked for hosting), so wrong-code limits see the real address.
  // Hosted behind one proxy (Render): trust only its hop, so a client can't fake its address with X-Forwarded-For.
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: cfg.hosted ? (_addr: string, hop: number) => hop < 1 : false });
  registerAccess(app, cfg);
  const admin = registerAdmin(app, cfg);
  registerWeb(app, cfg);
  if (interrupted) app.log.info(`${interrupted} run(s) were interrupted by a restart and are now paused.`);
  // Check models once at start-up so Settings can show the verdicts straight away.
  if (real && !cfg.problems.length) void checkModels();

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ControllerError || err instanceof ScoutError) return reply.status(err.status).send({ error: err.message });
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

  const config = (cookie?: string): AppConfig => ({
    providerMode: cfg.providerMode,
    keyName: cfg.keyName,
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
    rules: rules(),
    admin: admin.state(cookie),
    storage: !cfg.hosted ? 'local' : cfg.backup ? 'backed-up' : 'forgets',
    portraits: cfg.portraits,
    irisPictures: cfg.irisPictures,
  });

  app.get('/api/config', async req => config(req.headers.cookie));

  app.post('/api/guard/check', async req => {
    if (real && !cfg.problems.length) await checkModels();
    return config(req.headers.cookie);
  });

  app.put('/api/mock', async req => {
    if (real) throw new ControllerError('Mock controls only work in mock mode.', 409);
    const parsed = MockSettings.safeParse(req.body);
    if (!parsed.success) throw new ControllerError('Invalid mock settings.', 400);
    mock = parsed.data;
    return mock;
  });

  app.get('/api/conversations', async () =>
    repo.listConversations().map(c => ({ ...c, run: repo.latestRun(c.id), turnCount: repo.lastSeq(c.id), artist: repo.getArtist(c.id), branchCount: repo.branchCount(c.id) })));

  app.patch<{ Params: { id: string } }>('/api/conversations/:id', async req => {
    const parsed = RenameInput.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid title.', 400);
    view(req.params.id);
    repo.rename(req.params.id, parsed.data.title);
    controller.notify(req.params.id);
    return view(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/api/conversations/:id', async (req, reply) => {
    if (iris.isWorking(req.params.id)) throw new ControllerError('Iris is still drawing this episode. Try again in a moment.', 409);
    controller.remove(req.params.id);
    // Its rendered recording goes too.
    if (audioDir && safeId(req.params.id)) for (const ext of ['mp3', 'json']) rmSync(join(audioDir, `${req.params.id}.${ext}`), { force: true });
    return reply.status(204).send();
  });

  app.post('/api/conversations', async (req, reply) => {
    const parsed = CreateConversation.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid conversation.', 400);
    if (parsed.data.scoutTopicId) {
      const t = repo.getTopic(parsed.data.scoutTopicId);
      if (!t) throw new ControllerError("That Scout topic isn't available any more.", 400);
      if (parsed.data.audience === 'kids' && isSensitive(t)) throw new ControllerError("Politics and scandals aren't used for Kids episodes. Pick another topic or audience.", 400);
      if (isSensitive(t) && !rules().allowPolitics) throw new ControllerError('Politics and scandals are switched off in the Control room.', 400);
      if (t.hidden) throw new ControllerError('That Scout topic is hidden in the Control room.', 400);
    }
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

  // The listener restyles Iris's art (Sketch, Painting, Dreamscape, or a style from a host's home).
  // She remembers their taste for next time.
  app.put<{ Params: { id: string }; Body: { style?: unknown } }>('/api/conversations/:id/artist/style', async req => {
    const v = view(req.params.id);
    const style = episodeStyles(PAINT_STYLES, v.speakers).filter(s => s !== 'picture' || cfg.irisPictures).find(s => s === req.body?.style);
    if (!style) throw new ControllerError('Pick Sketch, Painting, Dreamscape, or a style from one of the hosts\' homes.', 400);
    if (!repo.setArtStyle(req.params.id, style)) throw new ControllerError("Iris hasn't finished a drawing for this episode yet.", 409);
    return view(req.params.id);
  });

  // Listener reactions: an emoji on a line, while it plays or after. Free (no model request).
  app.post<{ Params: { id: string } }>('/api/conversations/:id/reactions', async req => {
    const v = view(req.params.id);
    const body = ReactionInput.safeParse(req.body);
    if (!body.success) throw new ControllerError('Pick a reaction and a line.', 400);
    if (!v.turns.some(t => t.seq === body.data.seq)) throw new ControllerError("That line hasn't been said yet.", 400);
    if (repo.reactionCount(v.id) >= REACTIONS_MAX) throw new ControllerError('This episode has all the reactions it can hold.', 429);
    repo.addReaction(v.id, body.data.seq, body.data.kind);
    return { reactions: repo.reactionsFor(v.id) };
  });

  // Photo portraits of the invented hosts: fetched once per look, then served from the database.
  // The hosts' photos and Iris's paintings come from the same free service, one picture at a time.
  const imageQueue = new SerialQueue();
  const portraits = new Portraits(repo, f, undefined, undefined, imageQueue);
  const pictures = new IrisPictures(repo, f, imageQueue);
  app.get<{ Params: { id: string; version: string } }>('/api/iris/picture/:id/:version', async (req, reply) => {
    const found = cfg.irisPictures && safeId(req.params.id) ? pictures.check(req.params.id, Number(req.params.version.replace(/\.(jpg|png|webp)$/, '')) || 0) : null;
    if (found === 'pending') return reply.status(202).header('Retry-After', '4').header('Cache-Control', 'no-store').send({ pending: true });
    if (!found) return reply.status(404).send({ error: 'No painting for this drawing; her line art is shown.' });
    return reply.header('Cache-Control', 'public, max-age=31536000, immutable').type(found.mime).send(found.data);
  });
  // Never waits on the image service: 202 while a photo is being made (ask again shortly), 404 when
  // there won't be one. A held-open request would tie up the browser's few connections to the app.
  app.get<{ Params: { code: string } }>('/api/portraits/:code', async (req, reply) => {
    const code = req.params.code.replace(/\.(jpg|png|webp)$/, '');
    const found = cfg.portraits ? portraits.check(code) : null;
    if (found === 'pending') return reply.status(202).header('Retry-After', '4').header('Cache-Control', 'no-store').send({ pending: true });
    if (!found) return reply.status(404).send({ error: 'No photo for this host; the drawn portrait is used.' });
    return reply.header('Cache-Control', 'public, max-age=31536000, immutable').type(found.mime).send(found.data);
  });

  // Iris's gallery: every version of every drawing, in each style it was shown in.
  app.get('/api/iris/gallery', async () => repo.gallery());
  // The styles the listener lets Iris use (one or more).
  // Plus whether she may paint in a style from the hosts' homes (on unless switched off).
  const homeStylesOn = () => repo.getSetting<boolean>('iris_home_styles') !== false;
  app.get('/api/iris/styles', async () => ({ styles: cleanStyles(repo.getSetting('iris_styles')), homeStyles: homeStylesOn() }));
  app.put<{ Body: { homeStyles?: unknown } }>('/api/iris/home-styles', async req => {
    if (typeof req.body?.homeStyles !== 'boolean') throw new ControllerError('Say true or false.', 400);
    repo.setSetting('iris_home_styles', req.body.homeStyles);
    return { styles: cleanStyles(repo.getSetting('iris_styles')), homeStyles: homeStylesOn() };
  });
  app.put<{ Body: { styles?: unknown } }>('/api/iris/styles', async req => {
    const styles = req.body?.styles;
    if (!Array.isArray(styles) || !styles.length || styles.some(s => !(PAINT_STYLES as readonly unknown[]).includes(s))) {
      throw new ControllerError('Pick at least one of Sketch, Painting or Dreamscape.', 400);
    }
    repo.setSetting('iris_styles', cleanStyles(styles));
    return { styles: cleanStyles(styles), homeStyles: homeStylesOn() };
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

  // Raise your hand: the next host invites you in at the end of this line.
  app.post<{ Params: { id: string } }>('/api/conversations/:id/hand', async req => {
    controller.raiseHand(req.params.id);
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

  // Export: the transcript as JSON (schema v1), a readable Markdown script, or the episode page to keep or send.
  app.get<{ Params: { id: string; fmt: string } }>('/api/conversations/:id/export.:fmt', async (req, reply) => {
    const v = view(req.params.id);
    if (req.params.fmt === 'json') {
      return reply.header('Content-Disposition', `attachment; filename="${exportName(v, 'json')}"`).type('application/json')
        .send(JSON.stringify(exportJson(v, repo.listUsage(v.id)), null, 2));
    }
    if (req.params.fmt === 'md') {
      return reply.header('Content-Disposition', `attachment; filename="${exportName(v, 'md')}"`).type('text/markdown; charset=utf-8').send(exportMarkdown(v));
    }
    if (req.params.fmt === 'html') {
      return reply.header('Content-Disposition', `attachment; filename="${exportName(v, 'html')}"`).type('text/html; charset=utf-8').send(exportHtml(v));
    }
    throw new ControllerError('Export as json, md or html.', 404);
  });

  // Milestone 8: the Control room. Every action here is written to the audit log.
  const audit = (action: string, detail: string) => repo.audit(new Date().toISOString(), action, detail);

  app.get('/api/admin/overview', async (): Promise<Overview> => {
    const all = repo.listConversations();
    const episodes = all.filter(c => !c.parentId);
    const finished = all.filter(c => repo.latestRun(c.id)?.state === 'completed');
    const listenerCues = finished.reduce((n, c) => n + repo.listCues(c.id).filter(x => x.status === 'applied' && x.kind !== 'note').length, 0);
    const byCat = new Map<string, number>();
    for (const c of all) {
      const t = c.scoutTopicId ? repo.getTopic(c.scoutTopicId) : null;
      const label = t ? SCOUT_CATS[t.category] : 'Your own topics';
      byCat.set(label, (byCat.get(label) ?? 0) + 1);
    }
    return {
      episodes: episodes.length,
      finishedPct: all.length ? Math.round((finished.length / all.length) * 100) : null,
      cuesPerEpisode: finished.length ? Math.round((listenerCues / finished.length) * 10) / 10 : 0,
      irisArtworks: all.filter(c => repo.getArtist(c.id)?.state === 'done').length,
      waiting: finished.filter(c => c.publish === 'waiting').length,
      requestsToday: controller.requestsToday(),
      dailyLimit: cfg.dailyLimit,
      topics: [...byCat].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      audit: repo.listAudit(),
    };
  });

  app.get('/api/admin/rules', async () => rules());
  app.put('/api/admin/rules', async req => {
    const parsed = Rules.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid rules.', 400);
    const r = { ...parsed.data, blocked: [...new Set(parsed.data.blocked.map(w => w.trim()).filter(Boolean))] };
    repo.setSetting('rules', r);
    audit('rules', `blocked: ${r.blocked.length ? r.blocked.join(', ') : 'none'} · mature ${r.allowMature ? 'on' : 'off'} · heated ${r.allowHeated ? 'on' : 'off'} · politics ${r.allowPolitics ? 'on' : 'off'} · cues ${r.cueLimit}`);
    return r;
  });

  app.post<{ Params: { id: string } }>('/api/admin/conversations/:id/note', async req => {
    const parsed = NoteInput.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid note.', 400);
    const note = controller.addNote(req.params.id, parsed.data.text);
    audit('producer note', `“${parsed.data.text}” before turn ${note.appliesBeforeSeq} of ${repo.getConversation(req.params.id)!.title}`);
    return view(req.params.id);
  });

  app.post<{ Params: { id: string }; Body: { state?: unknown } }>('/api/admin/conversations/:id/publish', async req => {
    const state = req.body?.state;
    if (state !== 'approved' && state !== 'held') throw new ControllerError('Approve or hold.', 400);
    const c = repo.getConversation(req.params.id);
    if (!c) throw new ControllerError('Conversation not found.', 404);
    if (repo.latestRun(c.id)?.state !== 'completed') throw new ControllerError('Only finished episodes can be approved or held.', 409);
    repo.setPublish(c.id, state);
    audit(state === 'approved' ? 'approved' : 'held', c.title);
    controller.notify(c.id);
    return view(c.id);
  });

  /** What would go to the podcast, social and shop queues: approved episodes only, never held or waiting ones. */
  app.get('/api/admin/publish-queue', async () =>
    repo.listConversations().filter(c => c.publish === 'approved').map(c => ({ id: c.id, title: c.title, episode: c.episode })));

  app.post<{ Params: { id: string }; Body: { pinned?: unknown; hidden?: unknown } }>('/api/admin/topics/:id', async req => {
    const t = repo.getTopic(req.params.id);
    if (!t) throw new ControllerError('Topic not found.', 404);
    const flags = {
      pinned: typeof req.body?.pinned === 'boolean' ? req.body.pinned : undefined,
      hidden: typeof req.body?.hidden === 'boolean' ? req.body.hidden : undefined,
    };
    if (flags.pinned === undefined && flags.hidden === undefined) throw new ControllerError('Pin or hide: send pinned or hidden as true or false.', 400);
    repo.setTopicFlags(t.id, flags);
    const did = [flags.pinned !== undefined && (flags.pinned ? 'pinned' : 'unpinned'), flags.hidden !== undefined && (flags.hidden ? 'hid' : 'showed')].filter(Boolean).join(' and ');
    audit(`${did} topic`, t.question);
    return scoutView();
  });

  // Milestone 7: Topic Scout.
  app.get('/api/scout', async () => scoutView());
  app.put('/api/scout/prefs', async req => {
    const parsed = ScoutPrefs.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid Scout settings.', 400);
    // A site you add must be a public website. Checked now, so you hear about a bad link straight away
    // (mock mode never fetches anything, so it skips the address lookup but keeps the other checks).
    const before = new Set(scout.prefs().feeds);
    for (const url of parsed.data.feeds.filter(u => !before.has(u))) {
      try { await assertPublicUrl(url, real ? undefined : async () => [{ address: '203.0.113.1' }]); }
      catch (e) { throw new ControllerError((e as Error).message, 400); }
    }
    scout.setPrefs(parsed.data);
    return scoutView();
  });
  app.post('/api/scout/run', async () => { await scout.run(false); return scoutView(); });

  // Round two: same hosts, same question, picking up where this episode ended.
  app.post<{ Params: { id: string } }>('/api/conversations/:id/round', async (req, reply) => {
    const v = controller.nextRound(req.params.id);
    return reply.status(201).send(v);
  });

  // Where do you stand? The listener's own 0-100 before listening, and again once the episode is finished.
  app.put<{ Params: { id: string }; Body: { start?: unknown; end?: unknown } }>('/api/conversations/:id/you', async req => {
    const c = repo.getConversation(req.params.id);
    if (!c) throw new ControllerError('Conversation not found.', 404);
    const read = (v: unknown, now: number | null) => v === undefined ? now : v === null ? null
      : Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100 ? v as number : NaN;
    const start = read(req.body?.start, c.youStart), end = read(req.body?.end, c.youEnd);
    if (Number.isNaN(start) || Number.isNaN(end)) throw new ControllerError('Pick a whole number from 0 (no) to 100 (yes).', 400);
    if (end != null && start == null) throw new ControllerError('Say where you stood before listening first.', 409);
    if (end != null && end !== c.youEnd && repo.latestRun(c.id)?.state !== 'completed') throw new ControllerError('Say where you landed once the episode has finished.', 409);
    repo.setYou(c.id, start, end);
    repo.touchConversation(c.id, new Date().toISOString());
    controller.notify(c.id);
    return view(c.id);
  });

  // Hot seat: the listener says who moved them, once the episode is finished.
  app.post<{ Params: { id: string }; Body: { verdict?: unknown } }>('/api/conversations/:id/verdict', async req => {
    const c = repo.getConversation(req.params.id);
    if (!c) throw new ControllerError('Conversation not found.', 404);
    const v = req.body?.verdict;
    if (v !== 'held' && v !== 'won' && v !== 'torn') throw new ControllerError('Pick held, won or torn.', 400);
    if (c.mode !== 'hotseat') throw new ControllerError('Only Hot seat episodes ask who moved you.', 409);
    if (repo.latestRun(c.id)?.state !== 'completed') throw new ControllerError('Say who moved you once the episode has finished.', 409);
    if (c.publish === 'approved') throw new ControllerError("This episode is approved for publishing, so its vote can't change.", 409);
    repo.setVerdict(c.id, v);
    repo.touchConversation(c.id, new Date().toISOString());
    controller.notify(c.id);
    return view(c.id);
  });

  // Milestone 4: listener cues and branches.
  app.post<{ Params: { id: string } }>('/api/conversations/:id/cues', async req => {
    const parsed = CueInput.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid cue.', 400);
    controller.addCue(req.params.id, parsed.data);
    return view(req.params.id);
  });
  app.delete<{ Params: { id: string; cueId: string } }>('/api/conversations/:id/cues/:cueId', async req => {
    controller.cancelCue(req.params.id, req.params.cueId);
    return view(req.params.id);
  });
  app.post<{ Params: { id: string } }>('/api/conversations/:id/branch', async req => {
    const parsed = BranchInput.safeParse(req.body);
    if (!parsed.success) throw new ControllerError(parsed.error.issues[0]?.message ?? 'Invalid branch.', 400);
    return withAudio(controller.branch(req.params.id, parsed.data));
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

  if (opts.scheduler) { scout.start(); app.addHook('onClose', async () => scout.stop()); }
  return { app, controller, repo, guard, iris, scout, setMock: (m: MockSettings) => { mock = m; } };
}
