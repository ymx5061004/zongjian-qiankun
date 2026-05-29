# 纵剑乾坤：百世轮回

一个纯前端、零依赖的网页放置类武侠游戏。原本是单文件 HTML，现重构为「数据 / 状态 / 逻辑 / 视图 / 控制」分层的 ES 模块结构，便于持续扩展。

## 目录结构

```
zongjian-qiankun/
├── index.html          页面骨架（只有结构，交互用 data-act 标注，无 inline JS）
├── styles/
│   └── main.css        全部样式
├── src/
│   ├── config.js       【数据层】静态数据(装备/秘籍/地图/品阶...) + BALANCE 可调数值
│   ├── util.js         通用纯工具(formatNumber 等)
│   ├── state.js        【状态层】唯一数据源 state(player/finalStats/forgeItems...)
│   ├── storage.js      存档：localStorage 读写 + 版本号 + 迁移 + 容错
│   ├── domain.js       【逻辑层】纯规则函数，不碰 DOM、可单测
│   │                     computeStats / generateItem / generateSkill /
│   │                     finalizeEnemyStats / simulateBattle / computeForge* / partition*
│   ├── ui/
│   │   ├── dialog.js    toast / 异步 confirm / 多选 choose（替代 alert/confirm/prompt）
│   │   ├── render.js    【视图层】面板渲染 + tooltip + 切页
│   │   └── battle.js    战斗动画播放 + 挂机循环
│   ├── actions.js       【控制层】玩家动作：校验→改 state→刷新→存档
│   └── main.js          入口：启动流程 + 全局事件委托(data-act 分发)
├── game.js             （旧版单文件逻辑，保留作回退备份，未被引用）
└── README.md
```

分层依赖方向（单向，无循环）：
`config / util` ← `state` ← `domain` ← `render` ← `battle` ← `actions` ← `main`

## 本地预览

⚠️ ES 模块**不能用 `file://` 双击打开**（浏览器 CORS 会拦截模块加载），必须经 HTTP 访问。在本目录起一个静态服务器即可：

```bash
# 方式一：Python（本机已装 3.12）
python -m http.server 8080
# 然后浏览器打开 http://localhost:8080

# 方式二：Node
npx serve .
```

## 部署到服务器

纯静态，**把整个文件夹原样上传**到站点目录即可，无需构建、无需 node 运行时。唯一要求：服务器以正确的 JS MIME 类型（`text/javascript` 或 `application/javascript`）提供 `.js` 文件——主流静态托管（Nginx/Apache/对象存储/CDN）默认都满足。入口是 `index.html`。

## 如何扩展

- **加装备 / 秘籍 / 地图名**：改 `src/config.js` 的 `MATRIX_ITEMS` / `SKILL_SUFFIXES` / `MAP_NAMES`。
- **调平衡**（掉率、奖励、战斗系数、突破/轮回数值、洪炉成本、技能升级花费…）：集中在 `src/config.js` 的 `BALANCE` 对象，改一处即可。
- **加新玩法动作**：在 `src/actions.js` 写控制器函数 → 在 HTML/渲染处加 `data-act="xxx"` → 在 `src/main.js` 的委托 `switch` 里加一个分支。
- **加新页签**：HTML 加 `.page` 容器和 `.tab-btn`（带 `data-act="switch-page" data-page="新名"`）→ 在 `render.js` 的 `switchPage` 里补该页的渲染调用。
- **改战斗规则**：纯逻辑在 `src/domain.js` 的 `simulateBattle`（返回 `{win, events}`），动画演出在 `src/ui/battle.js`，两者解耦——改数值/规则不动动画，改动画不动规则。

## 回退

重构若有问题，可临时回到旧版单文件逻辑：把 `index.html` 末尾的
`<script type="module" src="src/main.js"></script>`
改回
`<script src="game.js"></script>`
即可（`game.js` 是重构前的完整逻辑备份）。

## 存档说明

存档键名 `wuxia_v6_full_save`（沿用旧版，老存档兼容）。结构变更时在 `src/storage.js` 的 `migrate()` 内按 `saveVersion` 逐步升级，旧档不会损坏。
