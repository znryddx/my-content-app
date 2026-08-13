# 我的每日内容 App（零成本自动更新）

打开手机就是你要的内容；内容由 GitHub 服务器在云端自动生成，电脑关机也照常更新，运行零积分。
首页是一个 **Marvis 风格的 2.5D 等距办公室**：左侧装饰区（含挂钟），右侧是若干「工位」卡片，每个工位 = 办公桌 + 转椅 + 显示器，分类名在工位上方；点击工位进入该分类的「6 宫格」内容视图，点击装饰区的**挂钟**可按日期回看历史。

## 原理
```
GitHub Actions（云端定时，每天一次）
  → 调用 GitHub Models 免费额度（内置 GITHUB_TOKEN，已授权 models: read，无需单独建 PAT）
  → 为每个分类生成 6 宫格内容，写入 data/<分类>/<日期>.json 并维护 dates.json（提交回仓库）
  → GitHub Pages 自动重新部署
  → 安卓 App（WebView 全屏）拉取对应日期的 JSON 直接展示
```

## 首页：等距工位画廊（视觉）
- 视觉由 `isometric.js`（SVG 等距引擎手绘家具）生成，纯静态、轻量、手机流畅。
- 工位（分类）与装饰区都在 `config.json` 配置：
  - `categories`：每个分类含 `id` / `label` / `theme`（主题）/ `strategy`（全案营销主题）。
  - `cells`：固定的 6 个宫格版块（`id` / `title` / `prompt`），每个版块的生成提示词，其中 `{theme}`、`{strategy}` 会被自动替换成对应分类的值。
  - `home.decor`：装饰区物件列表（可选 `clock` 作为历史入口）。
- 分类名、显示器图片、宫格提示词你后续随时改 `config.json` 即可，无需改代码。

## 内容视图：6 宫格（交互照搬 Tuudo）
点进某分类 → 今日 6 宫格。手势：
- **左滑**删除该宫格（红，仅本机标记，不影响服务器内容）
- **右滑**标记「已完成」（变灰，仅本机）
- **点击**宫格 → 全屏查看，可一键复制文字
- 右侧**红条**可拖动滚动；底部**＋按钮**可上拖（预留手动添加入口）
- 顶部日期「▾」或首页**挂钟** → 进入日期选择，回看任意历史某天

> 注：删除/已完成状态只存在你手机本机（localStorage），因为内容每天由 GitHub 重新生成，本机状态只管你自己的标记，合理也省事。

## 一、准备仓库
1. 在 GitHub 新建一个**公开**仓库（公开仓库 Actions 免费、无限分钟）。
2. 把本目录所有文件推上去（`config.json` / `index.html` / `app.js` / `isometric.js` / `styles.css` / `data/` / `.github/` / `android/`）。
   - `data/` 下已附带 3 天示例数据，首次打开即有内容；首次定时任务运行后会被真实内容覆盖。

## 二、开 GitHub Pages
仓库 → Settings → Pages → Source 选 **Deploy from a branch** → Branch 选 **main** → folder **/ (root)** → Save。
几分钟后访问 `https://<用户名>.github.io/<仓库名>/` 即可看到办公室首页。

## 三、开启每日自动生成（零配置，免 PAT）
本方案用 GitHub Actions **内置 `GITHUB_TOKEN`** 调用 GitHub Models，只需在 workflow 里加 `models: read` 权限（已写进 `.github/workflows/generate.yml`），**无需单独创建 PAT Secret**。

- 触发：每天 UTC 23:00（≈ 北京 07:00）自动跑；也可在 Actions 页面点 **Run workflow** 立即生成。
- 想换模型：改 `config.json` 的 `model`（如 `openai/gpt-4.1-mini`、`meta/Llama-3.3-70B-Instruct`）。免费档每日约 50 次请求（高档）/150 次（低档），本方案 8 分类 = 8 次/天，绰绰有余。
- 想改更新时间：编辑 `generate.yml` 里的 `cron`（UTC 时间，北京 = UTC+8）。

> 若你更想用独立令牌：创建一个 fine-grained PAT（仅 `Models: Read-only`）存为仓库 Secret `GH_MODELS_PAT`，并把 `generate.yml` 里的 `GITHUB_TOKEN` 改为 `${{ secrets.GH_MODELS_PAT }}` 即可。`generate.py` 会优先用 `GH_MODELS_PAT`，否则用 `GITHUB_TOKEN`。

## 四、安卓真机 App（不是网页，是安装包）
工程在 `android/` 目录，是一个全屏 WebView，加载上面的 Pages 地址。
1. 电脑装 **Android Studio**（免费）：https://developer.android.com/studio
2. 打开 Android Studio → Open → 选择本仓库的 `android/` 文件夹 → 等待 Gradle 同步完成。
3. 打开 `android/app/src/main/res/values/strings.xml`，把 `site_url` 改成你的 Pages 地址。
4. 菜单 Build → **Build APK(s)**（或点 ▶ Run 用模拟器跑）。
5. 把生成的 `app-debug.apk` 传到手机安装（需开启「允许未知来源应用」）。
之后每天打开这个 App 图标，就是自动更新好的内容，全屏、无地址栏、不像网页。

> 注：安卓工程需你用 Android Studio 点一下打包（免费）。Web 端（Pages）可立即验证内容效果。

## 本地预览（无需部署）
双击打开 `preview.html` 即可看到完整效果（等距首页 + 6 宫格 + 手势 + 挂钟回看，内置示例数据，离线可用）。
