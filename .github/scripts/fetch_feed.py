#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
抓取当日热点 RSS / 新闻源，输出 data/feed/<date>.txt，供「简报」生成使用。

设计要点（零成本）：
- 抓取是普通脚本联网（curl 式 urllib 请求），不受模型是否联网限制，0 元。
- GitHub Actions 境外环境可访问 Google News RSS（按关键词搜中文），作为
  财经/宏观/拍卖文玩类主力源；国内 RSS（36氪/少数派/钛媒体/澎湃）作科技补充。
- 单源失败不影响整体（兜底跳过），不阻塞生成。
输出格式：每行「【分类】标题 — 摘要(截断)」，供后续拼进简报 prompt 当真实素材。
"""
import os
import re
import datetime
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATE = datetime.date.today().isoformat()
FEED_DIR = os.path.join(ROOT, "data", "feed")
os.makedirs(FEED_DIR, exist_ok=True)

UA = "Mozilla/5.0 (compatible; my-content-app/1.0; +https://github.com/znryddx/my-content-app)"

# (分类标签, RSS/Atom URL)
SOURCES = [
    ("科技互联网", "https://36kr.com/feed"),
    ("科技互联网", "https://sspai.com/feed"),
    ("科技互联网", "https://www.tmtpost.com/rss.xml"),
    ("综合新闻",   "https://www.thepaper.cn/rss.jsp"),
    # 以下 Google News RSS 在 GitHub Actions(境外)环境可访问，沙箱本地可能 000 属正常
    ("财经宏观",   "https://news.google.com/rss/search?q=%E4%B8%AD%E5%9B%BD%E8%B4%A2%E7%BB%8F%20%E5%AE%8F%E8%A7%82%E7%BB%8F%E6%B5%8E&hl=zh-CN&gl=CN&ceid=CN:zh-CN"),
    ("财经宏观",   "https://news.google.com/rss/search?q=A%E8%82%A1%20%E8%82%A1%E5%B8%82&hl=zh-CN&gl=CN&ceid=CN:zh-CN"),
    ("拍卖文玩",   "https://news.google.com/rss/search?q=%E6%8B%8D%E5%8D%96%20%E6%96%87%E7%89%A9%20%E6%94%B6%E8%97%8F&hl=zh-CN&gl=CN&ceid=CN:zh-CN"),
    ("拍卖文玩",   "https://news.google.com/rss/search?q=%E5%98%89%E5%BE%B7%20%E4%BF%9D%E5%88%A9%20%E6%88%90%E4%BA%A4&hl=zh-CN&gl=CN&ceid=CN:zh-CN"),
]

ATOM = "{http://www.w3.org/2005/Atom}"
PER_SOURCE = 6
MAX_SUMMARY = 110


def fetch(url, timeout=20):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def parse_items(xml_text):
    items = []
    try:
        root = ET.fromstring(xml_text)
    except Exception as e:
        print("[warn] XML 解析失败: %s" % e)
        return items
    # RSS
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        desc = (item.findtext("description") or "").strip()
        link = (item.findtext("link") or "").strip()
        if title:
            items.append((title, desc, link))
    # Atom
    if not items:
        for entry in root.iter(ATOM + "entry"):
            title = (entry.findtext(ATOM + "title") or "").strip()
            node = entry.find(ATOM + "content") or entry.find(ATOM + "summary")
            desc = (node.text or "").strip() if node is not None else ""
            link = ""
            for l in entry.findall(ATOM + "link"):
                link = l.get("href") or ""
                if link:
                    break
            if title:
                items.append((title, desc, link))
    return items


def clean(html):
    txt = re.sub(r"<[^>]+>", " ", html)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt[:MAX_SUMMARY]


def main():
    out = []
    for cat, url in SOURCES:
        try:
            xml_text = fetch(url)
            items = parse_items(xml_text)[:PER_SOURCE]
            for title, desc, link in items:
                line = "【%s】%s" % (cat, title)
                summary = clean(desc)
                if summary:
                    line += " — " + summary
                out.append(line)
        except Exception as e:
            print("[warn] 抓取失败 %s : %s" % (url, e))
    text = "# 今日热点素材 (%s)\n\n" % DATE + "\n".join(out)
    path = os.path.join(FEED_DIR, DATE + ".txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("Wrote %s (%d 条)" % (path, len(out)))


if __name__ == "__main__":
    main()
