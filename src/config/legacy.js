// ============================================================
// 数据层 · 轮回遗产（Legacy）—— 生死结算后 3 选 1，「永久」继承，跨世累积（存 player.legacies）。
// 同一遗产可重复获得，但受 maxStacks 上限约束；重复叠加使用 repeatModifiers（效果递减，防膨胀）。
// 修正键含义与命格 lifepaths 完全一致（共用 getModifiers）。
// 设计要求：至少一半遗产影响「玩法路线」而非纯属性（黑市/采矿/采药/毒流/奇遇/寿元/财帛/掉宝…）。
// 第一阶段：在 属性计算 / 资源收益 / 战斗 中真实生效。
// ============================================================
export const LEGACIES = [
    // —— 纯属性向（maxStacks:5，重复递减至约 30%）——
    {
        id: 'sword_awaken', name: '剑意初醒', icon: '🗡️',
        desc: '新一世攻击 +5%（叠加递减，最多 5 层）。',
        maxStacks: 5,
        mods: { atkMult: 0.05 },
        repeatModifiers: { atkMult: 0.015 }
    },
    {
        id: 'tough_fate', name: '命硬', icon: '❤️',
        desc: '新一世最大气血 +12%（叠加递减，最多 5 层）。',
        maxStacks: 5,
        mods: { hpMult: 0.12 },
        repeatModifiers: { hpMult: 0.04 }
    },
    {
        id: 'shadow', name: '轻身残影', icon: '🪶',
        desc: '闪避 +6%（叠加递减，最多 5 层）。',
        maxStacks: 5,
        mods: { dodgeAdd: 6 },
        repeatModifiers: { dodgeAdd: 2 }
    },
    // —— 玩法路线向（maxStacks:8，重复约 30~50%）——
    {
        id: 'formation', name: '破阵心得', icon: '🎯',
        desc: '对精英与 Boss 伤害 +25%（叠加递减，最多 8 层）。',
        maxStacks: 8,
        mods: { vsEliteMult: 0.25, vsBossMult: 0.25 },
        repeatModifiers: { vsEliteMult: 0.08, vsBossMult: 0.08 }
    },
    {
        id: 'blackmarket', name: '黑市旧识', icon: '🤝',
        desc: '黑市价格 -12%；本世刷新次数上限 +1（叠加递减，最多 4 层）。',
        maxStacks: 4,
        mods: { shopDiscount: 0.12 },
        repeatModifiers: { shopDiscount: 0.04 }
    },
    {
        id: 'poison_page', name: '毒谱残页', icon: '☠️',
        desc: '淬毒伤害 +40%（叠加递减，最多 8 层）。',
        maxStacks: 8,
        mods: { poisonMult: 0.4 },
        repeatModifiers: { poisonMult: 0.12 }
    },
    {
        id: 'mine_sense', name: '矿脉感知', icon: '⛏️',
        desc: '采矿与矿脉节点收益 +60%（叠加递减，最多 8 层）。',
        maxStacks: 8,
        mods: { mineYieldMult: 0.6 },
        repeatModifiers: { mineYieldMult: 0.18 }
    },
    {
        id: 'herb_grace', name: '药王余泽', icon: '🌿',
        desc: '采药与药谷节点收益 +60%（叠加递减，最多 8 层）。',
        maxStacks: 8,
        mods: { herbYieldMult: 0.6 },
        repeatModifiers: { herbYieldMult: 0.18 }
    },
    {
        id: 'pill_resist', name: '丹毒抗性', icon: '💊',
        desc: '丹药副作用降低，服丹永久增益 +20%（叠加递减，最多 5 层）。',
        maxStacks: 5,
        mods: { pillPowerMult: 0.2 },
        repeatModifiers: { pillPowerMult: 0.06 }
    },
    {
        id: 'gear_ember', name: '器魂余烬', icon: '✨',
        desc: '战斗机缘掉宝率 +50%（叠加递减，最多 8 层）。',
        maxStacks: 8,
        mods: { dropMult: 0.5 },
        repeatModifiers: { dropMult: 0.15 }
    },
    {
        id: 'wanderer', name: '江湖阅历', icon: '📜',
        desc: '奇遇收益 +35%，因果更易积累（叠加递减，最多 8 层）。',
        maxStacks: 8,
        mods: { eventRewardMult: 0.35, karmaGainMult: 0.5 },
        repeatModifiers: { eventRewardMult: 0.1, karmaGainMult: 0.15 }
    },
    {
        id: 'longevity', name: '龟寿绵长', icon: '🐢',
        desc: '本世最大寿元 +12（叠加递减，最多 6 层）。',
        maxStacks: 6,
        mods: { maxAgeAdd: 12 },
        repeatModifiers: { maxAgeAdd: 4 }
    },
    {
        id: 'wealth_star', name: '财帛星君', icon: '🪙',
        desc: '节点碎银收益 +30%（叠加递减，最多 8 层）。',
        maxStacks: 8,
        mods: { coinMult: 0.3 },
        repeatModifiers: { coinMult: 0.09 }
    }
];

export const LEGACY_MAP = Object.fromEntries(LEGACIES.map(l => [l.id, l]));
export function getLegacy(id) { return LEGACY_MAP[id] || null; }
