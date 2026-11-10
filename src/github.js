import { Buffer } from 'node:buffer';

export class GithubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const encodePath = path => path.split('/').map(encodeURIComponent).join('/');

export class Github {
  constructor(session, fetcher = fetch) {
    this.token = session.user.token;
    this.repo = session.repo?.full_name || '';
    this.branch = session.repo?.branch || '';
    this.fetcher = fetcher;
  }

  async request(method, path, body, allow404 = false) {
    const response = await this.fetcher(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Resumis-Cloudflare',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (allow404 && response.status === 404) return null;
    const result = await response.json();
    if (!response.ok) {
      throw new GithubError(result.message || 'GitHub request failed', response.status);
    }
    return result;
  }

  async paginated(path) {
    const results = [];
    for (let page = 1; ; page++) {
      const batch = await this.request('GET', `${path}?per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new GithubError('Unexpected GitHub response', 502);
      results.push(...batch);
      if (batch.length < 100) return results;
    }
  }

  repos() { return this.paginated('/user/repos'); }
  branches(repo) { return this.paginated(`/repos/${encodePath(repo)}/branches`); }
  contentsPath(path = '') { return `/repos/${encodePath(this.repo)}/contents${path ? `/${encodePath(path)}` : ''}`; }
  get(path = '', allow404 = false) {
    return this.request('GET', `${this.contentsPath(path)}?ref=${encodeURIComponent(this.branch)}`, undefined, allow404);
  }
  async has(path) { return (await this.get(path, true)) !== null; }
  async list(path = '') {
    const result = await this.get(path, path === '');
    if (result === null) return []; // A new repository has no contents yet.
    if (!Array.isArray(result)) throw new GithubError('Expected a resume folder', 400);
    return result;
  }
  async read(path) {
    const file = await this.get(path);
    if (typeof file.content !== 'string' || file.encoding !== 'base64') {
      throw new GithubError('GitHub did not return file contents', 502);
    }
    return Buffer.from(file.content, 'base64').toString('utf8');
  }
  create(path, content) {
    return this.request('PUT', this.contentsPath(path), {
      message: `Create [${path}]`, content: Buffer.from(content, 'utf8').toString('base64'), branch: this.branch,
    });
  }
  async update(path, content) {
    const file = await this.get(path);
    if (Buffer.from(file.content, 'base64').toString('utf8') === content) return;
    return this.request('PUT', this.contentsPath(path), {
      message: `Update [${path}]`, content: Buffer.from(content, 'utf8').toString('base64'),
      sha: file.sha, branch: this.branch,
    });
  }
  async duplicate(source, destination) {
    for (const item of await this.list(source)) {
      const path = `${destination}${item.path.slice(source.length)}`;
      if (item.type === 'dir') await this.duplicate(item.path, path);
      else if (item.type === 'file') await this.create(path, await this.read(item.path));
    }
  }
  async remove(path) {
    // Serialize writes: GitHub's Contents API rejects concurrent branch updates.
    for (const item of await this.list(path)) {
      if (item.type === 'dir') await this.remove(item.path);
      else if (item.type === 'file') {
        const file = await this.get(item.path);
        await this.request('DELETE', this.contentsPath(item.path), {
          message: `Delete [${item.path}]`, sha: file.sha, branch: this.branch,
        });
      }
    }
  }
}
