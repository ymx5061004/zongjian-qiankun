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
        equips: { weapon: null, subweapon: null, armor: null, helm: null, ring: null, artifact: null },
        bag: [], bagMax: 16,           // 默认16格；扩容靠黑市常驻购买（见 BALANCE.bag / domain.bagExpandCost）
        skills: [],
        currentMapId: null,
        // —— 生产/挂机 ——
        professions: { mining: { exp: 0 }, smithing: { exp: 0 } }, // 各生产技能累计经验
        materials: {},                 // 可堆叠物料仓库 { 物料key: 数量 }
        activity: null,                // 当前挂机生产动作 id（与战斗挂机互斥）；存档保留以便读档续挂+离线结算
        lastTickTime: 0                // 上次存活时间戳（saveGame 时刷新）；读档据此结算离线产出
    };
}

export const state = {
    player: makeDefaultPlayer(),
    finalStats: {},          // 由 computeStats 派生出的当前战斗属性
    forgeItems: [null, null],// 洪炉两个槽位
    hangupTimer: null,       // 挂机 setInterval 句柄
    battleProgress: 0
};
