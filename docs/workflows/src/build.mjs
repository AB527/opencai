// Generates the workflow diagrams in docs/workflows/ as PNG.
//
//   node docs/workflows/src/build.mjs
//
// Each figure is drawn as SVG, rendered to a 2x PNG with headless Chrome, and
// the SVG is then removed. Set CHROME to the browser binary if it is not found;
// without one the SVGs are left in place instead.
//
// Layout is explicit (coordinates per diagram) so the drawings stay exact and
// quiet: ink on paper, one muted accent for "stops here" paths. Keep the
// diagrams in step with the code they describe -- each figure names its source.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
// Every saved diagram, so the PNG pass at the end knows each one's size.
const SAVED = [];

const C = {
  paper: '#fbfaf7',
  ink: '#1f1f1f',
  muted: '#5e5e5e',
  rule: '#a3a09a',
  fill: '#ffffff',
  soft: '#f1eee8',
  accent: '#7a2e2e',
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A line is a string (first line = heading, others = detail) or
// { t, style: 'head' | 'detail' | 'mono' | 'accent' }.
const LINE = {
  head: { size: 14, lh: 19, family: SANS, weight: 600, color: C.ink },
  detail: { size: 12, lh: 16, family: SANS, weight: 400, color: C.muted },
  mono: { size: 11.5, lh: 16, family: MONO, weight: 400, color: C.ink },
  accent: { size: 14, lh: 19, family: SANS, weight: 600, color: C.accent },
};

class Diagram {
  constructor({ file, width, height, fig, title, subtitle, source }) {
    Object.assign(this, { file, width, height, fig, title, subtitle, source });
    this.parts = [];
  }

  add(svg) {
    this.parts.push(svg);
  }

  lines(cx, cy, lines) {
    const specs = lines.map((l, i) => {
      const o = typeof l === 'string' ? { t: l, style: i === 0 ? 'head' : 'detail' } : l;
      return { ...LINE[o.style ?? 'detail'], t: o.t };
    });
    const total = specs.reduce((a, s) => a + s.lh, 0);
    let y = cy - total / 2;
    for (const s of specs) {
      y += s.lh;
      this.add(
        `<text x="${cx}" y="${y - (s.lh - s.size) / 2 - 2}" text-anchor="middle" font-family="${s.family}" font-size="${s.size}" font-weight="${s.weight}" fill="${s.color}">${esc(s.t)}</text>`,
      );
    }
  }

  // kind: process | terminal | outcome | stop | store
  box(x, y, w, h, lines, { kind = 'process' } = {}) {
    const stroke = kind === 'stop' ? C.accent : C.ink;
    const fill = kind === 'terminal' || kind === 'outcome' ? C.soft : C.fill;
    const rx = kind === 'terminal' ? h / 2 : 3;
    const sw = kind === 'outcome' || kind === 'stop' ? 1.5 : 1.1;
    if (kind === 'store') {
      const ry = 7;
      this.add(
        `<path d="M${x},${y + ry} a${w / 2},${ry} 0 0 0 ${w},0 a${w / 2},${ry} 0 0 0 ${-w},0 v${h - 2 * ry} a${w / 2},${ry} 0 0 0 ${w},0 v${-(h - 2 * ry)}" fill="${C.fill}" stroke="${C.ink}" stroke-width="1.1"/>`,
      );
      this.lines(x + w / 2, y + h / 2 + ry / 2, lines);
    } else {
      this.add(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`,
      );
      this.lines(x + w / 2, y + h / 2, lines);
    }
    return anchors(x, y, w, h);
  }

  diamond(cx, cy, w, h, lines) {
    this.add(
      `<polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}" fill="${C.fill}" stroke="${C.ink}" stroke-width="1.1"/>`,
    );
    this.lines(cx, cy, lines.map((t) => ({ t, style: 'detail' })));
    return {
      t: [cx, cy - h / 2],
      b: [cx, cy + h / 2],
      l: [cx - w / 2, cy],
      r: [cx + w / 2, cy],
      cx,
      cy,
    };
  }

  // A numbered marker for sequential steps.
  step(cx, cy, n) {
    this.add(
      `<circle cx="${cx}" cy="${cy}" r="13" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.1"/>` +
        `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="14" fill="${C.ink}">${n}</text>`,
    );
  }

  frame(x, y, w, h, label, { labelEnd = false } = {}) {
    const lx = labelEnd ? x + w - 14 : x + 14;
    this.add(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${C.rule}" stroke-width="1" stroke-dasharray="5 4"/>` +
        `<text x="${lx}" y="${y + 20}" text-anchor="${labelEnd ? 'end' : 'start'}" font-family="${SANS}" font-size="10.5" letter-spacing="1.6" fill="${C.muted}">${esc(label)}</text>`,
    );
  }

  note(x, y, lines, { anchor = 'start', color = C.muted } = {}) {
    lines.forEach((t, i) =>
      this.add(
        `<text x="${x}" y="${y + i * 17}" text-anchor="${anchor}" font-family="${SERIF}" font-style="italic" font-size="13" fill="${color}">${esc(t)}</text>`,
      ),
    );
  }

  // points: [[x,y], ...]; label: text near labelAt (defaults to the middle of
  // the first segment).
  arrow(points, { label, labelAt, anchor = 'middle', accent = false, dashed = false, head = true } = {}) {
    const color = accent ? C.accent : C.ink;
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
    this.add(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.1"${dashed ? ' stroke-dasharray="4 3"' : ''}${head ? ` marker-end="url(#${accent ? 'head-accent' : 'head'})"` : ''}/>`,
    );
    if (label) {
      const [[x1, y1], [x2, y2]] = points;
      const [lx, ly] = labelAt ?? [(x1 + x2) / 2, (y1 + y2) / 2 - 6];
      this.add(
        `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="${SERIF}" font-style="italic" font-size="12.5" fill="${accent ? C.accent : C.muted}" stroke="${C.paper}" stroke-width="4" paint-order="stroke">${esc(label)}</text>`,
      );
    }
  }

  render() {
    const { width: W, height: H } = this;
    const head = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>${esc(this.title)}</title>
<defs>
  <marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9" fill="none" stroke="${C.ink}" stroke-width="1.3"/></marker>
  <marker id="head-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9" fill="none" stroke="${C.accent}" stroke-width="1.3"/></marker>
</defs>
<rect width="${W}" height="${H}" fill="${C.paper}"/>
<text x="48" y="60" font-family="${SERIF}" font-size="25" fill="${C.ink}">${esc(this.title)}</text>
<text x="48" y="86" font-family="${SERIF}" font-style="italic" font-size="14" fill="${C.muted}">${esc(this.subtitle)}</text>
<line x1="48" y1="102" x2="${W - 48}" y2="102" stroke="${C.rule}" stroke-width="0.8"/>
<line x1="48" y1="${H - 44}" x2="${W - 48}" y2="${H - 44}" stroke="${C.rule}" stroke-width="0.8"/>
<text x="48" y="${H - 22}" font-family="${SERIF}" font-style="italic" font-size="12" fill="${C.muted}">Fig. ${this.fig} — source: ${esc(this.source)}</text>
<text x="${W - 48}" y="${H - 22}" text-anchor="end" font-family="${SANS}" font-size="10" letter-spacing="2" fill="${C.muted}">OPENCAI · WORKFLOWS</text>
`;
    return `${head}${this.parts.join('\n')}\n</svg>\n`;
  }

  save() {
    writeFileSync(join(OUT_DIR, `${this.file}.svg`), this.render());
    SAVED.push(this);
  }
}

function anchors(x, y, w, h) {
  return {
    x,
    y,
    w,
    h,
    cx: x + w / 2,
    cy: y + h / 2,
    t: [x + w / 2, y],
    b: [x + w / 2, y + h],
    l: [x, y + h / 2],
    r: [x + w, y + h / 2],
  };
}

/* -------------------------------------------------------------------------- */
/* Fig. 1 — System overview                                                    */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '01-system-overview',
    width: 1280,
    height: 680,
    fig: 1,
    title: 'System overview',
    subtitle: 'What talks to what. The browser only ever talks to the backend.',
    source: 'backend/src, frontend/src, docker-compose.yml',
  });

  const user = d.box(72, 150, 166, 44, ['Operator or admin'], { kind: 'terminal' });
  const web = d.box(60, 290, 190, 96, ['Web app', 'React · Vite', 'chat, history, admin console']);
  d.arrow([user.b, web.t], { label: 'browser', labelAt: [155 + 34, 246], anchor: 'start' });
  d.note(60, 420, ['Holds only the session token;', 'never sees AWS or model keys.']);

  d.frame(320, 140, 420, 402, 'BACKEND API · NODE.JS + EXPRESS');
  const rows = [180, 270, 360, 450];
  const cols = [345, 545];
  const inner = [
    [['Auth & MFA', 'JWT · TOTP · backup codes'], ['Admin', 'orgs · workspaces · settings']],
    [['Chat sessions', 'titles · history · audit log'], ['Agent orchestrator', 'model loop · step limits']],
    [['Command policy', 'default-deny classifier'], ['Output sanitizer', 'secret redaction']],
    [['Credential vault', 'envelope encryption'], ['Sandbox manager', 'dockerode · idle sweep']],
  ];
  rows.forEach((y, r) => cols.forEach((x, c) => d.box(x, y, 180, 62, inner[r][c])));
  d.arrow([web.r, [320, web.cy]], { label: 'HTTPS', labelAt: [285, web.cy - 8] });

  d.box(850, rows[0] - 4, 200, 70, ['PostgreSQL', 'users · sessions · audit'], { kind: 'store' });
  d.box(850, rows[1], 220, 62, ['LLM provider', 'Anthropic · OpenAI · Gemini · Groq']);
  d.box(850, rows[2] - 4, 200, 70, ['MinIO / S3', 'branding assets'], { kind: 'store' });
  d.frame(830, rows[3] - 12, 260, 112, 'DOCKER ENGINE');
  const sandbox = d.box(850, rows[3] + 22, 220, 62, ['Sandbox container', 'aws-cli · non-root · read-only fs']);
  const aws = d.box(1134, rows[3] + 22, 90, 62, ['AWS', 'your account']);

  const mid = (r) => rows[r] + 31;
  d.arrow([[740, mid(0)], [850, mid(0)]], { label: 'Prisma' });
  d.arrow([[740, mid(1)], [850, mid(1)]], { label: 'tool calls' });
  d.arrow([[740, mid(2)], [850, mid(2)]], { label: 'S3 API' });
  d.arrow([[740, sandbox.cy], [830, sandbox.cy]], { label: 'create · exec', labelAt: [785, sandbox.cy - 8] });
  d.arrow([sandbox.r, aws.l], { label: 'AWS CLI', labelAt: [1102, sandbox.cy - 8] });
  d.note(830, 580, ['One container per chat session. AWS credentials are passed', 'to each command, never stored in the container.']);
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 2 — The life of a chat request                                         */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '02-chat-request',
    width: 1100,
    height: 1330,
    fig: 2,
    title: 'The life of a chat request',
    subtitle: 'From the Operator pressing Send to the answer on screen.',
    source: 'backend/src/modules/chat, backend/src/ai/orchestrator.js',
  });

  const X = 210;
  const W = 380;
  const t0 = d.box(X, 124, W, 44, ['Operator sends a message'], { kind: 'terminal' });
  const s1 = d.box(X, 204, W, 62, ['Create the session if needed', 'created lazily, on the first message; the URL gains ?session=']);
  const s2 = d.box(X, 302, W, 62, ['Check and save the message', 'refused while a command still awaits confirmation']);
  const s3 = d.box(X, 400, W, 62, ['Resolve the AI provider', 'Chat Settings: provider · model · API key']);
  const s4 = d.box(X, 498, W, 62, ['Provision the sandbox', 'reuse this chat’s container, or start a new one']);
  const s5 = d.box(X, 596, W, 78, ['Build the conversation', 'the last 40 messages; earlier commands replayed', 'as notes; reasoning is never sent back']);
  [
    [t0, s1],
    [s1, s2],
    [s2, s3],
    [s3, s4],
    [s4, s5],
  ].forEach(([a, b]) => d.arrow([a.b, b.t]));

  const e3 = d.box(680, 400, 360, 62, ['Stops: 503', 'no provider or key configured yet'], { kind: 'stop' });
  const e4 = d.box(680, 498, 360, 62, ['Stops with a message', '“The execution environment couldn’t be started.”'], { kind: 'stop' });
  d.arrow([s3.r, e3.l], { accent: true, label: 'not set', labelAt: [635, s3.cy - 8] });
  d.arrow([s4.r, e4.l], { accent: true, label: 'fails', labelAt: [635, s4.cy - 8] });

  d.frame(170, 712, 890, 346, 'AGENT LOOP · AT MOST 8 MODEL CALLS AND 2 MINUTES PER MESSAGE', { labelEnd: true });
  const l1 = d.box(X, 752, W, 78, ['Call the model', 'system prompt + tool rules · tools: run_lookup, run_command', 'its reasoning, if returned, is saved']);
  d.arrow([s5.b, l1.t]);
  const q = d.diamond(X + W / 2, 912, 230, 90, ['Answer or', 'tool call?']);
  d.arrow([l1.b, q.t]);
  const cmd = d.box(680, 881, 340, 62, ['Command decision', 'classify, then run, reject or park — Fig. 4']);
  d.arrow([q.r, cmd.l], { label: 'tool call', labelAt: [612, q.cy - 8] });
  d.arrow([cmd.t, [cmd.cx, l1.cy], l1.r], {
    dashed: true,
    label: 'result or refusal fed back',
    labelAt: [cmd.cx - 12, l1.cy - 8],
    anchor: 'end',
  });
  d.note(196, 990, ['Out of calls or time →', '“I’m having trouble', 'completing this…”']);

  const s6 = d.box(X, 1092, W, 62, ['Save the answer and context usage', 'tokens used ÷ context window → the header ring']);
  d.arrow([q.b, s6.t], { label: 'answer', labelAt: [X + W / 2 + 10, 992], anchor: 'start' });
  const park = d.box(680, 1092, 340, 62, ['Waits for the Operator', 'Confirm / Cancel card — Fig. 5']);
  d.arrow([cmd.b, park.t], { label: 'needs confirmation', labelAt: [cmd.cx + 10, 1076], anchor: 'start' });
  const t1 = d.box(X, 1192, W, 44, ['Reply shown: Thought dropdown + answer'], { kind: 'terminal' });
  d.arrow([s6.b, t1.t]);
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 3 — How the agent arrives at a command                                 */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '03-command-creation',
    width: 1180,
    height: 1000,
    fig: 3,
    title: 'How the agent arrives at a command',
    subtitle: 'There is no command catalogue or help map. The model writes the AWS CLI command itself and checks the real CLI when unsure.',
    source: 'backend/src/ai/orchestrator.js, backend/src/ai/prompts, backend/src/ai/providers',
  });

  d.frame(60, 130, 350, 400, 'SENT TO THE MODEL ON EVERY CALL');
  d.box(85, 165, 300, 62, ['Persona prompt', 'per mode or FinOps sub-mode, from the database']);
  d.box(85, 247, 300, 62, ['Tool rules', 'how to call tools, retry and use regions']);
  d.box(85, 329, 300, 84, ['Two tools', { t: 'run_lookup(command)', style: 'mono' }, { t: 'run_command(command, explanation)', style: 'mono' }]);
  d.box(85, 433, 300, 62, ['Conversation', 'the request · earlier commands and results']);
  d.note(60, 562, ['Nothing here lists the commands that exist:', 'which command to use is the model’s own knowledge.']);

  const X = 460;
  const W = 340;
  const CX = X + W / 2;
  const t0 = d.box(X, 130, W, 44, ['Operator asks in plain language'], { kind: 'terminal' });
  const m1 = d.box(X, 214, W, 62, ['Model drafts a command', 'from what it already knows of the AWS CLI']);
  d.arrow([t0.b, m1.t]);
  d.arrow([[410, m1.cy - 12], [X, m1.cy - 12]]);

  const q1 = d.diamond(CX, 346, 240, 84, ['Sure of the', 'syntax?']);
  d.arrow([m1.b, q1.t]);
  const l1 = d.box(860, 315, 270, 62, ['Look it up: run_lookup', { t: 'aws <service> <operation> help', style: 'mono' }]);
  d.arrow([q1.r, l1.l], { label: 'no', labelAt: [808, q1.cy - 8] });
  const l2 = d.box(860, 417, 270, 78, ['Help page from the real CLI', 'run in the sandbox · no web search', 'first 6,000 characters go to the model']);
  d.arrow([l1.b, l2.t]);
  d.note(860, 522, ['The lookup in detail — Fig. 3.1']);
  d.arrow([l2.r, [1155, l2.cy], [1155, m1.cy], m1.r], {
    dashed: true,
    label: 'help text fed back',
    labelAt: [975, m1.cy - 8],
  });

  const p1 = d.box(X, 440, W, 62, ['Propose it: run_command', 'the exact command + a plain-language explanation']);
  d.arrow([q1.b, p1.t], { label: 'yes', labelAt: [CX + 10, 420], anchor: 'start' });
  const p2 = d.box(X, 540, W, 62, ['Command policy', 'run, park for confirmation, or reject — Fig. 4']);
  d.arrow([p1.b, p2.t]);
  const q2 = d.diamond(CX, 690, 240, 84, ['Did it run', 'and succeed?']);
  d.arrow([p2.b, q2.t]);

  const r1 = d.box(85, 659, 300, 62, ['Error or refusal goes back', 'the model corrects the command, or looks it up'], { kind: 'stop' });
  d.arrow([q2.l, r1.r], { accent: true, label: 'no', labelAt: [448, q2.cy - 8] });
  d.arrow([r1.t, [r1.cx, 622], [435, 622], [435, m1.cy + 14], [X, m1.cy + 14]], {
    accent: true,
    dashed: true,
    label: 'try again',
    labelAt: [335, 614],
  });

  const a1 = d.box(X, 782, W, 62, ['Sanitised output goes back to the model', 'more commands if needed — at most 8 model calls']);
  d.arrow([q2.b, a1.t], { label: 'yes', labelAt: [CX + 10, 762], anchor: 'start' });
  const t1 = d.box(X, 882, W, 44, ['Model answers in plain language'], { kind: 'terminal' });
  d.arrow([a1.b, t1.t]);
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 3.1 — How a documentation lookup runs                                  */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '03-1-command-lookup',
    width: 1180,
    height: 980,
    fig: '3.1',
    title: 'How a documentation lookup runs',
    subtitle: 'run_lookup reads the AWS CLI’s own help inside the sandbox. It passes the same policy as every other command.',
    source: 'backend/src/ai/orchestrator.js, backend/src/ai/policy/commandPolicy.js',
  });

  const X = 420;
  const W = 380;
  const CX = X + W / 2;
  const t0 = d.box(X, 130, W, 44, ['The model calls run_lookup'], { kind: 'terminal' });
  const s1 = d.box(X, 210, W, 62, ['The command it sends', { t: 'aws ec2 describe-instances help', style: 'mono' }]);
  const s2 = d.box(X, 308, W, 62, ['Command policy checks it first', 'parse · no shell operators · binary on the allowlist']);
  d.arrow([t0.b, s1.t]);
  d.arrow([s1.b, s2.t]);
  const e = d.box(900, 308, 232, 62, ['Rejected', 'the reason goes back to the model'], { kind: 'stop' });
  d.arrow([s2.r, e.l], { accent: true, label: 'fails a check', labelAt: [850, s2.cy - 8] });

  const q = d.diamond(CX, 452, 240, 84, ['A help', 'request?']);
  d.arrow([s2.b, q.t]);
  d.note(770, 428, ['Counts as help:', 'aws help · aws <service> help', 'aws <service> <operation> help', 'or any command with --help']);
  const o = d.box(60, 421, 290, 62, ['Treated as an ordinary command', 'read-only runs now · mutating waits — Fig. 4'], { kind: 'outcome' });
  d.arrow([q.l, o.r], { label: 'no', labelAt: [420, q.cy - 8] });

  const s3 = d.box(X, 546, W, 62, ['Run in the session sandbox', 'help text bundled with the CLI · no confirmation needed']);
  d.arrow([q.b, s3.t], { label: 'yes', labelAt: [CX + 10, 526], anchor: 'start' });
  const s4 = d.box(X, 644, W, 62, ['Sanitise, save and audit', 'secrets redacted · chat history · audit log']);
  const s5 = d.box(X, 742, W, 78, ['Shorten for the model', 'the newest result keeps its first 6,000 characters', 'older results shrink to 1,500']);
  const t1 = d.box(X, 858, W, 44, ['Help text returned to the model — Fig. 3'], { kind: 'terminal' });
  d.arrow([s3.b, s4.t]);
  d.arrow([s4.b, s5.t]);
  d.arrow([s5.b, t1.t]);
  d.note(60, 770, ['The full help page stays in the chat history;', 'only the copy sent to the model is shortened.']);
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 4 — How a command is decided                                           */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '04-command-decision',
    width: 1180,
    height: 1480,
    fig: 4,
    title: 'How a proposed command is decided',
    subtitle: 'Every command the model proposes passes these checks, in order. Nothing unrecognised runs.',
    source: 'backend/src/ai/policy/commandPolicy.js, backend/src/ai/orchestrator.js',
  });

  const X = 290;
  const W = 360;
  const CX = X + W / 2;
  const t0 = d.box(X, 122, W, 56, ['The model proposes a command', 'tool call: command · explanation · optional regions'], {
    kind: 'terminal',
  });

  const checks = [
    { lines: ['1  Parse into arguments', 'shell-quote tokenizer'], reject: 'unparseable' },
    { lines: ['2  Shell operators?', '&&   ||   |   ;   >   <   globs'], reject: 'present' },
    { lines: ['3  Backticks or $( ) ?', 'never valid in an AWS argument'], reject: 'present' },
    { lines: ['4  Binary on the allowlist?', 'the persona’s allowed binaries — aws'], reject: 'not listed' },
    { lines: ['5  Documentation request?', '--help, or  aws … help'], yes: 'lookup' },
    { lines: ['6  aws <service> <operation> ?', 'structure check'], reject: 'missing' },
    { lines: ['7  Changes resources?', 'create-  delete-  stop-  start-  modify-  run-instances …'], yes: 'confirm' },
    { lines: ['8  Read-only operation?', 'describe-   list-   get-'], reject: 'default deny' },
  ];
  const ROW0 = 214;
  const GAP = 96;
  const H = 60;
  const boxes = checks.map((c, i) => d.box(X, ROW0 + i * GAP, W, H, c.lines));
  // The answer that lets a command continue to the next check.
  const CONTINUE_LABELS = ['parsed', 'no', 'no', 'yes', 'no', 'yes', 'no'];
  d.arrow([t0.b, boxes[0].t]);
  boxes.slice(1).forEach((b, i) =>
    d.arrow([boxes[i].b, b.t], { label: CONTINUE_LABELS[i], labelAt: [CX + 10, b.y - 14], anchor: 'start' }),
  );

  const rej = d.box(790, ROW0, 320, ROW0 + 7 * GAP + H - ROW0, [
    { t: 'Rejected', style: 'accent' },
    { t: 'never runs' },
    { t: '' },
    { t: 'the reason goes back to the model,' },
    { t: 'which tries an allowed way instead' },
    { t: '' },
    { t: 'audit: command rejected' },
  ], { kind: 'stop' });
  checks.forEach((c, i) => {
    if (!c.reject) return;
    d.arrow([boxes[i].r, [rej.x, boxes[i].cy]], { accent: true, label: c.reject, labelAt: [720, boxes[i].cy - 8] });
  });

  const lookup = d.box(40, boxes[4].y, 190, H, ['Lookup', 'documentation · runs now'], { kind: 'outcome' });
  d.arrow([boxes[4].l, lookup.r], { label: 'yes', labelAt: [260, boxes[4].cy - 8] });
  const confirm = d.box(40, boxes[6].y, 190, H, ['Needs confirmation', 'the Operator decides — Fig. 5'], { kind: 'outcome' });
  d.arrow([boxes[6].l, confirm.r], { label: 'yes', labelAt: [260, boxes[6].cy - 8] });

  const runs = d.box(X, 1010, W, 60, ['Runs now, no human in the loop', 'lookups and read-only commands']);
  d.arrow([boxes[7].b, runs.t], { label: 'yes', labelAt: [CX + 10, 990], anchor: 'start' });
  d.arrow([lookup.l, [22, lookup.cy], [22, runs.cy], runs.l]);

  const q = d.diamond(CX, 1146, 250, 84, ['regions', 'requested?']);
  d.arrow([runs.b, q.t]);
  const once = d.box(120, 1236, 320, 62, ['Run once in the sandbox', 'timeout · non-root · output sanitised']);
  const many = d.box(500, 1236, 380, 62, ['Run in each region, in parallel', '["all"] = enabled regions · at most 25 · one result']);
  d.arrow([q.l, [once.cx, q.cy], once.t], { label: 'no', labelAt: [once.cx + 10, q.cy - 8], anchor: 'start' });
  d.arrow([q.r, [many.cx, q.cy], many.t], { label: 'yes', labelAt: [many.cx + 10, q.cy - 8], anchor: 'start' });
  d.arrow([[many.cx + 150, many.y], [many.cx + 150, 1188], [rej.cx, 1188], rej.b], {
    accent: true,
    label: 'invalid regions request',
    labelAt: [rej.cx + 10, 1080],
    anchor: 'start',
  });
  const back = d.box(CX - 240, 1350, 480, 50, ['Output goes back to the model — next turn of the loop'], { kind: 'terminal' });
  d.arrow([once.b, [once.cx, 1326], [CX - 40, 1326], [CX - 40, back.y]]);
  d.arrow([many.b, [many.cx, 1326], [CX + 40, 1326], [CX + 40, back.y]]);
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 5 — Commands that change resources                                     */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '05-confirmation',
    width: 1100,
    height: 1220,
    fig: 5,
    title: 'Commands that change resources',
    subtitle: 'A mutating command never runs until the Operator confirms it — and it is checked again when they do.',
    source: 'backend/src/ai/orchestrator.js — confirmCommand, cancelCommand',
  });

  const X = 250;
  const W = 360;
  const CX = X + W / 2;
  const t0 = d.box(X, 124, W, 44, ['Mutating command proposed'], { kind: 'terminal' });
  const cap = d.diamond(CX, 244, 240, 86, ['Session limit', 'reached?']);
  d.arrow([t0.b, cap.t]);
  const capped = d.box(700, 214, 340, 60, ['Capped', 'never runs · start a new session'], { kind: 'stop' });
  d.arrow([cap.r, capped.l], { accent: true, label: 'yes', labelAt: [650, cap.cy - 8] });

  const park = d.box(X, 334, W, 62, ['Parked, awaiting confirmation', 'audit: command proposed']);
  d.arrow([cap.b, park.t], { label: 'no', labelAt: [CX + 10, 316], anchor: 'start' });
  const dry = d.diamond(CX, 474, 240, 86, ['Dry-run', 'supported?']);
  d.arrow([park.b, dry.t]);
  const preview = d.box(700, 444, 340, 60, ['Run it with --dry-run', 'the preview is shown on the card']);
  d.arrow([dry.r, preview.l], { label: 'yes', labelAt: [650, dry.cy - 8] });

  const decide = d.diamond(CX, 614, 240, 86, ['The Operator', 'decides']);
  d.arrow([dry.b, decide.t], { label: 'no', labelAt: [CX + 10, 548], anchor: 'start' });
  d.arrow([preview.b, [preview.cx, decide.cy], decide.r]);
  const cancelled = d.box(40, 584, 170, 60, ['Cancelled', 'nothing runs'], { kind: 'outcome' });
  d.arrow([decide.l, cancelled.r], { label: 'cancel', labelAt: [248, decide.cy - 8] });

  const steps = [
    ['Claim the command atomically', 'a second confirm gets 409 — already resolved'],
    ['Check it with the policy again', 'it must still need confirmation'],
    ['Take one of the session’s mutating slots', 'atomic; capped if the limit was reached meanwhile'],
    ['Execute in the sandbox', 'argument list only, never a shell string · audit: executed'],
  ];
  let prev = decide;
  const Y0 = 700;
  const made = steps.map((lines, i) => {
    const b = d.box(X, Y0 + i * 100, W, 62, lines);
    d.arrow([prev.b, b.t], i === 0 ? { label: 'confirm', labelAt: [CX + 10, Y0 - 12], anchor: 'start' } : {});
    prev = b;
    return b;
  });
  const failed = d.box(700, made[1].y, 340, 62, ['Marked failed', 'policy or mode changed since it was proposed'], { kind: 'stop' });
  d.arrow([made[1].r, failed.l], { accent: true, label: 'no longer', labelAt: [655, made[1].cy - 8] });
  const t1 = d.box(X, 1112, W, 44, ['The model continues from the result'], { kind: 'terminal' });
  d.arrow([made[3].b, t1.t]);
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 6 — Local setup                                                        */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '06-local-setup',
    width: 1180,
    height: 1140,
    fig: 6,
    title: 'Setting up OpenCAI locally',
    subtitle: 'From a fresh clone to an Operator chatting with their AWS account.',
    source: 'README.md, dev.sh, docker-compose.yml, backend/prisma/seed.js',
  });

  const X = 150;
  const W = 610;
  const items = [
    [130, 64, ['Prerequisites', 'Node.js 24+ · PostgreSQL · S3-compatible storage (MinIO) · Docker Desktop']],
    [230, 84, ['Configure the environment', { t: 'backend/.env — DATABASE_URL, S3_*, JWT_SECRET, MASTER_ENCRYPTION_KEY', style: 'mono' }, { t: 'frontend/.env — VITE_API_BASE_URL', style: 'mono' }]],
    [350, 64, ['Install dependencies', { t: 'npm install   (in backend/ and frontend/)', style: 'mono' }]],
    [450, 84, ['Prepare the database', { t: 'npx prisma migrate deploy  ·  npm run prisma:seed', style: 'mono' }, 'the seed creates the master admin and the default agent personas']],
    [570, 64, ['Build the sandbox image', { t: 'docker build -t opencai-sandbox:2.15.30 backend/sandbox', style: 'mono' }]],
    [670, 64, ['Start the app', { t: './dev.sh   →   API :5271   ·   web app :5270', style: 'mono' }]],
    [770, 64, ['First admin sign-in', 'sign in as the master admin · enrol MFA · change the default password']],
    [870, 84, ['Configure the platform', 'Chat Settings: provider, model, API key', 'Organisations: workspaces + AWS credentials · Operators: create and assign']],
  ];
  let prev;
  items.forEach(([y, h, lines], i) => {
    const b = d.box(X, y, W, h, lines);
    d.step(110, b.cy, i + 1);
    if (prev) d.arrow([prev.b, b.t]);
    prev = b;
  });
  const done = d.box(X, 990, W, 48, ['Operators sign in, pick a workspace and chat'], { kind: 'terminal' });
  d.arrow([prev.b, done.t]);

  d.frame(820, 130, 312, 462, 'OR · EVERYTHING IN DOCKER');
  const alt = [
    [168, 50, ['backend/.env + frontend/.env']],
    [236, 50, ['Build the sandbox image', { t: 'same as step 5', style: 'detail' }]],
    [304, 84, [{ t: 'docker compose up --build -d', style: 'mono' }, 'postgres · minio · backend · frontend', 'migrations run as the backend starts']],
    [416, 70, [{ t: 'docker compose exec backend', style: 'mono' }, { t: 'npm run prisma:seed', style: 'mono' }]],
    [514, 50, ['web app :8080 · API :4000']],
  ];
  let p2;
  alt.forEach(([y, h, lines]) => {
    const b = d.box(840, y, 272, h, lines);
    if (p2) d.arrow([p2.b, b.t]);
    p2 = b;
  });
  d.arrow([p2.b, [p2.cx, 802], [X + W, 802]], { label: 'continue at step 7', labelAt: [p2.cx - 10, 790], anchor: 'end' });
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 7 — Signing in                                                         */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '07-sign-in-and-mfa',
    width: 1120,
    height: 1200,
    fig: 7,
    title: 'Signing in',
    subtitle: 'Password first, then a one-time code. The session token is only issued after both.',
    source: 'backend/src/modules/auth/auth.service.js',
  });

  const X = 300;
  const W = 360;
  const CX = X + W / 2;
  const t0 = d.box(X, 124, W, 44, ['Open the sign-in page'], { kind: 'terminal' });
  const p1 = d.box(X, 204, W, 62, ['Username and password', { t: 'POST /api/auth/login', style: 'mono' }]);
  d.arrow([t0.b, p1.t]);
  const q1 = d.diamond(CX, 344, 240, 86, ['Credentials', 'valid?']);
  d.arrow([p1.b, q1.t]);
  const bad = d.box(760, 314, 300, 60, ['Invalid username or password'], { kind: 'stop' });
  d.arrow([q1.r, bad.l], { accent: true, label: 'no', labelAt: [690, q1.cy - 8] });
  const p2 = d.box(X, 434, W, 62, ['Short-lived MFA token', 'valid for 10 minutes; proves step one only']);
  d.arrow([q1.b, p2.t], { label: 'yes', labelAt: [CX + 10, 416], anchor: 'start' });
  const q2 = d.diamond(CX, 574, 240, 86, ['MFA', 'enrolled?']);
  d.arrow([p2.b, q2.t]);

  const e1 = d.box(760, 544, 300, 60, ['Enrol an authenticator', 'scan a QR code (otpauth://)']);
  const e2 = d.box(760, 644, 300, 60, ['Confirm a 6-digit code', '10 backup codes shown once']);
  d.arrow([q2.r, e1.l], { label: 'no', labelAt: [690, q2.cy - 8] });
  d.arrow([e1.b, e2.t]);

  const q3 = d.diamond(CX, 714, 240, 86, ['Authenticator', 'code valid?']);
  d.arrow([q2.b, q3.t], { label: 'yes', labelAt: [CX + 10, 648], anchor: 'start' });
  const q4 = d.diamond(145, 854, 190, 80, ['One-time backup', 'code matches?']);
  d.arrow([q3.l, [145, q3.cy], q4.t], { label: 'no', labelAt: [240, q3.cy - 8] });
  const invalid = d.box(55, 960, 180, 50, ['Invalid code'], { kind: 'stop' });
  d.arrow([q4.b, invalid.t], { accent: true, label: 'no', labelAt: [155, 944], anchor: 'start' });

  const jwt = d.box(X, 824, W, 62, ['Session token issued', 'role in the token · expires after 12 hours']);
  d.arrow([q3.b, jwt.t], { label: 'yes', labelAt: [CX + 10, 790], anchor: 'start' });
  d.arrow([q4.r, jwt.l], { label: 'yes', labelAt: [270, q4.cy - 8] });
  d.arrow([e2.b, [e2.cx, jwt.cy], jwt.r]);

  const p3 = d.box(X, 924, W, 50, ['Kept in the browser, sent as a Bearer token']);
  d.arrow([jwt.b, p3.t]);
  const admin = d.box(X - 10, 1060, 170, 44, ['Admin console'], { kind: 'terminal' });
  const oper = d.box(X + W - 160, 1060, 170, 44, ['Operator console'], { kind: 'terminal' });
  d.arrow([[CX - 30, p3.y + p3.h], [CX - 30, 1024], [admin.cx, 1024], admin.t], { label: 'ADMIN', labelAt: [admin.cx - 10, 1016], anchor: 'end' });
  d.arrow([[CX + 30, p3.y + p3.h], [CX + 30, 1024], [oper.cx, 1024], oper.t], { label: 'OPERATOR', labelAt: [oper.cx + 10, 1016], anchor: 'start' });
  d.save();
}

/* -------------------------------------------------------------------------- */
/* Fig. 8 — Releasing                                                          */
/* -------------------------------------------------------------------------- */
{
  const d = new Diagram({
    file: '08-release',
    width: 1180,
    height: 820,
    fig: 8,
    title: 'Releasing a version',
    subtitle: 'Work lands on dev; merging into release publishes a version and its images.',
    source: '.github/workflows/ci.yml, .github/workflows/release.yml, .releaserc.json',
  });

  const L = 90;
  const LW = 360;
  const a1 = d.box(L, 164, LW, 62, ['Work on dev', 'conventional commits — feat:, fix:, feat!:']);
  const a2 = d.box(L, 274, LW, 84, ['CI on every push and pull request', { t: 'backend:  lint · prisma validate · test', style: 'mono' }, { t: 'frontend: lint · build', style: 'mono' }]);
  const a3 = d.box(L, 406, LW, 62, ['Pull request: dev → release', 'release is protected by a ruleset']);
  d.arrow([a1.b, a2.t]);
  d.arrow([a2.b, a3.t]);
  d.frame(L - 30, 122, LW + 60, 372, 'BRANCH  DEV');

  const R = 640;
  const RW = 440;
  const RX = R + RW / 2;
  const b1 = d.box(R, 164, RW, 50, ['Merge triggers release.yml']);
  d.arrow([a3.r, [560, a3.cy], [560, b1.cy], b1.l], { label: 'merge', labelAt: [505, a3.cy - 8] });
  const q = d.diamond(RX, 284, 250, 84, ['A new version', 'since the last tag?']);
  d.arrow([b1.b, q.t]);
  const none = d.box(R + RW - 150, 384, 150, 44, ['Nothing published'], { kind: 'outcome' });
  d.arrow([q.r, [none.cx, q.cy], none.t], { label: 'no', labelAt: [none.cx + 10, q.cy - 8], anchor: 'start' });
  const b2 = d.box(R, 454, RW - 180, 96, ['semantic-release', 'bumps both package.json files', 'writes CHANGELOG.md · commits to release', 'tags vX.Y.Z · GitHub Release']);
  d.arrow([q.b, [q.cx, 404], [b2.cx, 404], b2.t], { label: 'yes', labelAt: [b2.cx + 10, 428], anchor: 'start' });
  const b3 = d.box(R, 590, RW, 84, ['Build and push images to GitHub Container Registry', { t: 'ghcr.io/<owner>/opencai-backend:X.Y.Z, :latest', style: 'mono' }, { t: 'ghcr.io/<owner>/opencai-frontend:X.Y.Z, :latest', style: 'mono' }]);
  d.arrow([b2.b, [b2.cx, 570], [b3.cx, 570], b3.t]);
  d.frame(R - 30, 122, RW + 60, 580, 'BRANCH  RELEASE');
  const t = d.box(L, b3.cy - 22, LW, 44, ['Pull a released image and run it'], { kind: 'terminal' });
  d.arrow([b3.l, t.r], { dashed: true, label: 'published', labelAt: [540, b3.cy - 8] });
  d.save();
}

/* -------------------------------------------------------------------------- */
/* PNG pass                                                                    */
/* -------------------------------------------------------------------------- */
function findChrome() {
  const candidates = [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((c) => c && existsSync(c));
}

{
  const chrome = findChrome();
  if (!chrome) {
    console.warn('No Chrome found (set CHROME): left the SVGs in place, no PNGs written.');
  } else {
    // Its own profile, so it never hands the job to a browser that is already open.
    const profile = mkdtempSync(join(tmpdir(), 'opencai-workflows-'));
    for (const d of SAVED) {
      const svg = join(OUT_DIR, `${d.file}.svg`);
      const png = join(OUT_DIR, `${d.file}.png`);
      const run = spawnSync(chrome, [
        '--headless=new',
        '--hide-scrollbars',
        '--disable-gpu',
        '--force-device-scale-factor=2',
        `--user-data-dir=${profile}`,
        `--window-size=${d.width},${d.height}`,
        `--screenshot=${png}`,
        pathToFileURL(svg).href,
      ]);
      if (run.status !== 0 || !existsSync(png)) {
        console.warn(`could not render ${d.file}.png; kept ${d.file}.svg`);
        continue;
      }
      unlinkSync(svg);
      console.log(`wrote ${d.file}.png`);
    }
    rmSync(profile, { recursive: true, force: true });
  }
}
