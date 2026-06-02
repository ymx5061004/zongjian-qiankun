# 纵剑乾坤：百世轮回

一个纯前端、零依赖的网页放置类武侠游戏。原本是单文件 HTML，现重构为「数据 / 状态 / 逻辑 / 视图 / 控制」分层的 ES 模块结构，便于持续扩展。

## 目录结构

```
zongjian-qiankun/
├── index.html          页面骨架（只有结构，交互用 data-act 标注，无 inline JS）
├── styles/
│   └── main.css        全部样式
├── src/
│   ├── config.js       【数据层】静态数据(装备/秘籍/地图/品阶...) + BALANCE 可调数值(含 BALANCE.roguelite)
│   ├── config/         【数据层·百世轮回】内容数据(拆分以免 config.js 膨胀)
│   │   ├── tactics.js    5 种战前策略(稳/疾攻/守心/淬毒/养剑)
│   │   ├── lifepaths.js  10 个开局命格(仅当前一世)
│   │   ├── legacy.js     13 个轮回遗产(永久跨世累积)
│   │   ├── regions.js    5 个江湖区域 + 节点构成模板 + 战场修饰
│   │   ├── events.js     25 个奇遇事件(数据驱动的选择/效果/条件，含事件链)
│   │   ├── runtalents.js 12 个本世奇珍/感悟(剑/毒/守/通用 三系，仅当世) ★二期
│   │   └── enemyaffixes.js 敌人词条(狂暴/再生/荆棘/护体/嗜血/天罚) ★二期
│   ├── util.js         通用纯工具(formatNumber 等)
│   ├── state.js        【状态层】唯一数据源 state(player/finalStats/...)；player.run/legacies 为轮回态
│   ├── storage.js      存档：localStorage 读写 + 版本号 + 迁移 + 容错（v5：补全 run/legacies）
│   ├── domain.js       【逻辑层】纯规则函数，不碰 DOM、可单测
│   │                     computeStats(含命格/遗产修正) / simulateBattle(含策略/持久血量) / 生成器 / ...
│   ├── run.js          【逻辑层·百世轮回】纯引擎：命格遗产修正聚合 / 节点图生成 / 敌人 /
│   │                     奇遇结算 / 节点奖励计划 / 生死结算。仅依赖 config，被 domain 反向依赖(无循环)
│   ├── ui/
│   │   ├── dialog.js    toast / 异步 confirm / 多选 choose / chooseCard(卡片三选一)
│   │   ├── render.js    【视图层】面板渲染 + tooltip + 切页
│   │   ├── battle.js    战斗动画播放 + 挂机循环
│   │   └── run.js       【视图+控制·百世轮回】轮回主页渲染 + 命格/事件/战果/结算弹窗 + 节点控制器
│   ├── actions.js       【控制层】玩家动作：校验→改 state→刷新→存档
│   └── main.js          入口：启动流程 + 全局事件委托(data-act 分发)
├── game.js             （旧版单文件逻辑，保留作回退备份，未被引用）
└── README.md
```

分层依赖方向（单向，无循环）：
`config / config/* / util` ← `run` ← `domain` ← `render` ← `battle` ← `actions` ← `ui/run` ← `main`
（`run.js` 只依赖数据层，故 `domain.computeStats` 可反向取其修正而不成环。）

## 🆕 百世轮回 Roguelite（第一阶段）

新核心循环（默认首页「☯ 百世轮回」）：

> **开局命格 → 江湖路线选择 → 节点(战斗/奇遇/生产/奇遇) → 流派构筑 → 生死结算 → 轮回遗产 → 下一世变局**

- **命格**：每世开局 3 选 1，仅影响当世（攻/防/血/采集/折扣…）。
- **江湖棋盘**：每世为当前区域生成一张节点图（战斗/精英/Boss/奇遇/矿脉/药谷/锻造/黑市/调息）。探索若干节点解锁区域 Boss。
- **寿元与气血**：节点流逝寿元（回合预算），气血在本世内**持久**（战斗损血、调息/药谷/奇遇回血）；陨落或寿尽即结算。
- **战前策略**：5 种，真实进入 `simulateBattle` 结算（疾攻先发增伤但更脆 / 守心减伤降攻 / 淬毒逐回合叠真伤 / 养剑第 5 回合爆发）。
- **生死结算**：展示本世编号/节点数/斩 Boss/进账/因果/评价，并 3 选 1 一缕**轮回遗产**（永久、可叠加）带入下一世。
- **轮回遗产**：13 个，至少半数影响玩法路线（黑市折扣/采矿采药增产/毒流/对 Boss 增伤/奇遇收益/寿元…）。
- 旧的境界、装备、秘籍、生产、丹药、碎银修为皆为**永久成长**，跨世保留——百关征途/秘境/生产各页一并保留，新循环「接管」而非取代。

