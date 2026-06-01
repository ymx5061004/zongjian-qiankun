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
    artifact: ["炼妖壶", "东皇钟", "昆仑镜", "神农鼎", "山河社稷图", "七宝妙树", "太极图", "诛仙剑阵图"],
    amulet: ["平安符", "长命锁", "护身玉牌", "观音玉坠", "辟邪铃", "九转护魂符", "太一护身符箓"],
    gloves: ["皮护腕", "铁护手", "玄铁臂甲", "龙鳞手套", "金刚护腕", "拨云擒龙手", "混元护法金刚套"],
    boots:  ["麻布鞋", "软底快靴", "铁芒靴", "踏云靴", "风火轮靴", "凌波微步靴", "纵地金光神行靴"]
};

// ============================================================
// 装备部位「唯一权威清单」(原先散落在 render/battle 的 4 份硬编码列表，统一到此)。
//   key: 部位标识(= 装备 item.type、equips 的键、makeGearPiece 的 case)；
//   label: 中文名；realmReq: 解锁所需 realmLevel(数值，1=开局即有)。
// 加新部位 = 这里加一条 + MATRIX_ITEMS 给名 + makeGearPiece 加 case + index.html 加一行槽位。
// 新部位按境界逐步解锁(realmReq>1)，给战力膨胀一个节奏；未解锁的部位不掉落/不可打造/不可装备。
// ============================================================
export const GEAR_SLOTS = [
    { key: 'weapon',    label: '兵刃', realmReq: 1 },
    { key: 'subweapon', label: '暗器', realmReq: 1 },
    { key: 'armor',     label: '防具', realmReq: 1 },
    { key: 'helm',      label: '头盔', realmReq: 1 },
    { key: 'ring',      label: '配饰', realmReq: 1 },
    { key: 'artifact',  label: '法宝', realmReq: 1 },
    { key: 'amulet',    label: '护符', realmReq: 11 },  // 先天解锁(暴击/血)
    { key: 'gloves',    label: '护腕', realmReq: 21 },  // 宗师解锁(攻击/暴击)
    { key: 'boots',     label: '战靴', realmReq: 31 }   // 大宗师解锁(闪避/血)
];

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
    { name: "招财秘录", type: "passive", coinRate: 15, desc: "每重增加 15% 碎银获取率。" },

    // —— 新词条（暗黑式 affix，均为被动；字段对应 COMBAT_AFFIXES，由 simulateBattle 结算）——
    // 进攻乘区
    { name: "杀诀",   type: "passive", critDmg: 25,  desc: "每重【暴击伤害】+25%（与暴击率相乘，越暴越痛）。" },
    { name: "战意篇", type: "passive", dmgBonus: 8,  desc: "每重【增伤】+8%（一切伤害的独立加成池）。" },
    { name: "裂甲式", type: "passive", armorPen: 6,  desc: "每重【破甲】+6%，无视敌人对应比例的防御（克高防）。" },
    { name: "吸星诀", type: "passive", lifestealPct: 4, desc: "每重【吸血】+4%：普攻按对敌实伤回血。" },
    // 防御生存
    { name: "护体诀", type: "passive", dmgReduction: 5, desc: "每重【减伤】-5%：受到的伤害按比例削减。" },
    { name: "龟息功", type: "passive", regenPct: 3, desc: "每重【回血】+3%：每回合回复最大生命的对应比例。" },
    { name: "荆棘甲", type: "passive", thornsPct: 18, desc: "每重【反伤】+18%：受击时反弹自身攻击的对应比例（真伤）。" },
    { name: "铁布衫", type: "passive", blockPct: 5, desc: "每重【格挡】+5%：概率完全格挡一次敌方攻击（与闪避分轴）。" },
    // 条件触发
    { name: "斩魂式", type: "passive", executeBonus: 30, desc: "每重【斩杀】+30%：敌方生命低于 25% 时伤害大涨（处决）。" },
    { name: "背水诀", type: "passive", lastStandBonus: 15, desc: "每重【背水】+15%：自身生命低于 35% 时，增伤与减伤同时上涨。" },
    { name: "疾风式", type: "passive", openerBonus: 20, desc: "每重【先发增伤】+20%：战斗前 2 回合伤害提升（开场一击流）。" },
    { name: "连环掌", type: "passive", rampPerRound: 5, desc: "每重【连击增伤】+5%/回合：每多打一回合越战越勇，最多叠 8 层。" },
    { name: "血刃术", type: "passive", bleedPct: 12, desc: "每重【流血】+12%：每回合额外造成自身攻击对应比例的真伤（无视防御）。" },
    { name: "锁灵咒", type: "passive", stunChance: 8, desc: "每重【定身】+8%：概率令敌人本回合无法出手。" }
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

    enemy: { baseHp: 280, baseAtk: 35, baseDef: 5, diffBase: 1.5 }, // 敌人基础值, 再乘 diffBase^(mapId-1)。diffBase 越小=难度越缓、堆装备/强化越能多推关卡(原为2, 太陡致装备近乎无效)

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
        baseDrop: 0.20,               // 装备掉落率(掉「该区域档位」装备), 再乘 dropRate/100
        oreDropMax: 2,                // 每场胜利必掉该区域矿石 1~oreDropMax 个(材料导向, 喂打造)
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
        expC: 20, expP: 1.9,                  // 升级累计经验曲线: 到达 L 级所需累计经验 = expC*(L-1)^expP（调缓, 早期更快）
        offlineCapMs: 12 * 3600 * 1000,       // 离线最多结算 12 小时
        offlineReportMinMs: 60 * 1000,        // 离线提示门槛：离开≥此时长才弹「欢迎回来」(产出照常结算)，避免秒级切换刷屏；可调
        // —— 效率途径：练级本身让你「更快 + 偶尔双倍产出」(不只是解锁高档) ——
        speedPerLevel: 0.005, speedCap: 0.5,  // 等级提速：每级单次读条 -0.5%，封顶 -50%
        yieldPerLevel: 0.005, yieldCap: 0.75  // 等级增产：每级 +0.5% 概率「本次产出翻倍」，封顶 75%
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
    },

    // —— 装备成色（随机品阶退居为锻造的小幅波动；tier 才是强度主轴）——
    gear: {
        qualityStep: 0.06          // 成色每级 +6% 属性(凡品0 → 神话+30%)，保留配色/熔炼价值但不越档
    },

    // —— 神兵进阶（突破打造天花板 T6→T7→T8，吃秘境 Boss 掉的神魂结晶 + 碎银）——
    upgrade: {
        crystalCost: { 7: 3, 8: 8 },        // 进到第 N 档需神魂结晶数
        coinCost: { 7: 30000, 8: 120000 }   // 进到第 N 档需碎银
    },

    // —— 词条战斗常量（秘籍「暗黑词条化」用，全在此一处调；阈值固定、各词条只贡献「增益值×重数」）——
    // ⚖️ 这些是新词条的「触发线/上限」旋钮，词条本身的每重数值在 COMBAT_AFFIXES / SKILL_SUFFIXES 里。试玩后在这调。
    combat: {
        executeThresh: 25,        // 斩杀：敌方生命低于此%时，触发「斩杀增伤」
        lastStandThresh: 35,      // 背水：自身生命低于此%时，触发「背水」(同时吃增伤+减伤)
        openerRounds: 2,          // 先发制人：战斗前 N 回合吃「先发增伤」
        rampMaxStacks: 8,         // 越战越勇：连击增伤最多叠的回合数
        armorPenCap: 75,          // 破甲上限%(无视敌防)
        dmgReductionCap: 75,      // 减伤上限%
        blockCap: 75              // 格挡率上限%
    },

    // —— 背包扩容（默认16格，黑市常驻购买，每次+1格、几何递增「偏贵·后期奢侈」）——
    // n=已扩次数(=bagMax-base)；单次价 = round(priceStart * priceGrowth^n / 100)*100。
    // 调手感只动这4个数：base起步 / max上限 / priceStart首格价 / priceGrowth每格涨幅。
    bag: {
        base: 16,                 // 新角色初始格数（老存档保留各自 bagMax，不缩水）
        max: 120,                 // 扩容上限
        priceStart: 2000,         // 第1次扩容(16→17)价(文)
        priceGrowth: 1.08         // 每多扩1格单价 ×1.08（首格2000→末格约554万，全程约7480万）
    }
};

