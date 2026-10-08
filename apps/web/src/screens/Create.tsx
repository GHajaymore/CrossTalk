import { useMemo, useState } from 'react';
import {
  ARTIST, AUDIENCES, episodeLabel, FORMATS, LENS_MAX, MODES, NAME_MAX, PERSONAS, personaLabel, PRESETS, resolveSpeakers,
  TEMPERATURE_ORDER, TEMPERATURES, TOPIC_MAX,
  type AppConfig, type Audience, type CreateConversation, type Format, type Mode, type PersonaKey, type SpeakerDraft, type SpeakerId, type Temperature,
} from '@crosstalk/shared';
import { api } from '../api/client';
import { BudgetBanner, realBlocked, SetupBanner } from '../lib/Banners';
import { HeatMeter } from '../lib/HeatMeter';
import { StudioSet } from '../studio/StudioSet';
import { Footer } from './Footer';

const seatDraft = (persona: PersonaKey): SpeakerDraft => ({ name: '', autoName: true, persona, autoPersona: true, lens: '' });
const maxTemp = (a: Audience): Temperature => (a === 'kids' ? 'lively' : 'heated');

type Props = { config: AppConfig | null; go: (hash: string) => void; refreshConfig: () => void; toast: (m: string) => void };

export function Create({ config, go, refreshConfig, toast }: Props) {
  const [topic, setTopic] = useState<string>(PRESETS[2]);
  const [mode, setMode] = useState<Mode>('explore');
  const [format, setFormat] = useState<Format>('recorded');
  const [audience, setAudience] = useState<Audience>('general');
  const [temperature, setTemperature] = useState<Temperature>('lively');
  const [drafts, setDrafts] = useState<{ A: SpeakerDraft; B: SpeakerDraft }>({ A: seatDraft('optimist'), B: seatDraft('skeptic') });
  const [starting, setStarting] = useState(false);

  const models = config?.models ?? { A: 'mock/wren-v1', B: 'mock/hale-v1' };
  // The same rule the server uses, so what you see is what gets saved.
  const speakers = useMemo(() => resolveSpeakers(topic, audience, drafts, models), [topic, audience, drafts, models.A, models.B]);
  const edit = (k: SpeakerId, patch: Partial<SpeakerDraft>) => setDrafts(d => ({ ...d, [k]: { ...d[k], ...patch } }));
  const busy = !!config?.activeConversationId;
  const overBudget = !!config && config.requestsToday >= config.dailyLimit;
  const blocked = realBlocked(config);
  const canStart = !!topic.trim() && !busy && !starting && !overBudget && !blocked;

  const pickAudience = (a: Audience) => {
    setAudience(a);
    if (TEMPERATURE_ORDER.indexOf(temperature) > TEMPERATURE_ORDER.indexOf(maxTemp(a))) setTemperature(maxTemp(a));
  };

  const start = async () => {
    setStarting(true);
    try {
      const body: CreateConversation = { topic: topic.trim(), mode, format, audience, temperature, speakers: drafts };
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
          <span className="tag">Personality</span>
          <select value={d.autoPersona ? 'auto' : d.persona}
            onChange={e => e.target.value === 'auto' ? edit(k, { autoPersona: true }) : edit(k, { autoPersona: false, persona: e.target.value as PersonaKey })}>
            <option value="auto">Auto · {PERSONAS[s.persona].label}</option>
            {(Object.keys(PERSONAS) as PersonaKey[]).map(pk => <option key={pk} value={pk}>{PERSONAS[pk].label}{pk === 'custom' ? '…' : ''}</option>)}
          </select>
        </label>
        {d.autoPersona && <p className="hint" style={{ margin: '-4px 0 0' }}>Picked for this topic and audience.</p>}
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
        <div className="tag">New episode · 8 turns · {episodeLabel(config?.nextEpisode ?? 1)}</div>
        <h1>Choose a topic. Record it with two AI hosts.</h1>
        <p>Challenge their ideas, turn up the heat, branch from any moment, and keep the episode and Iris's art.</p>
      </div>

      <StudioSet
        show={`CrossTalk · ${FORMATS[format].label}`}
        topic={topic.trim() || 'Pick a topic to start recording'}
        tags={`${MODES[mode].label} · ${AUDIENCES[audience].label} · ${TEMPERATURES[temperature].label}`}
        temperature={temperature}
        hosts={{ A: { name: speakers.A.name, role: personaLabel(speakers.A) }, B: { name: speakers.B.name, role: personaLabel(speakers.B) } }}
        speaking={null}
        voiceLevel={0}
        caption={null}
        runState="lobby"
        clock={{ seconds: 0, running: false }}
        iris={{ text: 'Iris · in the booth', active: false }}
      />

      <div className="later-box">
        <div><span className="tag">Today · from the Scout</span><h2>What people are arguing about</h2></div>
        <span className="soon">Arrives in Milestone 7</span>
      </div>

      <div className="topic-box">
        <label className="tag" htmlFor="topic">Topic</label>
        <textarea id="topic" maxLength={TOPIC_MAX} placeholder="Ask a question worth two perspectives" value={topic} onChange={e => setTopic(e.target.value)} />
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
        <p className="mode-help">{FORMATS[format].help}{format === 'live' ? ' Speaking aloud arrives with voices in Milestone 3.' : ''}</p>
      </div>

      <div className="dials">
        <div>
          <div className="tag" style={{ marginBottom: 8 }}>Audience</div>
          <div className="seg" role="group" aria-label="Audience">
            {(Object.keys(AUDIENCES) as Audience[]).map(k => <button key={k} aria-pressed={audience === k} onClick={() => pickAudience(k)}>{AUDIENCES[k].label}</button>)}
          </div>
          <p className="mode-help">{AUDIENCES[audience].help}</p>
        </div>
        <div>
          <div className="tag" style={{ marginBottom: 8 }}>Temperature <HeatMeter temperature={temperature} /></div>
          <div className="seg" role="group" aria-label="Temperature">
            {TEMPERATURE_ORDER.map(k => (
              <button key={k} aria-pressed={temperature === k} onClick={() => setTemperature(k)}
                disabled={TEMPERATURE_ORDER.indexOf(k) > TEMPERATURE_ORDER.indexOf(maxTemp(audience))}
                title={k === 'heated' && audience === 'kids' ? 'Not available for Kids' : undefined}>{TEMPERATURES[k].label}</button>
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
        <span><b>{ARTIST.name}, {ARTIST.role},</b> listens from the booth. When the discussion ends, she shares her perspective as a listener and sketches the moment that stayed with her. <span className="soon">Milestone 5</span></span>
      </div>

      <SetupBanner config={config} />
      <BudgetBanner config={config} />
      <div className="start-row">
        <button className="btn primary" disabled={!canStart} onClick={start}>● Start recording</button>
        <span className="meta">
          {blocked ? 'Real mode is blocked; see above.' : overBudget ? 'Daily limit reached.' : busy
            ? <>Another discussion is still generating. <a href={`#/studio/${config!.activeConversationId}`} style={{ color: 'var(--cue)' }}>Open it</a> to pause or stop it first.</>
            : !topic.trim() ? 'Add a topic first.'
            : config?.providerMode === 'openrouter' ? 'Uses 8 requests to free models (up to 16 if turns are retried).'
            : 'Mock mode: scripted text, no model is called.'}
        </span>
      </div>
      <Footer config={config} />
    </div>
  );
}
