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

export const ACHIEVEMENT_CATEGORIES = {
    realm: "修为成就",
    reborn: "轮回成就",
    map: "地图探索",
    battle: "战斗成就",
    equip: "装备成就",
    skill: "秘籍成就",
    wealth: "财富成就",
    challenge: "试炼成就",   // 第四阶段：挑战向（残血翻盘/极限一击…）
    path: "流派成就",        // 第四阶段：流派向（各派专属里程碑）
    funny: "江湖奇谈"        // 第四阶段：趣味/隐藏向
};

export const ACHIEVEMENTS = [
    // 修为成就
    { id: 'realm_5', category: 'realm', name: '破碎虚空', desc: '修为突破到第5重', target: 5, metric: 'realmLevel', reward: { coin: 10000 } },
    { id: 'realm_20', category: 'realm', name: '天仙降临', desc: '修为突破到第20重', target: 20, metric: 'realmLevel', reward: { coin: 60000 } },
    { id: 'realm_50', category: 'realm', name: '至尊霸业', desc: '修为突破到第50重', target: 50, metric: 'realmLevel', reward: { coin: 200000 } },
    { id: 'realm_100', category: 'realm', name: '天帝之位', desc: '修为突破到第100重', target: 100, metric: 'realmLevel', reward: { coin: 500000, exp: 200000 } },

    // 轮回成就
    { id: 'reborn_1', category: 'reborn', name: '初涉轮回', desc: '第一次轮回转世', target: 1, metric: 'rebornCount', reward: { coin: 50000 } },
    { id: 'reborn_5', category: 'reborn', name: '命运之轮', desc: '轮回5次', target: 5, metric: 'rebornCount', reward: { coin: 200000 } },
    { id: 'reborn_10', category: 'reborn', name: '轮回大道', desc: '轮回10次', target: 10, metric: 'rebornCount', reward: { coin: 600000 } },

    // 地图探索
    { id: 'map_10', category: 'map', name: '初出茅庐', desc: '通过第10关', target: 10, metric: 'maxMapCleared', reward: { coin: 30000 } },
    { id: 'map_20', category: 'map', name: '武林新秀', desc: '通过第20关', target: 20, metric: 'maxMapCleared', reward: { coin: 80000 } },
    { id: 'map_50', category: 'map', name: '荡平诸邪', desc: '通过第50关', target: 50, metric: 'maxMapCleared', reward: { coin: 250000 } },
    { id: 'map_100', category: 'map', name: '天下无敌', desc: '通过第100关', target: 100, metric: 'maxMapCleared', reward: { coin: 800000 } },

    // 战斗成就
    { id: 'kill_100', category: 'battle', name: '斩妖除魔', desc: '击败100个敌人', target: 100, metric: 'totalKills', reward: { coin: 50000 } },
    { id: 'kill_1000', category: 'battle', name: '杀戮之王', desc: '击败1000个敌人', target: 1000, metric: 'totalKills', reward: { coin: 300000 } },
    { id: 'kill_10000', category: 'battle', name: '末世屠神', desc: '击败10000个敌人', target: 10000, metric: 'totalKills', reward: { coin: 2000000 } },
    // —— 地图词缀成就（在特定词缀关卡建功）——
    { id: 'thunder_10', category: 'battle', name: '逆雷而行', desc: '在「雷泽」词缀关卡获胜10次', target: 10, metric: 'thunderWins', reward: { coin: 100000 } },
    { id: 'swordtomb_weapon', category: 'battle', name: '剑冢寻锋', desc: '在「剑冢」词缀关卡夺得一件兵刃', target: 1, metric: 'swordTombWeapons', reward: { coin: 60000 } },

    // 装备成就
    { id: 'equip_2_legendary', category: 'equip', name: '初得传说', desc: '装备2件神话品质装备', target: 2, metric: 'equippedLegendary', reward: { coin: 120000 } },
    { id: 'equip_6_legendary', category: 'equip', name: '神装加身', desc: '装备6件神话品质装备', target: 6, metric: 'equippedLegendary', reward: { coin: 600000 } },
    { id: 'craft_10', category: 'equip', name: '初识锻造', desc: '通过洪炉合成10次', target: 10, metric: 'totalForgeCount', reward: { coin: 120000 } },
    { id: 'craft_50', category: 'equip', name: '锻造大师', desc: '通过洪炉合成50次', target: 50, metric: 'totalForgeCount', reward: { coin: 800000 } },

    // 秘籍成就
    { id: 'skill_5', category: 'skill', name: '初入道门', desc: '掌握5门秘籍', target: 5, metric: 'skillCount', reward: { exp: 20000 } },
    { id: 'skill_10', category: 'skill', name: '百般武艺', desc: '掌握10门秘籍', target: 10, metric: 'skillCount', reward: { exp: 80000 } },
    { id: 'honghuang_lv10', category: 'skill', name: '洪荒觉醒', desc: '老区长混沌诀达到10重', target: 10, metric: 'honghuangLevel', reward: { coin: 300000 } },
    { id: 'honghuang_lv50', category: 'skill', name: '洪荒之主', desc: '老区长混沌诀达到50重', target: 50, metric: 'honghuangLevel', reward: { coin: 2000000 } },

    // 财富成就
    { id: 'coin_10w', category: 'wealth', name: '小有资财', desc: '累计获得碎银100万文', target: 1000000, metric: 'totalCoinEarned', reward: { exp: 50000 } },
    { id: 'coin_100w', category: 'wealth', name: '财富巨龙', desc: '累计获得碎银1000万文', target: 10000000, metric: 'totalCoinEarned', reward: { exp: 300000 } },

    // ============================================================
    // 第四阶段·策略向成就 + 永久小奖励（reward.perm：claimed 后由 computeStats 集中读取叠乘，绝不重复叠加）。
    //   perm 字段（均为百分比）：all(五维) / atk / hp / def / crit / dodge / dropRate / coinRate。
    //   hidden:true 未解锁时显示「？？？」+ hint；flavorText：解锁后的武侠寄语。复杂条件靠 achievements.stats 累计（见 domain.getCurrentMetricValue）。
    // ============================================================
    // 通用里程碑
    { id: 'first_battle', category: 'battle', name: '初入江湖', desc: '完成第一次战斗（胜负皆可）', target: 1, metric: 'battleCount', reward: { coin: 2000, perm: { allPct: 0.5 } }, hint: '去「百关征途」随便打一场', flavorText: '初心一剑，江湖路远。' },
    { id: 'breakthrough_first', category: 'challenge', name: '破境鸣金', desc: '完成第一次破境冲关', target: 1, metric: 'breakthroughCount', reward: { coin: 3000, perm: { atkPct: 1 } }, flavorText: '一朝破境，天地为之一宽。' },
    { id: 'enhance_10', category: 'equip', name: '神兵微芒', desc: '神兵强化累计 10 次', target: 10, metric: 'enhanceCount', reward: { coin: 50000, perm: { atkPct: 1 } }, flavorText: '千锤百炼，神兵渐成微芒。' },

    // 试炼向（挑战）
    { id: 'armor_win', category: 'challenge', name: '披衣初成', desc: '穿戴防具取胜 1 次', target: 1, metric: 'armorWins', reward: { coin: 3000 }, hint: '装备一件防具后再取胜', flavorText: '甲胄在身，临阵不惧。' },
    { id: 'lowhp_win', category: 'challenge', name: '残血反杀', desc: '在自身气血低于 20% 时取胜', target: 1, metric: 'lowHpWins', reward: { coin: 8000, perm: { critPct: 1 } }, hint: '濒死之际翻盘', flavorText: '置之死地而后生。' },
    { id: 'big_hit', category: 'challenge', name: '孤注一掷', desc: '单次出手造成 10 万以上伤害', target: 100000, metric: 'maxSingleHit', reward: { coin: 10000, perm: { atkPct: 1 } }, flavorText: '一击，足矣。' },

    // 流派向
    { id: 'sword_wins', category: 'path', name: '初心初现', desc: '修「剑修」期间取胜 20 次', target: 20, metric: 'swordPathWins', reward: { coin: 10000, perm: { critPct: 1 } }, flavorText: '剑心通明，二十战不改其志。' },
    { id: 'body_tank', category: 'path', name: '铁骨横江', desc: '修「体修」期间累计承受 50 万伤害', target: 500000, metric: 'bodyDamageTaken', reward: { coin: 10000, perm: { hpPct: 1 } }, flavorText: '千击不溃，是为金身。' },
    { id: 'poison_kill', category: 'path', name: '毒入骨髓', desc: '修「毒修」期间以毒伤了结对手', target: 1, metric: 'poisonKills', reward: { coin: 8000, perm: { allPct: 0.5 } }, hint: '让中毒灼烧成为最后一击', flavorText: '附骨之蛆，无声夺命。' },
    { id: 'agility_dodge', category: 'path', name: '踏雪无痕', desc: '战斗中累计闪避 100 次', target: 100, metric: 'dodgeCount', reward: { coin: 8000, perm: { allPct: 0.5 } }, flavorText: '来去如风，敌不能伤。' },
    { id: 'artisan_craft', category: 'path', name: '千锤百炼', desc: '「打造图谱」打造装备累计 10 件', target: 10, metric: 'craftCount', reward: { coin: 8000, perm: { allPct: 0.5 } }, flavorText: '以器养道，匠心独运。' },

    // 地图词缀向
    { id: 'poisonmist_wins', category: 'map', name: '毒瘴不侵', desc: '在「毒瘴」词缀关卡取胜 5 次', target: 5, metric: 'poisonMistWins', reward: { coin: 20000, perm: { hpPct: 1 } }, flavorText: '瘴气如墨，我自巍然。' },
    { id: 'spirit_exp', category: 'map', name: '灵脉钟秀', desc: '在「灵脉」词缀关卡累计获得 5 万修为', target: 50000, metric: 'spiritVeinExp', reward: { coin: 20000, perm: { coinRatePct: 1 } }, flavorText: '灵脉滋养，修为日进千里。' },

    // 江湖奇谈（趣味 / 隐藏）
    { id: 'high_quality', category: 'funny', name: '今天手气不错', desc: '获得一件史诗及以上品质的装备', target: 1, metric: 'gotHighQuality', reward: { coin: 5000 }, hint: '撞一回大运', flavorText: '时来天地皆同力。' },
    { id: 'hidden_naked', category: 'funny', hidden: true, name: '赤手空拳', desc: '未装备兵刃却取胜 1 次', target: 1, metric: 'nakedWins', reward: { coin: 5000, perm: { allPct: 0.5 } }, hint: '???', flavorText: '手中无剑，心中有剑。' }
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
        // 修为前段抬高(40→55)、随关增速略增(40→44)：破境成本随境界线性涨，前期修为偏紧→到「轮回(20级)」太慢；
        // 抬基数让前 15~20 分钟破境更顺、更快摸到首次轮回这个关键乘区(平滑 1~20 关)，但仍非「一键毕业」。
        expBase: 55, expPerMap: 44,
        baseDrop: 0.20,               // 装备掉落率(掉「该区域档位」装备), 再乘 dropRate/100
        // 每胜必掉矿 1~oreDropMax：2→3(均值 1.5→2，+33%)。矿是打造/强化(主力变强轴)的唯一喂料，前期偏紧；
        // 提产让装备/强化跟得上 1.5^关 的敌人曲线。在线≈3272矿/时仍 > 离线1200/时 → 不破坏「离线不超在线」。
        oreDropMax: 3,
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
        // 指数 1.9→1.85：低阶几乎不变(L2 仍 20 经验)，中高阶累计经验降 ~10~18%，让采矿/熔炼解锁高档(铁/玄铁…)
        // 与打造高阶装备的等级门槛来得更顺(平滑「生产耗时过长」)，但不改早期手感、不让生产秒满级。
        expC: 20, expP: 1.85,                 // 升级累计经验曲线: 到达 L 级所需累计经验 = expC*(L-1)^expP（调缓, 早期更快）
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
    },

    // —— 修行流派切换花费（首次择道免费；之后改换门庭按已切换次数几何递增碎银，抑制频繁反复横跳）——
    // 第 n 次切换(n=pathSwitchCount, 从0计) = round(switchCoinBase * switchCoinGrowth^n / 1000)*1000。
    path: { switchCoinBase: 80000, switchCoinGrowth: 1.8 },

    // —— 地图词缀（关卡特性）旋钮：分配节奏 + 各效果硬上限（确定性·可解释·不爆经济/不秒杀）——
    // 分配：前 earlySafeStages 关恒为荒原；非 milestoneEvery 倍数关为荒原；倍数关按非默认词缀顺序轮转；
    //       eliteEvery 倍数关为「精英」(词缀强度 ×eliteIntensity，各效果仍各自封顶)。详见 domain.getMapModifier。
    // 所有数值上限集中在此，调平衡只动这里。
    mapMod: {
        earlySafeStages: 3,            // 前 N 关恒为荒原（新手友好，不上惩罚词缀）
        milestoneEvery: 5,             // 每 N 关出现一个明显词缀（其余关为荒原·均衡）
        eliteEvery: 10,                // 每 N 关为「精英关」（词缀强化 + UI 提示）
        eliteIntensity: 1.5,           // 精英关词缀强度倍率（作用于环境伤害/敌暴击/掉率加成，再各自封顶）
        envDmgPctCap: 5,               // 单回合环境伤害上限（占气血上限 %）——绝不秒杀
        dodgeReductionCap: 25,         // 闪避削减上限（百分点）
        enemyCritCap: 60,              // 敌方暴击率上限（%）
        healMultFloor: 0.2,            // 回血/吸血最低保留比例（魔窟）
        expMultCap: 1.6,               // 修为加成上限（灵脉）
        gearDropMultRange: [0.5, 1.6], // 装备掉率乘区允许范围
        herbDropChanceCap: 0.35,       // 药材掉落概率上限（毒瘴）
        skillDropChanceCap: 0.1        // 秘籍掉落概率上限（魔窟）
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
    pill_atk1:  { name: "淬体丹", icon: "🔴", price: 0, pill: { atk: 12 } },  // 8→12：早期炼丹收益偏弱(有意义的大还丹太晚)，小幅抬入门丹，使早期炼丹值得一试
    pill_hp1:   { name: "聚元丹", icon: "🟠", price: 0, pill: { hp: 80 } },   // 50→80
    pill_def1:  { name: "玄龟丹", icon: "🟤", price: 0, pill: { def: 10 } },  // 6→10
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

// ============================================================
// 新手指引任务链（江湖指引）：把「前 30 分钟该做什么」做成可领奖的目标系统。
// 逐步引导玩家接触 战斗→装备→洪炉→突破→秘籍→黑市→采矿→熔炼→打造→强化→炼丹→秘境→轮回 等核心系统。
// 每条 = 一个目标 + 奖励。进度判定/领取逻辑见 domain.js（纯函数），落地+UI 见 actions.js / render.js。
//   type:    进度判定类型（domain.getQuestProgress 按此取值；新增类型在那里加一个 case 即可）；
//   target:  目标值；
//   reward:  { coins, exp, material:{物料key:数量}, statBonus:{hp/atk/def/crit/dodge}, honghuangPower, item, skill }；
//   page:    「前往」按钮跳转的页签 id（= switch-page 的 data-page）；
//   unlockHint: 去哪完成的文字提示；order: 排序（同时是推荐推进顺序）；next: 下一条 id（仅作链路标注）。
// 奖励优先用 碎银/修为/物料/永久根骨(statBonus)——不占背包、对旧档零风险；
// item/skill 类奖励会占背包，actions 领取前会校验背包是否已满（满则拒绝并提示，沿用现有背包满规则）。
// 进度判定尽量「从现有状态派生」（如已装备/已通关/已会秘籍数），这样旧档若早已满足条件会直接显示「可领取」，不会卡死。
// ============================================================
export const GUIDE_QUESTS = [
    { id: 'q_battle',       order: 1,  type: 'battleCount',  target: 1,  title: '初入江湖', desc: '在「百关征途」挑战任意关卡，完成 1 次战斗。',               reward: { coins: 2000, exp: 500 },                          page: 'adventure', unlockHint: '左侧菜单 → 百关征途 → 点任意关卡【挑战】',            next: 'q_equip' },
    { id: 'q_equip',        order: 2,  type: 'equipItem',    target: 1,  title: '夺得兵刃', desc: '在「行囊与洪炉」点击一件装备并【披挂上身】。',             reward: { coins: 3000, material: { ingot_copper: 4 } },     page: 'bag',       unlockHint: '行囊与洪炉 → 点背包里的装备 → 披挂上身',           next: 'q_map3' },
    { id: 'q_map3',         order: 3,  type: 'clearMap',     target: 3,  title: '小试锋芒', desc: '一路挂机征战，通关到第 3 关。',                           reward: { coins: 3000, exp: 1500 },                         page: 'adventure', unlockHint: '百关征途 → 挂机推进到第 3 关',                     next: 'q_forge' },
    { id: 'q_forge',        order: 4,  type: 'forgeCount',   target: 1,  title: '天地洪炉', desc: '把两件物品投入「天地洪炉」融合 1 次。',                   reward: { coins: 5000 },                                    page: 'bag',       unlockHint: '行囊与洪炉 → 拖两件物品入炉 → 点【融合】',         next: 'q_breakthrough' },
    { id: 'q_breakthrough', order: 5,  type: 'breakthrough', target: 1,  title: '内息初成', desc: '在「修真命格」完成 1 次破境冲关（境界 +1）。',             reward: { exp: 1500 },                                      page: 'role',      unlockHint: '修真命格 → 破境冲关（需消耗修为）',               next: 'q_path' },
    { id: 'q_path',         order: 6,  type: 'choosePath',   target: 1,  title: '择道而行', desc: '在「修行流派」选择一门流派，确立你的长远成长方向。',         reward: { coins: 8000, exp: 1000 },                         page: 'path',      unlockHint: '左侧菜单 → 修行流派 → 选择一门流派（首次免费）',     next: 'q_skill' },
    { id: 'q_skill',        order: 7,  type: 'ownSkill',     target: 2,  title: '百修入门', desc: '除初始拳法外，再参悟或购买并学会 1 本秘籍。',             reward: { coins: 6000, exp: 1000 },                         page: 'kungfu',    unlockHint: '珍宝黑市买秘籍 → 行囊参悟，或「百修秘籍」一键参悟', next: 'q_shop' },
    { id: 'q_shop',         order: 8,  type: 'visitShop',    target: 1,  title: '黑市问价', desc: '进入或刷新一次「珍宝黑市」，看看有什么好货。',           reward: { coins: 5000 },                                    page: 'shop',      unlockHint: '左侧菜单 → 珍宝黑市',                             next: 'q_mine' },
    { id: 'q_mine',         order: 9,  type: 'startMining',  target: 1,  title: '采矿试炼', desc: '到「采矿」开采矿石，或在战斗中拾得任意矿石。',           reward: { material: { ore_copper: 10 } },                   page: 'mining',    unlockHint: '生产经营 → 采矿 → 开采铜矿【开始】',              next: 'q_smelt' },
    { id: 'q_smelt',        order: 10, type: 'startSmelting', target: 1, title: '百炼成锭', desc: '在「锻造」把矿石熔炼成金属锭（2 矿石熔 1 锭，先去采矿备料）。', reward: { coins: 4000, material: { ingot_copper: 4 } },  page: 'smithing',  unlockHint: '生产经营 → 锻造 → 熔炼铜锭【开始】（需铜矿石）',    next: 'q_craft' },
    { id: 'q_craft',        order: 11, type: 'craftCount',   target: 1,  title: '自铸神兵', desc: '用金属锭在「打造」亲手锻造一件命名装备（强度主轴=档位）。', reward: { coins: 8000, exp: 1500 },                       page: 'craft',     unlockHint: '生产经营 → 打造 → 选部位打造（耗锭 + 碎银）',      next: 'q_enhance' },
    { id: 'q_enhance',      order: 12, type: 'enhanceCount', target: 1,  title: '千锤淬锋', desc: '在「强化」给已装备的神兵 +1（攻/防/血永久放大，黑市买不到）。', reward: { coins: 10000, statBonus: { atk: 5, def: 4 } }, page: 'enhance',   unlockHint: '生产经营 → 强化 → 选已装备的装备强化（耗锭 + 碎银）', next: 'q_pill' },
    { id: 'q_pill',         order: 13, type: 'getPill',      target: 1,  title: '炼药初识', desc: '采药并在「炼丹」炼出一炉丹药（或服用任意丹药）。',         reward: { statBonus: { hp: 50 } },                          page: 'alchemy',   unlockHint: '生产经营 → 采药 → 炼丹 → 丹房服用',              next: 'q_map10' },
    { id: 'q_map10',        order: 14, type: 'clearMap',     target: 10, title: '斩妖问道', desc: '战力渐长，通关到第 10 关（亦可去秘境击败 Boss）。',       reward: { coins: 20000, exp: 3000 },                        page: 'adventure', unlockHint: '百关征途 → 推进到第 10 关；秘境可挑战 Boss',       next: 'q_dixing' },
    { id: 'q_dixing',       order: 15, type: 'clearAffixStage', target: 1, title: '识地势', desc: '通关一处带「地势词缀」的关卡（每 5 关起便有词缀，留意地图上的地势标识）。', reward: { coins: 10000, exp: 1500 },       page: 'adventure', unlockHint: '百关征途 → 挑战第 5 关及以上的词缀关卡并取胜',     next: 'q_five' },
    { id: 'q_five',         order: 16, type: 'questsDone',   target: 5,  title: '一日小成', desc: '累计达成 5 个新手指引任务。',                             reward: { coins: 30000, statBonus: { atk: 8, def: 6 } },    page: 'quest',     unlockHint: '继续完成上面的指引任务即可',                       next: 'q_reborn' },
    { id: 'q_reborn',       order: 17, type: 'learnReborn',  target: 1,  title: '百世伏笔', desc: '了解「渡劫轮回」：境界达 20 级即可渡劫，重置境界换取全属性永久质变（不必现在就轮回）。', reward: { coins: 50000, exp: 10000 }, page: 'role', unlockHint: '修真命格 → 渡劫轮回（境界 ≥ 20 解锁）', next: null }
];

// ============================================================
// 修行流派（修行流派系统）：给玩家明确的长期成长分支——同样的装备/秘籍/战斗，
// 因「道」不同而走向高攻爆发 / 厚血坚守 / 持毒磨敌 / 灵巧闪避 / 以器养道等不同风格。
// 轻量·清晰·可扩展：不做复杂天赋树，一派 = 一组「加成 + 代价」数值（mods），由 domain 集中接入。
//   id/name/desc/tags/unlockRealmLevel/recommendedStats/flavorText：展示用；
//   bonuses/penalties：卡片展示的中文条目（与 mods 数值一一对应，便于武侠化措辞）；
//   mods：引擎实际读取的数值（domain.pathModifiers 归一化后用于 computeStats / simulateBattle）：
//     mult:  作用于 气血/攻击/防御 的「百分比乘区」(整数%，可负)；
//     flat:  固定值加成——crit/dodge 为「百分点」；critDmg/thornsPct/openerBonus… 为战斗词条点数；
//     gearStatMult:  装备「基础属性(攻/防/血)」贡献额外 +X%（器修）；
//     subweaponMult: 暗器(subweapon)贡献额外 +X%（毒修）；
//     enhanceMult:   强化收益额外 +X%（器修，放大 enhance 倍率）；
//     skillMult:     被动秘籍五维收益 +X%（器修为负，作代价）；
//     craftQualityBonus: 打造时高成色概率小幅提升的开关(≥1)（器修）；
//     poison: { chance(每次出手中毒概率%), pctOfAtk(每层每回合伤害=攻击×%), maxStacks(层数上限), bossEff(对Boss效率系数) }（毒修）。
// 数值平衡集中在此与 BALANCE.path——调手感只动这里，逻辑零散落。
// ============================================================
export const CULTIVATION_PATHS = [
    {
        id: 'sword', name: '剑宗·剑修', tags: ['攻击', '暴击', '爆发'], unlockRealmLevel: 1,
        desc: '以剑入道，求一击破敌。攻势凌厉、暴起伤人，然守御稍疏。',
        recommendedStats: '攻击 · 暴击 · 暴击伤害',
        flavorText: '剑者，凶器也；一寸短一寸险，一剑快，天下惊。',
        bonuses: ['攻击 +8%', '暴击率 +3%', '暴击伤害 +10%'],
        // 防御惩罚 -5%→-3%：原惩罚在陡峭生存临界点过重，使剑修胜率反低于无流派；减税让进攻流可玩、仍保留「攻强守弱」定位。
        penalties: ['防御 -3%'],
        mods: { mult: { atk: 8, def: -3 }, flat: { crit: 3, critDmg: 10 } }
    },
    {
        id: 'body', name: '金身·体修', tags: ['气血', '防御', '坚毅'], unlockRealmLevel: 1,
        desc: '淬炼肉身如金似铁，血厚甲坚，最宜稳扎稳打、长久挂机；受击之际更有反震之力。',
        recommendedStats: '气血 · 防御 · 反震',
        flavorText: '千锤百炼此身躯，刀枪难入鬼神惊。',
        // 平衡：原 +12%血/+10%防/15%反伤 在「敌人近乎一击」的生存临界点过强(第10/20关 ~99% 胜率，其余流派仅 ~60~78%)。
        // 下调为 +8%血/+7%防/11%反伤：仍是最肉、最宜挂机的流派(胜率仍居首)，但降其绝对战力、收窄与其它道的差距。
        bonuses: ['气血 +8%', '防御 +7%', '反震：受击反弹攻击 11%'],
        penalties: ['闪避 -3%'],
        mods: { mult: { hp: 8, def: 7 }, flat: { dodge: -3, thornsPct: 11 } }
    },
    {
        id: 'poison', name: '毒龙·毒修', tags: ['暗器', '持续', '磨炼'], unlockRealmLevel: 5,
        desc: '御毒驭虫，伤敌于无形。暗器淬毒，出手有概率使敌中毒、逐回合灼烧；然正面拼杀稍逊。',
        recommendedStats: '攻击 · 暗器 · 持久',
        flavorText: '见血封喉，附骨之蛆——磨死强敌，何须一击。',
        bonuses: ['暗器伤害 +20%', '出手 30% 概率附「淬毒」', '中毒每层每回合 = 攻击 10%（可叠 4 层 · 真伤无视防御）'],
        penalties: ['正面攻击 -4%'],
        mods: { mult: { atk: -4 }, subweaponMult: 20, poison: { chance: 30, pctOfAtk: 10, maxStacks: 4, bossEff: 0.4 } }
    },
    {
        id: 'agility', name: '踏雪·身法', tags: ['闪避', '先手', '灵巧'], unlockRealmLevel: 1,
        desc: '身轻如燕，来去如风。善避锋芒、抢占先机，开场数招气势如虹；唯体魄略薄。',
        recommendedStats: '闪避 · 先手 · 灵巧',
        flavorText: '踏雪无痕，迎风一笑——敌未近身，我已三剑。',
        bonuses: ['闪避 +5%', '先发制人：前 2 回合增伤 +20%'],
        // 气血惩罚 -8%→-6%：原惩罚在陡峭生存临界点过重，使身法胜率反低于无流派；减税让灵巧流可玩、仍保留「灵巧脆皮」定位。
        penalties: ['气血 -6%'],
        mods: { mult: { hp: -6 }, flat: { dodge: 5, openerBonus: 20 } }
    },
    {
        id: 'artisan', name: '百炼·器修', tags: ['装备', '强化', '打造'], unlockRealmLevel: 8,
        desc: '痴于器物，以兵养道。装备根骨更盛、强化所得更丰、打造易出好货；然钻研武学之心稍分。',
        recommendedStats: '装备 · 强化 · 打造',
        flavorText: '人养兵三年，兵助人一世——神兵在手，胜过十年苦功。',
        bonuses: ['装备基础属性 +5%', '强化收益 +8%', '打造更易出高成色'],
        penalties: ['秘籍（被动功法）收益 -5%'],
        mods: { gearStatMult: 5, enhanceMult: 8, craftQualityBonus: 1, skillMult: -5 }
    }
];

// ============================================================
// 地图词缀（关卡特性）：让不同关卡有不同战斗环境与掉落倾向，而非纯数值翻倍。
// 确定性·可解释·UI 可见（按关卡号分配，刷新不变；见 domain.getMapModifier）。轻量配置化，加词缀只往此处加一条。
//   id/name/desc/icon/tone：展示（tone 引用既有 CSS 变量，不硬编码颜色）；
//   unlockFromMapLevel：该词缀最早可在第几关出现（早关回落荒原，配速更温和）；
//   preferredPaths：契合的修行流派 id（仅信息展示 + 个别机制联动，如毒修抗毒瘴）；
//   combat：战斗环境（由 domain.resolveMapEnv 解析、各项封顶后喂给 simulateBattle）——
//     enemyCritChance/enemyCritMult（敌暴击）、dodgeReduction（玩家闪避削减·百分点）、
//     healMult（玩家回血/吸血乘区<1）、envDmgPctMaxHp（每回合环境真伤=气血上限%）、
//     envLabel（环境伤害日志文案）、resistPath+resistFactor（对应流派减伤，如毒修抗毒瘴）；
//   reward：掉落/收益倾向（由 domain.getMapRewardMods 解析、全部封顶）——
//     expMult（修为加成）、gearDropMult（装备掉率乘区）、weaponBias（兵刃/暗器掉落偏向概率）、
//     herbDropChance（药材掉落概率）、skillDropChance（秘籍掉落概率）。
// ============================================================
export const MAP_MODIFIERS = [
    {
        id: 'wildland', name: '荒原', icon: '🌾', tone: 'var(--text-muted)', unlockFromMapLevel: 1,
        desc: '天地平和，无特殊凶险，亦无额外造化。', preferredPaths: [],
        combat: {}, reward: {}
    },
    {
        id: 'spirit_vein', name: '灵脉', icon: '🌀', tone: 'var(--color-success)', unlockFromMapLevel: 5,
        desc: '地脉灵气充盈，修行事半功倍；然宝物罕现，装备掉落偏少。', preferredPaths: [],
        combat: {}, reward: { expMult: 1.3, gearDropMult: 0.7 }
    },
    {
        id: 'sword_tomb', name: '剑冢', icon: '🗡️', tone: 'var(--color-orange)', unlockFromMapLevel: 5,
        desc: '万剑长眠，杀机森寒——守卫出手暴起伤人，却也最易遗落兵刃。', preferredPaths: ['sword'],
        combat: { enemyCritChance: 25, enemyCritMult: 1.6 }, reward: { weaponBias: 0.7 }
    },
    {
        id: 'poison_mist', name: '毒瘴', icon: '☠️', tone: 'var(--color-accent)', unlockFromMapLevel: 10,
        desc: '瘴气弥漫，逐回合侵蚀气血；草药却也丰茂。毒修于此如鱼得水，所受侵蚀大减。', preferredPaths: ['poison'],
        combat: { envDmgPctMaxHp: 3, envLabel: '毒瘴侵体', resistPath: 'poison', resistFactor: 0.4 },
        reward: { herbDropChance: 0.25 }
    },
    {
        id: 'demon_den', name: '魔窟', icon: '👹', tone: 'var(--color-honghuang)', unlockFromMapLevel: 15,
        desc: '魔煞蚀身，回血与吸血大打折扣；然魔头藏有武学秘传，偶有秘籍遗落。', preferredPaths: [],
        combat: { healMult: 0.4 }, reward: { skillDropChance: 0.05 }
    },
    {
        id: 'thunder_marsh', name: '雷泽', icon: '⚡', tone: 'var(--color-blue)', unlockFromMapLevel: 20,
        desc: '雷霆过境，身形难展（闪避大降），且逐回合雷击灼身——唯血厚甲坚者可镇之。', preferredPaths: ['body'],
        combat: { dodgeReduction: 10, envDmgPctMaxHp: 2, envLabel: '雷光过境' }, reward: {}
    }
];

// ============================================================
// 第五阶段·打造副词条（生产↔流派绑定）：打造装备时可选一种「副词条」，按流派风格小幅加成。
// 选择成本：每件只能选一种副词条，且额外多耗 extraIngot 个同档锭（吃同一套采矿→熔炼产能）。
//   id/name/desc：展示；path：契合流派（用于「推荐」高亮）；extraIngot：额外锭消耗；
//   实际数值在 domain.applyCraftAffix（按档 tier 缩放）；'refine' 走成色 +1（在 craftGear 处理）。
// ============================================================
export const CRAFT_AFFIXES = [
    { id: 'none',   name: '无',   path: null,      desc: '普通打造，无额外词条、无额外耗材。',         extraIngot: 0 },
    { id: 'sharp',  name: '锋锐', path: 'sword',   desc: '注入锋锐之意——暴击提升（宜剑修）。',         extraIngot: 2 },
    { id: 'guard',  name: '坚铠', path: 'body',    desc: '淬炼坚铠之体——防御与气血提升（宜体修）。',   extraIngot: 2 },
    { id: 'swift',  name: '轻灵', path: 'agility', desc: '附身法之轻灵——闪避提升（宜身法）。',         extraIngot: 2 },
    { id: 'venom',  name: '淬毒', path: 'poison',  desc: '暗器淬毒——攻击与暴击提升（宜毒修暗器）。',   extraIngot: 2 },
    { id: 'refine', name: '精工', path: 'artisan', desc: '匠心精工——成色必再升一阶（宜器修）。',       extraIngot: 3 }
];
