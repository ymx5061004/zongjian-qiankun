// ============================================================
// 数据层 · 敌人词条（EnemyAffix）—— 第二阶段「精英/Boss 词条化」。
// 精英固定挂 1 个、Boss 挂 1 个（生成节点图时随机分配并存于 node.enemyAffixes，可预览）；
// 因果反噬时再额外叠加「天罚」。finalizeNodeEnemy 据此调敌人属性并设战斗字段，simulateBattle 结算：
//   atkMult/hpMult : 敌人攻击/气血乘区（生成敌人时即应用）
//   regenPct       : 敌人每回合回复「最大气血」此% (真回血)
//   thornsPct      : 敌人受击反弹「你本次伤害」此%真伤（克高攻速杀）
//   dmgReduction   : 敌人受到伤害 -此%（克脆皮，逼出破甲/持久）
//   lifesteal      : 敌人命中你时按命中伤害回血此%
// 「天罚」(heavenly) 仅由 karma 反噬注入，不进随机池（pool=false）。
// ============================================================
export const ENEMY_AFFIXES = [
    { id: 'berserk', name: '狂暴', icon: '😡', pool: true, desc: '攻击大幅提升。',           e: { atkMult: 0.35 } },
    { id: 'regen',   name: '再生', icon: '💚', pool: true, desc: '每回合回复气血，须速杀。', e: { regenPct: 6 } },
    { id: 'thorns',  name: '荆棘', icon: '🌵', pool: true, desc: '受击反弹真伤，克高攻。',   e: { thornsPct: 25 } },
    { id: 'tough',   name: '护体', icon: '🪨', pool: true, desc: '受到伤害降低，克脆皮。',   e: { dmgReduction: 25 } },
    { id: 'vampire', name: '嗜血', icon: '🦇', pool: true, desc: '命中你时回血，越拖越难。', e: { lifesteal: 30 } },
    // —— 因果反噬专用（不进随机池）——
    { id: 'heavenly',name: '天罚', icon: '⚡', pool: false, desc: '高因果引来天道反噬：攻防血俱增。', e: { atkMult: 0.5, hpMult: 0.5, regenPct: 4 } }
];

export const ENEMY_AFFIX_MAP = Object.fromEntries(ENEMY_AFFIXES.map(a => [a.id, a]));
export const ENEMY_AFFIX_POOL = ENEMY_AFFIXES.filter(a => a.pool).map(a => a.id);
export function getEnemyAffix(id) { return ENEMY_AFFIX_MAP[id] || null; }
