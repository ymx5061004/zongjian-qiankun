// ============================================================
// 数据层 · 构筑机制（Build Mechanics）—— 第五阶段「构筑机制化 / 战斗状态引擎」。
// 把「数值堆叠的流派」升级为「拥有不同战斗规则的构筑」：剑势 / 毒蚀 / 守势 / 影步 / 炉心过载。
//
// 每个机制由 computeStats 据「流派 / 心法 / 禁忌 / 装备词条 / 派系特权」判定是否启用（enabled），
// 启用后把本表的阈值/概率/倍率写进 stats.build.<mech>，由 simulateBattle 的「战斗状态引擎」读取结算。
//   ⚠️ 没有任何构筑条件时 → 全部 enabled=false → 战斗逻辑与第四阶段完全一致（旧档/dev sim 零影响）。
//
// 全部数值集中在此（数据层），调手感只动这里 + BALANCE.builds。机制语义：
//   剑势 swordForce ：暴击/主动命中攒势，满阈值触发「破绽斩」(额外伤害·部分无视防御·残血追加斩杀)。
//   毒蚀 poison     ：流血/淬毒/毒修出手攒毒层，满阈值触发「毒蚀爆发」(按敌最大气血百分比真伤·对再生敌增效·对Boss降效)。
//   守势 guard      ：受击攒势，满阈值抵消下一次大伤害的一部分并反震；接住 Boss 蓄力招＝破招。
//   影步 afterimage ：闪避成功攒残影，下一击追加一段较弱攻击；对「必中/雷罚」Boss 招式失效。
//   炉心 forge      ：战前过载（消耗锭/碎银 + 本世次数），本战增伤/减伤，可破特定 Boss 招式（仅 opts.overcharge 时生效）。
// ============================================================

export const BUILD_TAGS = {
    sword:  { key: 'sword',  name: '剑势', icon: '⚔️' },
    poison: { key: 'poison', name: '毒蚀', icon: '☠️' },
    guard:  { key: 'guard',  name: '守势', icon: '🛡️' },
    dodge:  { key: 'dodge',  name: '影步', icon: '🪶' },
    forge:  { key: 'forge',  name: '炉心', icon: '🔥' }
};

// 各机制的引擎参数（computeStats 据 enabled 写入 stats.build；缺省字段＝该机制无此项）。
export const BUILD_RULES = {
    // 剑势：暴击 +forceOnCrit、主动命中 +forceOnActive；满 threshold 触发破绽斩。
    //   破绽斩 = 攻击 × breakDmgMult，无视 breakArmorPen 比例的敌防；敌残血(<executeLowPct%)再追加 攻击 × executeMult。
    //   青城派特权可叠：forceChance(暴击额外攒势概率)/extraArmorPen/refundOnBossBreak(破 Boss 招返还势)。
    sword: {
        threshold: 4, forceOnCrit: 1, forceOnActive: 1,
        breakDmgMult: 1.1, breakArmorPen: 0.4,
        executeLowPct: 30, executeMult: 0.4
    },
    // 毒蚀：玩家出手且毒/流血源生效时每回合 +1 层，满 threshold 爆发。
    //   爆发真伤 = 敌最大气血 × maxHpPct（对 Boss × bossEff；敌带再生时 × (1+regenBonus)）。爆发后扣减 threshold 层、可再攒。
    poison: {
        threshold: 6, maxStacks: 8, maxHpPct: 0.035,
        bossEff: 0.5, regenBonus: 0.5
    },
    // 守势：受击 +gainPerHit（体修/守心额外 +gainBonus，由 computeStats 合并）；满 threshold 后，
    //   仅在「大伤害」(蓄力招 或 单击≥bigHitPct×最大气血)来临时抵消 absorbPct 并反震 攻击 × counterPct 真伤。
    //   ⚠️ 只接「大招」是刻意设计：守势是抗爆发/破招工具，不在普通小伤害上堆生存→体修在常规战不被无脑拉满。
    guard: {
        threshold: 4, gainPerHit: 1, absorbPct: 0.35, counterPct: 0.15, bigHitPct: 0.15
    },
    // 影步：闪避成功 +1 残影，满 threshold（默认 1）后下一回合追加 攻击 × followAtkPct 的一击。
    dodge: {
        threshold: 1, followAtkPct: 0.7, maxStacks: 3
    },
    // 炉心过载：战前抉择，消耗 costIngot 个「已装备兵刃对应档的锭」+ costCoin 碎银 + 本世 1 次（perLifeCap 上限）。
    //   本战增伤 dmgBonusPct、减伤 dmgReductionPct；铸剑山庄特权可降耗(costMult)/增威(powerBonus)。仅 opts.overcharge 时进战斗。
    forge: {
        dmgBonusPct: 18, dmgReductionPct: 10, costIngot: 1, costCoin: 3000, perLifeCap: 3
    }
};

// 构筑原型（UI / 构筑摘要 / Boss 破招建议用的展示文案）。strengths/weaknesses 短句；counters＝擅长破解的 Boss 招式方向。
export const BUILD_ARCHETYPES = {
    sword:  { key: 'sword',  name: '剑势流', icon: '⚔️', strengths: ['暴击攒势爆发', '破防斩杀'], weaknesses: ['生存偏薄', '怕被压制连击'], counters: ['抢断蓄力重击', '剑壁/反击型 Boss'] },
    poison: { key: 'poison', name: '毒蚀流', icon: '☠️', strengths: ['百分比真伤磨血', '克高血厚甲'], weaknesses: ['前期偏慢', '怕毒抗/速战'], counters: ['回血/再生型 Boss', '高血幻雾 Boss'] },
    guard:  { key: 'guard',  name: '守势流', icon: '🛡️', strengths: ['硬接大招', '反震消耗'], weaknesses: ['输出偏软', '怕持久磨耗'], counters: ['雷劫/天罚重击', 'Boss 蓄力大招'] },
    dodge:  { key: 'dodge',  name: '影步流', icon: '🪶', strengths: ['闪避补刀', '克高攻慢速敌'], weaknesses: ['怕必中/范围', '体魄薄'], counters: ['高攻慢速 Boss', '可闪避的重击'] },
    forge:  { key: 'forge',  name: '炉心流', icon: '🔥', strengths: ['过载爆发', '硬破强招'], weaknesses: ['吃材料/碎银', '一世次数有限'], counters: ['雷劫硬破', '剑壁强攻'] }
};

// 影步「高闪避自动启用」阈值（无身法流派/无相残篇时，纯堆闪避也可玩影步）。
export const DODGE_ENABLE_DODGE = 18;