> 平衡旋钮集中在 `config.js → BALANCE.roguelite`（敌人强度/寿元/节点收益/因果阈值/天赋），内容数据在 `config/*.js`。

### 第二阶段（已实现）

- **江湖棋盘·分支路线**：每世生成<b>分层 DAG</b>（节点带 `row/col/next`），沿当前路径择路前行（高风险/稳健分叉），Boss 在末程；棋盘按「第 N 程」分层渲染，显示可达/未达/已探索。旧平铺存档自动兼容。
- **精英 / Boss 词条化**：精英挂 1 条、Boss 挂 1 条敌人词条（生成时预挂、棋盘可预览），战斗真实结算——再生(须速杀)、护体(逼破甲)、荆棘(克高攻)、嗜血(越拖越难)、狂暴。普通战斗节点不挂词条（前期平滑）；百关/秘境零影响。
- **流派构筑·本世奇珍**：精英/Boss 战胜与部分奇遇 3 选 1「感悟」，<b>仅当世有效</b>、轮回清空；分剑/毒/守/通用四系，<b>同系 ≥2 触发协同</b>，与战前策略联动（毒系×淬毒、守系×守心…）。
- **因果 karma 深化**：高因果 → Boss 叠「⚡天罚」反噬（更强、厚赏、斩之洗业）；低因果 → 善缘庇佑（黑市折扣 + 奇遇收益）；新增因果/事件链奇遇，链路 payoff 会被优先触发。
- **平衡修复**：轮回遗产须「本世 ≥3 节点或斩 Boss」方可获得（反空轮回刷属性）、3 选 1 优先未拥有(先广后深)、按本世评价缩放；黑市刷新费用<b>几何递增 + 随时间衰减</b>（反 500 文无限刷新钓鱼）。

### 第三阶段（已实现）

- **节点连线可视化**：棋盘用 SVG 在节点间画出分支连线（贝塞尔曲线），<b>已走过(金)/当前可前往(绿)/未来(暗)</b> 三色区分，随渲染与窗口缩放重绘。
- **区域剧情 + 多结局飞升**：每区域开场叙事（首世入场 / 深入新区域时）；踏破最后区域之主可<b>「⭐ 飞升·通天」</b>——按<b>因果/主修流派</b>给不同结局（煞神/仙道/剑仙/毒尊/不灭金身/通天）+ 终局厚赏 + 记录飞升，随后开启新一世。
- **江湖录·图鉴 + 历世记录**：新页「📓 江湖录」——策略/命格/遗产/感悟/敌词条 全图鉴（已拥有/已识高亮）+ 历世记录（最高世/最深区/最佳评价/累计斩 Boss/飞升次数/收集度）+ 三系构筑建议。记录存 `player.records`（v7）。
- **Boss 机制化**：区域之主超出词条——<b>残血狂暴</b>（一次性提攻）+ <b>周期蓄力大招</b>（逢 N 回合一击 ×倍率），战斗日志标注；仅 Boss 生效，百关/秘境零影响。

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
- **加新页签**：在 `index.html` 左侧菜单 `<aside class="nav-sidebar">` 的某个 `.menu-group` 里加一个 `.menu-item` 按钮（带 `data-act="switch-page" data-page="新名"`），并加对应 `.page` 容器 → 在 `render.js` 的 `switchPage` 里补该页的渲染调用。整组新功能（如未来的采集/加工技能）则新增一个 `.menu-group` 分组。导航是左侧竖向分组菜单（桌面常驻、移动端汉堡抽屉），分组标题点击折叠（`data-act="toggle-group"`）。
- **改战斗规则**：纯逻辑在 `src/domain.js` 的 `simulateBattle`（返回 `{win, events}`），动画演出在 `src/ui/battle.js`，两者解耦——改数值/规则不动动画，改动画不动规则。
- **加生产技能 / 采集·加工动作**（武侠版梅尔沃的非战斗侧）：往 `src/config.js` 的 `PROFESSIONS`（技能）/ `MATERIALS`（可堆叠物料）/ `ACTIVITIES`（挂机动作：读条·消耗·产出·给谁经验）加数据即可，通用挂机引擎 `src/ui/idle.js` 直接驱动（含等级/经验、离线收益、与战斗挂机互斥），**引擎本身不用改**。新增独立技能页同「加新页签」。`craftItem` 类动作产出随机装备进背包、背包满则自动熔炼成碎银。

