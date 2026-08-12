import { brand, system } from '../lib/config.js';
import * as store from '../lib/store.js';
import { makeLogger } from '../lib/log.js';

const log = makeLogger('chat');

/**
 * The chat surface.
 *
 * Sha and Kai talk to the system here instead of opening a terminal. Two modes,
 * and which one is live depends on whether an Anthropic key is configured:
 *
 *   - assistant mode — Claude answers in plain language and can run the same
 *     stages the buttons run, via tool calls
 *   - command mode   — the deterministic allowlist (.start, .review, ...)
 *
 * Command mode is always available and is the fallback, so the box is never
 * dead. Everything that touches publishing goes through the same approval gate
 * either way: the assistant can plan, review and brief, but it cannot publish.
 */

const API = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.CHAT_MODEL || 'claude-sonnet-5';

export function isAssistantConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * What the assistant is allowed to do.
 *
 * Deliberately excludes publishing. `ship` is absent by design — a chat message
 * must never be able to put something on her account. Approval stays a tap on
 * the queue.
 */
export function buildTools(commands) {
  return [
    {
      name: 'run_command',
      description:
        'Run one of the engine commands. These are the same actions as the dashboard buttons. Publishing is not available here.',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            enum: Object.keys(commands),
            description: 'Which command to run.',
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'read_state',
      description:
        "Read part of the engine's current state: this week's plan, the posts queue, the last account review, the weekly targets, or the footage inventory.",
      input_schema: {
        type: 'object',
        properties: {
          what: {
            type: 'string',
            enum: ['plan', 'posts', 'review', 'weeks', 'footage', 'trends'],
          },
        },
        required: ['what'],
      },
    },
  ];
}

/** A compact picture of where things stand, for the system prompt. */
export function situation() {
  const posts = store.read('posts', []);
  const plan = store.read('plan', { slots: [] });
  const review = store.read('review', null);
  const weeks = store.read('weeks', []);

  return {
    business: `${brand.business.name}, ${brand.business.suburb} ${brand.business.region}`,
    operator: brand.business.operator,
    instagram: `@${brand.business.instagram}`,
    cadence: system.cadence.postsPerWeek,
    waiting: posts.filter((p) => p.status === 'awaiting_approval').length,
    approved: posts.filter((p) => p.status === 'approved').length,
    published: posts.filter((p) => p.publishedAt).length,
    slotsPlanned: (plan.slots || []).length,
    slotsNeedingFootage: (plan.slots || []).filter((s) => !s.clipIds?.length).length,
    lastGrade: review?.summary?.grade ?? null,
    lastEngagement: review?.summary?.averageEngagement ?? null,
    weekTarget: weeks[0]?.targets ?? null,
  };
}

export function systemPrompt() {
  const s = situation();
  return `You are the marketing engine for ${s.business}, run by ${s.operator}. You are speaking to her or to Kai, who manages the system.

You are not a general chatbot. You run a specific content pipeline and you talk about that.

Where things stand right now:
- Instagram ${s.instagram}, posting ${s.cadence} times a week
- ${s.waiting} post(s) waiting for approval, ${s.approved} approved, ${s.published} published
- ${s.slotsPlanned} slot(s) planned this week, ${s.slotsNeedingFootage} still need footage
- Last account grade: ${s.lastGrade ?? 'not reviewed yet'}${s.lastEngagement ? ` at ${s.lastEngagement}% engagement` : ''}

How to behave:
- Be brief and concrete. She reads this between clients.
- Use the tools to check real state rather than guessing. Never invent a number — if you have not read it, say you have not read it.
- You cannot publish. Approval is a tap on the queue and that is deliberate; say so if asked.
- Her brand voice is understated and expert. Do not write hype, and do not use words on her avoid list: ${brand.voice.avoid.slice(0, 8).join(', ')}.
- If someone asks for something the engine does not do, say so plainly instead of pretending.`;
}