// ============================================================
// 「词条」(暗黑式 affix) ——秘籍/功法的随机词条池（被动子类）。
// 每条 = 一个战斗 mod 字段，computeStats 按「字段值×重数」聚合(不吃轮回/洪荒乘区，纯百分比)，
// simulateBattle 据此结算。加新词条 = 往这里加一条 + 在 SKILL_SUFFIXES 给它一个秘籍后缀名即可。
//   k=字段名(skill 对象 + stats 上的键)；n=显示名；s=单位后缀；c=配色；
//   cond=true 表示「条件触发型」(其阈值在 BALANCE.combat，这里只配每重的增益值)。
// ============================================================
export const COMBAT_AFFIXES = [
    { k: 'critDmg',       n: '暴击伤害', s: '%',     c: 'var(--color-orange)' },
    { k: 'dmgBonus',      n: '增伤',     s: '%',     c: 'var(--color-accent)' },
    { k: 'armorPen',      n: '破甲',     s: '%',     c: 'var(--color-accent)' },
    { k: 'dmgReduction',  n: '减伤',     s: '%',     c: 'var(--color-blue)'   },
    { k: 'regenPct',      n: '回血',     s: '%',     c: 'var(--color-success)'},
    { k: 'thornsPct',     n: '反伤',     s: '%',     c: 'var(--color-accent)' },
    { k: 'blockPct',      n: '格挡',     s: '%',     c: 'var(--color-blue)'   },
    { k: 'bleedPct',      n: '流血',     s: '%',     c: 'var(--color-accent)' },
    { k: 'lifestealPct',  n: '吸血',     s: '%',     c: 'var(--color-success)'},
    { k: 'executeBonus',  n: '斩杀增伤', s: '%',     c: 'var(--color-orange)', cond: true },
    { k: 'lastStandBonus',n: '背水',     s: '%',     c: 'var(--color-orange)', cond: true },
    { k: 'openerBonus',   n: '先发增伤', s: '%',     c: 'var(--color-orange)', cond: true },
    { k: 'rampPerRound',  n: '连击增伤', s: '%/回合', c: 'var(--color-orange)', cond: true },
    { k: 'stunChance',    n: '定身',     s: '%',     c: 'var(--color-blue)',   cond: true }
];
export const COMBAT_AFFIX_KEYS = COMBAT_AFFIXES.map(a => a.k);

