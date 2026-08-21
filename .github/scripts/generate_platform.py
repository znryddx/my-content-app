#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为「平台」模块每日生成选题方向：4 平台（抖音/小红书/视频号/微信图文号）× 8 品类 = 32 条，
每条含 title（平台调性标题）+ body（选题方向：角度+钩子+配图建议）。

复用 generate.py 的免费模型池 + 多模型降级 + 退避重试，最大化每日生成成功率。
结果写入 data/platform/<date>.json 并维护 data/platform/dates.json。
非破坏性：若当日 data/platform/<date>.json 已齐全（32 条且非占位），跳过不覆盖。
"""
import os
import json
import datetime
import urllib.request
import urllib.error
import time
import random

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
    cfg = json.load(f)

PM = cfg.get("platforms_module", {})
PLATFORMS = PM.get("platforms", [])
CAT_MAP = {c["id"]: c for c in cfg.get("categories", [])}
DATE = datetime.date.today().isoformat()

# 平台模块固定生成 config 中 platforms_module.categories（8 个老品类），不跟随每日轮换，
# 保持与「原模块」一致，且避免引用未单独开 tile 的轻角度品类。
CAT_IDS = PM.get("categories", [])
print("[info] 平台模块固定品类：%s" % CAT_IDS)

PRIMARY_MODEL = os.environ.get("LLM_MODEL", "google/gemma-4-31b-it:free")
MODELS = [PRIMARY_MODEL,
          "google/gemma-4-26b-a4b-it:free",
          "nvidia/nemotron-3-nano-30b-a3b:free",
          "openai/gpt-oss-20b:free",
          "qwen/qwen3-32b:free",
          "meta/llama-3.1-8b-instruct:free",
          "deepseek/deepseek-r1-distill-llama-70b:free",
          "thudm/glm-4-9b:free"]
BACKOFF = [15, 30, 60]
_BASE = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
ENDPOINT = _BASE + "/chat/completions"
API_KEY = os.environ.get("LLM_API_KEY", "")

TONES = {
    "douyin": "短平快、强钩子、反差/悬念/数字，图文卡形式，标题要让人想点",
    "xiaohongshu": "氛围感、清单体、emoji、种草、教程感，标题带｜分隔与符号",
    "shipinhao": "文化叙事、中年审美、信任感、故事性，标题偏思考与反问",
    "weixin": "深度长图文、品牌调性、价值输出，标题偏『一文讲透/辞典/志』式",
}

SYSTEM = (
    "你是一个中文内容营销专家，服务于一个东方器物文创 App 的「平台」模块。"
    "只返回合法的、压缩过的 JSON（不要 markdown 代码块、不要任何解释文字）。"
    "写作须用简体中文；每个选题是 4 个字段："
    "  title：符合该平台调性的标题，≤20 字；"
    "  hook：开头钩子，含「选题角度 + 内容钩子」，40-90 字，要有让人点开的理由；"
    "  photo：配图建议，提示用户用自己的器物实拍图，20-60 字，具体到画面/构图/光感；"
    "  interact：互动引导，给读者一个评论/收藏/转发动作，15-40 字。"
    "差异化硬约束：4 个平台的同品类 4 字段必须明显不同（调性不同），8 个品类之间也不得雷同句式或选题。"
)

PLACEHOLDER = "（今日自动生成暂未成功，将在下次定时任务重试）"


def cat_label(cid):
    c = CAT_MAP.get(cid, {})
    return c.get("label", cid)


def cat_theme(cid):
    c = CAT_MAP.get(cid, {})
    return c.get("theme", c.get("label", cid))


def build_prompt(plat):
    pid = plat["id"]
    tone = TONES.get(pid, "")
    lines = []
    for cid in CAT_IDS:
        lines.append("- %s（主题：%s）" % (cat_label(cid), cat_theme(cid)))
    return (
        "请为平台「%s」（调性：%s）生成今日（%s）以下 %d 个品类的图文选题方向。"
        "每个品类输出一个选题，含 4 个字段：\n"
        "  title：符合该平台调性的标题，≤20 字；\n"
        "  hook：开头钩子（选题角度 + 内容钩子），40-90 字；\n"
        "  photo：配图建议，提示用户用自己的器物实拍图，20-60 字；\n"
        "  interact：互动引导（评论/收藏/转发动作），15-40 字。\n"
        "品类列表：\n%s\n\n"
        '只返回一个 JSON 对象，结构严格为 {"<品类id>": {"title": string, "hook": string, "photo": string, "interact": string}}，'
        "品类 id 依次为：%s。不要任何解释文字、不要 markdown 代码块。"
        % (plat["name"], tone, DATE, len(CAT_IDS), "\n".join(lines), ", ".join(CAT_IDS))
    )


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def call_model(user):
    if not API_KEY:
        raise RuntimeError("缺少 LLM_API_KEY")
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    last = None
    for model in MODELS:
        for attempt in range(3):
            payload = json.dumps({"model": model, "messages": messages,
                                  "temperature": 0.7, "max_tokens": 4000}).encode("utf-8")
            req = urllib.request.Request(ENDPOINT, data=payload, headers={
                "Authorization": "Bearer " + API_KEY,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/znryddx/my-content-app",
                "X-Title": "my-content-app"}, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=90) as r:
                    data = json.loads(r.read().decode("utf-8"))
                return extract_json(data["choices"][0]["message"]["content"])
            except urllib.error.HTTPError as e:
                if e.code in (401, 403):
                    raise RuntimeError("HTTP %d 密钥无效" % e.code)
                if e.code == 404:
                    break
                wait = BACKOFF[min(attempt, len(BACKOFF) - 1)] + int(random.uniform(0, 6))
                print("[warn] %s 第%d次失败(%d)，%ds" % (model, attempt + 1, e.code, wait), flush=True)
                last = e
                if attempt < 2:
                    time.sleep(wait)
            except Exception as e:
                print("[warn] %s 第%d次失败：%s" % (model, attempt + 1, e), flush=True)
                last = e
                if attempt < 2:
                    time.sleep(BACKOFF[0] + int(random.uniform(0, 6)))
    raise RuntimeError("所有免费模型均失败: %s" % last)


def is_complete(res):
    if not isinstance(res, dict):
        return False
    if len(res) < len(CAT_IDS):
        return False
    for cid in CAT_IDS:
        it = res.get(cid)
        if not isinstance(it, dict):
            return False
        for f in ("title", "hook", "photo", "interact"):
            v = str(it.get(f, "")).strip()
            if not v or PLACEHOLDER in v:
                return False
    return True


def existing_complete():
    p = os.path.join(ROOT, "data", "platform", DATE + ".json")
    if not os.path.exists(p):
        return False
    try:
        d = json.load(open(p, encoding="utf-8"))
        plat = d.get("platforms", {})
        if len(plat) < len(PLATFORMS):
            return False
        for plat_id in [x["id"] for x in PLATFORMS]:
            cats = plat.get(plat_id, {}).get("categories", {})
            if len(cats) < len(CAT_IDS):
                return False
        for cid in CAT_IDS:
            it = cats.get(cid, {})
            bad = False
            for f in ("title", "hook", "photo", "interact"):
                v = str(it.get(f, "")).strip()
                if not v or PLACEHOLDER in v:
                    bad = True
            if bad:
                return False
        return True
    except Exception:
        return False


def write_platform(res):
    folder = os.path.join(ROOT, "data", "platform")
    os.makedirs(folder, exist_ok=True)
    doc = {"date": DATE, "platforms": {}}
    for plat in PLATFORMS:
        pid = plat["id"]
        cats = {}
        for cid in CAT_IDS:
            it = res.get(cid, {})
            cats[cid] = {
                "title": str(it.get("title", "")).strip() or PLACEHOLDER,
                "hook": str(it.get("hook", "")).strip() or PLACEHOLDER,
                "photo": str(it.get("photo", "")).strip() or PLACEHOLDER,
                "interact": str(it.get("interact", "")).strip() or PLACEHOLDER,
            }
        doc["platforms"][pid] = {"name": plat.get("name", pid), "categories": cats}
    with open(os.path.join(folder, DATE + ".json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

    dp = os.path.join(folder, "dates.json")
    dates = []
    if os.path.exists(dp):
        try:
            dates = json.load(open(dp, encoding="utf-8"))
        except Exception:
            dates = []
    if DATE not in dates:
        dates.append(DATE)
    dates.sort()
    with open(dp, "w", encoding="utf-8") as f:
        json.dump(dates, f, ensure_ascii=False, indent=2)
    print("Wrote data/platform/%s.json (4×%d=32)" % (DATE, len(CAT_IDS)), flush=True)


def main():
    if not PLATFORMS or not CAT_IDS:
        print("config.json 缺少 platforms_module")
        return
    if not API_KEY:
        print("[fatal] 未设置 LLM_API_KEY")
        return
    if existing_complete():
        print("[skip] 当日 platform 数据已齐全，跳过")
        return
    for plat in PLATFORMS:
        result = None
        for attempt in range(4):
            try:
                res = call_model(build_prompt(plat))
            except Exception as e:
                print("[error] %s 生成失败：%s" % (plat["name"], e), flush=True)
                res = {}
            if is_complete(res):
                result = res
                break
            print("[warn] %s 第%d次结构不全，重试" % (plat["name"], attempt + 1), flush=True)
            if attempt < 3:
                time.sleep(12)
        if result is None:
            print("[error] %s 多次失败，写占位待兜底" % plat["name"], flush=True)
            result = {cid: {"title": PLACEHOLDER, "hook": PLACEHOLDER, "photo": PLACEHOLDER, "interact": PLACEHOLDER} for cid in CAT_IDS}
        # 合并到已有 doc（已生成的平台保留）
        folder = os.path.join(ROOT, "data", "platform")
        os.makedirs(folder, exist_ok=True)
        doc_path = os.path.join(folder, DATE + ".json")
        doc = {"date": DATE, "platforms": {}}
        if os.path.exists(doc_path):
            try:
                doc = json.load(open(doc_path, encoding="utf-8"))
            except Exception:
                pass
        if "platforms" not in doc:
            doc["platforms"] = {}
        cats = {}
        for cid in CAT_IDS:
            it = result.get(cid, {})
            cats[cid] = {
                "title": str(it.get("title", "")).strip() or PLACEHOLDER,
                "hook": str(it.get("hook", "")).strip() or PLACEHOLDER,
                "photo": str(it.get("photo", "")).strip() or PLACEHOLDER,
                "interact": str(it.get("interact", "")).strip() or PLACEHOLDER,
            }
        doc["platforms"][plat["id"]] = {"name": plat.get("name", plat["id"]), "categories": cats}
        with open(doc_path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        print("平台 %s 已写入" % plat["name"], flush=True)
        time.sleep(15)  # 平台间间隔避开限流
    # 维护 dates.json
    dp = os.path.join(folder, "dates.json")
    dates = []
    if os.path.exists(dp):
        try:
            dates = json.load(open(dp, encoding="utf-8"))
        except Exception:
            dates = []
    if DATE not in dates:
        dates.append(DATE)
    dates.sort()
    with open(dp, "w", encoding="utf-8") as f:
        json.dump(dates, f, ensure_ascii=False, indent=2)
    print("All done.")


if __name__ == "__main__":
    main()
