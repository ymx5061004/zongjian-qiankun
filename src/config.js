// ============================================================
// 数据层：静态游戏数据 + 可调数值。
// 调平衡、加内容（新装备/秘籍/地图）只动这个文件。
// ============================================================

export const ITEM_PREFIXES = ["破旧的", "青铜", "百炼精铁", "沉香木", "寒霜", "流光", "紫电", "赤焰", "龙骨", "诛仙", "太虚", "造化", "乾坤", "鸿蒙", "荒古始源", "无上天道掌控者"];

export const MATRIX_ITEMS = {
    weapon: ["长剑", "唐刀", "重剑", "长枪", "利刃", "折扇", "长鞭", "战斧", "拂尘", "拳套", "方天画戟", "屠龙宝刀"],
    subweapon: ["飞刀", "袖箭", "毒针", "判官笔", "金刚杵", "乾坤圈", "爆裂火弹", "暴雨梨花针"],
    armor: ["布衣", "皮甲", "链甲", "玄武重铠", "金丝软甲", "流光战袍", "太极道衣", "九天神魔仙衣"],
    helm: ["头巾", "皮帽", "精铁盔", "紫金冠", "凤翅玲珑盔", "大罗天御冕", "混元无极发冠"],
    ring: ["铜指环", "骨质项链", "青玉佩", "龙纹扳指", "乾坤避毒符", "大罗天魂坠", "混沌鸿蒙神印"],
    artifact: ["炼妖壶", "东皇钟", "昆仑镜", "神农鼎", "山河社稷图", "七宝妙树", "太极图", "诛仙剑阵图"]
};

export const QUALITY_NAMES = ["凡品", "良品", "上品", "精品", "史诗", "神话"];
// 品阶配色（原来散落在 tooltip 里的魔法数组，统一到此处）
export const QUALITY_COLORS = ["#7f8c8d", "#2ecc71", "#3498db", "#9b59b6", "#e67e22", "#e74c3c"];

export const SKILL_SECTS = ["少林", "武当", "峨眉", "华山", "丐帮", "魔教", "逍遥", "昆仑", "桃花岛", "大理段氏"];
export const SKILL_TYPES = ["降魔", "纯阳", "凌波", "太极", "夺命", "无极", "浩然", "逆天", "九幽", "混元"];

export const SKILL_SUFFIXES = [
    { name: "掌", type: "active", power: 1.5, desc: "气吞山河，造成[伤害]倍输出。" },
    { name: "剑诀", type: "active", power: 1.9, desc: "万剑归宗，造成[伤害]倍输出。" },
    { name: "噬血术", type: "active", power: 1.8, healRate: 0.3, desc: "造成[伤害]倍输出并吸血 30%。" },
    { name: "神功", type: "passive", hp: 150, atk: 30, desc: "每重永久叠加[气血]气血和[攻击]攻击。" },
    { name: "心法", type: "passive", def: 20, dodge: 1.5, desc: "每重永久叠加[防御]防御与[闪避]%闪避。" },
    { name: "真卷", type: "passive", atk: 40, crit: 1.5, desc: "每重永久叠加[攻击]攻击与[暴击]%暴击率。" },
    { name: "寻龙诀", type: "passive", dropRate: 15, desc: "每重永久提升【掉宝率】 15%。" },
    { name: "招财秘录", type: "passive", coinRate: 15, desc: "每重增加 15% 碎银获取率。" }
];

export const REALMS = ["后天", "先天", "宗师", "大宗师", "渡劫", "天仙", "金仙", "仙帝", "神话", "至高天尊"];

