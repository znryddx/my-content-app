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

为规避免费档 RPM 限流，本脚本将分类「分批」调用：每批 1 个分类单独生成，
靠分类间间隔 + 模型池轮换 + 退避重试避开限流，最大化每日生成成功率（让 B 链路尽量不触发）。
- 结果写入 data/<catId>/<date>.json，并维护 data/<catId>/dates.json（供 App 回看历史）。
"""
import os
import sys
import json
import datetime
import urllib.request
import urllib.error
import time
import random

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
    cfg = json.load(f)

CATEGORIES = cfg.get("categories", [])
CELLS = cfg.get("cells", [])
# 轻角度品类库（含未单独开 tile 的器物，用于简报每日顺带，不生成独立数据文件）
ANGLE_POOL = {a["id"]: a for a in cfg.get("rotation", {}).get("angle_pool", [])}
DATE = datetime.date.today().isoformat()

PRIMARY_MODEL = os.environ.get("LLM_MODEL", "google/gemma-4-31b-it:free")
# 免费档单模型偶发排队/卡死（如 gemma-4-31b 高峰期长时间无响应），
# 故按优先级尝试多个 :free 模型，任一可用即采用，显著提升每日生成成功率。
# 模型池越大，A 链路命中可用模型的概率越高，B 兜底越不需要启动。
MODELS = [PRIMARY_MODEL,
          "google/gemma-4-26b-a4b-it:free",
          "nvidia/nemotron-3-nano-30b-a3b:free",
          "openai/gpt-oss-20b:free",
          "qwen/qwen3-32b:free",
          "meta/llama-3.1-8b-instruct:free",
          "deepseek/deepseek-r1-distill-llama-70b:free",
          "thudm/glm-4-9b:free"]
# 逐次退避基数（秒），叠加随机抖动避免多模型同时重试被集体限流
BACKOFF = [15, 30, 60]
# —— 备用通道：GitHub Models（Actions 内置 GITHUB_TOKEN，零成本零配置）——
# OpenRouter 免费档高峰期会长时间排队/限流，此时切换到 GitHub Models 保底，
# 避免整条日更链路因为单一供应商抖动而中断。
GH_TOKEN = os.environ.get("GH_MODELS_TOKEN", "") or os.environ.get("GITHUB_TOKEN", "")
GH_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions"
GH_MODELS = [
    "openai/gpt-4.1-mini",
    "openai/gpt-4o-mini",
    "meta/Llama-3.3-70B-Instruct",
    "mistralai/Mistral-Nemo",
]
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

BATCH_SIZE = 1  # 每分类单独生成：避免免费模型在批量时掏空前几个分类的 body；靠分类间间隔+重试避开限流


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


def build_batch(cats, extra=""):
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
    if extra:
        head += "\n\n【脚本注入·今日主推约束（仅对简报生效，模型必须严格遵守）】\n%s\n" % extra
    return head


def extract_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def _call_once(endpoint, key, model, user, timeout=90):
    """单次调用，返回 (ok, result)；result 为解析后的 JSON 或错误描述字符串"""
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user},
    ]
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 6000,
    }).encode("utf-8")
    req = urllib.request.Request(
        endpoint, data=payload,
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/znryddx/my-content-app",
            "X-Title": "my-content-app",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
        return True, extract_json(data["choices"][0]["message"]["content"])
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", "ignore")[:300]
        except Exception:
            pass
        return False, ("HTTP%d:%s" % (e.code, detail))
    except Exception as e:
        return False, str(e)


def call_model(user):
    """依次尝试：OpenRouter 免费模型池 -> GitHub Models 池，任一成功即返回"""
    providers = []
    if API_KEY:
        providers.append(("OpenRouter", ENDPOINT, API_KEY, MODELS))
    if GH_TOKEN:
        providers.append(("GitHubModels", GH_ENDPOINT, GH_TOKEN, GH_MODELS))
    if not providers:
        raise RuntimeError("缺少 LLM_API_KEY 环境变量（请在 Actions Secrets 中配置）")

    last = None
    for pname, endpoint, key, models in providers:
        print("[info] 尝试通道: %s（%d 个模型）" % (pname, len(models)), flush=True)
        for model in models:
            for attempt in range(3):
                ok, res = _call_once(endpoint, key, model, user)
                if ok:
                    print("[ok] %s 命中模型 %s" % (pname, model), flush=True)
                    return res
                # 密钥类致命错误：直接放弃该通道
                if isinstance(res, str) and (res.startswith("HTTP401") or res.startswith("HTTP403")):
                    print("[warn] %s 密钥不可用（%s），切换通道" % (pname, res[:120]), flush=True)
                    last = res
                    break
                if isinstance(res, str) and res.startswith("HTTP404"):
                    print("[warn] %s 模型 %s 不存在，换下一个" % (pname, model), flush=True)
                    last = res
                    break
                wait = BACKOFF[min(attempt, len(BACKOFF) - 1)]
                wait = int(wait + random.uniform(0, wait * 0.4))
                print("[warn] %s %s 第%d次失败：%ds后重试 %s"
                      % (pname, model, attempt + 1, wait, str(res)[:120]), flush=True)
                last = res
                if attempt < 2:
                    time.sleep(wait)
        print("[warn] 通道 %s 全部失败，尝试下一个通道" % pname, flush=True)
    raise RuntimeError("所有通道均失败（多为排队/限流），最后错误: %s" % (str(last)[:300],))


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
    # 兜底安全网：模型整体返回空时，用占位文案而非空 body（空 body 会被 App 误判成"生成中"）
    if not gen:
        gen = fallback(cat)
    by_id = {c.get("id"): c for c in gen}
    ordered = []
    for meta in cells_meta:
        c = by_id.get(meta["id"]) or {"id": meta["id"], "title": meta["title"], "body": ""}
        body = str(c.get("body", "")).strip()
        # 空 body 也用占位，避免 App 显示"生成中…"兜底
        if not body:
            body = "（今日自动生成暂未成功，将在下次定时任务重试）"
        ordered.append({"id": meta["id"], "title": meta["title"], "body": body})
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
    real = sum(1 for c in ordered if str(c.get("body", "")).strip() and "暂未成功" not in c["body"])
    print("Wrote data/%s/%s.json  (%d/%d 真实, %d 占位)"
          % (cat_id, DATE, real, len(ordered), len(ordered) - real), flush=True)


def _cat_has_content(res, cat_id, n_meta):
    """判断模型返回中该分类是否每个版块都有非空 body。"""
    if not isinstance(res, dict):
        return False
    gen = res.get(cat_id, {}).get("cells", []) if cat_id in res else res.get("cells", [])
    if not gen or len(gen) < n_meta:
        return False
    return all(str(c.get("body", "")).strip() for c in gen)


def call_batch(batch, extra=""):
    # 每批仅一个分类（BATCH_SIZE=1）：聚焦单分类，避免免费模型在批量时掏空前几个分类
    cat = batch[0]
    cells_meta = cat.get("cells") or CELLS
    n = len(cells_meta)
    result = None
    for attempt in range(4):  # 单分类整体最多 4 轮（每轮内部已轮换 8 个模型 × 3 次）
        try:
            res = call_model(build_batch([cat], extra if cat["id"] == "brief" else ""))
        except Exception as e:
            print("[error] 生成失败：%s" % e, flush=True)
            res = {}
        # 兼容模型偶尔返回单分类旧格式 {"cells":[...]}
        if isinstance(res, dict) and "cells" in res and cat["id"] not in res:
            res = {cat["id"]: res}
        if _cat_has_content(res, cat["id"], n):
            result = res
            break
        print("[warn] 第 %d 次：分类 %s 存在空 body 或结构不全，重试" % (attempt + 1, cat["id"]), flush=True)
        if attempt < 3:
            time.sleep(12)
    if result is None:
        # 非破坏性：若当日该分类已有真实内容（如人工补种），不覆盖为占位
        existing = os.path.join(ROOT, "data", cat["id"], DATE + ".json")
        if os.path.exists(existing):
            try:
                ej = json.load(open(existing, encoding="utf-8"))
                if all(str(c.get("body", "")).strip() and "暂未成功" not in str(c.get("body", ""))
                       for c in ej.get("cells", [])):
                    print("[skip] 分类 %s 已有真实内容，跳过占位覆盖" % cat["id"], flush=True)
                    return True
            except Exception:
                pass
        print("[error] 分类 %s 多次为空，写兜底占位（本次视为生成失败）" % cat["id"], flush=True)
        write_cat(cat, {cat["id"]: {"cells": fallback(cat)}})
        return False
    write_cat(cat, result)
    return True


def chunked(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def load_rotation():
    p = os.path.join(ROOT, cfg.get("rotation", {}).get("state_file", "data/_rotation.json"))
    if os.path.exists(p):
        try:
            d = json.load(open(p, encoding="utf-8"))
            if isinstance(d, dict):
                return d
        except Exception:
            pass
    return {"history": [], "today_main": None, "today_angles": []}


def save_rotation(state):
    p = os.path.join(ROOT, cfg.get("rotation", {}).get("state_file", "data/_rotation.json"))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def cat_label(cid):
    for c in CATEGORIES:
        if c["id"] == cid:
            return c.get("label", cid)
    if cid in ANGLE_POOL:
        return ANGLE_POOL[cid].get("label", cid)
    return cid


def cat_theme(cid):
    for c in CATEGORIES:
        if c["id"] == cid:
            return c.get("theme", c.get("label", cid))
    if cid in ANGLE_POOL:
        return ANGLE_POOL[cid].get("label", cid)
    return cid


def nearest_festival(date_str):
    """近似计算今日/临近节庆（农历节日用公历近似日，仅作内容驱动，非精确历法）。"""
    try:
        y, m, d = (int(x) for x in date_str.split("-"))
    except Exception:
        return None
    fests = [
        (1, 1, "元旦"), (1, 15, "年货节"), (1, 29, "春节"), (2, 12, "元宵"),
        (2, 14, "情人节"), (3, 8, "妇女节"), (4, 5, "清明"), (5, 1, "劳动节"),
        (5, 10, "端午"), (5, 10, "母亲节(近似)"), (6, 1, "儿童节"),
        (6, 10, "父亲节(近似)"), (8, 19, "七夕"), (9, 10, "教师节"),
        (9, 27, "中秋"), (10, 1, "国庆"), (10, 21, "重阳"), (11, 11, "双11"),
        (12, 21, "冬至"), (12, 25, "圣诞"),
    ]
    days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    cur = days[m - 1] + d

    def doy(mo, da):
        return days[mo - 1] + da
    best, best_diff = None, 999
    for fmo, fda, name in fests:
        fd = doy(fmo, fda)
        diff = abs(cur - fd)
        diff = min(diff, 365 - diff)
        if diff < best_diff:
            best_diff, best = diff, name
    return best if best_diff <= 6 else None


def pick_main(pool, history, avoid):
    recent = set(history[-avoid:]) if avoid and avoid > 0 else set()
    cands = [c for c in pool if c not in recent] or list(pool)
    def lu(c):
        return history[::-1].index(c) if c in history else 10 ** 9
    cands.sort(key=lu, reverse=True)
    return cands[0]


def pick_angles(pool, main, history, n):
    others = [c for c in pool if c != main]
    recent = set(history[-3:]) - {main}
    cands = [c for c in others if c not in recent] or others
    rnd = random.Random(DATE)
    rnd.shuffle(cands)
    return cands[:n]


def main():
    if not CATEGORIES:
        print("config.json 中没有 categories")
        return
    if not API_KEY:
        print("[fatal] 未设置 LLM_API_KEY，无法生成。请在仓库 Settings → Secrets → Actions 添加 LLM_API_KEY。")
        sys.exit(1)

    # ---- 轮换决策：每日 1 主推 + 顺带 3 轻角度 ----
    rot = cfg.get("rotation", {})
    pool = rot.get("main_pool") or [c["id"] for c in CATEGORIES if c["id"] not in rot.get("always_daily", [])]
    always = rot.get("always_daily", [])
    avoid = int(rot.get("avoid_repeat_days", 7) or 7)
    n_angles = int(rot.get("brief_light_angles", 3) or 3)

    state = load_rotation()
    history = state.get("history", []) or []
    main_cat = pick_main(pool, history, avoid)
    # 轻角度从完整品类库（含未开 tile 的器物）抽取，保证简报每天带出多品类角度
    angle_ids = [a["id"] for a in (rot.get("angle_pool") or [])] or list(pool)
    angles = pick_angles(angle_ids, main_cat, history, n_angles)
    history.append(main_cat)
    state["history"] = history[-max(avoid, 14):]
    state["today_main"] = main_cat
    state["today_angles"] = angles
    state["date"] = DATE
    save_rotation(state)

    # 香品二级细分：今日定一个 subtype 注入 theme/strategy（确定性，按日期）
    inc_sub = None
    if "incense" in (always + [main_cat]):
        subs = next((c.get("subtypes", []) for c in CATEGORIES if c["id"] == "incense"), []) or []
        if subs:
            seed = sum(int(ch) for ch in DATE if ch.isdigit())
            inc_sub = subs[seed % len(subs)]

    mt = cat_theme(main_cat).replace("{subtype}", inc_sub or "香品")
    fest = nearest_festival(DATE)
    fest_line = ("今日/临近节庆：%s。\n" % fest) if fest else "今日/临近节庆：无重大节庆（平常日）。\n"
    rotation_ctx = (
        "今日主推品类：%s（主题：%s）。\n"
        "简报需顺带轻角度的品类（各给一句轻量角度/钩子即可，不必展开）：%s。\n"
        "%s"
        "主推与顺带品类由脚本固定，严禁自选其他品类作为主推；主推品类已确保与近 %d 天不重复。"
        % (cat_label(main_cat), mt, "、".join(cat_label(a) for a in angles), fest_line, avoid)
    )

    # 待生成集合：默认轮换（常驻+主推）；FULL_REGEN=1 时全量生成所有分类
    if os.environ.get("FULL_REGEN") == "1":
        to_gen_ids = {c["id"] for c in CATEGORIES}
    else:
        to_gen_ids = set(always) | {main_cat}
    to_gen = [c for c in CATEGORIES if c["id"] in to_gen_ids]
    print("今日主推：%s%s | 顺带：%s | 常驻：%s"
          % (cat_label(main_cat), ("·" + inc_sub) if inc_sub else "",
             "、".join(cat_label(a) for a in angles),
             "、".join(cat_label(x) for x in always)))
    print("本次生成 %d 个分类：%s" % (len(to_gen), ",".join(c["id"] for c in to_gen)))

    failed = []
    for i, cat in enumerate(to_gen):
        c = dict(cat)
        if c["id"] == "incense" and inc_sub:
            c["theme"] = (c.get("theme") or "").replace("{subtype}", inc_sub)
            c["strategy"] = (c.get("strategy") or "").replace("{subtype}", inc_sub)
        print("--- %d/%d：%s ---" % (i + 1, len(to_gen), c["id"]), flush=True)
        ok = call_batch([c], rotation_ctx)
        if not ok:
            failed.append(c["id"])
        if i < len(to_gen) - 1:
            time.sleep(25)  # 分类间间隔，进一步避开免费档 RPM
    print("All done.")
    if failed:
        # 有分类仅产出占位/无真实内容：以非零码退出，使 Actions 流水线标记失败并触发告警，
        # 杜绝「假成功 → 静默断更」。需人工或兜底链路介入后重新生成当日内容。
        print("[fatal] 以下分类生成失败（仅占位/无真实内容）：%s。流水线将标记为失败。" % ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
