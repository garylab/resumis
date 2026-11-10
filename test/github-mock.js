import assert from 'node:assert/strict';

// Models the Contents API, including branch selection, SHA conflicts, and Unicode.
export function githubMock() {
  const files = new Map();
  const calls = [];
  let sequence = 0;
  let failure;
  const repos = [{ full_name: 'gary/resumes' }];
  const branches = [{ name: 'feature/resumes & css' }, { name: 'main' }];
  function put(path, content) {
    files.set(path, { content, sha: `sha-${++sequence}` });
  }
  function file(path) {
    const entry = files.get(path);
    return { name: path.split('/').at(-1), path, type: 'file', sha: entry.sha,
      encoding: 'base64', content: Buffer.from(entry.content).toString('base64') };
  }
  function contents(path) {
    if (files.has(path)) return file(path);
    const prefix = path ? `${path}/` : '';
    const children = new Map();
    for (const key of files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length).split('/')[0];
      const childPath = `${prefix}${name}`;
      children.set(name, files.has(childPath) ? file(childPath) : { name, path: childPath, type: 'dir' });
    }
    return children.size ? [...children.values()] : null;
  }
  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method || 'GET';
    calls.push({ url, method, ...init });
    if (failure && (!failure.method || failure.method === method) && (!failure.path || failure.path === url.pathname)) {
      return Response.json({ message: failure.message }, { status: failure.status });
    }
    if (url.href === 'https://github.com/login/oauth/access_token') {
      assert.equal(new URLSearchParams(init.body).get('code'), 'valid-code');
      return Response.json({ access_token: 'test-github-token' });
    }
    assert.equal(init.headers.Authorization, 'Bearer test-github-token');
    assert.ok(init.headers['User-Agent']);
    if (url.pathname === '/user') return Response.json({ id: 123, login: 'gary', name: 'Gary & Co', email: null });
    if (url.pathname === '/user/emails') return Response.json([{ email: 'gary@example.com', primary: true }]);
    if (url.pathname === '/user/repos' || url.pathname.endsWith('/branches')) {
      const values = url.pathname === '/user/repos' ? repos : branches;
      const page = Number(url.searchParams.get('page') || 1);
      return Response.json(values.slice((page - 1) * 100, page * 100));
    }
    const prefix = '/repos/gary/resumes/contents';
    assert.ok(url.pathname.startsWith(prefix), `Unexpected GitHub URL ${url.href}`);
    const path = decodeURIComponent(url.pathname.slice(prefix.length).replace(/^\//, ''));
    if (method === 'GET') {
      assert.equal(url.searchParams.get('ref'), 'feature/resumes & css');
      const result = contents(path);
      return result ? Response.json(result) : Response.json({ message: 'Not Found' }, { status: 404 });
    }
    const body = JSON.parse(init.body);
    assert.equal(body.branch, 'feature/resumes & css');
    assert.ok(body.message);
    if (method === 'PUT') {
      if (files.has(path) && files.get(path).sha !== body.sha) {
        return Response.json({ message: 'SHA conflict' }, { status: 409 });
      }
      put(path, Buffer.from(body.content, 'base64').toString('utf8'));
      return Response.json({ content: file(path) }, { status: 201 });
    }
    if (method === 'DELETE') {
      assert.equal(files.get(path)?.sha, body.sha);
      files.delete(path);
      return Response.json({ content: null });
    }
    throw new Error(`Unexpected ${method} ${url.href}`);
  };
  return { files, calls, repos, branches, put, fetcher, fail: (status, message, method, path) => { failure = { status, message, method, path }; } };
}
