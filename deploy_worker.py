#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
部署 Claw 上传 Worker 到 Cloudflare（需用户提供 Cloudflare 账号信息）。
用法：
  set CF_ACCOUNT_ID=xxxx
  set CF_API_TOKEN=xxxx          # Cloudflare API Token，需 Workers Scripts:Edit 权限
  set GH_TOKEN=ghp_xxx           # 旧 GitHub token（仅写入 Cloudflare 密钥，不落前端）
  python deploy_worker.py
可选：
  set UPLOAD_KEY=任意密钥        # 给上传接口加一道简单门槛（非绝对安全，前端会带此 key）
"""
import os
import sys
import json
import urllib.request

ACCOUNT = os.environ.get('CF_ACCOUNT_ID', '').strip()
TOKEN = os.environ.get('CF_API_TOKEN', '').strip()
GH_TOKEN = os.environ.get('GH_TOKEN', '').strip()
GH_REPO = os.environ.get('GH_REPO', 'znryddx/my-content-app').strip()
UPLOAD_KEY = os.environ.get('UPLOAD_KEY', '').strip()
SCRIPT = 'claw-upload'


def need(name, val):
    if not val:
        print('缺少环境变量：' + name)
        sys.exit(1)


for n, v in [('CF_ACCOUNT_ID', ACCOUNT), ('CF_API_TOKEN', TOKEN), ('GH_TOKEN', GH_TOKEN)]:
    need(n, v)


def api(method, path, body=None, extra_headers=None):
    url = 'https://api.cloudflare.com/client/v4/accounts/%s/workers/scripts/%s%s' % (ACCOUNT, SCRIPT, path)
    headers = {'Authorization': 'Bearer ' + TOKEN}
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if body is not None:
        if isinstance(body, (bytes, bytearray)):
            data = body
        else:
            data = json.dumps(body).encode('utf-8')
            headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode('utf-8')
            return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'ignore')
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'errors': [{'message': raw[:300]}]}


# 1) 上传脚本本体
with open('worker.js', 'rb') as f:
    src = f.read()
status, resp = api('PUT', '', body=src, extra_headers={'Content-Type': 'application/javascript'})
if not resp.get('success') and status >= 400:
    print('上传脚本失败：', status, resp)
    sys.exit(1)
print('[1/3] Worker 脚本已上传')

# 2) 写入密钥 GH_TOKEN
status, resp = api('PUT', '/secrets/GH_TOKEN', body={'text': GH_TOKEN})
if not resp.get('success') and status >= 400:
    print('写入 GH_TOKEN 失败：', status, resp)
    sys.exit(1)
print('[2/3] GH_TOKEN 密钥已写入（仅服务端可见）')

# 3) 可选 UPLOAD_KEY
if UPLOAD_KEY:
    status, resp = api('PUT', '/secrets/UPLOAD_KEY', body={'text': UPLOAD_KEY})
    if not resp.get('success') and status >= 400:
        print('写入 UPLOAD_KEY 失败：', status, resp)
        sys.exit(1)
    print('[3/3] UPLOAD_KEY 已写入')

print('部署完成。Worker 地址：https://%s.%s.workers.dev' % (SCRIPT, 'YOUR_SUBDOMAIN'))
print('请把上面的 Worker URL 回填到 config.json 的 upload_endpoint，然后 git push。')
