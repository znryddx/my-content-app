#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调用 GitHub Models 免费额度，为 config.json 中的每个分类按「分类 × 日期」生成 6 宫格内容。

- 每个分类一次模型调用（当前 8 分类 = 8 次/天，远低于每日 50 次上限）。
- 结果写入 data/<catId>/<date>.json，并维护 data/<catId>/dates.json 索引（供 App 回看历史）。
- 认证：优先 GH_MODELS_PAT（fine-grained PAT, models:read）；否则用 GITHUB_TOKEN（Actions 内置，需 permissions: models: read）。
"""
import os
import json
import datetime
import urllib.request
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
    cfg = json.load(f)

MODEL = cfg.get("model", "openai/gpt-4.1-mini")
CATEGORIES = cfg.get("categories", [])
CELLS = cfg.get("cells", [])
DATE = datetime.date.today().isoformat()

ENDPOINT = "https://models.github.ai/inference/chat/completions"

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


def build_user(cat):
    items = []
    for c in CELLS:
        items.append("%s｜%s：%s" % (c["id"], c["title"], fill(c.get("prompt", ""), cat)))
    joined = "\n".join("%d. %s" % (i + 1, p) for i, p in enumerate(items))
    return (
        "请为分类「%s」生成今日（%s）内容。\n" % (cat.get("label", ""), DATE) +
        "该分类主题：%s\n" % cat.get("theme", "") +
        "全案营销策略主题：%s\n\n" % cat.get("strategy", "") +
        "【关键】必须严格基于上面的 theme 与 strategy 写作，禁止挪用其他品类的通用话术，"
        "依次生成以下版块：\n%s\n\n" % joined +
        '只返回严格 JSON：{"cells":[{"id":<对应上面 id>,"title":<版块名>,"body":<正文>}...]}，不要额外文字。'
    )


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def call_model(user):
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
    }).encode("utf-8")
    token = os.environ.get("GH_MODELS_PAT") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("缺少认证：请设置 GH_MODELS_PAT 或 GITHUB_TOKEN（需 models:read）")
    req = urllib.request.Request(
        ENDPOINT, data=payload,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
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
    folder = os.path.join(ROOT, "data", cat_id)
    os.makedirs(folder, exist_ok=True)

    try:
        result = call_model(build_user(cat))
        cells = result.get("cells", [])
        by_id = {c.get("id"): c for c in cells}
        ordered = []
        for meta in CELLS:
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
    for cat in CATEGORIES:
        write_cat(cat)
    print("All done.")


if __name__ == "__main__":
    main()
