// ============================================================
// 数据层 · 奇遇事件池（Event）—— 数据驱动，第一阶段 22 个。
// event 节点触发，从池中按区域/因果条件随机抽一个；选择影响：属性 / 资源 / 因果 karma /
// 世界标记 worldFlags / 寿元 age / 装备材料秘籍 / 流派倾向(tactic) / 后续事件条件(flag/require)。
//
// choice.effects 支持键（由 run.applyEventChoice 落地；item/skill 由 ui 控制器实体化以避免循环依赖）：
//   stats                 : { atk/def/hp/crit/dodge } 「本世临时」属性（写入 run.tempBonus，轮回后清空）
//   permStats             : { atk/def/hp/crit/dodge } 「永久根骨」（写入 player.pillBonus，跨世保留）—— 仅极少数稀有事件使用
//   hpNow                 : 当前寿命气血 增减（+疗伤 / -受创；控制器据最大气血夹取，归零即陨落）
//   coin/exp/honghuangPower: 碎银/修为/洪荒之力
//   karma                 : 因果值增减（正向因果受命格/遗产 karmaGainMult 放大）
//   age                   : 寿元增减（+催老 / -驻颜，罕见）
//   material              : { 物料key: 数量 }（受 eventRewardMult 放大）
//   item                  : true（随机装备）| { tier, slot, quality }
//   skill                 : true（随机秘籍入行囊）
//   flag                  : { key: value } 写入 run.worldFlags（驱动后续 require）
//   tactic                : 设为某策略（流派倾向引导）
//   reputation            : { 派系id: 增量 }（第五阶段·事件链 payoff；内联增减，受 repMax 钳制）
// choice.require（不满足则该选项灰显锁定）：{ karmaMin, karmaMax, flag, notFlag, minAtk }
// ============================================================
export const EVENTS = [
    {
        id: 'sword_tomb_tablet', title: '剑冢残碑', regionTags: ['jianzhong'],
        desc: '荒草间露出半截断碑，碑文中隐有剑意流转，似在低声诵念某种剑诀。',
        choices: [
            { text: '凝神参悟剑痕', effects: { stats: { atk: 5 }, permStats: { atk: 1 }, karma: 1 }, resultText: '剑意入体，根骨略有精进，今世攻势更盛，却也沾染了一缕执念。' },
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
            { text: '舍命陪君子，痛饮三百杯', effects: { hpNow: -50, stats: { atk: 4, dodge: 2 }, karma: -1 }, resultText: '醉里挑灯，老者抚掌大笑，临走点拨了你几手身法。' },
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
            { text: '求一道护身符', effects: { stats: { hp: 40 }, flag: { hasTalisman: true } }, resultText: '卜者递来护身符，你只觉今世体魄壮实了几分。' },
            { text: '一笑了之', effects: {}, resultText: '你不信命，扬长而去。' }
        ]
    },
    {
        id: 'sword_spirit', title: '剑灵低语', regionTags: ['jianzhong'],
        desc: '一柄折剑悬浮半空，剑灵嘶哑发问：「凡人，可愿以血饲剑，承我剑道？」',
        choices: [
            { text: '滴血认主', effects: { hpNow: -60, stats: { atk: 10 }, karma: 1, tactic: 'aggressive' }, resultText: '剑鸣龙吟，凶戾剑意灌体——你的杀招更盛了。' },
            { text: '以剑诀相易', effects: { skill: true }, resultText: '剑灵化作一道流光钻入你识海，留下一门剑诀。' },
            { text: '镇压邪剑', require: { minAtk: 60 }, effects: { karma: -2, material: { soul_crystal: 1 } }, resultText: '你以浩然之力镇住邪剑，得其剑魂凝成的结晶。' }
        ]
    },
    {
        id: 'test_stone', title: '试剑石', regionTags: ['jianzhong'],
        desc: '一方丈高的青石屹立道旁，石面布满深浅剑痕，传言可测剑者根骨。',
        choices: [
            { text: '全力一剑', effects: { hpNow: -20, stats: { atk: 5 }, exp: 800 }, resultText: '一剑劈下，石屑纷飞，你对劲力的领悟更深。' },
            { text: '以巧劲点石', effects: { stats: { dodge: 2, crit: 1 } }, resultText: '四两拨千斤，你的身法与眼力都有所精进。' }
        ]
    },
    {
        id: 'herb_king', title: '毒手药王庐', regionTags: ['wandu'],
        desc: '草庐中一位白须老者正在熬药，药香与毒气交织：「来得正好，替老夫试试这炉新丹。」',
        choices: [
            { text: '吞服新丹', effects: { hpNow: -40, stats: { hp: 40, atk: 5 }, permStats: { hp: 10 }, karma: 0 }, resultText: '丹入腹中翻江倒海，挺过之后筋骨略有蜕变——根底有所夯实。' },
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
            { text: '献血养蛊', effects: { hpNow: -70, stats: { atk: 8 }, karma: 2, tactic: 'poison' }, resultText: '蛊虫噬血，化为你体内的剧毒杀机。' },
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
            { text: '注入真元加固封印', effects: { hpNow: -40, karma: -2, stats: { def: 8 }, flag: { sealedDemon: true } }, resultText: '你加固了封印，功德加身，今世体魄愈坚。' },
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
            { text: '应战（搏命）', effects: { hpNow: -90, stats: { atk: 7 }, exp: 1200, karma: 1 }, resultText: '一场恶斗险胜，你从生死间悟得杀伐之道。' },
            { text: '以礼相待，切磋点到为止', effects: { exp: 600, stats: { dodge: 1 } }, resultText: '点到为止，互有进益，结为好友。' },
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
            { text: '感悟星辰之力', effects: { stats: { crit: 2 }, exp: 1000 }, resultText: '星光入眼，你的洞察与暴起之机更敏锐了。' }
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
            { text: '以杀止杀，斩破心魔', require: { karmaMin: 5 }, effects: { hpNow: -100, stats: { atk: 12 }, karma: -3 }, resultText: '你在血与火中斩断心魔，杀意化作纯粹的力量。' },
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
            { text: '我命由我，不惧因果', effects: { stats: { atk: 6 }, karma: 2 }, resultText: '你直面业镜，杀意愈纯，然因果更深。' }
        ]
    },

    // ============================================================
    // 第五阶段·事件链（6 条短链，每条 3 步，用 worldFlags 串联；payoff 影响构筑机制/Boss 破招/派系声望）。
    // step1 无 require（随处可遇）；step2/3 require 前置 flag；step2 两选项都置 step2-flag，确保链路可达。
    // effects 支持 reputation:{派系:增量}（第五阶段新增，见 run.applyEventChoice）。
    // ============================================================
    // —— 1) 剑灵低语链（剑冢 · 剑势/青城/因果）——
    {
        id: 'jl_1', title: '剑灵低语·初闻', regionTags: ['jianzhong'],
        desc: '断剑林深处，一缕剑灵附于折剑，低声试探你的剑心。',
        choices: [
            { text: '与剑灵立约，借其剑意', effects: { stats: { atk: 6 }, karma: 1, flag: { jl_whisper: true } }, resultText: '剑灵嗤笑入体，攻势更利，却也染上一缕戾气。' },
            { text: '以自身剑诀印证，不沾因果', effects: { stats: { crit: 2 }, exp: 600 }, resultText: '你以剑诀回应，剑灵默然，留下一丝感悟。' }
        ]
    },
    {
        id: 'jl_2', title: '剑灵试炼', regionTags: ['jianzhong'],
        desc: '剑灵引你入虚影剑冢，要你斩破万千心魔之剑。',
        choices: [
            { text: '凝神以剑势破阵', require: { flag: 'jl_whisper' }, effects: { stats: { atk: 5, crit: 2 }, flag: { jl_trial: true } }, resultText: '你以纯粹剑势破尽虚影，剑灵认可——剑势更盛。' },
            { text: '借剑灵之力强渡', require: { flag: 'jl_whisper' }, effects: { hpNow: -50, karma: 2, runTalent: true, flag: { jl_trial: true } }, resultText: '你任剑灵之力贯体，险胜负反噬——得一门本世感悟。' }
        ]
    },
    {
        id: 'jl_3', title: '剑灵归宿', regionTags: ['jianzhong'],
        desc: '剑灵执念已消，问你如何处置它残存的剑魂。',
        choices: [
            { text: '纳剑魂入鞘，承其剑道', require: { flag: 'jl_trial' }, effects: { stats: { atk: 8, crit: 3 }, reputation: { qingcheng: 8 }, karma: 1 }, resultText: '剑魂归鞘，青城闻讯结善缘——你的剑势臻于大成。' },
            { text: '超度剑灵，了却千年执念', require: { flag: 'jl_trial' }, effects: { karma: -3, material: { soul_crystal: 1 }, exp: 1500 }, resultText: '你诵经超度，剑灵化光而散，遗下一枚剑魂结晶。' }
        ]
    },
    // —— 2) 药王救疫链（云梦/万毒 · 药王谷/草药/低因果）——
    {
        id: 'yw_1', title: '瘟疫村落', regionTags: ['yunmeng', 'wandu'],
        desc: '一座村落瘟疫横行，药王谷弟子焦头烂额地施救。',
        choices: [
            { text: '出手相助，分发草药', effects: { karma: -1, reputation: { yaowang: 4 }, flag: { yw_plague: true } }, resultText: '你协助施药，疫情稍缓，药王谷感念。' },
            { text: '只求购解毒药材', effects: { coin: -600, material: { herb_2: 4 } }, resultText: '你买下几味珍贵药材便离去。' }
        ]
    },
    {
        id: 'yw_2', title: '寻药解疫', regionTags: ['yunmeng', 'wandu'],
        desc: '要根治瘟疫，须寻一味生于毒地的解药引子。',
        choices: [
            { text: '深入毒地采药', require: { flag: 'yw_plague' }, effects: { hpNow: -40, material: { herb_3: 3 }, flag: { yw_cure: true } }, resultText: '你冒毒采得药引，虽受损伤，却离根治更近。' },
            { text: '请药王谷高手坐镇', require: { flag: 'yw_plague' }, effects: { coin: -1000, exp: 800, flag: { yw_cure: true } }, resultText: '你重金请来药王谷高手，暂稳疫情。' }
        ]
    },
    {
        id: 'yw_3', title: '疫尽人安', regionTags: ['yunmeng', 'wandu'],
        desc: '瘟疫终被压下，村民与药王谷皆来致谢。',
        choices: [
            { text: '受药王谷传授解毒之术', require: { flag: 'yw_cure' }, effects: { reputation: { yaowang: 10 }, karma: -3, permStats: { def: 8 } }, resultText: '药王谷倾囊相授解毒法门，体魄与善缘俱增（更易破万毒 Boss）。' },
            { text: '功成身退，不求回报', require: { flag: 'yw_cure' }, effects: { karma: -4, reputation: { commoners: 6 }, exp: 1200 }, resultText: '你悄然离去，积下深厚善缘。' }
        ]
    },
    // —— 3) 黑市债契链（任意区域 · 黑市声望/因果/天罚 Boss 风险）——
    {
        id: 'bm_1', title: '牙行密信',
        desc: '一名黑市牙人塞来一封密信：「一笔横财，要不要？」',
        choices: [
            { text: '接下黑契，预支横财', effects: { coin: 3000, karma: 2, reputation: { blackmarket: 5 }, flag: { bm_debt: true } }, resultText: '你接过沉甸甸的钱袋——这笔债，迟早要还。' },
            { text: '婉拒，不沾是非', effects: { karma: -1 }, resultText: '你摇头离去，牙人冷笑收信。' }
        ]
    },
    {
        id: 'bm_2', title: '黑契追加',
        desc: '牙人再度现身：「上回的本钱，可愿翻倍再赌一注？」',
        choices: [
            { text: '加注，赌一场大的', require: { flag: 'bm_debt' }, effects: { coin: 5000, karma: 3, flag: { bm_due: true } }, resultText: '你押上身家，横财滚滚——业力也滚滚而来。' },
            { text: '先还旧债，及时收手', require: { flag: 'bm_debt' }, effects: { coin: -2000, karma: -2, flag: { bm_due: true } }, resultText: '你结清旧账，牙人挑眉：「识相。」' }
        ]
    },
    {
        id: 'bm_3', title: '血债血偿',
        desc: '黑契到期，债主带着杀气找上门来——是了结的时候了。',
        choices: [
            { text: '以武力镇压债主', require: { flag: 'bm_due', karmaMin: 5 }, effects: { hpNow: -80, coin: 4000, reputation: { blackmarket: 10 }, karma: 1 }, resultText: '你一战镇住债主，黑市敬你三分（高因果引天罚 Boss，慎之）。' },
            { text: '散尽横财，消灾解业', require: { flag: 'bm_due' }, effects: { coin: -3000, karma: -5 }, resultText: '你散财消灾，业力大消，债主作罢。' }
        ]
    },
    // —— 4) 炉心铸剑链（剑冢/万毒/天门 · 过载/锻材/铸剑山庄）——
    {
        id: 'forge_1', title: '古炉余烬', regionTags: ['jianzhong', 'wandu', 'tianmen'],
        desc: '一座废弃古炉余烬未熄，似还能再燃一炉好钢。',
        choices: [
            { text: '添薪续火，淬炼好钢', effects: { material: { ingot_xuan: 3 }, reputation: { zhujian: 4 }, flag: { forge_spark: true } }, resultText: '你重燃古炉，炼得几锭好钢，铸剑山庄闻讯而至。' },
            { text: '拆炉取材变卖', effects: { coin: 1500, karma: 1 }, resultText: '你拆炉换钱，铸剑师若知怕要痛心。' }
        ]
    },
    {
        id: 'forge_2', title: '淬火秘传', regionTags: ['jianzhong', 'wandu', 'tianmen'],
        desc: '炉火中浮现一段铸剑山庄的淬火口诀。',
        choices: [
            { text: '参悟「炉心过载」火候', require: { flag: 'forge_spark' }, effects: { material: { ingot_cold: 2 }, exp: 1000, flag: { forge_temper: true } }, resultText: '你领悟过载淬火的火候真意，离器修大成更近。' },
            { text: '默记口诀，留待日后', require: { flag: 'forge_spark' }, effects: { reputation: { zhujian: 5 }, flag: { forge_temper: true } }, resultText: '你默记口诀，铸剑山庄记你一份人情。' }
        ]
    },
    {
        id: 'forge_3', title: '神兵将成', regionTags: ['jianzhong', 'wandu', 'tianmen'],
        desc: '古炉最后一燃，可成一件神兵——也可能炸炉。',
        choices: [
            { text: '倾力一铸（赌）', require: { flag: 'forge_temper' }, effects: { hpNow: -30, item: { tier: 5 }, reputation: { zhujian: 8 } }, resultText: '炉火冲天，你抢出一件神兵！铸剑山庄叹服（声望助炉心过载）。' },
            { text: '稳妥收炉，积攒锻材', require: { flag: 'forge_temper' }, effects: { material: { ingot_star: 3, soul_crystal: 1 }, reputation: { zhujian: 5 } }, resultText: '你稳妥收炉，攒下珍贵锻材。' }
        ]
    },
    // —— 5) 凡人香火链（任意区域 · 善缘/死亡结算保底/遗产）——
    {
        id: 'incense_1', title: '路旁土地庙',
        desc: '一座香火零落的土地小庙，残破却供着几炷将熄的香。',
        choices: [
            { text: '添香火，许一愿', effects: { coin: -300, karma: -2, reputation: { commoners: 4 }, flag: { incense_vow: true } }, resultText: '你添了香油钱，村民感念，冥冥中似有庇佑。' },
            { text: '歇脚片刻便走', effects: { hpNow: 40 }, resultText: '你在庙中歇息，气血微复。' }
        ]
    },
    {
        id: 'incense_2', title: '村民相赠',
        desc: '几名村民认出你便是那添香之人，执意回赠心意。',
        choices: [
            { text: '坦然受礼，结此善缘', require: { flag: 'incense_vow' }, effects: { material: { herb_1: 8 }, coin: 800, reputation: { commoners: 6 }, flag: { incense_bless: true } }, resultText: '村民送上薄礼，善缘渐厚。' },
            { text: '分赠村中老弱', require: { flag: 'incense_vow' }, effects: { karma: -3, reputation: { commoners: 4 }, flag: { incense_bless: true } }, resultText: '你将所得尽数分赠，善名远播。' }
        ]
    },
    {
        id: 'incense_3', title: '香火庇佑',
        desc: '夜半梦中，土地神向你颔首：「善有善报，去吧。」',
        choices: [
            { text: '叩谢神恩', require: { flag: 'incense_bless' }, effects: { karma: -4, reputation: { commoners: 10 }, permStats: { hp: 15 } }, resultText: '你受土地庇佑，体魄微增、善缘深厚（陨落更轻、结算更易得遗产）。' },
            { text: '回赠香火，广积阴德', require: { flag: 'incense_bless' }, effects: { coin: -1000, karma: -5, reputation: { commoners: 8 } }, resultText: '你广施香火，业障尽消。' }
        ]
    },
    // —— 6) 雷劫问心链（天门 · 守势/影步/低因果）——
    {
        id: 'lj_1', title: '雷劫问心', regionTags: ['tianmen'],
        desc: '天门古道雷云翻涌，一道心魔之声叩问你的道心。',
        choices: [
            { text: '凝神守心，硬抗雷音', effects: { stats: { def: 6 }, flag: { lj_ask: true } }, resultText: '你稳如磐石，心魔退散——守御之意更坚。' },
            { text: '身随雷动，避其锋芒', effects: { stats: { dodge: 3 }, flag: { lj_ask: true } }, resultText: '你身形飘忽，雷音不能近身——身法更灵。' }
        ]
    },
    {
        id: 'lj_2', title: '问心三难', regionTags: ['tianmen'],
        desc: '雷劫连发三问，每一问都直指你一路的杀伐与执念。',
        choices: [
            { text: '以低因果之身坦然受问', require: { flag: 'lj_ask', karmaMax: 0 }, effects: { karma: -2, exp: 1500, flag: { lj_resolve: true } }, resultText: '你心无挂碍，三问皆过，道心通明（低因果可破天门雷劫）。' },
            { text: '以武止问，斩破心魔', require: { flag: 'lj_ask' }, effects: { hpNow: -60, stats: { atk: 6 }, karma: 1, flag: { lj_resolve: true } }, resultText: '你一剑斩破心魔，强渡此关。' }
        ]
    },
    {
        id: 'lj_3', title: '雷劫加身', regionTags: ['tianmen'],
        desc: '最后一道天雷将落，是镇魔将临前的最后考验。',
        choices: [
            { text: '以守势硬接天雷', require: { flag: 'lj_resolve' }, effects: { permStats: { def: 6 }, stats: { def: 10 }, reputation: { zhujian: 5 } }, resultText: '你硬接天雷不退，守御之道大成（更易以守势破天门雷劫）。' },
            { text: '以影步卸去雷势', require: { flag: 'lj_resolve' }, effects: { stats: { dodge: 5 }, karma: -2 }, resultText: '你借影步卸尽雷势，全身而退（更易以影步避雷劫）。' }
        ]
    }
];

export const EVENT_MAP = Object.fromEntries(EVENTS.map(e => [e.id, e]));
