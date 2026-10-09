import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ARTIST, AUDIENCES, HOME_CODES, LANGUAGES, languagesFor, MOCK_FULL_LANGUAGES, nameLook, VOICE_STYLES, voiceStyleOf, HOMES, homeOf, SCOUT_COUNTRIES, SCOUT_REGIONS, TALK_STYLES, blockedHit, DEFAULT_RULES, episodeLabel, FORMATS, hostSubtitle, isSensitive, LENGTHS, LENS_MAX, MODES, NAME_MAX, PERSONAS, PRESETS, resolveSpeakers, ROLE_MAX,
  TEMPERATURE_ORDER, TEMPERATURES, TOPIC_MAX,
  type AppConfig, type Audience, type CreateConversation, type Format, type HomeCode, type Language, type Length, type Mode, type PersonaKey, type ScoutTopic, type SpeakerDraft, type SpeakerId, type Temperature, type VoiceStyle,
} from '@crosstalk/shared';
import { api } from '../api/client';
import { BudgetBanner, realBlocked, SetupBanner, StorageBanner } from '../lib/Banners';
import { HeatMeter } from '../lib/HeatMeter';
import { BriefBox } from '../scout/BriefBox';
import { TodayTray } from '../scout/TodayTray';
import { StudioSet } from '../studio/StudioSet';
import { Footer } from './Footer';
import { WhatsNew } from './WhatsNew';

const seatDraft = (persona: PersonaKey): SpeakerDraft => ({ name: '', autoName: true, persona, autoPersona: true, lens: '', role: '', autoRole: true });
const HOME_REGIONS = ['na', 'latam', 'europe', 'mideast', 'africa', 'asia', 'oceania'] as const;
/** How much a host's home style shows at each Temperature. */
const styleShows: Record<Temperature, string> = { calm: 'a light touch at Calm.', lively: 'clearly there at Lively.', heated: 'full strength at Heated.' };
const maxTemp = (a: Audience): Temperature => (a === 'kids' ? 'lively' : 'heated');

type Props = { config: AppConfig | null; go: (hash: string) => void; refreshConfig: () => void; toast: (m: string) => void };

/** What this episode costs from today's free requests, and how many more of this length still fit. */
function budgetLine(c: AppConfig, length: Length) {
  const per = LENGTHS[length].turns + 1;
  const left = Math.max(0, c.dailyLimit - c.requestsToday);
  const fits = Math.floor(left / per);
  const shortPer = LENGTHS.short.turns + 1;
  const base = `Uses about ${per} requests: one per turn, plus one for Iris (a few more if a turn is retried). ${left} left today`;
  if (fits >= 1) return `${base}: room for ${fits === 1 ? 'one more episode' : `${fits} episodes`} this length.`;
  if (length !== 'short' && left >= shortPer) return `${base}: not enough for this length, but a Short one (about ${shortPer}) fits.`;
  return `${base}: not enough for a full episode. The count resets tomorrow.`;
}

