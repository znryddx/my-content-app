#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
发布脚本：把 generate.py 提前生成在暂存区（data/_pre/<date>/）的内容搬到正式目录，
并在这一刻推进轮换。纯文件操作，不调用任何 AI 接口 —— 不受免费额度限流影响，可视为必成。

设计要点：
1. 生成与发布解耦：AI 生成在前一天完成（有一整夜时间重试 429），发布在当天早上执行。
2. 轮换一天只推进一次：仅在发布时写 _rotation.json，
   根除「同一 workflow 每天触发 N 次就推进 N 次」导致的轮换乱跳、history 被反复截断。
3. 已存在的真实内容一律不覆盖：保护人工补种与本地主引擎的产出。
4. 幂等：当天已发布过再次执行会安全跳过，可放心配多个错峰 cron 兜底。

环境变量：
  TARGET_DATE  目标发布日期（必填，由 workflow 显式传入，UTC/北京时差已在那里换算好）
  STAGE_DIR    暂存目录，默认 data/_pre/<TARGET_DATE>
"""
import os
import sys
import json
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATE = (os.environ.get("TARGET_DATE") or "").strip()
if not DATE:
    print("[fatal] 未指定 TARGET_DATE，拒绝猜测日期（Actions runner 走 UTC，today() 会差一天）。")
    sys.exit(1)

STAGE_DIR = (os.environ.get("STAGE_DIR") or "").strip() or os.path.join("data", "_pre", DATE)
STAGE_ROOT = os.path.join(ROOT, STAGE_DIR)
PLACE = ("暂未成功", "生成中", "占位符", "暂无内容", "待生成", "未成功", "内容生成失败")


def has_real_content(path):
    """文件存在且每个版块都有真实内容（非占位）。"""
    if not os.path.exists(path):
        return False
    try:
        with open(path, encoding="utf-8") as f:
            j = json.load(f)
    except Exception:
        return False
    cells = j.get("cells")
    if cells is None:
        # platform / hub 等非 cells 结构，只要有内容即视为有效
        return bool(j)
    if not cells:
        return False
    return all(str(c.get("body", "")).strip() and not any(p in str(c.get("body", "")) for p in PLACE)
               for c in cells)


def update_dates(cat_id):
    folder = os.path.join(ROOT, "data", cat_id)
    dates_path = os.path.join(folder, "dates.json")
    dates = []
    if os.path.exists(dates_path):
        try:
            with open(dates_path, encoding="utf-8") as f:
                dates = json.load(f)
        except Exception:
            dates = []
    if DATE not in dates:
        dates.append(DATE)
        dates.sort()
    os.makedirs(folder, exist_ok=True)
    with open(dates_path, "w", encoding="utf-8") as f:
        json.dump(dates, f, ensure_ascii=False, indent=2)


def advance_rotation(meta):
    """推进轮换：一天仅一次，且严格沿用生成阶段算好的决策（保证主推与已生成内容一致）。"""
    try:
        with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception as e:
        print("[warn] 无法读取 config.json，跳过轮换推进：%s" % e)
        return
    rot_rel = cfg.get("rotation", {}).get("state_file", "data/_rotation.json")
    rot_path = os.path.join(ROOT, rot_rel)
    try:
        with open(rot_path, encoding="utf-8") as f:
            state = json.load(f)
    except Exception:
        state = {}
    if not isinstance(state, dict):
        print("[warn] %s 结构异常，已重置为初始状态" % rot_rel)
        state = {}

    avoid = int(cfg.get("rotation", {}).get("avoid_repeat_days", 7) or 7)
    history = list(state.get("history", []) or [])
    main_cat = meta.get("main_cat")
    if not main_cat:
        print("[warn] _meta.json 缺少 main_cat，跳过轮换推进（内容已搬运，但 App 主推 tile 可能错位）")
        return
    # 幂等：当天已推进过则不再追加，避免重复跑本 job 时 history 二次增长
    if state.get("date") == DATE:
        print("[skip] 轮换 date 已是 %s，跳过推进（幂等）" % DATE)
        return
    history.append(main_cat)
    state["history"] = history[-max(avoid, 14):]
    state["today_main"] = main_cat
    state["today_angles"] = meta.get("angles", state.get("today_angles", []))
    state["date"] = DATE
    with open(rot_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    print("[rotation] %s -> main=%s angles=%s history[-4:]=%s"
          % (DATE, main_cat, state["today_angles"], state["history"][-4:]))


def main():
    if not os.path.isdir(STAGE_ROOT):
        print("[fatal] 暂存目录不存在：%s —— 前一天的生成可能失败了，本次无内容可发布。" % STAGE_DIR)
        sys.exit(1)

    meta_path = os.path.join(STAGE_ROOT, "_meta.json")
    meta = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as e:
            print("[warn] _meta.json 解析失败：%s" % e)

    published, skipped, rejected = [], [], []
    for entry in sorted(os.listdir(STAGE_ROOT)):
        src_dir = os.path.join(STAGE_ROOT, entry)
        if not os.path.isdir(src_dir):
            continue
        src = os.path.join(src_dir, DATE + ".json")
        if not os.path.exists(src):
            continue
        cat_id = entry
        # 防线：生成失败只会写出占位文案，绝不能把占位搬到线上（宁可不动用昨天的内容）
        if not has_real_content(src):
            rejected.append(cat_id)
            continue
        dst_dir = os.path.join(ROOT, "data", cat_id)
        dst = os.path.join(dst_dir, DATE + ".json")
        if has_real_content(dst):
            skipped.append(cat_id)
            continue
        os.makedirs(dst_dir, exist_ok=True)
        with open(src, encoding="utf-8") as f:
            content = json.load(f)
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        update_dates(cat_id)
        published.append(cat_id)

    print("[publish] %s：搬运 %d 个分类%s" % (DATE, len(published), ("：" + ",".join(published)) if published else ""))
    if skipped:
        print("[publish] 已存在真实内容，未覆盖 %d 个分类：%s" % (len(skipped), ",".join(skipped)))
    if rejected:
        print("[publish] 暂存内容为占位，拒绝搬运 %d 个分类：%s" % (len(rejected), ",".join(rejected)))

    if meta:
        advance_rotation(meta)
    else:
        print("[warn] 暂存区缺少 _meta.json，未推进轮换")

    if not published and not skipped:
        print("[fatal] 暂存区没有任何可发布内容。")
        sys.exit(1)
    print("[publish] done.")


if __name__ == "__main__":
    main()
