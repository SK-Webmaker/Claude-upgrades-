import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

/** Ships the committed market-research snapshot into a fresh store. */
function loadResearchSeed() {
  try {
    const seed = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'research-seed.json');
    return JSON.parse(readFileSync(seed, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Flat JSON store on disk. Render gives the service a persistent disk mounted at
 * DATA_DIR, so the queue survives restarts and deploys.
 */
export class Store {
  constructor(dataDir = process.env.DATA_DIR || join(process.cwd(), 'src', 'data')) {
    this.dataDir = dataDir;
    this.file = join(dataDir, 'state.json');
    mkdirSync(dataDir, { recursive: true });
    if (!existsSync(this.file)) {
      this._write({ posts: [], insights: [], research: loadResearchSeed(), briefs: [] });
    }
  }

  _read() {
    return JSON.parse(readFileSync(this.file, 'utf8'));
  }

  // Write to a temp file then rename, so a crash mid-write can't truncate state.
  _write(state) {
    const tmp = `${this.file}.tmp`;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, this.file);
  }

  update(fn) {
    const state = this._read();
    const next = fn(state) ?? state;
    this._write(next);
    return next;
  }

  get state() {
    return this._read();
  }

  posts(filter = () => true) {
    return this._read().posts.filter(filter);
  }

  getPost(id) {
    return this._read().posts.find((p) => p.id === id) ?? null;
  }

  addPost(post) {
    const withId = { id: randomUUID(), createdAt: new Date().toISOString(), ...post };
    this.update((s) => {
      s.posts.push(withId);
      return s;
    });
    return withId;
  }

  patchPost(id, patch) {
    let updated = null;
    this.update((s) => {
      const post = s.posts.find((p) => p.id === id);
      if (!post) return s;
      Object.assign(post, patch);
      updated = post;
      return s;
    });
    return updated;
  }

  saveResearch(research) {
    this.update((s) => {
      s.research = { ...research, fetchedAt: new Date().toISOString() };
      return s;
    });
  }

  saveBrief(brief) {
    this.update((s) => {
      s.briefs.unshift({ ...brief, createdAt: new Date().toISOString() });
      s.briefs = s.briefs.slice(0, 26);
      return s;
    });
  }

  saveInsights(insights) {
    this.update((s) => {
      s.insights = insights;
      return s;
    });
  }
}

export const POST_STATUS = Object.freeze({
  DRAFTED: 'drafted',
  BLOCKED: 'blocked',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  FAILED: 'failed',
});