## 平衡模拟工具（dev，零依赖·不影响正式游戏）

开发用的平衡观测工具，复用 `src/domain.js` 的纯逻辑（`finalizeEnemyStats` / `computeStats` / `simulateBattle` / `resolveMapEnv` …）模拟 1~100 关通关曲线、奖励曲线、各流派强度、离线收益。**正式入口 `index.html` 不引用它，`game.js` 不受影响。**

- **核心**：`dev/sim-core.js`（纯逻辑，仅 import `src/config.js` / `src/domain.js` / `src/state.js`，无 DOM，Node 与浏览器均可跑；用 `.js` 而非 `.mjs` 是为了让静态服务器以 JS MIME 提供、浏览器才肯按模块加载）。
- **方式一·Node CLI**（控制台表格，无需任何依赖）：
  ```bash
  node scripts/balance-sim.mjs            # 跑全部
  node scripts/balance-sim.mjs enemy      # 仅①敌人曲线
  node scripts/balance-sim.mjs power      # ②战力曲线
  node scripts/balance-sim.mjs reward     # ⑤奖励曲线
  node scripts/balance-sim.mjs path 50    # ③④第50关·5流派胜率对比
  node scripts/balance-sim.mjs offline mine_iron   # ⑥离线收益
  ```
- **方式二·浏览器页面**（表格 + 按钮，经 HTTP 访问，**勿 file:// 双击**）：
  ```bash
  python -m http.server 8080
  # 浏览器开 http://localhost:8080/dev/balance-sim.html
  ```
- **模拟项**：① 关卡→敌人气血/攻击/防御　② 推荐配置玩家战力　③④ 各流派同配置胜率 + 平均回合（自动调参把无流派基线拉到 ~50% 作公平战力锚，再比流派）　⑤ 每场胜利碎银/修为/掉落（按 `BALANCE.reward` + 词缀再推导）　⑥ 离线收益（按生产动作再推导，封顶 12h）+ 离线 vs 在线同轴对比。
- **说明**：奖励/离线逻辑在 `ui/battle.js` / `ui/idle.js`（依赖 DOM），故按 `BALANCE` 常量「再推导」，与正式逻辑可能有细微漂移，已在输出注明；无法精确模拟项会标注、不伪造结果。

## 回退

重构若有问题，可临时回到旧版单文件逻辑：把 `index.html` 末尾的
`<script type="module" src="src/main.js"></script>`
改回
`<script src="game.js"></script>`
即可（`game.js` 是重构前的完整逻辑备份）。

## 存档说明

存档键名 `wuxia_v6_full_save`（沿用旧版，老存档兼容）。当前 `SAVE_VERSION = 5`（v5 新增百世轮回 `run`/`legacies`）。结构变更时在 `src/storage.js` 的 `migrate()` / `normalizePlayer()` 内按 `saveVersion` 逐步升级 + 默认值兜底，旧档不会损坏（缺 `run`/`legacies` 等新字段会自动补全，旧档加载后处于「未入轮回」态，打开「百世轮回」页点【开启第一世】即可，原有进度不受影响）。导入/导出存档同样走 `normalizePlayer`，旧档导入不炸。

## 致谢与声明

- **原版来源**：<https://gamers520.com/BAIS.html>
- **原作者**：老区长

本项目是在上述原版基础上进行的模块化重构，仅供个人学习与技术交流，不作任何商业用途。游戏创意与原始内容版权归原作者所有。若有侵权，请与本人联系，将第一时间删除或下架。
