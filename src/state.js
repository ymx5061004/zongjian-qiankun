// ============================================================
// 状态层：全局唯一数据源。
// 所有模块通过 state.player / state.finalStats ... 读写，
// 不再从 DOM 读状态、也不把状态存进 DOM。
// （用一个 state 对象持有，便于 loadGame 整体替换 player 引用）
// ============================================================

// 「百世轮回」本世 Run 状态：每开启/轮回一世重建（见 run.startLife）。
//   lifeNo 世数；age/maxAge 寿元(回合预算)；hp 本世当前气血(null=控制层填满)；karma 因果；
//   regionId/regionIndex 当前区域；nodeMap 当前一世的江湖节点图；currentNodeId/visitedNodes 探索进度；
//   selectedTactic 战前策略；lifepathId 本世命格；runTalents 预留(本世临时增益)；worldFlags 世界标记(驱动事件条件)。
export function makeDefaultRun() {
    return {
        lifeNo: 1, age: 16, maxAge: 80, hp: null, karma: 0,
        regionId: null, regionIndex: 0,
        nodeMap: [], currentNodeId: null, visitedNodes: [],
        nodesDone: 0, clearedBosses: 0, coinGained: 0, expGained: 0,
        selectedTactic: 'balanced', lifepathId: null, runTalents: [], worldFlags: {},
        // 本世临时属性加成（事件 stats 效果）；轮回时清空，不跨世保留
        tempBonus: { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0 }
    };
}

export function makeDefaultPlayer() {
    return {
        name: "", realmLevel: 1, exp: 0, coin: 50000, rebornCount: 0,
        baseHp: 250, baseAtk: 35, baseDef: 15, baseCrit: 5, baseDodge: 5,
        honghuangPower: 0,
        equips: { weapon: null, subweapon: null, armor: null, helm: null, ring: null, artifact: null, amulet: null, gloves: null, boots: null },
        bag: [], bagMax: 16,           // 默认16格；扩容靠黑市常驻购买（见 BALANCE.bag / domain.bagExpandCost）
        skills: [],
        loadout: makeDefaultLoadout(),   // 第四阶段·秘籍装配：携带哪些秘籍进战斗（拥有≠携带；洪荒恒生效不占槽）
        currentMapId: null,
        // —— 生产/挂机 ——
        professions: { mining: { exp: 0 }, smithing: { exp: 0 }, herb: { exp: 0 }, alchemy: { exp: 0 } }, // 各生产技能累计经验
        materials: {},                 // 可堆叠物料仓库 { 物料key: 数量 }
        pillBonus: { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0 }, // 丹药永久根骨增益（服丹累加，跨轮回保留）
        activity: null,                // 当前挂机生产动作 id（与战斗挂机互斥）；存档保留以便读档续挂+离线结算
        lastTickTime: 0,               // 上次存活时间戳（saveGame 时刷新）；读档据此结算离线产出
        achievements: { unlocked: [], claimed: [], stats: {} }, // stats: 策略向成就的累计计数（dodgeCount/winByPath/poisonKills…，按需建键）
        // —— 新手指引任务链（江湖指引）——
        // completed: 已达成任务 id；claimed: 已领奖 id；activeId: 当前推荐任务（由 domain.syncQuestProgress 计算）；
        // stats: 无法从其他状态派生、需累计的计数器（其余进度尽量从既有状态派生，见 domain.getQuestProgress）。
        quests: { completed: [], claimed: [], activeId: null, stats: { battleCount: 0, breakthroughCount: 0, shopVisitCount: 0, affixStageWins: 0 } },
        // —— 修行流派 —— 未择道时为 null（保持原始数值，不施加任何加成/代价）。
        cultivationPath: null,   // 当前流派 id（见 config.CULTIVATION_PATHS）
        pathSelectedAt: 0,       // 首次/最近一次择道时间戳（Date.now()，仅记录）
        pathSwitchCount: 0,      // 改换门庭次数（首次免费不计；用于切换花费几何递增）
        totalKills: 0,
        totalCoinEarned: 0,
        totalForgeCount: 0,
        maxMapCleared: 0,
        // —— 地图词缀成就计数 —— 在特定词缀关卡建功（逆雷而行 / 剑冢寻锋）。
        thunderWins: 0,          // 在「雷泽」词缀关卡的获胜次数
        swordTombWeapons: 0,     // 在「剑冢」词缀关卡夺得的兵刃件数
        // —— 百世轮回 Roguelite ——
        run: makeDefaultRun(),  // 本世进行态（每世重建）
        legacies: [],           // 永久轮回遗产 id 列表（跨世累积，可重复＝叠加）
        // —— 黑市货架 + 刷新状态（goods 存档，页面刷新不重摇；per-life 计数随 startLife 清空）——
        shop: { goods: [], refreshCount: 0, lastRefreshAt: 0, lifeRefreshCount: 0, booksBoughtThisLife: 0, gearBoughtThisLife: 0 },
        // —— 历世记录（江湖录·元进度；跨世永久累积）——
        records: makeDefaultRecords(),
        // —— 第四阶段·江湖委托/宗门订单 + 派系声望（跨世永久累积）——
        orders: makeDefaultOrders(),
        reputation: makeDefaultReputation()
    };
}

// 秘籍装配（第四阶段）：携带进战斗的秘籍。active/passives 存「已拥有 skills 的 id」（active≤1、passives≤3）；
// heart/forbidden 存「内置心法/禁忌图鉴 id」（见 config/manuals.js）。洪荒功法恒生效、不占槽。
export function makeDefaultLoadout() {
    return { active: null, passives: [], heart: null, forbidden: null };
}

// 江湖委托（第四阶段）：active=当前展示的委托实例数组；其余为完成/刷新计数（反无限刷新，刷新费用几何递增）。
export function makeDefaultOrders() {
    return { active: [], completedCount: 0, refreshCount: 0, lastRefreshAt: 0 };
}

// 派系声望（第四阶段）：0~repMax 的整数，跨世永久累积；影响委托奖励倍率 / 稀有委托出现 / 黑市因果风险。
export function makeDefaultReputation() {
    return { qingcheng: 0, yaowang: 0, zhujian: 0, blackmarket: 0, commoners: 0 };
}

// 历世记录：最高世数 / 最深区域 / 最佳本世评分与评价 / 累计斩 Boss / 飞升次数 / 见过的本世感悟。
export function makeDefaultRecords() {
    return { maxLifeNo: 1, deepestRegion: 0, bestScore: 0, bestGrade: '-', bossKills: 0, ascensions: 0, talentsSeen: [] };
}

export const state = {
    player: makeDefaultPlayer(),
    finalStats: {},          // 由 computeStats 派生出的当前战斗属性
    forgeItems: [null, null],// 洪炉两个槽位
    hangupTimer: null,       // 挂机 setInterval 句柄
    battleProgress: 0
};
