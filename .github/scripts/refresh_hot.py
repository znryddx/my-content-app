#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
发布之后，用「当天」最新热点刷新「简报」的四个时效性版块：
auction（拍卖资讯）/ finance（财经）/ hotnews（热点）/ trend（电商趋势）。

背景：「提前一天生成」唯一的副作用，就是 AI 综述基于前一天的热点素材。
本脚本在内容已经上架之后运行，把这四个版块换成当天早上刚抓到的热点。

刻意做成「尽力而为」：
- 内容在发布 job 里已经就位，此处即使全部失败，App 依然有完整内容（只是热点保留隔夜版本）。
- 任何异常都打印原因后以退出码 0 结束，绝不阻断流水线、不触发误告警。
- 新内容为空或含占位词时保留原文，绝不把已有的好内容覆盖坏。

环境变量：TARGET_DATE（必填）
"""
import os
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))

TARGET = (os.environ.get("TARGET_DATE") or "").strip()
if not TARGET:
    print("[refresh] 未指定 TARGET_DATE，跳过热点刷新")
    sys.exit(0)

REFRESH_IDS = ["auction", "finance", "hotnews", "trend"]
PLACE = ("暂未成功", "生成中", "占位符", "暂无内容", "待生成", "未成功", "内容生成失败")

BRIEF_FILE = os.path.join(ROOT, "data", "brief", TARGET + ".json")


def main():
    if not os.path.exists(BRIEF_FILE):
        print("[refresh] %s 不存在，跳过热点刷新" % BRIEF_FILE)
        return
    # 让被复用的 generate 模块以目标日期初始化（必须在 import 之前设置）
    os.environ["TARGET_DATE"] = TARGET
    os.environ.pop("STAGE_DIR", None)
    sys.path.insert(0, HERE)
    try:
        import generate as G
    except Exception as e:
        print("[refresh] 载入 generate 模块失败：%s" % e)
        return

    feed = G.load_feed()
    if not feed:
        print("[refresh] 无当天热点素材（data/feed/%s.txt 缺失/为空），跳过刷新" % TARGET)
        return

    brief = next((c for c in G.CATEGORIES if c.get("id") == "brief"), None)
    if not brief:
        print("[refresh] config.json 中未找到 brief 分类，跳过")
        return
    cells_meta = brief.get("cells") or G.CELLS
    sub = [c for c in cells_meta if c.get("id") in REFRESH_IDS]
    if not sub:
        print("[refresh] brief 中没有目标版块，跳过")
        return

    lines = ["%s｜%s：%s" % (c["id"], c["title"], G.fill(c.get("prompt", ""), brief)) for c in sub]
    prompt = (
        "请为「每日简报」重新撰写以下 %d 个版块的内容，日期为 %s。\n\n"
        "【重要】必须严格基于下方脚本抓取的当天真实热点素材（含来源）撰写，"
        "不得凭空编造具体新闻、数据或机构名称；素材未覆盖的部分可结合常识做综述。\n\n"
        "【当天真实素材】\n%s\n\n"
        "【需重写的版块】\n%s\n\n"
        "只返回一个 JSON 对象，结构严格为 {\"brief\": {\"cells\": [{\"id\":string,\"title\":string,\"body\":string}...]}}，"
        "cells 顺序与上面版块一致，id 保持一致。不要任何解释文字、不要 markdown 代码块。"
        % (len(sub), TARGET, feed, "\n".join("%d. %s" % (i + 1, p) for i, p in enumerate(lines)))
    )

    try:
        res = G.call_model(prompt)
    except Exception as e:
        print("[refresh] 模型调用失败（保留原热点内容）：%s" % str(e)[:200])
        return

    new_cells = None
    if isinstance(res, dict):
        if isinstance(res.get("brief"), dict):
            new_cells = res["brief"].get("cells")
        elif isinstance(res.get("cells"), list):
            new_cells = res["cells"]
    if not new_cells:
        print("[refresh] 模型未返回可用结构（保留原热点内容）")
        return

    fresh = {}
    for c in new_cells:
        cid = c.get("id")
        body = str(c.get("body", "")).strip()
        if cid in REFRESH_IDS and body and not any(p in body for p in PLACE):
            fresh[cid] = body
    if not fresh:
        print("[refresh] 返回内容为空或含占位（保留原热点内容）")
        return

    try:
        with open(BRIEF_FILE, encoding="utf-8") as f:
            cur = json.load(f)
    except Exception as e:
        print("[refresh] 读取现有 brief 失败：%s" % e)
        return

    n = 0
    for c in cur.get("cells", []):
        if c.get("id") in fresh:
            c["body"] = fresh[c["id"]]
            n += 1
    if not n:
        print("[refresh] 未匹配到任何版块，放弃写入")
        return
    with open(BRIEF_FILE, "w", encoding="utf-8") as f:
        json.dump(cur, f, ensure_ascii=False, indent=2)
    print("[refresh] 已用当天热点刷新 %d 个版块：%s" % (n, ",".join(sorted(fresh.keys()))))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # 兜底：热点刷新永远不许拖垮流水线
        print("[refresh] 未预期异常（忽略）：%s" % str(e)[:200])
    sys.exit(0)
