/**
 * Instagram publishing through Composio's OAuth connection.
 *
 * Replaces the old raw Graph API access token path. Sha's account is connected
 * through Composio (OAuth), so we never hold a Meta token ourselves — Composio
 * executes the Graph call on the connection's behalf.
 *
 * What Composio actually exposes, and what it does not:
 *
 *   INSTAGRAM_POST_IG_USER_MEDIA          -> creates a media *container*
 *   INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH  -> publishes that container
 *
 * A container is NOT an Instagram draft. It is an invisible server-side staging
 * handle: it never appears in the Instagram app, Sha cannot see or tap it, and it
 * expires after roughly 24 hours. Meta's API has no save-to-drafts endpoint at
 * all — drafts are in-app only. That is why approval happens on our own review
 * page before we ever create a container, rather than "in her drafts".
 *
 * Platform limits still apply regardless of which tool wraps the call:
 *   - the account must be Business or Creator (verified via getAccountInfo)
 *   - media must be a publicly fetchable HTTPS URL returning real media bytes
 *   - publishing is capped per rolling 24h window (read live, not assumed)
 */

const COMPOSIO_BASE = process.env.COMPOSIO_BASE_URL || 'https://backend.composio.dev';

export class ComposioError extends Error {
  constructor(message, { toolSlug, payload, status } = {}) {
    super(message);
    this.name = 'ComposioError';
    this.toolSlug = toolSlug;
    this.payload = payload;
    this.status = status;
  }
}