/** Executes a tool call and returns a string result for the model. */
async function runTool(name, input, commands) {
  if (name === 'run_command') {
    const command = commands[input.command];
    if (!command) return `No such command: ${input.command}`;
    const result = await command.run();
    return command.done(result);
  }

  if (name === 'read_state') {
    const map = {
      plan: () => store.read('plan', { slots: [] }),
      posts: () =>
        store.read('posts', []).map((p) => ({
          id: p.id,
          status: p.status,
          type: p.type,
          formatName: p.formatName,
          hook: p.caption?.hook,
        })),
      review: () => store.read('review', null),
      weeks: () => store.read('weeks', []).slice(0, 2),
      footage: () => store.read('footage', []).map((f) => ({ id: f.id, tags: f.tags, durationSec: f.durationSec })),
      trends: () => store.read('trends', null),
    };
    const read = map[input.what];
    if (!read) return `Cannot read "${input.what}".`;
    return JSON.stringify(read(), null, 1).slice(0, 6000);
  }

  return `Unknown tool: ${name}`;
}

async function callClaude(messages, tools) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(),
      tools,
      messages,
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = payload?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return payload;
}

/**
 * Handles one turn. Runs the tool loop until the model stops asking for tools,
 * capped so a confused model cannot spin.
 */
export async function respond({ history = [], message, commands }) {
  const tools = buildTools(commands);
  const messages = [...history, { role: 'user', content: message }];
  const ran = [];

  for (let hop = 0; hop < 5; hop += 1) {
    const reply = await callClaude(messages, tools);
    messages.push({ role: 'assistant', content: reply.content });

    const toolUses = reply.content.filter((c) => c.type === 'tool_use');
    if (!toolUses.length) {
      const text = reply.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
        .trim();
      return { reply: text || '(no reply)', ran, history: messages };
    }

    const results = [];
    for (const use of toolUses) {
      let content;
      try {
        content = await runTool(use.name, use.input, commands);
        ran.push(use.input.command ?? use.input.what ?? use.name);
      } catch (err) {
        content = `That failed: ${err.message}`;
      }
      results.push({ type: 'tool_result', tool_use_id: use.id, content: String(content) });
    }
    messages.push({ role: 'user', content: results });
  }

  return {
    reply: 'I got stuck working that out. Try one of the commands directly.',
    ran,
    history: messages,
  };
}

/**
 * Entry point used by the server. Falls back to the command allowlist when no
 * Anthropic key is set, so the box always does something useful.
 */
export async function handle({ history = [], message, commands }) {
  const raw = String(message ?? '').trim();
  if (!raw) return { mode: 'command', reply: 'Say something, or type .start to begin the week.' };

  // A leading dot is always a direct command, key or no key — it is faster and
  // it cannot be misread by a model.
  if (raw.startsWith('.')) {
    const name = raw.slice(1).toLowerCase().split(/\s/)[0];
    const command = commands[name];
    if (!command) {
      return {
        mode: 'command',
        reply: `I do not know "${raw}". Try: ${Object.keys(commands).map((c) => `.${c}`).join(', ')}`,
      };
    }
    const result = await command.run();
    return { mode: 'command', reply: command.done(result), ran: [name], result };
  }

  if (!isAssistantConfigured()) {
    return {
      mode: 'command',
      reply: `Chat needs an ANTHROPIC_API_KEY on this service. Until then use the commands: ${Object.keys(commands)
        .map((c) => `.${c}`)
        .join(', ')}`,
    };
  }

  try {
    const out = await respond({ history, message: raw, commands });
    return { mode: 'assistant', ...out };
  } catch (err) {
    log.warn(`assistant failed: ${err.message}`);
    return {
      mode: 'command',
      reply: `The assistant is not reachable (${err.message}). The commands still work: ${Object.keys(commands)
        .map((c) => `.${c}`)
        .join(', ')}`,
    };
  }
}

export default { handle, respond, situation, systemPrompt, buildTools, isAssistantConfigured };