export function Create({ config, go, refreshConfig, toast }: Props) {
  const [topic, setTopic] = useState<string>(PRESETS[2]);
  const [mode, setMode] = useState<Mode>('explore');
  const [format, setFormat] = useState<Format>('recorded');
  // Your last length choice, remembered on this device (Short saves free requests).
  const [length, setLengthState] = useState<Length>(() => {
    try { const l = localStorage.getItem('ct_length'); return l === 'short' || l === 'long' ? l : 'normal'; } catch { return 'normal'; }
  });
  const setLength = (l: Length) => { setLengthState(l); try { localStorage.setItem('ct_length', l); } catch { /* storage blocked */ } };
  const [language, setLanguage] = useState<Language>('en');
  const [audience, setAudience] = useState<Audience>('general');
  const [temperature, setTemperature] = useState<Temperature>('lively');
  const [drafts, setDrafts] = useState<{ A: SpeakerDraft; B: SpeakerDraft }>({ A: seatDraft('optimist'), B: seatDraft('skeptic') });
  const [starting, setStarting] = useState(false);
  // The Start bar follows you down the page until the real Start row comes into view.
  const startRow = useRef<HTMLDivElement>(null);
  const [dock, setDock] = useState(false);
  useEffect(() => {
    const el = startRow.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setDock(!e.isIntersecting && e.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // A topic from the Today tray brings its brief; editing the question away from it drops the brief.
  const [scoutTopic, setScoutTopic] = useState<ScoutTopic | null>(null);
  const kidsBlocked = !!scoutTopic && audience === 'kids' && isSensitive(scoutTopic);
  const briefOn = !!scoutTopic && topic.trim() === scoutTopic.question && !kidsBlocked;

  const models = config?.models ?? { A: 'mock/wren-v1', B: 'mock/hale-v1' };
  // The same rule the server uses, so what you see is what gets saved.
  const speakers = useMemo(() => resolveSpeakers(topic, audience, drafts, models), [topic, audience, drafts, models.A, models.B]);
  // English first, then the languages of the hosts' homes.
  const suggested = languagesFor([drafts.A.home, drafts.B.home]);
  const edit = (k: SpeakerId, patch: Partial<SpeakerDraft>) => setDrafts(d => ({ ...d, [k]: { ...d[k], ...patch } }));
  const busy = !!config?.activeConversationId;
  const real = !!config && config.providerMode !== 'mock';
  const overBudget = !!config && config.requestsToday >= config.dailyLimit;
  const blocked = realBlocked(config);
  // The Control room's rules: blocked words keep a topic off air; Mature and Heated can be switched off.
  const rules = config?.rules ?? DEFAULT_RULES;
  // If the Control room switches off what's selected, step back to the nearest allowed choice.
  useEffect(() => {
    if (audience === 'mature' && !rules.allowMature) setAudience('general');
    if (temperature === 'heated' && !rules.allowHeated) setTemperature('lively');
  }, [rules.allowMature, rules.allowHeated]); // eslint-disable-line react-hooks/exhaustive-deps
  const blockedWord = blockedHit(topic, rules.blocked);
  const canStart = !!topic.trim() && !busy && !starting && !overBudget && !blocked && !blockedWord
    && !(audience === 'mature' && !rules.allowMature) && !(temperature === 'heated' && !rules.allowHeated);

  const pickAudience = (a: Audience) => {
    setAudience(a);
    if (TEMPERATURE_ORDER.indexOf(temperature) > TEMPERATURE_ORDER.indexOf(maxTemp(a))) setTemperature(maxTemp(a));
  };

  const start = async () => {
    setStarting(true);
    try {
      const body: CreateConversation = { topic: topic.trim(), mode, format, length, language, audience, temperature, speakers: drafts, scoutTopicId: briefOn ? scoutTopic!.id : null };
      const c = await api.create(body);
      await api.start(c.id);
      go(`#/studio/${c.id}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setStarting(false);
      refreshConfig();
    }
  };

  const seat = (k: SpeakerId) => {
    const d = drafts[k], s = speakers[k];
    return (
      <section className={`seat ${k}`} aria-label={`Speaker ${k}`}>
        <div className="seat-head"><span className={`flag ${k}`} aria-hidden="true">{k}</span><span className="tag">Speaker {k} · {k === 'A' ? 'left seat' : 'right seat'}</span></div>
        <label className="fld">
          <span className="tag">Name {d.autoName
            ? <span className="auto-chip">Auto</span>
            : <button type="button" className="link-btn" onClick={() => edit(k, { autoName: true, name: '' })}>↺ Back to auto</button>}</span>
          <input type="text" maxLength={NAME_MAX} value={d.autoName ? s.name : d.name} onChange={e => edit(k, { autoName: false, name: e.target.value })} />
        </label>
        <label className="fld">
          <span className="tag">Role {d.autoRole
            ? <span className="auto-chip">Auto</span>
            : <button type="button" className="link-btn" onClick={() => edit(k, { autoRole: true, role: '' })}>↺ Back to auto</button>}</span>
          <input type="text" maxLength={ROLE_MAX}
            value={d.autoRole ? (real ? '' : s.role) : d.role}
            placeholder={real ? 'Written to fit the topic when you start' : 'e.g. Chef who runs a small bistro'}
            onChange={e => edit(k, { autoRole: false, role: e.target.value })} />
        </label>
        {d.autoRole && <p className="hint" style={{ margin: '-4px 0 0' }}>{real ? 'A fitting job for this topic is written by the AI when recording starts.' : 'A job that fits this topic.'} Type your own to change it.</p>}
        <label className="fld">
          <span className="tag">Home</span>
          <select value={d.home ?? ''} onChange={e => edit(k, { home: e.target.value as HomeCode | '' })}>
            <option value="">Anywhere · no regional style</option>
            {HOME_REGIONS.map(r => (
              <optgroup key={r} label={SCOUT_REGIONS[r]}>
                {HOME_CODES.filter(c => HOMES[c].region === r).map(c => <option key={c} value={c}>{SCOUT_COUNTRIES[c]}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {homeOf(d.home) && <p className="hint" style={{ margin: '-4px 0 0' }}>{TALK_STYLES[homeOf(d.home)!.style].label}: {styleShows[temperature]} Their name and face fit {homeOf(d.home)!.country}{homeOf(d.home)!.voice ? ', with a local English voice if your device has one' : ''}.</p>}
        <label className="fld">
          <span className="tag">Personality</span>
          <select value={d.autoPersona ? 'auto' : d.persona}
            onChange={e => e.target.value === 'auto' ? edit(k, { autoPersona: true }) : edit(k, { autoPersona: false, persona: e.target.value as PersonaKey })}>
            <option value="auto">Auto · {PERSONAS[s.persona].label}</option>
            {(Object.keys(PERSONAS) as PersonaKey[]).map(pk => <option key={pk} value={pk}>{PERSONAS[pk].label}{pk === 'custom' ? '…' : ''}</option>)}
          </select>
        </label>
        {d.autoPersona && <p className="hint" style={{ margin: '-4px 0 0' }}>Picked for this topic and audience.</p>}
        <label className="fld">
          <span className="tag">Voice</span>
          <select value={d.voice ?? 'auto'} onChange={e => edit(k, { voice: e.target.value as SpeakerDraft['voice'] })}>
            <option value="auto">Auto · {VOICE_STYLES[voiceStyleOf(s)].label}</option>
            {(Object.keys(VOICE_STYLES) as VoiceStyle[]).map(v => <option key={v} value={v}>{VOICE_STYLES[v].label}</option>)}
          </select>
        </label>
        <p className="hint" style={{ margin: '-4px 0 0' }}>{VOICE_STYLES[voiceStyleOf(s)].help} {nameLook(s.name) ? `A ${nameLook(s.name) === 'w' ? "woman's" : "man's"} voice when your device has one.` : ''}</p>
        {s.persona === 'custom'
          ? <input type="text" maxLength={LENS_MAX} value={d.lens} placeholder="Describe them in a few words, e.g. a retired chef who hates waste" onChange={e => edit(k, { lens: e.target.value })} />
          : <p className="lens">{s.lens}</p>}
        <div><div className="tag" style={{ marginBottom: 5 }}>Model</div><div className="model">{s.modelId}</div></div>
      </section>
    );
  };

  return (
    <div className="create">
      <div className="hero">
        <div className="tag">New episode · {LENGTHS[length].turns} turns · {episodeLabel(config?.nextEpisode ?? 1)}</div>
        <h1>Choose a topic. Record it with two AI hosts.</h1>
        <p>Challenge their ideas, turn up the heat, branch from any moment, and keep the episode and Iris's art.</p>
      </div>

      <WhatsNew />

      <StudioSet photos={config?.portraits}
        show={`CrossTalk · ${FORMATS[format].label}`}
        topic={topic.trim() || 'Pick a topic to start recording'}
        tags={`${MODES[mode].label} · ${AUDIENCES[audience].label} · ${TEMPERATURES[temperature].label}`}
        temperature={temperature}
        hosts={{
          A: { name: speakers.A.name, role: real && drafts.A.autoRole ? 'Role written when you start' : hostSubtitle(speakers.A), home: speakers.A.home },
          B: { name: speakers.B.name, role: real && drafts.B.autoRole ? 'Role written when you start' : hostSubtitle(speakers.B), home: speakers.B.home },
        }}
        speaking={null}
        voiceLevel={0}
        caption={null}
        runState="lobby"
        clock={{ seconds: 0, running: false }}
        iris={{ text: 'Iris · in the booth', active: false }}
      />

      <TodayTray rules={rules} audience={audience} selected={scoutTopic?.id ?? null} real={real} toast={toast}
        onPick={t => { setScoutTopic(t); setTopic(t.question); setMode('debate'); document.getElementById('topic')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />

      <div className="topic-box">
        <label className="tag" htmlFor="topic">Topic</label>
        <textarea id="topic" maxLength={TOPIC_MAX} placeholder="Ask a question worth two perspectives" value={topic} onChange={e => setTopic(e.target.value)} />
        {briefOn && <BriefBox brief={scoutTopic!} note="from the Scout" />}
        {blockedWord && <p className="hint blocked-hint" role="alert">✕ “{blockedWord}” is on the Control room's blocked list, so this topic can't go on air.</p>}
        {kidsBlocked && <p className="hint">Politics and scandals aren't used for Kids episodes, so this topic's brief is off. Pick another topic or audience.</p>}
        {scoutTopic && !briefOn && !kidsBlocked && <p className="hint">You changed the question, so the Scout's brief won't be used. <button className="link-btn" onClick={() => setTopic(scoutTopic.question)}>Put it back</button></p>}
        <div className="chips" role="group" aria-label="Preset topics">
          {PRESETS.map(p => <button key={p} className="chip" aria-pressed={topic === p} onClick={() => setTopic(p)}>{p}</button>)}
        </div>
      </div>

      <div>
        <div className="tag" style={{ marginBottom: 8 }}>Mode</div>
        <div className="seg" role="group" aria-label="Mode">
          {(Object.keys(MODES) as Mode[]).map(k => <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{MODES[k].label}</button>)}
        </div>
        <p className="mode-help">{MODES[mode].help}</p>
      </div>

      <div>
        <div className="tag" style={{ marginBottom: 8 }}>Format</div>
        <div className="seg" role="group" aria-label="Format">
          {(Object.keys(FORMATS) as Format[]).map(k => <button key={k} aria-pressed={format === k} onClick={() => setFormat(k)}>{k === 'live' ? '● ' : ''}{FORMATS[k].label}</button>)}
        </div>
        <p className="mode-help">{FORMATS[format].help}</p>
      </div>

      <div>
        <div className="tag" style={{ marginBottom: 8 }}>Length · listening time</div>
        <div className="seg" role="group" aria-label="Length">
          {(Object.keys(LENGTHS) as Length[]).map(k => <button key={k} aria-pressed={length === k} onClick={() => setLength(k)}>{LENGTHS[k].label} · ~{LENGTHS[k].minutes} min</button>)}
        </div>
        <p className="mode-help">{LENGTHS[length].help}</p>
      </div>

      <div>
        <label className="tag" htmlFor="language" style={{ display: 'block', marginBottom: 8 }}>Language</label>
        <select id="language" style={{ maxWidth: 360 }} value={language} onChange={e => setLanguage(e.target.value as Language)}>
          <optgroup label={suggested.length > 1 ? 'For these hosts' : 'Default'}>
            {suggested.map(l => <option key={l} value={l}>{LANGUAGES[l].label}{l !== 'en' ? ` · ${LANGUAGES[l].native}` : ''}</option>)}
          </optgroup>
          <optgroup label="More languages">
            {(Object.keys(LANGUAGES) as Language[]).filter(l => !suggested.includes(l)).map(l => <option key={l} value={l}>{LANGUAGES[l].label} · {LANGUAGES[l].native}</option>)}
          </optgroup>
        </select>
        <p className="mode-help">{language === 'en'
          ? 'The hosts and Iris speak English. Give a host a home to see their languages first.'
          : `The hosts and Iris speak ${LANGUAGES[language].label}, read aloud by your device's ${LANGUAGES[language].label} voice. ${real ? '' : (MOCK_FULL_LANGUAGES as readonly string[]).includes(language) ? `Mock mode plays a whole sample episode in ${LANGUAGES[language].label}, Iris included.` : `Mock mode greets you in ${LANGUAGES[language].label}, then plays its sample script in English; real AI hosts speak it throughout.`}`}</p>
      </div>

      <div className="dials">
        <div>
          <div className="tag" style={{ marginBottom: 8 }}>Audience</div>
          <div className="seg" role="group" aria-label="Audience">
            {(Object.keys(AUDIENCES) as Audience[]).map(k => <button key={k} aria-pressed={audience === k} onClick={() => pickAudience(k)}
              disabled={k === 'mature' && !rules.allowMature} title={k === 'mature' && !rules.allowMature ? 'Switched off in the Control room' : undefined}>{AUDIENCES[k].label}</button>)}
          </div>
          <p className="mode-help">{AUDIENCES[audience].help}</p>
        </div>
        <div>
          <div className="tag" style={{ marginBottom: 8 }}>Temperature <HeatMeter temperature={temperature} /></div>
          <div className="seg" role="group" aria-label="Temperature">
            {TEMPERATURE_ORDER.map(k => (
              <button key={k} aria-pressed={temperature === k} onClick={() => setTemperature(k)}
                disabled={TEMPERATURE_ORDER.indexOf(k) > TEMPERATURE_ORDER.indexOf(maxTemp(audience)) || (k === 'heated' && !rules.allowHeated)}
                title={k === 'heated' && audience === 'kids' ? 'Not available for Kids' : k === 'heated' && !rules.allowHeated ? 'Switched off in the Control room' : undefined}>{TEMPERATURES[k].label}</button>
            ))}
          </div>
          <p className="mode-help">{TEMPERATURES[temperature].help} You can turn it up or down mid-discussion.</p>
        </div>
      </div>
      <p className="hint">Political topics are fine when you choose them: both speakers must represent each side fairly and never tell you what to believe. In mock mode the scripted text only hints at these settings; real models follow them fully.</p>

      <div>
        <div className="tag" style={{ marginBottom: 8 }}>At the table</div>
        <div className="facing">{seat('A')}<div className="table-gap" aria-hidden="true"><span className="tag">across the table</span></div>{seat('B')}</div>
      </div>

      <div className="booth-note">
        <span className="flag C" aria-hidden="true">I</span>
        <span><b>{ARTIST.name}, {ARTIST.role},</b> listens from the booth. When the discussion ends, she shares her perspective as a listener and sketches the moment that stayed with her, then paints it the way the episode felt. Tell her what you think and she learns your taste.</span>
      </div>

      <SetupBanner config={config} />
      <StorageBanner config={config} />
      <BudgetBanner config={config} />
      <div className="start-row" ref={startRow}>
        <button className="btn primary" disabled={!canStart} onClick={start}>● Start recording</button>
        <span className="meta">
          {blocked ? 'Real mode is blocked; see above.' : overBudget ? 'Daily limit reached.' : busy
            ? <>Another discussion is still generating. <a href={`#/studio/${config!.activeConversationId}`} style={{ color: 'var(--cue)' }}>Open it</a> to pause or stop it first.</>
            : !topic.trim() ? 'Add a topic first.'
            : real ? budgetLine(config!, length)
            : 'Mock mode: scripted text, no model is called.'}
        </span>
      </div>
      <Footer config={config} />
      {dock && (
        <div className="start-dock" role="region" aria-label="Quick start">
          <div className="wrap">
            <span className="dock-topic"><b>{topic.trim() || 'Add a topic first'}</b>
              <span className="hint">{MODES[mode].label} · {TEMPERATURES[temperature].label}{scoutTopic ? ' · from the Scout' : ''}</span></span>
            <button className="btn primary" disabled={!canStart} onClick={start}>● Record</button>
          </div>
        </div>
      )}
    </div>
  );
}
