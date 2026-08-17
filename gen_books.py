# -*- coding: utf-8 -*-
"""把 data/law/books.json 每本知识补到 TARGET 条（纯追加，不替换已有）。
免费模型多模型降级 + 退避；边生成边落地，中途超时也不丢进度。
由 .github/workflows/gen_books.yml 经 secrets.LLM_API_KEY 调用。"""
import json, os, time, urllib.request, urllib.error

API = "https://openrouter.ai/api/v1/chat/completions"
MODELS = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-it:free",
    "nvidia/nemotron-3-nano-30b:free",
    "openai/gpt-oss-20b:free",
]
TARGET = 200
BATCH = 15
BOOKS = "data/law/books.json"


def load_books():
    if os.path.exists(BOOKS):
        with open(BOOKS, encoding="utf-8") as f:
            return json.load(f)
    return {"startDate": "2026-08-17", "perBook": TARGET, "topics": []}


def save_books(books):
    with open(BOOKS, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=1)


def call_llm(system, user):
    key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("LLM_API_KEY")
    if not key:
        raise RuntimeError("no api key")
    last = None
    for model in MODELS:
        for attempt in range(3):
            try:
                data = json.dumps({
                    "model": model,
                    "temperature": 0.6,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "max_tokens": 2400,
                }).encode("utf-8")
                req = urllib.request.Request(API, data=data, headers={
                    "Authorization": "Bearer " + key,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://znryddx.github.io",
                    "X-Title": "law-books",
                })
                with urllib.request.urlopen(req, timeout=90) as r:
                    j = json.load(r)
                return j["choices"][0]["message"]["content"]
            except Exception as e:
                last = e
                print("  model %s attempt %d err: %s" % (model, attempt, e))
                time.sleep(10 * (attempt + 1))
    raise RuntimeError("all models failed: %s" % last)


def extract_json(txt):
    s = txt.find("[")
    e = txt.rfind("]")
    if s != -1 and e != -1 and e > s:
        try:
            return json.loads(txt[s:e + 1])
        except Exception:
            pass
    import re
    m = re.search(r"```(?:json)?\s*(.*?)```", txt, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    return None


def main():
    books = load_books()
    topics = books.get("topics") or []
    changed = False
    for t in topics:
        name = t.get("name") or t.get("id")
        policy = bool(t.get("policy", False))
        pts = t.get("points") or []
        have = [p.get("title", "") for p in pts]
        print("[%s] 现有 %d 条，目标 %d" % (name, len(pts), TARGET))
        while len(pts) < TARGET:
            n = min(BATCH, TARGET - len(pts))
            system = ("你是有经验的法律/政策科普作者，输出准确、通俗、合规，不杜撰未施行的法条；"
                      "政策类（社保、税务、反诈）内容末尾务必标注（以最新政策为准）。")
            user = ("主题：《%s》。已有知识点标题（仅供避免重复，不要生成相同标题）：\n" % name)
            user += "\n".join("- " + x for x in have[-40:]) + "\n"
            user += ("请再生成 %d 条新的、逻辑顺序合理的知识点。每条格式："
                     "{\"title\":\"简短知识点标题\",\"body\":\"讲解80-160字，通俗准确\"}。"
                     "只输出 JSON 数组，不要其它文字。") % n
            try:
                txt = call_llm(system, user)
            except Exception as e:
                print("  [%s] 生成中断：%s" % (name, e))
                break
            new = extract_json(txt)
            if not new:
                print("  [%s] 解析失败，跳过本批" % name)
                break
            added = 0
            for p in new:
                if not isinstance(p, dict):
                    continue
                tt = (p.get("title") or "").strip()
                bb = (p.get("body") or "").strip()
                if not tt or not bb:
                    continue
                if tt in have:
                    continue
                if policy and "以最新政策为准" not in bb and "最新政策" not in bb:
                    bb = bb.rstrip("。") + "（以最新政策为准）。"
                pts.append({"title": tt, "body": bb})
                have.append(tt)
                added += 1
            print("  [%s] 现 %d 条，本批新增 %d" % (name, len(pts), added))
            if added == 0:
                print("  [%s] 无新增，停止" % name)
                break
            t["points"] = pts
            changed = True
            save_books(books)  # 渐进落地
    if changed:
        save_books(books)
        print("books.json 已更新并提交")
    else:
        print("无需补充")


if __name__ == "__main__":
    main()
