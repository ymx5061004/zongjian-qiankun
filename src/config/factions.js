// ============================================================
// 数据层 · 派系声望特权（Faction Perks）—— 第五阶段「派系声望特权」。
// 把第四阶段「委托涨声望」升级为「声望解锁玩法特权」：五大派系各 3 档，按 player.reputation 自动解锁。
// 纯数据：特权效果以 mods（修正键）表达，由 src/factions.js 的纯函数聚合，被 computeStats(战斗) /
// run(开世/结算) / orders(刷新) / render(展示) 读取。声望数值沿用第四阶段（player.reputation，0~repMax）。
//
// 字段：level 解锁所需该派声望；id 唯一；name/desc 展示；mods 修正键；risk:true 标记「有因果/业力风险」(黑市)。
// mods 键（聚合后被各层读取，缺省 0）：
//   —— 战斗（computeStats → stats.build）——
//   swordForceChance  : 暴击额外获得剑势的概率（青城）
//   swordBreakArmor   : 破绽斩额外无视防御比例（青城）
//   swordRefundOnBreak: 破 Boss 招后返还的剑势层数（青城）
//   poisonLifesteal   : 毒蚀爆发按伤害回血比例（药王谷，亦为破万毒 Boss 毒潮的特权 id 'yw_antidote'）
//   overchargeCostMult: 炉心过载消耗倍率增量（铸剑，负＝更便宜）
//   overchargePowerBonus / overchargeReductionBonus : 过载增伤/减伤额外加成（铸剑）
//   forbiddenDmgBonus : 携带禁忌秘籍时的增伤%（黑市，risk）
//   —— 玩法（run / orders）——
//   restHeal Bonus     : 调息节点回血比例增量（药王谷）
//   eventKarmaReduce  : 奇遇所获「正向因果」减免（药王谷）
//   orderRefreshMult  : 委托刷新费用倍率增量（黑市，负＝更便宜，risk）
//   rareRepReqCut     : 稀有/史诗委托声望门槛下调（黑市，risk）
//   eventRewardBonus  : 奇遇碎银/物料收益增量（无名村镇）
//   deathPenaltyReduce: 陨落损失碎银的减免比例（无名村镇）
//   legacyPoolBonus   : 生死结算遗产候选池 +N（无名村镇）
// ============================================================
export const FACTION_PERKS = {
    // 青城派：剑势 / 暴击 / 破招
    qingcheng: [
        { level: 20, id: 'qc_sword_1', name: '青城剑引', desc: '暴击时额外 25% 概率获得剑势。', mods: { swordForceChance: 0.25 } },
        { level: 50, id: 'qc_sword_2', name: '松风破壁', desc: '破绽斩额外无视 15% 防御。', mods: { swordBreakArmor: 0.15 } },
        { level: 80, id: 'qc_sword_3', name: '归鞘再发', desc: '破 Boss 招式后返还 1 层剑势。', mods: { swordRefundOnBreak: 1 } }
    ],
    // 药王谷：解毒 / 休整 / 毒蚀回血 / 降因果
    yaowang: [
        { level: 20, id: 'yw_antidote', name: '药王解毒', desc: '毒蚀爆发时按伤害回血 20%；并可破万毒 Boss 的毒潮招式。', mods: { poisonLifesteal: 0.2 } },
        { level: 50, id: 'yw_rest', name: '悬壶济世', desc: '调息节点恢复气血额外 +20%。', mods: { restHealBonus: 0.2 } },
        { level: 80, id: 'yw_karma', name: '积善之家', desc: '奇遇所获正向因果 -1（更易积善缘）。', mods: { eventKarmaReduce: 1 } }
    ],
    // 铸剑山庄：强化 / 打造 / 炉心过载 / 破招
    zhujian: [
        { level: 20, id: 'zj_forge_1', name: '山庄秘锻', desc: '炉心过载消耗 -30%。', mods: { overchargeCostMult: -0.3 } },
        { level: 50, id: 'zj_forge_2', name: '赤炉淬兵', desc: '炉心过载增伤额外 +8%。', mods: { overchargePowerBonus: 8 } },
        { level: 80, id: 'zj_forge_3', name: '神工护体', desc: '炉心过载减伤额外 +6%。', mods: { overchargeReductionBonus: 6 } }
    ],
    // 黑市牙行：禁忌 / 刷新 / 稀有 —— 必带因果风险
    blackmarket: [
        { level: 20, id: 'bm_forbidden', name: '禁卷研习', desc: '携带禁忌秘籍时增伤 +6%。', mods: { forbiddenDmgBonus: 6 }, risk: true },
        { level: 50, id: 'bm_refresh', name: '牙行门路', desc: '江湖委托刷新费用 -25%。', mods: { orderRefreshMult: -0.25 }, risk: true },
        { level: 80, id: 'bm_rare', name: '销金窟', desc: '稀有/史诗委托声望门槛 -10（更易浮现）。', mods: { rareRepReqCut: 10 }, risk: true }
    ],
    // 无名散修：低风险 / 善缘 / 事件链 / 死亡结算保底
    commoners: [
        { level: 20, id: 'cm_death', name: '乡邻相助', desc: '陨落损失碎银 -30%。', mods: { deathPenaltyReduce: 0.3 } },
        { level: 50, id: 'cm_event', name: '广结善缘', desc: '奇遇碎银/物料收益 +15%。', mods: { eventRewardBonus: 0.15 } },
        { level: 80, id: 'cm_legacy', name: '香火绵延', desc: '生死结算遗产候选池 +1（更易择得心仪遗产）。', mods: { legacyPoolBonus: 1 } }
    ]
};

// 黑市派系（特权带风险）：UI 用以加因果风险提示。
export const RISK_FACTIONS = ['blackmarket'];