export const MAP_NAMES = [
    "青竹林", "恶狼谷", "黑风寨", "断魂坡", "清风观", "野猪林", "饮马驿", "飞鹰帮", "鸣沙湾", "连环坞",
    "狂狮堂", "神剑山庄", "铁剑门", "聚贤庄", "恶人谷", "快活林", "缥缈峰", "光明顶", "桃花岛", "侠客岛",
    "昆仑巅", "极寒雪域", "烈焰焚城", "幽冥鬼道", "万剑冢", "锁妖塔", "伏魔殿", "归墟之地", "幻灭深渊", "九天玄界",
    "天门关", "落星峡", "荒古禁地", "寂灭荒原", "天心湖", "浮空岛", "九幽冥府", "紫薇圣境", "无量海", "虚空断层",
    "太初矿场", "灵木森林", "赤焰峡谷", "落雷沼泽", "寒冰洞穴", "暗影迷踪", "血色祭坛", "圣殿遗迹", "众神花园", "枯骨荒原",
    "极乐净土", "无间地狱", "天机阁", "星辰之海", "轮回道", "彼岸花海", "幽梦古境", "苍穹之顶", "云梦泽", "古战场",
    "碎星域", "龙脉山", "天道台", "封魔地", "归元宗", "剑圣谷", "战神府", "万妖林", "死寂之海", "永恒森林",
    "雷劫洞", "火云窟", "冰封谷", "灵台山", "紫云峰", "望月阁", "沉星湖", "葬剑崖", "乱魔岗", "炼心路",
    "断天涯", "洗髓池", "铸兵台", "悟道峰", "登仙路", "问天台", "飞仙谷", "镇魔关", "斩仙境", "凌云顶",
    "九重天", "圣皇都", "神隐界", "造化府", "混沌海", "极境之渊", "至尊殿", "永恒领域", "终焉神座", "虚空尽头"
];

export const epicStory = [
    "混沌初开，大道崩坏。",
    "你曾是上古时期傲视万界的无上天尊，却在纪元劫难中身陨，真灵遁入轮回。",
    "历经九十九世的沉沦与蒙昧，今生的你，终于苏醒。",
    "这是一个灵气枯竭、妖魔横行、传承断绝的末法时代。",
    "但你的灵魂深处，正激荡着一股古老而禁忌的本源——",
    "那正是传说中，足以颠覆天道、逆转乾坤的【老区长的洪荒之力】。",
    "百关征途，前路死局；天地洪炉，万物皆可炼造！",
    "握紧手中的凡铁，去重铸昔日的荣光，斩破这无尽的虚空吧！"
];

