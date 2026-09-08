#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
推算下一次要处理的「目标日期」，规则：max(最后发布日的次日, 北京时间今天)。

为什么不用 date.today() 或「今天+1天」：
GitHub Actions 免费档的定时触发延迟 4~5.5 小时且浮动不定，
同一份 cron 有时落在北京当天、有时落在次日凌晨，按运行时刻推算必然会算错日期。
改为以「最后发布日」为基准推进，则无论何时触发、触发几次，得出的目标日期都唯一且正确；
再与「北京今天」取 max，保证轮换万一落后时能先补上今天，而不是继续生成明天的。

用法：next_target.py [强制日期]
输出：YYYY-MM-DD（仅此一行）
"""
import json
import os
import sys
import datetime

CN_TZ = datetime.timezone(datetime.timedelta(hours=8))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    forced = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    if forced:
        print(forced)
        return
    last = None
    try:
        with open(os.path.join(ROOT, "data", "_rotation.json"), encoding="utf-8") as f:
            last = json.load(f).get("date")
    except Exception:
        last = None
    today = datetime.datetime.now(CN_TZ).date()
    cands = [today]
    if last:
        try:
            cands.append(datetime.date.fromisoformat(last) + datetime.timedelta(days=1))
        except Exception:
            pass
    print(max(cands).isoformat())


if __name__ == "__main__":
    main()
