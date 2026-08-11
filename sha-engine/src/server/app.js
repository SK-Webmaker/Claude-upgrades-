import express from 'express';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { Store, POST_STATUS } from '../lib/store.js';
import { approvePost, rejectPost } from '../stages/ship.js';
import { renderReviewPage } from './review-page.js';

const app = express();
const store = new Store();
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'src', 'data', 'uploads');
const REVIEW_TOKEN = process.env.REVIEW_TOKEN;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/**
 * Public media. Instagram fetches these URLs server-side, so this route must stay
 * unauthenticated — Meta has no credentials. Only the uploads directory is
 * exposed, and express.static resolves paths safely.
 */
app.use(
  '/media',
  express.static(UPLOADS_DIR, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600'),
    dotfiles: 'deny',
    index: false,
  }),
);

app.get('/healthz', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

/** Everything below is Sha's private review surface. */
function requireToken(req, res, next) {
  if (!REVIEW_TOKEN) {
    return res
      .status(503)
      .send('REVIEW_TOKEN is not configured — the review page is disabled until it is set.');
  }
  const supplied = req.query.t ?? req.body?.t ?? '';
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(REVIEW_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).send('Not authorised.');
  }
  return next();
}

app.get('/review', requireToken, (req, res) => {
  const posts = store
    .posts((p) =>
      [POST_STATUS.AWAITING_APPROVAL, POST_STATUS.APPROVED, POST_STATUS.BLOCKED].includes(p.status),
    )
    .sort((a, b) => new Date(a.slot ?? a.createdAt) - new Date(b.slot ?? b.createdAt));

  const published = store
    .posts((p) => p.status === POST_STATUS.PUBLISHED)
    .sort((a, b) => new Date(b.publish?.publishedAt ?? 0) - new Date(a.publish?.publishedAt ?? 0))
    .slice(0, 5);

  const { briefs } = store.state;
  res.type('html').send(
    renderReviewPage({ posts, published, brief: briefs?.[0] ?? null, token: req.query.t }),
  );
});

app.post('/review/:id/approve', requireToken, (req, res) => {
  try {
    approvePost(store, req.params.id, { by: 'sha' });
    res.redirect(`/review?t=${encodeURIComponent(req.body.t ?? req.query.t)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

app.post('/review/:id/reject', requireToken, (req, res) => {
  try {
    rejectPost(store, req.params.id, { reason: req.body.reason ?? null });
    res.redirect(`/review?t=${encodeURIComponent(req.body.t ?? req.query.t)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

/** Caption text on its own, for manual cross-posting to TikTok and Facebook. */
app.get('/review/:id/caption.txt', requireToken, (req, res) => {
  const post = store.getPost(req.params.id);
  if (!post) return res.status(404).send('Not found');
  const tags = (post.caption.hashtags ?? []).map((t) => `#${t.replace(/^#/, '')}`).join(' ');
  return res.type('text/plain').send([post.caption.body, post.caption.cta, tags].join('\n\n'));
});

const port = process.env.PORT || 10000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`sha-engine listening on ${port}`);
    if (!REVIEW_TOKEN) console.warn('REVIEW_TOKEN unset — /review will refuse requests');
    if (!process.env.PUBLIC_BASE_URL) console.warn('PUBLIC_BASE_URL unset — media URLs will fail');
  });
}

export { app, store };