// ============================================================
// 可调数值（设计平衡集中处）。数值与原版逐一对齐。
// ============================================================
export const BALANCE = {
    rebornMultPerCount: 0.6,          // 每次轮回的全属性乘区: 1 + rebornCount * 0.6
    honghuangMultPerLevel: 0.02,      // 洪荒之力每重的五维乘区: 1 + power * 0.02
    dodgeCap: 75,                     // 闪避率硬上限(%)：避免堆到 100% 后战斗永不掉血、必胜无敌

    breakthrough: { costPerLevel: 400, hpGain: 80, atkGain: 18, defGain: 8 },
    reborn: { minLevel: 20, baseHp: 250, baseAtk: 35, baseDef: 15 },

    enemy: { baseHp: 280, baseAtk: 35, baseDef: 5 }, // 敌人基础值, 再乘 2^(mapId-1)

    battle: {
        maxRounds: 20,
        critMult: 1.8,
        activeSkillChance: 0.4,       // 每回合触发主动技概率
        activeLevelScale: 0.18,       // 主动技伤害倍率随等级: power + level*0.18
        animStaggerMs: 60,            // 逐回合动画错峰间隔
        playerActionDelayMs: 30,      // 玩家出手相对敌人的延迟
        hpResetDelayMs: 1200,         // 战斗结束后血条复位延迟
        intervalMs: 2200,             // 挂机每场战斗间隔
        logMax: 200                   // 战斗日志最多保留条数（修原版 innerHTML += 内存泄漏）
    },

    reward: {
        coinBase: 50, coinPerMap: 30,
        expBase: 40, expPerMap: 40,
        baseDrop: 0.20,               // 基础掉宝率, 再乘 dropRate/100
        loseCoinRate: 0.05            // 战败损失当前碎银比例
    },

    // 装备品阶概率（rollQ ∈ [0,100), 从高到低匹配）
    qualityRoll: [
        { min: 98.0, q: 5 },
        { min: 93, q: 4 },
        { min: 82, q: 3 },
        { min: 55, q: 2 },
        { min: 20, q: 1 }
        // 其余为 q=0
    ],
    itemPrice: { base: 200, growth: 2.5 }, // 回收价 = base * growth^quality

    forge: {
        costRate: 0.3, costBase: 100,         // 启动花费 = (p1+p2)*costRate + costBase
        upgradeSameQ: 0.35, upgradeDiffQ: 0.10,
        multRealmScale: 0.1, multBonus: 1.5,  // 装备合成倍率 = (q+1)*(1+realm*0.1)*1.5
        enchantPayloadMult: 5,                // 附魔时秘籍属性放大倍数
        resultPriceMult: 2.5                  // 合成装备售价 = cost * 2.5
    },

    skill: {
        normalMaxLevel: 10, hhMaxLevel: 100,
        normalUpgradeCostPerLevel: 800,       // 升级耗修为 = level * 800
        hhUpgradeCostPerLevel: 12000,         // 洪荒功法 = level * 12000
        baseRate: 0.35
    },
    hhSkillPrice: 380000,

    shopHHChance: 0.4,                        // 黑市出现洪荒孤本的概率
    shopRefreshCost: 500,                     // 黑市手动刷新花费(文)

    // —— 生产/挂机引擎（采矿·锻造…通用）——
    idle: {
        maxLevel: 99,                         // 生产技能等级上限
        expC: 50, expP: 2,                    // 升级累计经验曲线: 到达 L 级所需累计经验 = expC * (L-1)^expP
        offlineCapMs: 12 * 3600 * 1000,       // 离线最多结算 12 小时
        offlineReportMinMs: 2 * 60 * 1000     // 离线提示门槛：低于此时长不弹提示(产出照常结算)，避免刷新/切后台时被小额离线打扰
    },

    // —— 神兵强化（采矿/锻造的核心产出口：用锭+碎银强化已装备的装备）——
    // ⚖️ 平衡旋钮(待试玩后调，全在这一处)：当前成本随目标级线性涨(ingotQty=目标级)，
    //    故高档锭(玄晶/+16~18)是有意的"终局长草"瓶颈、低档锭前期会富余——若试玩觉得高段太肝，
    //    可把 enhanceCost 的 ingotQty 改缓(如 Math.ceil(target/3))、或把 levelsPerTier 改成不对称分档、
    //    或调 coinPerLevel 与品阶系数。强化与敌人 2^关 缩放的配速也在这里权衡。
    enhance: {
        perLevel: 0.08,            // 每 +1：该装备 攻/防/血 基础值 ×(1 + 0.08*N)，不影响暴击/闪避
        maxLevel: 18,              // 强化上限 +18（满级 ×2.44）
        levelsPerTier: 3,          // 每 3 级跨一档锭(越高级强化越吃高级锭 → 逼着往深矿挖)
        coinPerLevel: 400,         // 单次碎银 = 目标级 * 400 * (品阶+1)
        ingotTiers: ['ingot_copper', 'ingot_iron', 'ingot_xuan', 'ingot_cold', 'ingot_star', 'ingot_jade']
    }
};

// ============================================================
// 生产技能体系（武侠版梅尔沃的「非战斗」侧）。
// 加新技能：往 PROFESSIONS 加一个键；加新产物：往 MATERIALS 加；
// 加新挂机动作：往 ACTIVITIES 加一条（数据驱动，通用引擎 src/ui/idle.js 直接吃）。
// 目前首条产线：采矿(出矿石) → 锻造(熔炼成锭 / 打造神兵进背包)。
// ============================================================
export const PROFESSIONS = {
    mining:   { name: "采矿", icon: "⛏️", desc: "开采各色矿石，为锻造与炼器供给原料。" },
    smithing: { name: "锻造", icon: "🔨", desc: "将矿石熔炼成锭，再以锭打造神兵利器。" }
};

// 可堆叠物料（存 player.materials = { key: 数量 }）。price 为单个回收/出售价（文）。
export const MATERIALS = {
    ore_copper: { name: "铜矿石",   icon: "🟤", price: 12 },
    ore_iron:   { name: "铁矿石",   icon: "⚪", price: 30 },
    ore_xuan:   { name: "玄铁矿",   icon: "🟣", price: 70 },
    ore_cold:   { name: "寒铁矿",   icon: "🔵", price: 150 },
    ore_star:   { name: "星陨矿",   icon: "🟡", price: 320 },
    ore_jade:   { name: "玄晶矿",   icon: "🟢", price: 680 },
    ingot_copper: { name: "铜锭",   icon: "🔶", price: 35 },
    ingot_iron:   { name: "铁锭",   icon: "⚙️", price: 80 },
    ingot_xuan:   { name: "玄铁锭", icon: "🔩", price: 180 },
    ingot_cold:   { name: "寒铁锭", icon: "🧊", price: 380 },
    ingot_star:   { name: "星陨锭", icon: "✴️", price: 800 },
    ingot_jade:   { name: "玄晶锭", icon: "💠", price: 1700 }
};

