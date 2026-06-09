// ============================================================
// 数据层 · 秘籍装配「心法 / 禁忌」图鉴（第四阶段·秘籍装配系统）。
// 现有 player.skills（主动/被动）是「拥有」的武学；装配(loadout)决定「携带」哪些进战斗。
// 心法(heart)与禁忌(forbidden)是两类「内置可装配秘籍」——不占背包、按境界解锁/始终可选，
// 选一即占用对应槽位 → 制造「成长方向」与「高收益·高代价」的取舍。
//
// 效果一律用「现有叠加层字段」表达（与 CULTIVATION_PATHS.mods 同构），由 domain.loadoutArtModifiers
// 聚合后折进 computeStats —— 不新增任何战斗分支，面板与实战同源、缺省全 0、旧档/未装配零影响：
//   mult : { hp, atk, def }   五维百分比乘区（整数 %，可负＝代价）
//   flat : { crit, dodge }    暴击/闪避 百分点加成（可负）
//   affix: { ...COMBAT_AFFIX 字段 }  战斗词条点数（critDmg/dmgBonus/bleedPct/openerBonus/dmgReduction/thornsPct/regenPct/lifestealPct…）
//
// 数值平衡集中在此（数据层），调手感只动这里。心法温和(带小代价)、禁忌强力(带硬代价＝门槛)。
// ============================================================

// —— 心法（heart）：改变「基础成长方向」。一世只携带一门，按境界递进解锁（早期仅基础心法可选）。——
export const HEART_ARTS = [
    {
        id: 'heart_basic', name: '吐纳基础心法', icon: '🌬️', unlockRealmLevel: 1,
        desc: '中正平和的入门吐纳，气血与攻击俱有小补，无所偏废。',
        bonuses: ['气血 +6%', '攻击 +3%'], penalties: [],
        mods: { mult: { hp: 6, atk: 3 } }
    },
    {
        id: 'heart_vitality', name: '罡气护体心法', icon: '🛡️', unlockRealmLevel: 1,
        desc: '罡气流转、血脉雄浑——气血流，最宜长久挂机熬战；然攻势稍缓。',
        bonuses: ['气血 +12%', '每回合回血 +4%'], penalties: ['攻击 -5%'],
        mods: { mult: { hp: 12, atk: -5 }, affix: { regenPct: 4 } }
    },
    {
        id: 'heart_sword', name: '奔雷剑心', icon: '⚡', unlockRealmLevel: 8,
        desc: '剑意如奔雷，攻势凌厉、暴起伤人——剑修爆发流；然守御疏薄。',
        bonuses: ['攻击 +10%', '暴击率 +3%', '暴击伤害 +12%'], penalties: ['防御 -6%'],
        mods: { mult: { atk: 10, def: -6 }, flat: { crit: 3 }, affix: { critDmg: 12 } }
    },
    {
        id: 'heart_guard', name: '玄龟息壤功', icon: '🪨', unlockRealmLevel: 8,
        desc: '气沉丹田、稳如息壤——防守流，血厚甲坚、受创大减；唯出手偏软。',
        bonuses: ['防御 +14%', '减伤 +6%'], penalties: ['攻击 -8%'],
        mods: { mult: { def: 14, atk: -8 }, affix: { dmgReduction: 6 } }
    },
    {
        id: 'heart_poison', name: '青莲蚀心经', icon: '☠️', unlockRealmLevel: 12,
        desc: '阴柔毒劲附骨蚀心——持续流，逐回合以流血真伤磨敌；然正面拼杀稍逊。',
        bonuses: ['流血真伤 +20%/回合', '吸血 +4%'], penalties: ['攻击 -5%'],
        mods: { mult: { atk: -5 }, affix: { bleedPct: 20, lifestealPct: 4 } }
    }
];

// —— 禁忌（forbidden）：强收益 + 硬代价（副作用即门槛，无需另设获取流程；UI 强提示副作用）。一世只携带一门，可不带。——
export const FORBIDDEN_ARTS = [
    {
        id: 'forbid_blood', name: '血河禁卷', icon: '🩸', unlockRealmLevel: 1,
        desc: '焚血为引、暴起噬命——暴击伤害与增伤暴涨，然最大气血大损，一击不中便陷死地。',
        bonuses: ['暴击伤害 +40%', '增伤 +12%'], penalties: ['最大气血 -18%'],
        mods: { mult: { hp: -18 }, affix: { critDmg: 40, dmgBonus: 12 } }
    },
    {
        id: 'forbid_poison', name: '蚀骨毒经', icon: '🐍', unlockRealmLevel: 1,
        desc: '万毒入体、附骨之蛆——流血真伤极盛，磨死强敌；然毒侵自身经脉，正面攻击大减。',
        bonuses: ['流血真伤 +35%/回合', '吸血 +6%'], penalties: ['攻击 -15%'],
        mods: { mult: { atk: -15 }, affix: { bleedPct: 35, lifestealPct: 6 } }
    },
    {
        id: 'forbid_life', name: '燃寿剑章', icon: '🔥', unlockRealmLevel: 1,
        desc: '燃烧气血以求一时之勇——开场数招伤害暴涨、增伤大增，然燃寿伤元、自身气血大亏。',
        bonuses: ['先发增伤 +35%（前 2 回合）', '增伤 +15%'], penalties: ['最大气血 -20%'],
        mods: { mult: { hp: -20 }, affix: { openerBonus: 35, dmgBonus: 15 } }
    },
    {
        id: 'forbid_void', name: '无相残篇', icon: '👻', unlockRealmLevel: 1,
        desc: '身形如鬼魅般飘忽——闪避大增、抢占先机，然门户大开、防御荡然。',
        bonuses: ['闪避 +12%', '先发增伤 +15%（前 2 回合）'], penalties: ['防御 -20%'],
        mods: { mult: { def: -20 }, flat: { dodge: 12 }, affix: { openerBonus: 15 } }
    }
];

export const HEART_ART_MAP = Object.fromEntries(HEART_ARTS.map(a => [a.id, a]));
export const FORBIDDEN_ART_MAP = Object.fromEntries(FORBIDDEN_ARTS.map(a => [a.id, a]));
export function getHeartArt(id) { return HEART_ART_MAP[id] || null; }
export function getForbiddenArt(id) { return FORBIDDEN_ART_MAP[id] || null; }
