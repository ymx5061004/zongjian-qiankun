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
        bag: [], bagMax: 96,
        skills: [],
        currentMapId: null,
        lastTickTime: 0
    };
}

export const state = {
    player: makeDefaultPlayer(),
    finalStats: {},          // 由 computeStats 派生出的当前战斗属性
    forgeItems: [null, null],// 洪炉两个槽位
    hangupTimer: null,       // 挂机 setInterval 句柄
    battleProgress: 0
};
