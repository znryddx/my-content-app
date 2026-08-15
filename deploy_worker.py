import os, sys, json, base64, urllib.request, urllib.error, urllib.parse

CF_TOKEN = os.environ.get('CF_API_TOKEN')
CF_ACCOUNT = os.environ.get('CF_ACCOUNT_ID')
GH_TOKEN = os.environ.get('GH_TOKEN')
SCRIPT = 'marvis-upload'
ROOT = r'F:/2025/WorkBuddy储存/2026-08-13-10-56-02/my-content-app'
REPO = 'znryddx/my-content-app'

def cf_req(method, path, data=None, headers=None):
    url = 'https://api.cloudflare.com/client/v4/accounts/%s/workers/scripts/%s%s' % (CF_ACCOUNT, SCRIPT, path)
    h = {'Authorization': 'Bearer ' + CF_TOKEN, 'Content-Type': 'application/javascript'}
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
    payload = {'message': 'feat: 部署 Cloudflare Worker 上传后端', 'content': content}
    if sha:
        payload['sha'] = sha
    st, _ = gh_req('PUT', local_rel, payload)
    print('PUSHED', local_rel, st)

# 1) 部署 Worker 脚本
with open(os.path.join(ROOT, 'worker.js'), 'rb') as f:
    code = f.read()
st, body = cf_req('PUT', '', code)
print('DEPLOY', st, body[:160])
if st >= 300:
    sys.exit('Worker 部署失败：' + body[:300])

# 2) 写入 GH_TOKEN 服务端密钥（绝不进前端）
st2, body2 = cf_req('PUT', '/secrets/GH_TOKEN', json.dumps({'text': GH_TOKEN}).encode(), {'Content-Type': 'application/json'})
print('SECRET', st2, body2[:160])

# 3) 获取 workers.dev 子域，拼出上传 URL
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

# 4) 回填 config.upload_endpoint
if worker_url:
    cfgp = os.path.join(ROOT, 'config.json')
    cfg = json.load(open(cfgp, encoding='utf-8'))
    cfg['upload_endpoint'] = worker_url
    json.dump(cfg, open(cfgp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    # 推送 config.json（含 endpoint）到 GitHub
    push_file('config.json')
    # 推送前端双模式 + Worker 配套文件
    push_file('app.js')
    push_file('worker.js')
    push_file('wrangler.toml')
    push_file('deploy_worker.py')
    print('DONE -> upload_endpoint =', worker_url)
else:
    print('DONE_BUT_NO_URL: 部署成功但未拿到 worker URL，请手动在 Cloudflare 控制台确认子域后回填 config.upload_endpoint')
