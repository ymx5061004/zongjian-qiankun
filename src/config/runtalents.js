// ============================================================
// 数据层 · 本世奇珍 / 感悟（RunTalent）—— 第二阶段「流派构筑」。
// 仅影响「当前一世」（存 player.run.runTalents），轮回后清空重攒。来源：精英/Boss 战胜、部分奇遇。
// 效果用与命格/遗产相同的「修正键」表达，由 run.getModifiers 聚合（含新增的战斗词条增量键）：
//   atkMult/hpMult/defMult/dodgeAdd/critAdd/poisonMult/vsEliteMult/vsBossMult/coinMult/...（同 lifepaths）
//   dmgReductionAdd/regenAdd/thornsAdd/lifestealAdd —— 新增「战斗词条增量」，computeStats 叠加到对应词条上。
// school 三系：sword 剑(攻/暴/破阵) · poison 毒(毒伤) · guard 守(减伤/回血/反伤) · common 通用。
//   同一系持有 ≥2 件 → 触发「流派协同」额外加成（见 run.getModifiersFor 的 synergy）。
// ============================================================
export const RUN_TALENTS = [
    // 剑系（与 疾攻/养剑 策略、对精英Boss 协同）
    { id: 't_sword_qi',   name: '剑气纵横', icon: '⚔️', school: 'sword',  desc: '本世攻击 +10%。',                 mods: { atkMult: 0.10 } },
    { id: 't_sword_edge', name: '一往无前', icon: '🗡️', school: 'sword',  desc: '本世暴击 +8%。',                 mods: { critAdd: 8 } },
    { id: 't_sword_break',name: '破阵杀意', icon: '🎯', school: 'sword',  desc: '对精英与 Boss 伤害 +20%。',     mods: { vsEliteMult: 0.20, vsBossMult: 0.20 } },
    // 毒系（与 淬毒 策略协同）
    { id: 't_poison_bone',name: '毒入骨髓', icon: '☠️', school: 'poison', desc: '淬毒伤害 +60%。',               mods: { poisonMult: 0.60 } },
    { id: 't_poison_san', name: '蚀肌散',   icon: '🟢', school: 'poison', desc: '淬毒伤害 +35%，攻击 +5%。',     mods: { poisonMult: 0.35, atkMult: 0.05 } },
    // 守系（与 守心 策略协同）
    { id: 't_guard_bell', name: '金钟罩',   icon: '🛡️', school: 'guard',  desc: '受到伤害额外 -12%（减伤词条）。', mods: { dmgReductionAdd: 12 } },
    { id: 't_guard_turtle',name:'龟息诀',   icon: '🧘', school: 'guard',  desc: '每回合回复 5% 最大气血。',       mods: { regenAdd: 5 } },
    { id: 't_guard_thorn',name: '荆棘护体', icon: '🌵', school: 'guard',  desc: '受击反弹 20% 攻击真伤。',         mods: { thornsAdd: 20 } },
    // 通用
    { id: 't_com_hp',     name: '厚积根骨', icon: '❤️', school: 'common', desc: '本世最大气血 +12%。',           mods: { hpMult: 0.12 } },
    { id: 't_com_vamp',   name: '嗜血',     icon: '🩸', school: 'common', desc: '普攻吸血 +6%。',                 mods: { lifestealAdd: 6 } },
    { id: 't_com_dodge',  name: '凌波身法', icon: '🪶', school: 'common', desc: '本世闪避 +6%。',                 mods: { dodgeAdd: 6 } },
    { id: 't_com_fortune',name: '机缘加身', icon: '💰', school: 'common', desc: '本世节点碎银 +25%、掉宝 +30%。', mods: { coinMult: 0.25, dropMult: 0.30 } }
];

export const RUN_TALENT_MAP = Object.fromEntries(RUN_TALENTS.map(t => [t.id, t]));
export function getRunTalent(id) { return RUN_TALENT_MAP[id] || null; }

// 流派协同：每系持有 ≥2 件时，每多 1 件追加的加成（叠加到修正包）。common 不协同。
export const TALENT_SYNERGY = {
    sword:  { atkMult: 0.05 },        // 剑系每多 1 件：+5% 攻击
    poison: { poisonMult: 0.25 },     // 毒系每多 1 件：+25% 毒伤
    guard:  { dmgReductionAdd: 5 }    // 守系每多 1 件：+5% 减伤
};
