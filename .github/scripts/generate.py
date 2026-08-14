#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调用「OpenAI 兼容」的免费 LLM API，为 config.json 中每个分类按「分类 × 日期」生成 6 宫格内容。

GitHub Models 已于 2026-07-30 退役。默认改用国内免费平台「硅基流动 SiliconFlow」
（api.siliconflow.cn，国内可直连、注册免代理、新用户送免费额度），以绕开"本地无代理无法申请
境外平台 key"的问题——注意：真正调 API 的是 GitHub Actions 境外服务器，本地能否上 Google 不影响生成。
认证与端点通过环境变量注入（在 Actions 中以 Secret 提供，不写死在仓库里）：
  LLM_API_KEY  必填，API Key（在 siliconflow.cn 注册获取）
  LLM_BASE_URL 选填，OpenAI 兼容的 chat/completions 基址，默认硅基流动
  LLM_MODEL    选填，模型名，默认 deepseek-ai/DeepSeek-V3（质量高；可换 Qwen/Qwen2.5-72B-Instruct 等免费模型）
如需改用 OpenRouter / Gemini 等境外平台，覆盖 LLM_BASE_URL 与 LLM_MODEL 即可（但需本地能访问该站申请 key）。

- 每个分类一次模型调用（当前 8 分类 = 8 次/天）。
- 结果写入 data/<catId>/<date>.json，并维护 data/<catId>/dates.json（供 App 回看历史）。
"""
import os
import json
import datetime
import urllib.request
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
    cfg = json.load(f)

CATEGORIES = cfg.get("categories", [])
CELLS = cfg.get("cells", [])
DATE = datetime.date.today().isoformat()

MODEL = os.environ.get("LLM_MODEL", "deepseek-ai/DeepSeek-V3")
_BASE = os.environ.get("LLM_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/")
ENDPOINT = _BASE + "/chat/completions"
API_KEY = os.environ.get("LLM_API_KEY", "")

SYSTEM = (
    "你是一个中文内容生成器，服务于一个每日更新的多品类内容 App。"
    "只返回合法的、压缩过的 JSON（不要 markdown 代码块、不要任何解释文字）。"
    '结构必须严格为 {"cells":[{"id":string,"title":string,"body":string}, ...]}。'
    "用简体中文写作；每个版块内容要点化、控制篇幅：金句类每条不超过 30 字；"
    "其余版块每条不超过 350 字；整体 JSON 总字数不超过 4000 字。"
    "【差异化硬约束】严禁套用通用模板；每个分类的内容必须基于其 theme 与 strategy 具体化，"
    "不同分类之间不得出现雷同的句式、数据、选题或策略。金句要贴合该品类的器物/文化意象，"
    "不可把同一组金句复制给多个分类；趋势要有该品类的真实电商体感（品类词、价位带、平台差异）。"
)


def fill(tpl, cat):
    return (tpl.replace("{theme}", cat.get("theme", cat.get("label", "")))
               .replace("{strategy}", cat.get("strategy", cat.get("label", ""))))


def build_user(cat, cells, feed_text=None):
    items = []
    for c in cells:
        items.append("%s｜%s：%s" % (c["id"], c["title"], fill(c.get("prompt", ""), cat)))
    joined = "\n".join("%d. %s" % (i + 1, p) for i, p in enumerate(items))
    head = (
        "请为分类「%s」生成今日（%s）内容。\n" % (cat.get("label", ""), DATE) +
        "该分类主题：%s\n" % cat.get("theme", "") +
        "全案营销策略主题：%s\n\n" % cat.get("strategy", "")
    )
    if feed_text:
        head += (
            "【重要】以下是脚本抓取的今日真实热点素材（已含来源），请严格基于这些真实素材撰写"
            "「拍卖行资讯 / 财经新闻 / 热点新闻 / 文创电商趋势」等模块，不得凭空编造数据、行情或新闻；"
            "素材未覆盖的模块（金句、种草文案、标题、策略等）可正常发挥。\n"
            "真实素材如下：\n%s\n\n" % feed_text
        )
    head += (
        "【关键】必须严格基于上面的 theme 与 strategy 写作，禁止挪用其他品类的通用话术，"
        "依次生成以下版块：\n%s\n\n" % joined +
        '只返回严格 JSON：{"cells":[{"id":<对应上面 id>,"title":<版块名>,"body":<正文>}...]}，不要额外文字。'
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
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read().decode("utf-8"))
            return extract_json(data["choices"][0]["message"]["content"])
        except Exception as e:
            last = e
            print("[warn] 第 %d 次调用失败：%s" % (attempt + 1, e))
            if attempt < 2:
                time.sleep(8)
    raise RuntimeError("模型调用多次失败: %s" % last)


def fallback(cat):
    return [{"id": c["id"], "title": c["title"],
             "body": "（今日自动生成暂未成功，将在下次定时任务重试）"} for c in CELLS]


def write_cat(cat):
    cat_id = cat["id"]
    cells = cat.get("cells") or CELLS
    folder = os.path.join(ROOT, "data", cat_id)
    os.makedirs(folder, exist_ok=True)
    feed_text = None
    if cat_id == "brief":
        feed_path = os.path.join(ROOT, "data", "feed", DATE + ".txt")
        if os.path.exists(feed_path):
            try:
                feed_text = open(feed_path, encoding="utf-8").read()
                if len(feed_text) > 4000:
                    feed_text = feed_text[:4000] + "\n...(素材过长已截断)"
            except Exception:
                feed_text = None
    try:
        result = call_model(build_user(cat, cells, feed_text))
        gen_cells = result.get("cells", [])
        by_id = {c.get("id"): c for c in gen_cells}
        ordered = []
        for meta in cells:
            c = by_id.get(meta["id"]) or {"id": meta["id"], "title": meta["title"], "body": ""}
            ordered.append({"id": meta["id"], "title": meta["title"], "body": c.get("body", "")})
        content = {"date": DATE, "category": cat.get("label", ""), "cells": ordered}
    except Exception as e:
        print("[error] %s 生成失败，使用兜底：%s" % (cat_id, e))
        content = {"date": DATE, "category": cat.get("label", ""), "cells": fallback(cat)}

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
    print("Wrote data/%s/%s.json  (%d cells)" % (cat_id, DATE, len(content["cells"])))


def main():
    if not CATEGORIES:
        print("config.json 中没有 categories")
        return
    if not API_KEY:
        print("[fatal] 未设置 LLM_API_KEY，无法生成。请在仓库 Settings → Secrets → Actions 添加 LLM_API_KEY。")
        return
    for cat in CATEGORIES:
        write_cat(cat)
    print("All done.")


if __name__ == "__main__":
    main()