export class InstagramComposio {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey            Composio project API key
   * @param {string} [opts.connectedAccountId] e.g. "instagram_bogle-kanred"
   * @param {string} [opts.userId]          Composio user scope, when multi-user
   * @param {string} [opts.igUserId]        "me" resolves the authenticated account
   * @param {Function} [opts.fetchImpl]     injected for tests
   */
  constructor({
    apiKey = process.env.COMPOSIO_API_KEY,
    connectedAccountId = process.env.COMPOSIO_CONNECTED_ACCOUNT_ID,
    userId = process.env.COMPOSIO_USER_ID,
    igUserId = process.env.IG_USER_ID || 'me',
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (!apiKey) throw new Error('COMPOSIO_API_KEY is required to publish to Instagram');
    this.apiKey = apiKey;
    this.connectedAccountId = connectedAccountId;
    this.userId = userId;
    this.igUserId = igUserId;
    this.fetch = fetchImpl;
  }

  /** POST /api/v3/tools/execute/{tool_slug} */
  async execute(toolSlug, args) {
    const body = { arguments: args };
    if (this.connectedAccountId) body.connected_account_id = this.connectedAccountId;
    if (this.userId) body.user_id = this.userId;

    const res = await this.fetch(`${COMPOSIO_BASE}/api/v3/tools/execute/${toolSlug}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify(body),
    });

    let payload;
    try {
      payload = await res.json();
    } catch {
      throw new ComposioError(`${toolSlug}: non-JSON response (HTTP ${res.status})`, {
        toolSlug,
        status: res.status,
      });
    }

    if (!res.ok || payload.successful === false || payload.error) {
      const detail =
        payload?.error?.message ?? payload?.error ?? `HTTP ${res.status}`;
      throw new ComposioError(`${toolSlug}: ${detail}`, {
        toolSlug,
        payload,
        status: res.status,
      });
    }
    return payload.data;
  }

  async getAccountInfo() {
    const data = await this.execute('INSTAGRAM_GET_USER_INFO', { ig_user_id: this.igUserId });
    return {
      id: data.id,
      username: data.username,
      name: data.name,
      accountType: data.account_type,
      followers: data.followers_count,
      mediaCount: data.media_count,
      canPublish: data.account_type === 'BUSINESS' || data.account_type === 'CREATOR',
    };
  }

  /** Live quota read. Never assume the cap — it varies per account. */
  async getPublishingQuota() {
    const data = await this.execute('INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT', {
      ig_user_id: this.igUserId,
    });
    // Usage comes back as a list under data.data, not a flat object.
    const entry = Array.isArray(data?.data) ? data.data[0] : data;
    const used = entry?.quota_usage ?? 0;
    const total = entry?.config?.quota_total ?? 100;
    return { used, total, remaining: Math.max(0, total - used) };
  }

  /**
   * Confirms a media URL is actually fetchable and returns media bytes.
   *
   * Meta fetches the URL server-side; if it 404s, redirects to a share page, or
   * returns HTML, container creation fails with an opaque error. Checking here
   * turns that into a clear message before we burn quota.
   */
  async verifyMediaUrl(url, { expect = 'image' } = {}) {
    if (!/^https:\/\//i.test(url)) {
      return { ok: false, reason: 'Media URL must be HTTPS' };
    }
    try {
      let res = await this.fetch(url, { method: 'HEAD', redirect: 'follow' });
      // Some CDNs reject HEAD; fall back to a ranged GET.
      if (!res.ok || !res.headers.get('content-type')) {
        res = await this.fetch(url, { method: 'GET', headers: { range: 'bytes=0-1023' } });
      }
      if (!res.ok) return { ok: false, reason: `Media URL returned HTTP ${res.status}` };

      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (!type.startsWith(expect === 'video' ? 'video/' : 'image/')) {
        return { ok: false, reason: `Media URL served "${type || 'unknown'}", expected ${expect}` };
      }
      return { ok: true, contentType: type };
    } catch (err) {
      return { ok: false, reason: `Media URL unreachable: ${err.message}` };
    }
  }

  /**
   * Creates the media container. This stages the post; it publishes nothing.
   */
  async createContainer(post) {
    const args = { ig_user_id: this.igUserId, caption: renderCaption(post.caption) };
    const [primary] = post.media;

    if (post.mediaType === 'REELS') {
      args.media_type = 'REELS';
      args.video_url = primary.url;
      args.share_to_feed = true;
      if (post.coverUrl) args.cover_url = post.coverUrl;
    } else if (post.mediaType === 'CAROUSEL') {
      const children = [];
      for (const item of post.media) {
        const child = await this.execute('INSTAGRAM_POST_IG_USER_MEDIA', {
          ig_user_id: this.igUserId,
          image_url: item.url,
          is_carousel_item: true,
        });
        children.push(child.id);
      }
      args.media_type = 'CAROUSEL';
      args.children = children;
    } else {
      args.image_url = primary.url;
      if (post.altText) args.alt_text = post.altText;
    }

    const data = await this.execute('INSTAGRAM_POST_IG_USER_MEDIA', args);
    if (!data?.id) throw new ComposioError('Container created but no id returned');
    return data.id;
  }

  /**
   * Publishes an approved post.
   *
   * The approval check is deliberately inside the adapter, not only in the
   * Publisher stage. It is the last line of defence: any future caller reaching
   * this method still cannot make something public without Sha's explicit tap.
   */
  async publish(post, { maxWaitSeconds = 180 } = {}) {
    if (post.status !== 'approved' || !post.approval?.approvedAt) {
      throw new Error(
        `Refusing to publish "${post.id}": status is "${post.status}", not approved by Sha`,
      );
    }

    const quota = await this.getPublishingQuota();
    if (quota.remaining <= 0) {
      throw new Error(`Instagram publishing quota exhausted (${quota.used}/${quota.total} in 24h)`);
    }

    const containerId = await this.createContainer(post);

    // Images publish near-instantly; video needs 30-120s of processing. The tool
    // polls internally, so one call covers the wait.
    const data = await this.execute('INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH', {
      ig_user_id: this.igUserId,
      creation_id: containerId,
      max_wait_seconds: post.mediaType === 'REELS' ? maxWaitSeconds : 30,
    });

    const mediaId = data?.id;
    if (!mediaId) throw new ComposioError('Publish returned no media id', { payload: data });

    let permalink = null;
    try {
      const media = await this.execute('INSTAGRAM_GET_IG_MEDIA', {
        ig_media_id: mediaId,
        fields: 'id,permalink,media_type,timestamp',
      });
      permalink = media?.permalink ?? null;
    } catch {
      // Verification is a nicety; the post is already live.
    }

    return { containerId, mediaId, permalink, publishedAt: new Date().toISOString() };
  }

  /** Recent published media with engagement, for the Analyst. */
  async getRecentMedia(limit = 25) {
    const data = await this.execute('INSTAGRAM_GET_IG_USER_MEDIA', {
      ig_user_id: this.igUserId,
      limit,
      fields:
        'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,view_count,saved_count,shares_count',
    });
    const items = Array.isArray(data?.data) ? data.data : (data?.data?.data ?? []);
    return items;
  }
}

/** Caption body + hashtag block, joined the way Instagram expects. */
export function renderCaption(caption) {
  if (typeof caption === 'string') return caption;
  const tags = (caption.hashtags ?? []).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return [caption.body, caption.cta, tags].filter(Boolean).join('\n\n');
}