// 挂机动作表。字段：
//   prof: 所属技能；levelReq: 解锁等级；durationMs: 单次读条；exp: 单次该技能经验；
//   inputs: { 物料key: 数量 }（消耗，可空）；outputs: { 物料key: 数量 }（产出物料，可空）；
//   craftItem: 数字 → 产物是「随机装备」直接进背包（值作为 generateItemByMatrix 的 levelFact），不入 outputs。
export const ACTIVITIES = [
    // —— 采矿（无消耗，纯产矿石）——
    { id: "mine_copper", prof: "mining", tier: 1, name: "开采铜矿",   levelReq: 1,  durationMs: 3000, exp: 7,   outputs: { ore_copper: 1 } },
    { id: "mine_iron",   prof: "mining", tier: 2, name: "开采铁矿",   levelReq: 10, durationMs: 3000, exp: 17,  outputs: { ore_iron: 1 } },
    { id: "mine_xuan",   prof: "mining", tier: 3, name: "开采玄铁",   levelReq: 25, durationMs: 3500, exp: 35,  outputs: { ore_xuan: 1 } },
    { id: "mine_cold",   prof: "mining", tier: 4, name: "开采寒铁",   levelReq: 40, durationMs: 4000, exp: 55,  outputs: { ore_cold: 1 } },
    { id: "mine_star",   prof: "mining", tier: 5, name: "开采星陨铁", levelReq: 60, durationMs: 4500, exp: 80,  outputs: { ore_star: 1 } },
    { id: "mine_jade",   prof: "mining", tier: 6, name: "开采玄晶",   levelReq: 80, durationMs: 5000, exp: 120, outputs: { ore_jade: 1 } },
    // —— 锻造·熔炼（2 矿 → 1 锭）——
    { id: "smelt_copper", prof: "smithing", tier: 1, name: "熔炼铜锭",   levelReq: 1,  durationMs: 3000, exp: 9,   inputs: { ore_copper: 2 }, outputs: { ingot_copper: 1 } },
    { id: "smelt_iron",   prof: "smithing", tier: 2, name: "熔炼铁锭",   levelReq: 10, durationMs: 3000, exp: 18,  inputs: { ore_iron: 2 },   outputs: { ingot_iron: 1 } },
    { id: "smelt_xuan",   prof: "smithing", tier: 3, name: "熔炼玄铁锭", levelReq: 25, durationMs: 3500, exp: 36,  inputs: { ore_xuan: 2 },   outputs: { ingot_xuan: 1 } },
    { id: "smelt_cold",   prof: "smithing", tier: 4, name: "熔炼寒铁锭", levelReq: 40, durationMs: 4000, exp: 58,  inputs: { ore_cold: 2 },   outputs: { ingot_cold: 1 } },
    { id: "smelt_star",   prof: "smithing", tier: 5, name: "熔炼星陨锭", levelReq: 60, durationMs: 4500, exp: 85,  inputs: { ore_star: 2 },   outputs: { ingot_star: 1 } },
    { id: "smelt_jade",   prof: "smithing", tier: 6, name: "熔炼玄晶锭", levelReq: 80, durationMs: 5000, exp: 128, inputs: { ore_jade: 2 },   outputs: { ingot_jade: 1 } },
    // 注：锭不再用来「打造随机装备」(那与黑市/战斗爆装重复、毫无意义)。
    // 锭的唯一出口 = 强化已装备的神兵(见 BALANCE.enhance 与 actions.enhanceEquip)——黑市买不到、战斗爆不出的垂直变强轴。
    // (通用引擎仍支持 craftItem 类动作，暂未启用，保留备用。)
];
