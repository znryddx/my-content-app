#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调用「OpenAI 兼容」的免费 LLM API，为 config.json 中每个分类按「分类 × 日期」生成 6 宫格内容。

GitHub Models 已于 2026-07-30 退役。默认改用 OpenRouter（openrouter.ai，OpenAI 兼容、境外 Actions 调用稳定，
提供 google/gemma-4-31b-it:free 真实 :free 免费档）。真正调 API 的是 GitHub Actions 境外服务器，本地无需代理。
认证与端点通过环境变量注入（在 Actions 中以 Secret 提供，不写死在仓库里）：
  LLM_API_KEY  必填，API Key（在 openrouter.ai 获取；亦兼容其他 OpenAI 兼容端点）
  LLM_BASE_URL 选填，OpenAI 兼容的 chat/completions 基址，默认 OpenRouter
  LLM_MODEL    选填，模型名，默认 google/gemma-4-31b-it:free（OpenRouter 真实 :free 免费档）。
                注意：OpenRouter 上 google/gemini-2.5-flash 无 :free 档（按量计费），勿填带 :free 的 gemini-2.5-flash，会 404。
如需改用国内免代理平台（如硅基流动 SiliconFlow），覆盖 LLM_BASE_URL 与 LLM_MODEL 即可。

为规避免费档 RPM 限流，本脚本将分类「分批」调用：每批 3 个分类合并成 1 次 API 请求
（一次返回整批 JSON），全天仅 ~3 次调用，远低于限流阈值。
- 结果写入 data/<catId>/<date>.json，并维护 data/<catId>/dates.json（供 App 回看历史）。
"""
import os
import json
import datetime
import urllib.request
import urllib.error
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
    cfg = json.load(f)

CATEGORIES = cfg.get("categories", [])
CELLS = cfg.get("cells", [])
DATE = datetime.date.today().isoformat()

MODEL = os.environ.get("LLM_MODEL", "google/gemma-4-31b-it:free")
_BASE = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
ENDPOINT = _BASE + "/chat/completions"
API_KEY = os.environ.get("LLM_API_KEY", "")

SYSTEM = (
    "你是一个中文内容生成器，服务于一个每日更新的多品类内容 App。"
    "只返回合法的、压缩过的 JSON（不要 markdown 代码块、不要任何解释文字）。"
    "写作须用简体中文；每个版块内容要点化、控制篇幅：金句类每条不超过 30 字；"
    "其余版块每条不超过 350 字；整体 JSON 总字数不超过 3800 字。"
    "【差异化硬约束】严禁套用通用模板；每个分类的内容必须基于其自身 theme 与 strategy 具体化，"
    "不同分类之间不得出现雷同的句式、数据、选题或策略。金句要贴合该品类的器物/文化意象，"
    "不可把同一组金句复制给多个分类；趋势要有该品类的真实电商体感（品类词、价位带、平台差异）。"
)

BATCH_SIZE = 3  # 每批分类数；9 分类 => 全天仅 3 次 API 调用，避开免费档限流


def fill(tpl, cat):
    return (tpl.replace("{theme}", cat.get("theme", cat.get("label", "")))
               .replace("{strategy}", cat.get("strategy", cat.get("label", ""))))


def load_feed():
    feed_path = os.path.join(ROOT, "data", "feed", DATE + ".txt")
    if os.path.exists(feed_path):
        try:
            txt = open(feed_path, encoding="utf-8").read()
            return txt[:4000] + ("\n...(素材过长已截断)" if len(txt) > 4000 else "")
        except Exception:
            return None
    return None


def build_batch(cats):
    """为一批分类构建单次请求的 prompt，要求返回 {catId: {cells:[...]}}。"""
    blocks = []
    for cat in cats:
        cells = cat.get("cells") or CELLS
        lines = ["%s｜%s：%s" % (c["id"], c["title"], fill(c.get("prompt", ""), cat)) for c in cells]
        blocks.append(
            "【分类 %s】\n标签：%s\n主题：%s\n策略：%s\n需生成的版块：\n%s"
            % (cat["id"], cat.get("label", ""), cat.get("theme", ""),
               cat.get("strategy", ""), "\n".join("%d. %s" % (i + 1, p) for i, p in enumerate(lines)))
        )
    head = (
        "请为以下 %d 个分类分别生成今日（%s）内容。每个分类必须严格基于其自身的 theme 与 strategy 写作，"
        "禁止跨分类雷同或套用通用模板。\n\n%s\n\n"
        % (len(cats), DATE, "\n\n".join(blocks))
    )
    if any(c["id"] == "brief" for c in cats):
        feed = load_feed()
        if feed:
            head += (
                "【重要】以下是脚本抓取的今日真实热点素材（含来源），请严格基于这些真实素材撰写"
                "「拍卖行资讯 / 财经新闻 / 热点新闻 / 文创电商趋势」等模块，不得凭空编造数据或新闻；"
                "素材未覆盖的模块（金句、种草文案、标题、策略等）可正常发挥。\n真实素材如下：\n%s\n\n"
                % feed
            )
    head += (
        '只返回一个 JSON 对象，结构严格为 {"<分类id>": {"cells":[{"id":string,"title":string,"body":string}...]}}，'
        "每个分类的 cells 顺序与上面版块一致，id 与上面保持一致。不要任何解释文字、不要 markdown 代码块。"
    )
    return head


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def call_model(user):
    if not API_KEY:
        raise RuntimeError("缺少 LLM_API_KEY 环境变量（请在 Actions Secrets 中配置）")
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
    }).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT, data=payload,
        headers={
            "Authorization": "Bearer " + API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/znryddx/my-content-app",
            "X-Title": "my-content-app",
        },
        method="POST",
    )
    last = None
    backoff = [15, 30, 60, 120]
    for attempt in range(len(backoff) + 1):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read().decode("utf-8"))
            return extract_json(data["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8", "ignore")[:500]
            except Exception:
                pass
            print("[debug] HTTPError code=%s body=%s"
                  % (getattr(e, "code", "?"), detail), flush=True)
            if e.code in (401, 403, 404):
                raise RuntimeError(
                    "HTTP %d 致命错误（密钥无效或模型不存在），已停止重试：%s" % (e.code, detail))
            wait = backoff[min(attempt, len(backoff) - 1)]
            retry_after = e.headers.get("Retry-After") if hasattr(e, "headers") else None
            if retry_after and str(retry_after).isdigit():
                wait = int(retry_after) + 3
            print("[warn] HTTP %d 第 %d 次调用失败（限流/临时），%ds 后重试：%s"
                  % (e.code, attempt + 1, wait, detail), flush=True)
            last = e
        except Exception as e:
            print("[warn] 第 %d 次调用失败（非HTTP）：%s" % (attempt + 1, e), flush=True)
            last = e
            wait = backoff[min(attempt, len(backoff) - 1)]
        if attempt < len(backoff):
            time.sleep(wait)
    raise RuntimeError("模型调用多次失败（多因免费档限流），请稍后重试或换模型: %s" % last)


def fallback(cat):
    cells = cat.get("cells") or CELLS
    return [{"id": c["id"], "title": c["title"],
             "body": "（今日自动生成暂未成功，将在下次定时任务重试）"} for c in cells]


def write_cat(cat, cells_map):
    cat_id = cat["id"]
    cells_meta = cat.get("cells") or CELLS
    folder = os.path.join(ROOT, "data", cat_id)
    os.makedirs(folder, exist_ok=True)
    gen = cells_map.get(cat_id, {}).get("cells", []) if isinstance(cells_map, dict) else []
    by_id = {c.get("id"): c for c in gen}
    ordered = []
    for meta in cells_meta:
        c = by_id.get(meta["id"]) or {"id": meta["id"], "title": meta["title"], "body": ""}
        ordered.append({"id": meta["id"], "title": meta["title"], "body": c.get("body", "")})
    content = {"date": DATE, "category": cat.get("label", ""), "cells": ordered}

    with open(os.path.join(folder, DATE + ".json"), "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=2)

    dates_path = os.path.join(folder, "dates.json")
    dates = []
    if os.path.exists(dates_path):
        try:
            dates = json.load(open(dates_path, encoding="utf-8"))
        except Exception:
            dates = []
    if DATE not in dates:
        dates.append(DATE)
    dates.sort()
    with open(dates_path, "w", encoding="utf-8") as f:
        json.dump(dates, f, ensure_ascii=False, indent=2)
    real = sum(1 for c in ordered if "暂未成功" not in c["body"])
    print("Wrote data/%s/%s.json  (%d/%d 真实, %d 占位)"
          % (cat_id, DATE, real, len(ordered), len(ordered) - real), flush=True)


def call_batch(batch):
    try:
        result = call_model(build_batch(batch))
    except Exception as e:
        print("[error] 批量生成失败，整批兜底：%s" % e, flush=True)
        result = {}
    for cat in batch:
        # 兼容模型偶尔返回单分类旧格式 {"cells":[...]}
        if isinstance(result, dict) and "cells" in result and len(batch) == 1:
            result = {batch[0]["id"]: result}
        write_cat(cat, result)


def chunked(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def main():
    if not CATEGORIES:
        print("config.json 中没有 categories")
        return
    if not API_KEY:
        print("[fatal] 未设置 LLM_API_KEY，无法生成。请在仓库 Settings → Secrets → Actions 添加 LLM_API_KEY。")
        return
    batches = list(chunked(CATEGORIES, BATCH_SIZE))
    print("共 %d 个分类，分 %d 批调用（每批 %d 个）" % (len(CATEGORIES), len(batches), BATCH_SIZE))
    for i, batch in enumerate(batches):
        print("--- 第 %d/%d 批：%s ---" % (i + 1, len(batches), ",".join(c["id"] for c in batch)), flush=True)
        call_batch(batch)
        if i < len(batches) - 1:
            time.sleep(45)  # 批间间隔，进一步避开免费档 RPM
    print("All done.")


if __name__ == "__main__":
    main()