// ============================================================
// 生产技能体系（武侠版梅尔沃的「非战斗」侧）。
// 加新技能：往 PROFESSIONS 加一个键；加新产物：往 MATERIALS 加；
// 加新挂机动作：往 ACTIVITIES 加一条（数据驱动，通用引擎 src/ui/idle.js 直接吃）。
// 目前首条产线：采矿(出矿石) → 锻造(熔炼成锭 / 打造神兵进背包)。
// ============================================================
export const PROFESSIONS = {
    mining:   { name: "采矿", icon: "⛏️", desc: "开采各色矿石，为锻造与炼器供给原料。" },
    smithing: { name: "锻造", icon: "🔨", desc: "将矿石熔炼成锭，再以锭打造神兵利器。" },
    herb:     { name: "采药", icon: "🌿", desc: "采集天材地宝，为炼丹供给草药。" },
    alchemy:  { name: "炼丹", icon: "⚗️", desc: "以草药炼制丹药，服之永久增益根骨。" }
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
    ingot_jade:   { name: "玄晶锭", icon: "💠", price: 1700 },
    soul_crystal: { name: "神魂结晶", icon: "💎", price: 0 },   // 仅秘境 Boss 掉落，用于「神兵进阶」突破打造天花板(T6→神话→仙器)
    // —— 草药（采药产出，炼丹原料）——
    herb_1: { name: "三叶青草", icon: "🌱", price: 10 },
    herb_2: { name: "九叶灵芝", icon: "🍀", price: 40 },
    herb_3: { name: "万年雪参", icon: "🌾", price: 120 },
    // —— 丹药（炼丹产出；带 pill 增益标记 → 不入物料仓库列表，改在炼丹页「丹房」服用，服后永久 +pillBonus）——
    pill_atk1:  { name: "淬体丹", icon: "🔴", price: 0, pill: { atk: 8 } },
    pill_hp1:   { name: "聚元丹", icon: "🟠", price: 0, pill: { hp: 50 } },
    pill_def1:  { name: "玄龟丹", icon: "🟤", price: 0, pill: { def: 6 } },
    pill_crit:  { name: "锐金丹", icon: "🟡", price: 0, pill: { crit: 1 } },
    pill_dodge: { name: "轻灵丹", icon: "🟢", price: 0, pill: { dodge: 1 } },
    pill_great: { name: "大还丹", icon: "🟣", price: 0, pill: { hp: 120, atk: 15, def: 10 } }
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
    // 锭的两大出口 = ①打造命名套装(GEAR_TIERS + actions.craftGear) ②强化已装备的神兵(BALANCE.enhance + actions.enhanceEquip)。
    // 二者共享锭产能，需平衡(数值待试玩调)。黑市买不到、战斗爆不出的垂直变强轴=自己挖矿熔炼。
    // (通用引擎仍支持 craftItem 类动作，暂未启用，保留备用。)

    // —— 采药（无消耗，纯产草药；供炼丹）——
    { id: "gather_herb1", prof: "herb", tier: 1, name: "采三叶青草", levelReq: 1,  durationMs: 3000, exp: 7,  outputs: { herb_1: 1 } },
    { id: "gather_herb2", prof: "herb", tier: 2, name: "采九叶灵芝", levelReq: 20, durationMs: 4000, exp: 38, outputs: { herb_2: 1 } },
    { id: "gather_herb3", prof: "herb", tier: 3, name: "采万年雪参", levelReq: 45, durationMs: 5000, exp: 85, outputs: { herb_3: 1 } },
    // —— 炼丹（草药 → 丹药；产物带 pill 增益，在「丹房」服用永久增益根骨）——
    { id: "brew_atk1",  prof: "alchemy", tier: 1, name: "炼·淬体丹", levelReq: 1,  durationMs: 4000, exp: 10, inputs: { herb_1: 3 }, outputs: { pill_atk1: 1 } },
    { id: "brew_hp1",   prof: "alchemy", tier: 1, name: "炼·聚元丹", levelReq: 1,  durationMs: 4000, exp: 10, inputs: { herb_1: 3 }, outputs: { pill_hp1: 1 } },
    { id: "brew_def1",  prof: "alchemy", tier: 1, name: "炼·玄龟丹", levelReq: 8,  durationMs: 4500, exp: 14, inputs: { herb_1: 3 }, outputs: { pill_def1: 1 } },
    { id: "brew_crit",  prof: "alchemy", tier: 2, name: "炼·锐金丹", levelReq: 20, durationMs: 5000, exp: 30, inputs: { herb_2: 4 }, outputs: { pill_crit: 1 } },
    { id: "brew_dodge", prof: "alchemy", tier: 2, name: "炼·轻灵丹", levelReq: 30, durationMs: 5000, exp: 40, inputs: { herb_2: 4 }, outputs: { pill_dodge: 1 } },
    { id: "brew_great", prof: "alchemy", tier: 3, name: "炼·大还丹", levelReq: 50, durationMs: 6000, exp: 80, inputs: { herb_3: 6 }, outputs: { pill_great: 1 } }
];

