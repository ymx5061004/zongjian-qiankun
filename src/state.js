// ============================================================
// 状态层：全局唯一数据源。
// 所有模块通过 state.player / state.finalStats ... 读写，
// 不再从 DOM 读状态、也不把状态存进 DOM。
// （用一个 state 对象持有，便于 loadGame 整体替换 player 引用）
// ============================================================

export function makeDefaultPlayer() {
    return {
        name: "", realmLevel: 1, exp: 0, coin: 50000, rebornCount: 0,
        baseHp: 250, baseAtk: 35, baseDef: 15, baseCrit: 5, baseDodge: 5,
        honghuangPower: 0,
        equips: { weapon: null, subweapon: null, armor: null, helm: null, ring: null, artifact: null, amulet: null, gloves: null, boots: null },
        bag: [], bagMax: 16,           // 默认16格；扩容靠黑市常驻购买（见 BALANCE.bag / domain.bagExpandCost）
        skills: [],
        currentMapId: null,
        // —— 生产/挂机 ——
        professions: { mining: { exp: 0 }, smithing: { exp: 0 }, herb: { exp: 0 }, alchemy: { exp: 0 } }, // 各生产技能累计经验
        materials: {},                 // 可堆叠物料仓库 { 物料key: 数量 }
        pillBonus: { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0 }, // 丹药永久根骨增益（服丹累加，跨轮回保留）
        activity: null,                // 当前挂机生产动作 id（与战斗挂机互斥）；存档保留以便读档续挂+离线结算
        lastTickTime: 0,               // 上次存活时间戳（saveGame 时刷新）；读档据此结算离线产出
        achievements: { unlocked: [], claimed: [] },
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
        swordTombWeapons: 0      // 在「剑冢」词缀关卡夺得的兵刃件数
    };
}

export const state = {
    player: makeDefaultPlayer(),
    finalStats: {},          // 由 computeStats 派生出的当前战斗属性
    forgeItems: [null, null],// 洪炉两个槽位
    hangupTimer: null,       // 挂机 setInterval 句柄
    battleProgress: 0
};
