// tidepool.mjs — the fleet's memory ocean, one import away.
//
// SuperInstance/tidepool: a CF Worker holding every agent's context as a
// tide pool; the ocean behind it. API verified by direct code read
// (worker/index.js): 5 routes, NO auth (rate-limited per IP at 45/min),
// namespacing via author/kind/repo fields.
//
// Client-side discipline the open endpoint demands:
//   • author is REQUIRED and stable — attribution is the only wall
//     against pool poisoning.
//   • field caps enforced HERE (title 200, body 8000, author 64) so a
//     honest client never 4xx's.
//   • fireAndForget() for task-end distillation: memory must never break
//     the main line.
//   • a tiny token bucket (44/min default, one under the server's 45) so
//     fleet agents sharing an egress IP don't 429 each other.

export class TidepoolError extends Error {
  constructor(status, body) {
    super(`tidepool ${status}: ${String(body).slice(0, 200)}`);
    this.status = status;
  }
}

const CAPS = { author: 64, title: 200, body: 8000, kind: 32, repo: 128 };

export class TidepoolClient {
  constructor(baseUrl, { fetchFn, author, repo, ratePerMin = 44 } = {}) {
    if (!baseUrl) throw new Error('tidepool: baseUrl is required');
    this.base = baseUrl.replace(/\/$/, '');
    this.fetchFn = fetchFn ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetchFn) throw new Error('tidepool: no fetch available');
    this.author = author;
    this.repo = repo;
    this._tokens = ratePerMin;
    this._rate = ratePerMin;
    this._last = 0;
  }

  _throttle() {
    const now = Date.now();
    this._tokens = Math.min(this._rate, this._tokens + (now - this._last) / 60000 * this._rate);
    this._last = now;
    if (this._tokens < 1) {
      throw new TidepoolError(429, 'local token bucket: slow down, the ocean is shared');
    }
    this._tokens -= 1;
  }

  _cap(field, value) {
    const s = String(value);
    return s.length > CAPS[field] ? s.slice(0, CAPS[field]) : s;
  }

  async _req(path, init = {}) {
    this._throttle();
    const r = await this.fetchFn(this.base + path, init);
    if (!r.ok) throw new TidepoolError(r.status, await r.text().catch(() => ''));
    return r.json();
  }

  // POST /api/remember — distill and store. run:{task,outcome} records an
  // audit row alongside the artifact.
  async remember({ kind = 'lesson', title, body, repo, native, run } = {}) {
    if (!title) throw new Error('tidepool.remember: title required');
    if (!body) throw new Error('tidepool.remember: body required');
    if (!this.author) throw new Error('tidepool.remember: client author required');
    if (native !== undefined &&
        (!Array.isArray(native) || native.length !== 16 || !native.every(Number.isFinite))) {
      throw new Error('tidepool.remember: native must be exactly 16 finite numbers');
    }
    const payload = {
      kind: this._cap('kind', kind),
      author: this._cap('author', this.author),
      title: this._cap('title', title),
      body: this._cap('body', body),
    };
    const r = repo ?? this.repo;
    if (r) payload.repo = this._cap('repo', r);
    if (native) payload.native = native;
    if (run) payload.run = run;
    return this._req('/api/remember', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // fire-and-forget: memory must never break the main line.
  fireAndForget(payload, onError = () => {}) {
    this.remember(payload).catch(onError);
  }

  // GET /api/recall?q=&kind=&author=&repo=&limit= — no q = recent mode.
  async recall({ q, kind, author, repo, limit } = {}) {
    const p = new URLSearchParams();
    if (q) p.set('q', q.slice(0, 80));
    if (kind) p.set('kind', kind);
    if (author) p.set('author', author);
    if (repo) p.set('repo', repo);
    if (limit) p.set('limit', String(Math.min(50, Math.max(1, limit))));
    return this._req('/api/recall?' + p.toString());
  }

  // GET /api/recall/similar?id= | &vec=16nums
  async similar({ id, vec } = {}) {
    if (!id && !vec) throw new Error('tidepool.similar: id or vec required');
    if (vec && (!Array.isArray(vec) || vec.length !== 16 || !vec.every(Number.isFinite))) {
      throw new Error('tidepool.similar: vec must be exactly 16 finite numbers');
    }
    const p = new URLSearchParams();
    if (id) p.set('id', id);
    if (vec) p.set('vec', vec.join(','));
    return this._req('/api/recall/similar?' + p.toString());
  }

  // GET /api/ledger?limit= — recent line + per-kind counts.
  async ledger({ limit } = {}) {
    const p = new URLSearchParams();
    if (limit) p.set('limit', String(Math.min(100, Math.max(1, limit))));
    return this._req('/api/ledger?' + p.toString());
  }

  async health() { return this._req('/health'); }
}