// ============================================================
// 装备「命名套装阶梯」（梅尔沃式循序渐进的脊梁）：
// 装备强度的主轴 = tier(档)，对应矿石/锭层级；按采矿+锻造等级解锁，确定属性、靠打造获得。
// 随机品阶(quality 0~5)退居为「锻造成色」——同档装备打出来的 ±小幅波动(见 BALANCE.gear.qualityStep)，不再是越级强度来源。
// 强化(+N)在档内微调。换档=大跨步，强化=细打磨——两根轴。
// ingot/ingotQty/coin：打造「一件」的花费；power：该档相对 1 档的属性倍率。
// ============================================================
// ore：该档对应的矿石(战斗在该区域掉此矿，喂打造/熔炼)。ingot：打造/强化耗的锭。
export const GEAR_TIERS = [
    { tier: 1, name: "凡铁", smithingReq: 1,  ore: "ore_copper", ingot: "ingot_copper", ingotQty: 4, power: 1.0,  coin: 200,   craftable: true },
    { tier: 2, name: "精铁", smithingReq: 12, ore: "ore_iron",   ingot: "ingot_iron",   ingotQty: 4, power: 2.0,  coin: 700,   craftable: true },
    { tier: 3, name: "玄铁", smithingReq: 25, ore: "ore_xuan",   ingot: "ingot_xuan",   ingotQty: 5, power: 3.8,  coin: 2000,  craftable: true },
    { tier: 4, name: "寒铁", smithingReq: 40, ore: "ore_cold",   ingot: "ingot_cold",   ingotQty: 5, power: 7.0,  coin: 5500,  craftable: true },
    { tier: 5, name: "星陨", smithingReq: 60, ore: "ore_star",   ingot: "ingot_star",   ingotQty: 6, power: 13.0, coin: 15000, craftable: true },
    { tier: 6, name: "玄晶", smithingReq: 80, ore: "ore_jade",   ingot: "ingot_jade",   ingotQty: 6, power: 24.0, coin: 42000, craftable: true },
    // 以下两档「打造不出来」(craftable:false)——突破纯锻造天花板，只能靠秘境 Boss 掉的神魂结晶做「神兵进阶」升上来。
    { tier: 7, name: "神话", smithingReq: 999, ore: null, ingot: null, ingotQty: 0, power: 42.0, coin: 0, craftable: false },
    { tier: 8, name: "仙器", smithingReq: 999, ore: null, ingot: null, ingotQty: 0, power: 72.0, coin: 0, craftable: false }
];

