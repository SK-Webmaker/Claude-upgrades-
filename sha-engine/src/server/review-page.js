/**
 * Sha's review page. Mobile-first — she'll open this on her phone between
 * clients, so the approve button is thumb-sized and the media plays inline.
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtSlot = (iso) => {
  if (!iso) return 'No scheduled time';
  const d = new Date(iso);
  return d.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Melbourne',
  });
};

function renderMedia(post) {
  const item = post.media?.[0];
  if (!item?.url) return '<div class="media placeholder">No media</div>';
  return item.kind === 'video'
    ? `<video class="media" controls playsinline preload="metadata" src="${esc(item.url)}"></video>`
    : `<img class="media" alt="${esc(post.altText ?? '')}" src="${esc(item.url)}">`;
}

function renderCaptionBlock(caption) {
  const tags = (caption.hashtags ?? []).map((t) => `#${String(t).replace(/^#/, '')}`).join(' ');
  return `
    <div class="caption">
      <p>${esc(caption.body).replace(/\n/g, '<br>')}</p>
      <p class="cta">${esc(caption.cta)}</p>
      <p class="tags">${esc(tags)}</p>
    </div>`;
}

function renderPost(post, token) {
  const blocked = post.status === 'blocked';
  const approved = post.status === 'approved';
  const warnings = (post.gate?.violations ?? []).filter((v) => v.severity === 'warn');
  const blocking = (post.gate?.violations ?? []).filter((v) => v.severity === 'block');

  const actions = approved
    ? `<p class="approved">✓ Approved — publishing ${fmtSlot(post.slot)}</p>`
    : blocked
      ? `<p class="blocked-note">Held back — needs a fix before it can go out.</p>`
      : `
      <form method="post" action="/review/${esc(post.id)}/approve" class="actions">
        <input type="hidden" name="t" value="${esc(token)}">
        <button class="approve" type="submit">Approve &amp; schedule</button>
      </form>
      <form method="post" action="/review/${esc(post.id)}/reject" class="actions">
        <input type="hidden" name="t" value="${esc(token)}">
        <button class="reject" type="submit">Skip this one</button>
      </form>`;

  return `
  <article class="post ${blocked ? 'is-blocked' : ''}">
    <header>
      <span class="format">${esc(post.formatLabel ?? post.format ?? 'Post')}</span>
      <span class="slot">${esc(fmtSlot(post.slot))}</span>
    </header>
    ${renderMedia(post)}
    ${renderCaptionBlock(post.caption ?? {})}
    ${
      blocking.length
        ? `<ul class="violations">${blocking
            .map((v) => `<li><strong>${esc(v.rule)}</strong> ${esc(v.message)}</li>`)
            .join('')}</ul>`
        : ''
    }
    ${
      warnings.length
        ? `<ul class="warnings">${warnings.map((v) => `<li>${esc(v.message)}</li>`).join('')}</ul>`
        : ''
    }
    <a class="copy" href="/review/${esc(post.id)}/caption.txt?t=${encodeURIComponent(token)}">
      Caption only — for TikTok &amp; Facebook
    </a>
    ${actions}
  </article>`;
}

function renderBrief(brief) {
  if (!brief) return '';
  const rows = brief.shootList
    .map(
      (s) => `
      <li class="${s.status === 'NEEDS FILMING' ? 'todo' : 'done'}">
        <strong>${esc(s.label)}</strong> — ${esc(fmtSlot(s.slot))}
        <span class="badge">${esc(s.status)}</span>
        <p class="hook">“${esc(s.hook)}”</p>
        <ol>${s.shotList.map((shot) => `<li>${esc(shot)}</li>`).join('')}</ol>
        ${s.spec ? `<p class="spec">${esc(s.spec)}</p>` : ''}
        ${s.consent ? `<p class="consent">${esc(s.consent)}</p>` : ''}
      </li>`,
    )
    .join('');
  return `
  <section class="brief">
    <h2>This week's shoot brief</h2>
    <p class="sub">${brief.needsFilming} of ${brief.shootList.length} still to film</p>
    <ul>${rows}</ul>
  </section>`;
}

export function renderReviewPage({ posts, published = [], brief = null, token }) {
  const waiting = posts.filter((p) => p.status === 'awaiting_approval').length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hair by Sha — post review</title>
<style>
  :root {
    --bg: #faf8f6; --card: #fff; --ink: #1c1917; --muted: #78716c;
    --line: #e7e2dd; --accent: #8b6f5c; --ok: #2f6f4f; --bad: #b4472f;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#17140f; --card:#221e19; --ink:#f5f1ec; --muted:#a8a29e;
            --line:#332d26; --accent:#c9a88f; --ok:#6fbf95; --bad:#e0806a; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  .wrap { max-width: 620px; margin: 0 auto; padding: 20px 16px 64px; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; letter-spacing:-0.01em; }
  .sub { color: var(--muted); margin: 0 0 24px; font-size: 0.9rem; }
  .post { background: var(--card); border:1px solid var(--line); border-radius: 14px;
          margin-bottom: 20px; overflow: hidden; }
  .post.is-blocked { border-color: var(--bad); }
  .post header { display:flex; justify-content:space-between; gap:12px; align-items:baseline;
                 padding: 14px 16px; border-bottom:1px solid var(--line); }
  .format { font-weight:600; font-size:0.95rem; }
  .slot { color: var(--muted); font-size:0.82rem; white-space:nowrap; }
  .media { display:block; width:100%; max-height: 520px; object-fit: cover; background:#000; }
  .media.placeholder { display:grid; place-items:center; height:180px; color:var(--muted);
                       background:var(--bg); }
  .caption { padding: 14px 16px; }
  .caption p { margin: 0 0 10px; }
  .cta { color: var(--accent); font-weight:500; }
  .tags { color: var(--muted); font-size:0.85rem; word-break: break-word; }
  .violations, .warnings { margin: 0; padding: 12px 16px 12px 34px; font-size:0.87rem; }
  .violations { color: var(--bad); background: color-mix(in srgb, var(--bad) 8%, transparent); }
  .warnings { color: var(--muted); }
  .copy { display:block; padding: 10px 16px; font-size:0.85rem; color:var(--accent);
          text-decoration:none; border-top:1px solid var(--line); }
  .actions { margin:0; padding: 0 16px 12px; }
  .actions:first-of-type { padding-top: 12px; }
  button { width:100%; padding: 15px; border-radius: 10px; border:0; font-size:1rem;
           font-weight:600; cursor:pointer; font-family:inherit; }
  .approve { background: var(--ok); color:#fff; }
  .reject { background: transparent; color: var(--muted); border:1px solid var(--line); }
  .approved { margin:0; padding: 14px 16px; color: var(--ok); font-weight:600; }
  .blocked-note { margin:0; padding: 14px 16px; color: var(--bad); font-weight:500; }
  .brief { background:var(--card); border:1px solid var(--line); border-radius:14px;
           padding:16px; margin-bottom:24px; }
  .brief h2 { font-size:1.05rem; margin:0 0 2px; }
  .brief ul { list-style:none; padding:0; margin:12px 0 0; }
  .brief > ul > li { border-top:1px solid var(--line); padding:12px 0; }
  .badge { font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em;
           padding:2px 7px; border-radius:20px; background:var(--line); color:var(--muted); }
  li.todo .badge { background: var(--accent); color:#fff; }
  .hook { font-style:italic; color:var(--muted); margin:6px 0; }
  .spec, .consent { font-size:0.82rem; color:var(--muted); margin:6px 0 0; }
  .consent { color: var(--accent); }
  .brief ol { margin:6px 0 0; padding-left:20px; color:var(--muted); font-size:0.87rem; }
  .empty { text-align:center; color:var(--muted); padding:40px 0; }
  .published { font-size:0.85rem; color:var(--muted); }
  .published a { color: var(--accent); }
</style>
</head>
<body>
<div class="wrap">
  <h1>Hair by Sha</h1>
  <p class="sub">${waiting} post${waiting === 1 ? '' : 's'} waiting for you</p>

  ${renderBrief(brief)}

  ${
    posts.length
      ? posts.map((p) => renderPost(p, token)).join('')
      : '<p class="empty">Nothing waiting. Next batch lands with the weekly run.</p>'
  }

  ${
    published.length
      ? `<section class="published"><h2>Recently published</h2><ul>${published
          .map(
            (p) =>
              `<li>${esc(p.formatLabel ?? p.format)} — ${
                p.publish?.permalink
                  ? `<a href="${esc(p.publish.permalink)}">view</a>`
                  : 'published'
              }</li>`,
          )
          .join('')}</ul></section>`
      : ''
  }
</div>
</body>
</html>`;
}
