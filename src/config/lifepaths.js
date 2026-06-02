// ============================================================
// 数据层 · 命格 / 开局天赋（Lifepath）—— 每一世开始 3 选 1，仅影响「当前一世」。
// 轮回后重新选择（存 player.run.lifepathId）。效果以「修正字段」表达，由 run.getModifiers 聚合，
// 在属性计算 / 战斗 / 资源收益 / 商店 中真实生效（与轮回遗产 legacy 共用同一套修正键）。
//
// 修正键（mods，全部为「相对增量」，getModifiers 把它们叠加到基准 1 / 0 上）：
//   atkMult/hpMult/defMult : 攻/血/防 乘区增量（0.12=+12%；可为负＝削弱）
//   dodgeAdd/critAdd       : 闪避/暴击 加点（百分点）
//   shopDiscount           : 黑市折扣（0.18=便宜18%）
//   poisonMult             : 淬毒伤害增量（0.5=+50%）
//   mineYieldMult/herbYieldMult : 采矿/采药 产出增量
//   vsEliteMult/vsBossMult : 对精英/Boss 伤害增量
//   eventRewardMult        : 奇遇事件 碎银/物料 收益增量
//   karmaGainMult          : 事件中「正向因果」获取增量（孤煞命：因果更易上涨）
//   coinMult/expMult/dropMult : 节点碎银/修为/掉宝 收益增量
//   pillPowerMult          : 服丹永久增益 增量
//   maxAgeAdd              : 本世最大寿元 加成（回合预算）
//   loseExtra              : 战败/陨落 额外惩罚（0.5=惩罚再+50%）
// ============================================================
export const LIFEPATHS = [
    { id: 'sword_bone', name: '天生剑骨', icon: '⚔️',
      desc: '剑修之资，攻势凌厉，然根骨偏薄。', mods: { atkMult: 0.12, defMult: -0.10 } },
    { id: 'herb_root', name: '药灵根', icon: '🌿',
      desc: '通晓草木药性，采药与服丹皆有奇效。', mods: { herbYieldMult: 0.6, pillPowerMult: 0.2 } },
    { id: 'smith_fate', name: '铁匠命', icon: '🔨',
      desc: '天生力大善炼，采矿丰厚、财帛微涨。', mods: { mineYieldMult: 0.5, coinMult: 0.1 } },
    { id: 'lone_fiend', name: '孤煞命', icon: '🩸',
      desc: '煞气加身，攻击大涨，但行事易招因果。', mods: { atkMult: 0.1, karmaGainMult: 1.0 } },
    { id: 'yin_body', name: '玄阴体', icon: '☠️',
      desc: '阴毒入体，毒势暴涨，然气血孱弱。', mods: { poisonMult: 0.5, hpMult: -0.12 } },
    { id: 'swift', name: '轻鸿命', icon: '🪶',
      desc: '身轻如燕，闪避大增，难以被擒。', mods: { dodgeAdd: 8 } },
    { id: 'earth', name: '厚土命', icon: '🪨',
      desc: '体魄厚重，防御坚如磐石，唯身法稍滞。', mods: { defMult: 0.2, dodgeAdd: -3 } },
    { id: 'merchant', name: '商贾命', icon: '💰',
      desc: '精于算计，黑市折扣丰厚，进账亦多。', mods: { shopDiscount: 0.18, coinMult: 0.15 } },
    { id: 'ascetic', name: '苦修命', icon: '🧘',
      desc: '苦修悟道，修为精进飞快，然机缘掉宝偏少。', mods: { expMult: 0.5, dropMult: -0.15 } },
    { id: 'defiant', name: '逆命者', icon: '🔥',
      desc: '逆天而行，斩将屠龙伤害大涨，然一旦陨落代价更重。', mods: { vsBossMult: 0.3, loseExtra: 0.5 } }
];

export const LIFEPATH_MAP = Object.fromEntries(LIFEPATHS.map(l => [l.id, l]));
export function getLifepath(id) { return LIFEPATH_MAP[id] || null; }