// ============================================================
// 秘境 Boss（后期内容）：定点强敌，胜利掉「神魂结晶」(唯一来源)。难度 = getMapDifficulty(mapEquiv)*toughness。
// 需达到 realmReq 境界才可挑战；可反复刷(能打赢=靠真实战力，自带门槛)。
// ============================================================
export const BOSSES = [
    { id: "b1", name: "噬魂妖王",     realmReq: 25,  mapEquiv: 15, toughness: 1.5, crystalMin: 1, crystalMax: 2, coin: 8000 },
    { id: "b2", name: "血煞魔尊",     realmReq: 45,  mapEquiv: 25, toughness: 1.6, crystalMin: 1, crystalMax: 3, coin: 20000 },
    { id: "b3", name: "万剑剑圣",     realmReq: 70,  mapEquiv: 35, toughness: 1.8, crystalMin: 2, crystalMax: 4, coin: 50000 },
    { id: "b4", name: "幽冥鬼帝",     realmReq: 100, mapEquiv: 45, toughness: 2.0, crystalMin: 3, crystalMax: 6, coin: 120000 },
    { id: "b5", name: "混沌虚空兽",   realmReq: 140, mapEquiv: 55, toughness: 2.5, crystalMin: 5, crystalMax: 9, coin: 300000 }
];
