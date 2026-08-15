import os, sys, json, base64, urllib.request, urllib.error, urllib.parse, uuid

CF_TOKEN = os.environ.get('CF_API_TOKEN')
CF_ACCOUNT = os.environ.get('CF_ACCOUNT_ID')
GH_TOKEN = os.environ.get('GH_TOKEN')
SCRIPT = 'marvis-upload'
ROOT = r'F:/2025/WorkBuddy储存/2026-08-13-10-56-02/my-content-app'
REPO = 'znryddx/my-content-app'

def cf_req(method, path, data=None, headers=None):
    url = 'https://api.cloudflare.com/client/v4/accounts/%s/workers/scripts/%s%s' % (CF_ACCOUNT, SCRIPT, path)
    h = {'Authorization': 'Bearer ' + CF_TOKEN}
    if headers: h.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=60)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def gh_req(method, path, data=None):
    url = 'https://api.github.com/repos/%s/contents/%s' % (REPO, urllib.parse.quote(path))
    headers = {'Authorization': 'Bearer ' + GH_TOKEN, 'Accept': 'application/vnd.github+json', 'User-Agent': 'wb'}
    req = urllib.request.Request(url, data=(json.dumps(data).encode() if data is not None else None), method=method, headers=headers)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if method == 'GET' and e.code == 404:
            return 404, None
        print('GH ERR', method, path, e.code, e.read().decode()[:200])
        raise

def push_file(local_rel):
    p = os.path.join(ROOT, local_rel)
    with open(p, 'rb') as f:
        content = base64.b64encode(f.read()).decode()
    info = gh_req('GET', local_rel)
    sha = info[1]['sha'] if info[0] == 200 and info[1] and 'sha' in info[1] else None
    payload = {'message': 'feat: 部署 Cloudflare Worker 上传后端（secret 经 metadata 绑定）', 'content': content}
    if sha:
        payload['sha'] = sha
    st, _ = gh_req('PUT', local_rel, payload)
    print('PUSHED', local_rel, st)

# 1) 同一次 multipart 上传：脚本 + GH_TOKEN 密钥绑定（令牌只经 metadata 发给 Cloudflare，不进仓库/前端）
with open(os.path.join(ROOT, 'worker.js'), 'rb') as f:
    code = f.read()
metadata = {
    "body_part": "worker.js",
    "bindings": [{"type": "secret_text", "name": "GH_TOKEN", "text": GH_TOKEN}]
}
boundary = '----wb' + uuid.uuid4().hex
parts = []
parts.append(('--' + boundary).encode())
parts.append(b'Content-Disposition: form-data; name="metadata"')
parts.append(b'Content-Type: application/json')
parts.append(b'')
parts.append(json.dumps(metadata).encode())
parts.append(('--' + boundary).encode())
parts.append(b'Content-Disposition: form-data; name="worker.js"; filename="worker.js"')
parts.append(b'Content-Type: application/javascript')
parts.append(b'')
parts.append(code)
parts.append(('--' + boundary + '--').encode())
parts.append(b'')
body = b'\r\n'.join(parts)
headers = {'Content-Type': 'multipart/form-data; boundary=' + boundary}
st, resp = cf_req('PUT', '', body, headers)
print('DEPLOY', st, resp[:200])
if st >= 300:
    sys.exit('Worker 部署失败：' + resp[:300])

# 2) 获取 workers.dev 子域，拼出上传 URL
try:
    sd = urllib.request.urlopen(urllib.request.Request(
        'https://api.cloudflare.com/client/v4/accounts/%s/workers/subdomain' % CF_ACCOUNT,
        headers={'Authorization': 'Bearer ' + CF_TOKEN})).read().decode()
    sub = json.loads(sd).get('result', {}).get('subdomain')
except Exception as e:
    sub = None
    print('SUBDOMAIN_ERR', e)
worker_url = ('https://%s.%s.workers.dev/upload' % (SCRIPT, sub)) if sub else None
print('WORKER_URL', worker_url)

# 3) 回填 config.upload_endpoint 并推送前端 + 配套文件
if worker_url:
    cfgp = os.path.join(ROOT, 'config.json')
    cfg = json.load(open(cfgp, encoding='utf-8'))
    cfg['upload_endpoint'] = worker_url
    json.dump(cfg, open(cfgp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    push_file('config.json')
    push_file('app.js')
    push_file('worker.js')
    push_file('wrangler.toml')
    push_file('deploy_worker.py')
    print('DONE -> upload_endpoint =', worker_url)
else:
    print('DONE_BUT_NO_URL: 部署成功但未拿到 worker URL，请在 Cloudflare 控制台确认子域后手动回填 config.upload_endpoint')
