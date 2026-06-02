// ============================================================
// 数据层 · 奇遇事件池（Event）—— 数据驱动，第一阶段 22 个。
// event 节点触发，从池中按区域/因果条件随机抽一个；选择影响：属性 / 资源 / 因果 karma /
// 世界标记 worldFlags / 寿元 age / 装备材料秘籍 / 流派倾向(tactic) / 后续事件条件(flag/require)。
//
// choice.effects 支持键（由 run.applyEventChoice 落地；item/skill 由 ui 控制器实体化以避免循环依赖）：
//   atk/def/hp/crit/dodge : 「永久根骨」增量（写入 player.pillBonus，跨世保留、不被渡劫重置）
//   hpNow                 : 当前寿命气血 增减（+疗伤 / -受创；控制器据最大气血夹取，归零即陨落）
//   coin/exp/honghuangPower: 碎银/修为/洪荒之力
//   karma                 : 因果值增减（正向因果受命格/遗产 karmaGainMult 放大）
//   age                   : 寿元增减（+催老 / -驻颜，罕见）
//   material              : { 物料key: 数量 }（受 eventRewardMult 放大）
//   item                  : true（随机装备）| { tier, slot, quality }
//   skill                 : true（随机秘籍入行囊）
//   flag                  : { key: value } 写入 run.worldFlags（驱动后续 require）
//   tactic                : 设为某策略（流派倾向引导）
// choice.require（不满足则该选项灰显锁定）：{ karmaMin, karmaMax, flag, notFlag, minAtk }
// ============================================================
export const EVENTS = [
    {
        id: 'sword_tomb_tablet', title: '剑冢残碑', regionTags: ['jianzhong'],
        desc: '荒草间露出半截断碑，碑文中隐有剑意流转，似在低声诵念某种剑诀。',
        choices: [
            { text: '凝神参悟剑痕', effects: { atk: 6, karma: 1 }, resultText: '剑意入体，攻击根骨精进，却也沾染了一缕执念。' },
            { text: '拓印碑文带走', effects: { material: { ore_xuan: 4 }, coin: 600 }, resultText: '你拓下碑文，顺手凿了几块碑基玄铁。' },
            { text: '叩首而过，不扰先贤', effects: { karma: -1, exp: 300 }, resultText: '心怀敬意，反得一丝明悟。' }
        ]
    },
    {
        id: 'old_well', title: '荒村古井', regionTags: ['qingzhou'],
        desc: '废弃村落中一口古井，井底幽幽泛着微光，井绳早已腐朽。',
        choices: [
            { text: '缒身下井探宝', effects: { hpNow: -40, coin: 1200, item: { tier: 1 } }, resultText: '井壁尖石划破皮肉，却在淤泥里摸到一件旧兵器与一袋碎银。' },
            { text: '打一桶水饮下', effects: { hpNow: 60 }, resultText: '井水清冽回甘，疲惫一扫而空。' },
            { text: '绕井而行', effects: {}, resultText: '你谨慎离开，未生事端。' }
        ]
    },
    {
        id: 'drunk_tower', title: '醉仙楼', regionTags: ['qingzhou', 'yunmeng'],
        desc: '酒旗招展，楼里一位醉醺醺的老者拉你拼酒，说要传你「酒中剑意」。',
        choices: [
            { text: '舍命陪君子，痛饮三百杯', effects: { hpNow: -50, atk: 4, dodge: 2, karma: -1 }, resultText: '醉里挑灯，老者抚掌大笑，临走点拨了你几手身法。' },
            { text: '付账结交', effects: { coin: -800, exp: 500, flag: { metDrunkMaster: true } }, resultText: '你结清酒钱，老者记下了你的名号。' },
            { text: '推辞离去', effects: {}, resultText: '你婉拒了邀约。' }
        ]
    },
    {
        id: 'road_corpse', title: '路边横尸',
        desc: '官道旁躺着一具客商尸首，身上钱袋鼓囊，远处似有秃鹫盘旋。',
        choices: [
            { text: '搜刮财物', effects: { coin: 1500, karma: 2 }, resultText: '你取走了钱袋——死者无言，因果有声。' },
            { text: '掘土安葬', effects: { hpNow: -10, karma: -2, exp: 400 }, resultText: '入土为安，你心下坦荡。' },
            { text: '视而不见', effects: {}, resultText: '你快步离开了是非之地。' }
        ]
    },
    {
        id: 'beggar_test', title: '褴褛乞丐',
        desc: '一个浑身脏污的乞丐向你乞讨，眼神却清亮得不似常人。',
        choices: [
            { text: '慷慨施银', effects: { coin: -500, karma: -2, flag: { helpedBeggar: true } }, resultText: '乞丐叩谢，转身时步法竟暗合武学至理。' },
            { text: '分些干粮', effects: { karma: -1 }, resultText: '乞丐感念，指了条近路给你。' },
            { text: '冷眼呵斥', effects: { karma: 1 }, resultText: '乞丐冷笑离去，你心中莫名一沉。' }
        ]
    },
    {
        id: 'beggar_reward', title: '丐帮舵主',
        desc: '一名丐帮舵主拦住去路，似曾相识：「当日落魄受恩，今日特来还报。」',
        choices: [
            { text: '坦然受礼', require: { flag: 'helpedBeggar' }, effects: { skill: true, coin: 2000 }, resultText: '舵主奉上一本秘籍与盘缠，江湖恩义，循环往复。' },
            { text: '不敢居功', effects: { karma: -1, exp: 600 }, resultText: '你谦辞而退，反得舵主敬重。' }
        ]
    },
    {
        id: 'fishing_light', title: '渔家灯火', regionTags: ['yunmeng'],
        desc: '泽畔渔火点点，老渔夫邀你共食鲜鱼，言谈间提起水底古物。',
        choices: [
            { text: '随他夜潜捞宝', effects: { hpNow: -30, material: { ore_iron: 6 }, coin: 800 }, resultText: '冰冷泽水中，你捞起一网沉铁与铜钱。' },
            { text: '换些草药', effects: { material: { herb_1: 8 } }, resultText: '老渔夫送你一捆晒干的药草。' },
            { text: '饱餐一顿', effects: { hpNow: 50 }, resultText: '鱼鲜暖腹，气血回涌。' }
        ]
    },
    {
        id: 'fortune_teller', title: '泽畔卜者', regionTags: ['yunmeng'],
        desc: '一名盲眼卜者端坐泽畔：「客官印堂晦明不定，可愿一卜吉凶？」',
        choices: [
            { text: '卜问前程（耗银）', effects: { coin: -1000, exp: 1500, karma: -1 }, resultText: '卦象点醒迷津，你顿觉修为通达。' },
            { text: '求一道护身符', effects: { hp: 40, flag: { hasTalisman: true } }, resultText: '卜者递来护身符，你只觉根骨厚实了几分。' },
            { text: '一笑了之', effects: {}, resultText: '你不信命，扬长而去。' }
        ]
    },
    {
        id: 'sword_spirit', title: '剑灵低语', regionTags: ['jianzhong'],
        desc: '一柄折剑悬浮半空，剑灵嘶哑发问：「凡人，可愿以血饲剑，承我剑道？」',
        choices: [
            { text: '滴血认主', effects: { hpNow: -60, atk: 10, karma: 1, tactic: 'aggressive' }, resultText: '剑鸣龙吟，凶戾剑意灌体——你的杀招更盛了。' },
            { text: '以剑诀相易', effects: { skill: true }, resultText: '剑灵化作一道流光钻入你识海，留下一门剑诀。' },
            { text: '镇压邪剑', require: { minAtk: 60 }, effects: { karma: -2, material: { soul_crystal: 1 } }, resultText: '你以浩然之力镇住邪剑，得其剑魂凝成的结晶。' }
        ]
    },
    {
        id: 'test_stone', title: '试剑石', regionTags: ['jianzhong'],
        desc: '一方丈高的青石屹立道旁，石面布满深浅剑痕，传言可测剑者根骨。',
        choices: [
            { text: '全力一剑', effects: { hpNow: -20, atk: 5, exp: 800 }, resultText: '一剑劈下，石屑纷飞，你对劲力的领悟更深。' },
            { text: '以巧劲点石', effects: { dodge: 2, crit: 1 }, resultText: '四两拨千斤，你的身法与眼力都有所精进。' }
        ]
    },
    {
        id: 'herb_king', title: '毒手药王庐', regionTags: ['wandu'],
        desc: '草庐中一位白须老者正在熬药，药香与毒气交织：「来得正好，替老夫试试这炉新丹。」',
        choices: [
            { text: '吞服新丹', effects: { hpNow: -40, hp: 50, atk: 6, karma: 0 }, resultText: '丹入腹中翻江倒海，挺过之后筋骨竟脱胎换骨。' },
            { text: '讨教炼毒之术', effects: { tactic: 'poison', material: { herb_2: 6 } }, resultText: '老者传你淬毒法门，你已偏向以毒制敌。' },
            { text: '婉拒，只买药材', effects: { coin: -600, material: { herb_3: 4 } }, resultText: '你买下几株珍稀药材便告辞。' }
        ]
    },
    {
        id: 'antidote_spring', title: '解毒清泉', regionTags: ['wandu'],
        desc: '瘴气深处竟有一泓清泉，泉水沁凉，似能涤净百毒。',
        choices: [
            { text: '畅饮疗伤', effects: { hpNow: 120 }, resultText: '清泉入喉，遍体毒瘴尽消，气血大涨。' },
            { text: '灌满水囊备用', effects: { material: { herb_1: 10 }, flag: { hasSpringWater: true } }, resultText: '你灌满水囊，留作日后解毒之用。' }
        ]
    },
    {
        id: 'gu_master', title: '蛊师密室', regionTags: ['wandu'],
        desc: '幽暗石室里万蛊攒动，蛊师阴恻恻地盯着你：「献上一物，我便赐你蛊虫之力。」',
        choices: [
            { text: '献血养蛊', effects: { hpNow: -70, atk: 8, karma: 2, tactic: 'poison' }, resultText: '蛊虫噬血，化为你体内的剧毒杀机。' },
            { text: '以银钱交易', effects: { coin: -1500, skill: true }, resultText: '蛊师收下钱财，传你一门阴毒功法。' },
            { text: '焚毁蛊坛', require: { minAtk: 80 }, effects: { karma: -3, coin: 2000, exp: 1000 }, resultText: '你一掌震碎蛊坛，为江湖除一大害。' }
        ]
    },
    {
        id: 'old_immortal', title: '古道残仙', regionTags: ['tianmen'],
        desc: '登天阶上盘坐着一缕将散的残魂，自称万载前飞升失败的散仙。',
        choices: [
            { text: '聆听大道', effects: { exp: 4000, honghuangPower: 1, age: 3 }, resultText: '残仙传你一段大道真言，受益匪浅，却也耗去几年光阴。' },
            { text: '助其魂飞魄散，了却执念', effects: { karma: -3, material: { soul_crystal: 2 } }, resultText: '你超度了残仙，他遗下两枚神魂结晶以谢。' },
            { text: '夺其残魂炼化', effects: { hpNow: -50, honghuangPower: 2, karma: 3 }, resultText: '你强夺残魂炼入己身，洪荒之力暴涨，因果缠身。' }
        ]
    },
    {
        id: 'heaven_stele', title: '镇魔石碑', regionTags: ['tianmen'],
        desc: '一座古老石碑镇压着滚滚魔气，碑上铭文殷红如血。',
        choices: [
            { text: '注入真元加固封印', effects: { hpNow: -40, karma: -2, def: 8, flag: { sealedDemon: true } }, resultText: '你加固了封印，功德加身，根骨愈坚。' },
            { text: '破碑取宝', effects: { karma: 4, item: { tier: 5 }, coin: 3000 }, resultText: '魔气冲天，你抢出一件神兵——代价是滔天因果。' }
        ]
    },
    {
        id: 'broken_temple', title: '荒庙借宿', regionTags: ['qingzhou', 'jianzhong'],
        desc: '风雨夜，一座破庙可供避雨，神像斑驳，香案下似有暗格。',
        choices: [
            { text: '撬开暗格', effects: { coin: 1000, material: { ore_copper: 8 }, karma: 1 }, resultText: '暗格里藏着前人遗留的财物。' },
            { text: '打坐调息一夜', effects: { hpNow: 80, exp: 300 }, resultText: '一夜静修，神完气足。' },
            { text: '为神像拂尘上香', effects: { karma: -2, flag: { prayed: true } }, resultText: '你虔诚祭拜，冥冥中似有庇佑。' }
        ]
    },
    {
        id: 'wandering_swordsman', title: '挑战狂徒',
        desc: '一名狂傲剑客拦路:「听闻阁下小有名气，可敢与我一较高下？」',
        choices: [
            { text: '应战（搏命）', effects: { hpNow: -90, atk: 7, exp: 1200, karma: 1 }, resultText: '一场恶斗险胜，你从生死间悟得杀伐之道。' },
            { text: '以礼相待，切磋点到为止', effects: { exp: 600, dodge: 1 }, resultText: '点到为止，互有进益，结为好友。' },
            { text: '花钱消灾', effects: { coin: -1000 }, resultText: '破财免灾，狂徒哂笑而去。' }
        ]
    },
    {
        id: 'treasure_map', title: '残破藏宝图',
        desc: '你在一具枯骨手中发现半张藏宝图，墨迹模糊，去向成谜。',
        choices: [
            { text: '按图索骥（耗寿）', effects: { age: 2, coin: 2500, item: true }, resultText: '跋涉数月，你掘出一处小型宝藏。' },
            { text: '高价卖给行商', effects: { coin: 1200 }, resultText: '你把藏宝图卖了个好价钱，落袋为安。' }
        ]
    },
    {
        id: 'starlight_meteor', title: '陨星之夜', regionTags: ['tianmen', 'jianzhong'],
        desc: '夜空一道流火坠落不远处，星陨之地往往蕴藏天材地宝。',
        choices: [
            { text: '抢先挖掘', effects: { hpNow: -30, material: { ore_star: 3 } }, resultText: '余温灼人，你撬下几块星陨精铁。' },
            { text: '感悟星辰之力', effects: { crit: 2, exp: 1000 }, resultText: '星光入眼，你的洞察与暴起之机更敏锐了。' }
        ]
    },
    {
        id: 'merchant_caravan', title: '落难商队',
        desc: '一支商队遭劫，幸存的商人跪求护送出境，许以重酬。',
        choices: [
            { text: '仗义护送', effects: { hpNow: -40, coin: 2000, karma: -2, flag: { savedMerchant: true } }, resultText: '你击退余匪，商人千恩万谢奉上酬金。' },
            { text: '趁火打劫', effects: { coin: 1800, karma: 3 }, resultText: '你夺走货物扬长而去，恶名暗记。' },
            { text: '指条生路便走', effects: { karma: -1 }, resultText: '你为他们指了条活路，未取分文。' }
        ]
    },
    {
        id: 'karma_backlash', title: '因果反噬',
        desc: '夜半，你被无名心悸惊醒——往日所造业障似乎正在汇聚成形。',
        choices: [
            { text: '以杀止杀，斩破心魔', require: { karmaMin: 5 }, effects: { hpNow: -100, atk: 12, karma: -3 }, resultText: '你在血与火中斩断心魔，杀意化作纯粹的力量。' },
            { text: '静坐忏悔，消解业力', effects: { exp: 800, karma: -4 }, resultText: '你诚心忏悔，业障消散了不少。' },
            { text: '放任自流', effects: { karma: 2 }, resultText: '你压下不安，业障却又添一分。' }
        ]
    },
    {
        id: 'merchant_repay', title: '商号答谢',
        desc: '一位锦衣管事寻到你:「我家东主蒙恩公搭救，特备薄礼相赠。」',
        choices: [
            { text: '欣然收下', require: { flag: 'savedMerchant' }, effects: { coin: 3000, material: { ingot_iron: 6 } }, resultText: '管事奉上丰厚谢礼，江湖路上也算结了善缘。' },
            { text: '心领，礼不敢受', effects: { karma: -2, exp: 800 }, resultText: '你婉拒厚礼，反令对方更为敬重。' }
        ]
    },
    // —— 第二阶段：感悟(runTalent) / 事件链payoff / 因果链 ——
    {
        id: 'drunk_master_return', title: '醉仙再会',
        desc: '当日醉仙楼的老者又现身路旁，咧嘴一笑：「小子，缘分呐，传你一手压箱底的绝活。」',
        choices: [
            { text: '诚心求教', require: { flag: 'metDrunkMaster' }, effects: { runTalent: true, exp: 800 }, resultText: '老者倾囊相授，你福至心灵，领悟一门本世感悟。' },
            { text: '请他喝一坛', effects: { coin: -300, hpNow: 40, karma: -1 }, resultText: '推杯换盏，老者塞给你一壶疗伤烈酒。' }
        ]
    },
    {
        id: 'sword_enlighten', title: '剑庐悟道', regionTags: ['jianzhong'],
        desc: '废弃剑庐中一面斑驳铜镜，映出你的剑势，刹那间似有所悟。',
        choices: [
            { text: '闭目参详（耗寿元）', effects: { runTalent: true, age: 2 }, resultText: '数日苦修，剑意入心，得一门本世感悟。' },
            { text: '取下铜镜变卖', effects: { coin: 1500, karma: 1 }, resultText: '你撬下古镜，换得一笔盘缠。' }
        ]
    },
    {
        id: 'karma_mirror', title: '业镜台',
        desc: '一面漆黑古镜映出你一路的杀伐，镜中血光隐隐，似在叩问因果。',
        choices: [
            { text: '焚香赎罪', require: { karmaMin: 5 }, effects: { karma: -5, hpNow: -30, exp: 600 }, resultText: '你长跪忏悔，血光渐敛，业力消解大半。' },
            { text: '广施阴德', effects: { coin: -1000, karma: -2 }, resultText: '散去部分钱财，结一段善缘。' },
            { text: '我命由我，不惧因果', effects: { atk: 6, karma: 2 }, resultText: '你直面业镜，杀意愈纯，然因果更深。' }
        ]
    }
];

export const EVENT_MAP = Object.fromEntries(EVENTS.map(e => [e.id, e]));
