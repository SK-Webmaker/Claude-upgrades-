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

function renderGoals(week, lastScorecard) {
  if (!week) return '';
  const t = week.targets ?? {};
  const rows = [
    ['Followers', t.followers],
    ['Posts out', t.posts],
    ['Saves', t.saves],
    ['Shares', t.shares],
  ]
    .filter(([, v]) => v != null)
    .map(([label, v]) => `<li><span class="num">${esc(v)}</span><span class="lbl">${esc(label)}</span></li>`)
    .join('');

  const last = lastScorecard
    ? `<div class="scorecard">
         <h3>Last week — ${esc(lastScorecard.verdict)}</h3>
         <ul class="adjustments">
           ${lastScorecard.adjustments.map((a) => `<li>${esc(a.say)}</li>`).join('')}
         </ul>
       </div>`
    : '<p class="muted-note">First week — no scorecard yet. Next week gets one.</p>';

  return `
  <section class="goals">
    <h2>This week's target</h2>
    <p class="sub">Projection, not a measurement. Scored at the end of the week.</p>
    ${
      t.baselineKnown === false
        ? `<p class="muted-note">${esc(t.unavailable ?? 'No account metrics available this cycle.')}</p>`
        : ''
    }
    <ul class="targets">${rows}</ul>
    ${last}
  </section>`;
}

function renderPlaybook(pb) {
  const shots = pb.shots
    .map(
      (s) =>
        `<li><b>${s.seconds}s</b> — ${esc(s.direction)} <em>${esc(s.role)}</em></li>`,
    )
    .join('');
  const study = pb.study.accounts
    .map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">@${esc(a.handle)}</a> — ${esc(a.why)}</li>`)
    .join('');
  const browse = pb.study.browse
    .map(
      (b) =>
        `<li>#${esc(b.tag)} — <a href="${esc(b.instagram)}" target="_blank" rel="noopener">Instagram</a> · <a href="${esc(b.tiktok)}" target="_blank" rel="noopener">TikTok</a></li>`,
    )
    .join('');

  return `
  <details class="playbook">
    <summary>How to shoot this — ${esc(pb.label)}</summary>
    <p class="hook-line">Say / show first: <b>“${esc(pb.hook.say)}”</b></p>
    <p class="muted-note">${esc(pb.hook.rule)}</p>
    <h4>Shots — target ${esc(pb.runtime.targetSeconds)}s</h4>
    <ol class="shots">${shots}</ol>
    <h4>Filming</h4>
    <ul>
      <li>${esc(pb.framing.orientation)}</li>
      <li>${esc(pb.framing.light)}</li>
      <li>${esc(pb.framing.stability)}</li>
    </ul>
    <h4>Audio — ${esc(pb.audio.type)}</h4>
    <p>${esc(pb.audio.how)}</p>
    <p class="muted-note">${esc(pb.audio.note)}</p>
    <h4>After you post</h4>
    <ul>${pb.afterPosting.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    <h4>Watch first</h4>
    <ul>${study}</ul>
    <ul>${browse}</ul>
    <p class="muted-note">${esc(pb.study.how)}</p>
    ${pb.consent ? `<p class="consent">${esc(pb.consent)}</p>` : ''}
  </details>`;
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
        ${
          (brief.playbooks ?? []).find((p) => p.format === s.format)
            ? renderPlaybook(brief.playbooks.find((p) => p.format === s.format))
            : ''
        }
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

export function renderReviewPage({ posts, published = [], brief = null, goals = null, token }) {
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
  .spec, .consent, .muted-note { font-size:0.82rem; color:var(--muted); margin:6px 0 0; }
  .consent { color: var(--accent); }
  .goals { background:var(--card); border:1px solid var(--line); border-radius:14px;
           padding:16px; margin-bottom:20px; }
  .goals h2 { font-size:1.05rem; margin:0 0 2px; }
  .targets { display:flex; gap:10px; list-style:none; padding:0; margin:14px 0 0; flex-wrap:wrap; }
  .targets li { flex:1 1 68px; text-align:center; background:var(--bg); border-radius:10px;
                padding:10px 6px; }
  .targets .num { display:block; font-size:1.35rem; font-weight:600; }
  .targets .lbl { font-size:0.72rem; color:var(--muted); }
  .scorecard { margin-top:16px; border-top:1px solid var(--line); padding-top:12px; }
  .scorecard h3 { font-size:0.9rem; margin:0 0 6px; text-transform:capitalize; }
  .adjustments { margin:0; padding-left:18px; font-size:0.88rem; color:var(--muted); }
  .adjustments li { margin-bottom:6px; }
  .playbook { margin-top:10px; border-top:1px solid var(--line); padding-top:10px; }
  .playbook summary { cursor:pointer; font-weight:600; font-size:0.88rem; color:var(--accent); }
  .playbook h4 { font-size:0.82rem; text-transform:uppercase; letter-spacing:0.04em;
                 color:var(--muted); margin:14px 0 4px; }
  .playbook ul, .playbook ol { margin:0; padding-left:18px; font-size:0.87rem; }
  .playbook li { margin-bottom:4px; }
  .playbook a { color:var(--accent); }
  .hook-line { margin:10px 0 0; font-size:0.92rem; }
  .shots em { color:var(--muted); font-style:normal; font-size:0.8rem; }
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

  ${renderGoals(goals?.week, goals?.lastScorecard)}
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
