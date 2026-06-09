// ============================================================
// 逻辑层 · 派系声望特权（第五阶段）。纯函数：据 player.reputation 计算已解锁特权、聚合修正。
// 仅依赖数据层 config/factions.js —— 不依赖 domain/run，故 domain(战斗)、run(开世/结算)、orders(刷新)、
// render(展示) 均可单向 import 本模块，无循环依赖。
// ============================================================
import { FACTION_PERKS } from './config/factions.js';

// 某派系当前已解锁的特权（声望 ≥ level）。返回带 faction 字段的特权数组。
export function getFactionPerks(player) {
    const rep = (player && player.reputation && typeof player.reputation === 'object') ? player.reputation : {};
    const out = [];
    for (const [faction, perks] of Object.entries(FACTION_PERKS)) {
        (perks || []).forEach(p => { if ((rep[faction] || 0) >= (p.level || 0)) out.push(Object.assign({ faction }, p)); });
    }
    return out;
}

// 是否已解锁某特权 id。
export function hasFactionPerk(player, perkId) {
    return getFactionPerks(player).some(p => p.id === perkId);
}

// 把所有已解锁特权的 mods 求和（缺省键不出现）。各层按需取键，缺则视为 0。
export function factionPerkMods(player) {
    const acc = {};
    getFactionPerks(player).forEach(p => {
        for (const [k, v] of Object.entries(p.mods || {})) { if (Number.isFinite(v)) acc[k] = (acc[k] || 0) + v; }
    });
    return acc;
}

// 战斗相关修正（供 computeStats 折进 stats.build）。归一化为固定字段 + 已解锁特权 id 列表（供 Boss 破招 factionPerk 条件）。
export function factionBuildModifiers(player) {
    const m = factionPerkMods(player);
    return {
        swordForceChance: m.swordForceChance || 0,
        swordBreakArmor: m.swordBreakArmor || 0,
        swordRefundOnBreak: m.swordRefundOnBreak || 0,
        poisonLifesteal: m.poisonLifesteal || 0,
        overchargeCostMult: m.overchargeCostMult || 0,
        overchargePowerBonus: m.overchargePowerBonus || 0,
        overchargeReductionBonus: m.overchargeReductionBonus || 0,
        forbiddenDmgBonus: m.forbiddenDmgBonus || 0,
        perkIds: getFactionPerks(player).map(p => p.id)
    };
}

// 玩法（run/orders）相关修正：归一化为固定字段。
export function factionRunModifiers(player) {
    const m = factionPerkMods(player);
    return {
        restHealBonus: m.restHealBonus || 0,
        eventKarmaReduce: m.eventKarmaReduce || 0,
        eventRewardBonus: m.eventRewardBonus || 0,
        deathPenaltyReduce: m.deathPenaltyReduce || 0,
        legacyPoolBonus: m.legacyPoolBonus || 0,
        orderRefreshMult: m.orderRefreshMult || 0,
        rareRepReqCut: m.rareRepReqCut || 0
    };
}

// 各派「已解锁 + 下一档」进度（UI 用）。返回 { faction: { unlocked:[perk], next:perk|null } }。
export function factionPerkProgress(player) {
    const rep = (player && player.reputation && typeof player.reputation === 'object') ? player.reputation : {};
    const out = {};
    for (const [faction, perks] of Object.entries(FACTION_PERKS)) {
        const cur = rep[faction] || 0;
        const sorted = (perks || []).slice().sort((a, b) => (a.level || 0) - (b.level || 0));
        out[faction] = {
            unlocked: sorted.filter(p => cur >= (p.level || 0)),
            next: sorted.find(p => cur < (p.level || 0)) || null
        };
    }
    return out;
}
