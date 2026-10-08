// Transcript export (docs/PLAN.md, "Export (schema v1)"): one JSON document and the same content as a readable script.
import { ARTIST, AUDIENCES, CUE_LIMIT, episodeLabel, mindChange, MODES, NOTICE, SCOUT_NOTICE, TEMPERATURES, turnTotal, VERDICTS, type ConversationView } from '@crosstalk/shared';
import type { UsageRow } from './db/repo';

export const EXPORT_SCHEMA_VERSION = 1;

export function exportJson(c: ConversationView, usage: UsageRow[]) {
  const ok = usage.filter(u => u.status === 'ok');
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    notice: c.brief ? SCOUT_NOTICE : NOTICE,
    exportedAt: new Date().toISOString(),
    conversation: {
      id: c.id, title: c.title, topic: c.topic, mode: c.mode, format: c.format, episode: c.episode,
      audience: c.audience, temperature: c.temperature, createdAt: c.createdAt, updatedAt: c.updatedAt,
      state: c.run?.state ?? 'idle', turnsPlanned: turnTotal(c), listenerVerdict: c.verdict ?? null,
    },
    speakers: [c.speakers.A, c.speakers.B].map(s => ({ id: s.id, name: s.name, role: s.role ?? '', persona: s.persona, lens: s.lens, modelId: s.modelId })),
    branch: c.parentId ? { parentId: c.parentId, parentTitle: c.parent?.title ?? null, branchTurnId: c.branchTurnId, branchSeq: c.branchSeq, direction: c.branchDirection } : null,
    branches: c.branches.map(b => ({ id: b.id, branchSeq: b.branchSeq, direction: b.direction })),
    turns: c.turns.map(t => ({
      seq: t.seq, speakerId: t.speakerId, speaker: c.speakers[t.speakerId].name, modelId: t.modelId, job: t.objective, text: t.text,
      // In a branch, turns before the cut are read from the original episode.
      fromOriginal: t.conversationId !== c.id,
      stance: t.stance ?? null,
    })),
    interventions: c.interventions.map(x => ({
      kind: x.kind, text: x.text, targetSeq: x.targetSeq, fromTemperature: x.fromTemp, toTemperature: x.toTemp,
      appliesBeforeSeq: x.appliesBeforeSeq, status: x.status, createdAt: x.createdAt, fromOriginal: x.fromOriginal,
    })),
    cueLimit: CUE_LIMIT,
    artist: c.artist?.state === 'done' ? {
      name: ARTIST.name, modelId: c.artist.modelId, perspective: c.artist.perspective, momentSeq: c.artist.momentSeq,
      caption: c.artist.caption, artTitle: c.artist.artTitle, sketchSvg: c.artist.sketchSvg, imagePrompt: c.artist.imagePrompt,
    } : null,
    brief: c.brief ? { question: c.brief.question, date: c.brief.date, category: c.brief.category, region: c.brief.region, bullets: c.brief.bullets } : null,
    sources: c.brief ? [...new Map(c.brief.bullets.map(b => [b.url, { name: b.source, url: b.url }])).values()] : [],
    usage: {
      requests: usage.length,
      tokensIn: ok.reduce((n, u) => n + (u.tokensIn ?? 0), 0),
      tokensOut: ok.reduce((n, u) => n + (u.tokensOut ?? 0), 0),
      // Null means at least one reply came back without a price: unknown, never shown as $0.
      costUsd: ok.some(u => u.costUsd === null) ? null : ok.reduce((n, u) => n + (u.costUsd ?? 0), 0),
    },
  };
}

/** Listener text on one line, with inline Markdown escaped. Mid-line, # and list marks can't start a block, so it can't change the document's structure. */
const safe = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().replace(/([\\`*_[\]<>|])/g, '\\$1');

const CUE_LINE: Record<string, (x: ConversationView['interventions'][number]) => string> = {
  challenge: x => `> **Listener's challenge:** ${safe(x.text)}`,
  guest: x => `> **Guest on the mic:** “${safe(x.text)}”`,
  deeper: x => `> **Listener:** go deeper on turn ${x.targetSeq}`,
  temp: x => `> **Listener:** temperature ${x.fromTemp && TEMPERATURES[x.fromTemp].label} → ${x.toTemp && TEMPERATURES[x.toTemp].label}`,
};

export function exportMarkdown(c: ConversationView) {
  const sp = c.speakers;
  const host = (k: 'A' | 'B') => `**${sp[k].name}**${sp[k].role ? `, ${sp[k].role}` : ''} (${sp[k].modelId})`;
  const lines = [
    `# ${c.topic}`,
    '',
    `CrossTalk · ${episodeLabel(c.episode)} · ${MODES[c.mode].label} · ${AUDIENCES[c.audience].label} · ${TEMPERATURES[c.temperature].label}`,
    '',
    `Hosts: ${host('A')} and ${host('B')}`,
    c.parentId ? `\n✂ Branch of “${c.parent?.title ?? c.parentId}” from turn ${c.branchSeq}: “${safe(c.branchDirection)}”` : '',
    c.brief ? `\n**Today's brief** (the hosts treat only this as fact):\n\n${c.brief.bullets.map(b => `- ${safe(b.text)} ([${safe(b.source)}](${b.url}))`).join('\n')}` : '',
    '',
    '---',
    '',
  ];
  for (const t of c.turns) {
    for (const x of c.interventions.filter(i => i.appliesBeforeSeq === t.seq && i.status === 'applied')) lines.push(CUE_LINE[x.kind](x), '');
    lines.push(`**${sp[t.speakerId].name}** · turn ${t.seq} · ${t.objective}${t.conversationId !== c.id ? ' · from the original' : ''}`, '', t.text, '');
    if (c.branchSeq === t.seq) lines.push(`*✂ The branch starts here: “${safe(c.branchDirection)}”*`, '');
  }
  const mc = mindChange(c.turns);
  if (mc.A.start != null || mc.B.start != null) {
    lines.push('---', '', '## Mind-change meter', '', ...(['A', 'B'] as const).filter(k => mc[k].start != null)
      .map(k => `- ${sp[k].name}: ${mc[k].start}% on yes${mc[k].end != null ? ` → ${mc[k].end}%` : ''}`), '');
  }
  if (c.verdict) lines.push(`**Who moved you?** ${VERDICTS[c.verdict]}`, '');
  if (c.artist?.state === 'done') {
    lines.push('---', '', `## From the booth: ${ARTIST.name}, ${ARTIST.role}`, '', c.artist.perspective, '',
      `Her sketch, “${c.artist.artTitle}”, is of turn ${c.artist.momentSeq}: “${c.artist.caption}”`, '');
  }
  if (c.branches.length) lines.push('## Branches', '', ...c.branches.map(b => `- From turn ${b.branchSeq}: ${safe(b.direction)}`), '');
  lines.push('---', '', `*${c.brief ? SCOUT_NOTICE : NOTICE}*`);
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n') + '\n';
}

/** A safe, readable file name from the topic. */
export const exportName = (c: ConversationView, ext: string) =>
  `crosstalk-ep${String(c.episode).padStart(2, '0')}-${c.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'episode'}${c.parentId ? '-branch' : ''}.${ext}`;
