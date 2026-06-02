// ============================================================
// 数据层 · 江湖区域 / 节点地图（Region & Node）—— 把「线性百关」改成「节点选择」体验。
// 每一世开始为当前区域生成一张节点图（run.generateNodeMap 据此随机布点）。
// 节点类型：battle 普通战斗 / elite 精英 / boss 区域Boss / event 奇遇 / mine 矿脉 /
//          herb 药谷 / forge 锻造机缘 / shop 黑市商人 / rest 调息恢复。
//
// 区域字段：
//   id / name / desc
//   tier      : 对应 GEAR_TIERS 档（决定矿脉产何种矿、战斗掉落档位、敌人强度基线随之上扬）
//   bossName  : 区域 Boss 名
//   composition : 各类型节点数量（boss 恒 1；总数落在 8~12）
//   namePool  : 各类型节点的「名号」候选池（生成时随机取，纯展示）
// 加区域 = 在 REGIONS 末尾加一条即可（run.js 自动按 regionIndex 推进）。
// ============================================================

// 节点修饰（modifier）：少量「战场异象」，影响敌人强度 / 收益 / 因果。生成时部分节点随机挂一个。
export const NODE_MODIFIERS = [
    { id: 'ambush',   name: '伏击',     desc: '敌人占据地利，气血与攻击提升。', enemyMult: 1.25, rewardMult: 1.2, karma: 0 },
    { id: 'rich_qi',  name: '灵气充盈', desc: '此地灵气浓郁，收益大增。',       enemyMult: 1.0,  rewardMult: 1.6, karma: 0 },
    { id: 'cursed',   name: '戾气缭绕', desc: '煞气冲天，敌人凶悍，杀之招因果。', enemyMult: 1.35, rewardMult: 1.3, karma: 1 },
    { id: 'fortune',  name: '机缘暗藏', desc: '冥冥中似有造化。',               enemyMult: 1.0,  rewardMult: 1.4, karma: -1 }
];
export const MODIFIER_MAP = Object.fromEntries(NODE_MODIFIERS.map(m => [m.id, m]));

export const REGIONS = [
    {
        id: 'qingzhou', name: '青州边境', tier: 1, bossName: '黑风寨主·秃鹫',
        desc: '末法乱世的第一站。山贼游勇横行，亦是初出茅庐者磨砺剑锋之地。',
        intro: '官道尽头，青州在望。此地虽是边陲，却也匪患丛生——黑风寨的旗号在山口猎猎作响。初入江湖，先在这里站稳脚跟吧。',
        composition: { battle: 3, elite: 1, event: 2, mine: 1, herb: 1, rest: 1, boss: 1 },
        namePool: {
            battle: ['野狼坡', '断肠崖', '乱石岗', '清溪渡', '枯杨驿'],
            elite: ['黑风口', '夺命滩'],
            event: ['荒村古井', '路边残碑', '醉仙楼', '破庙'],
            mine: ['赭石矿洞'], herb: ['野菊坡'], rest: ['溪畔草庐'],
            boss: ['黑风寨']
        }
    },
    {
        id: 'yunmeng', name: '云梦泽', tier: 2, bossName: '泽国蛟魔',
        desc: '烟波浩渺的千里水泽，毒瘴弥漫，水匪与妖物并行，亦藏无数奇遇。',
        intro: '千里烟波浩渺无边，水汽里裹着腥甜的毒瘴。渔火明灭处暗藏杀机，泽底沉着前朝古物——传闻有蛟魔盘踞深渊，吞舟食人。',
        composition: { battle: 3, elite: 2, event: 2, mine: 1, herb: 1, shop: 1, rest: 1, boss: 1 },
        namePool: {
            battle: ['芦苇荡', '沉船湾', '雾隐滩', '蛙鸣泽', '浮萍渡'],
            elite: ['毒蟒潭', '夺魂矶'],
            event: ['渔家灯火', '水底古塚', '泽畔卜者'],
            mine: ['泽底铁砂'], herb: ['菖蒲泽'], shop: ['乌篷货船'], rest: ['渔人小筑'],
            boss: ['蛟魔深渊']
        }
    },
    {
        id: 'jianzhong', name: '剑冢荒原', tier: 3, bossName: '剑冢守墓人',
        desc: '万千折剑插地成林，剑意残响千年不散。无数剑客埋骨于此，亦有剑道传承。',
        intro: '万千断剑插地成林，残存的剑意千年不散，掠过荒原如有人在耳畔低吟剑诀。这里埋葬着无数剑客的执念，也藏着通天的剑道传承。',
        composition: { battle: 3, elite: 2, event: 2, mine: 1, herb: 1, forge: 1, shop: 1, boss: 1 },
        namePool: {
            battle: ['断剑林', '锈刃谷', '残戟坡', '问剑台', '埋骨地'],
            elite: ['剑奴营', '噬剑窟'],
            event: ['剑冢残碑', '无名剑庐', '试剑石', '剑灵低语'],
            mine: ['玄铁剑矿'], herb: ['剑兰崖'], forge: ['古剑炉'], shop: ['游方铸剑师'],
            boss: ['万剑归墟']
        }
    },
    {
        id: 'wandu', name: '万毒岭', tier: 4, bossName: '万毒老祖',
        desc: '五毒教盘踞的瘴疠之地，奇毒异虫遍野。胆敢踏入者，非死即得大造化。',
        intro: '尚未入岭，刺鼻毒气已扑面而来。这里是五毒教的禁脔，奇毒异虫遍布草木，连呼吸都需小心。然险地藏奇珍——万毒老祖的传承，足以令人脱胎换骨。',
        composition: { battle: 3, elite: 2, event: 2, mine: 1, herb: 1, forge: 1, shop: 1, boss: 1 },
        namePool: {
            battle: ['百足窟', '腐骨沼', '蛊虫巢', '瘴雾林', '蝎尾崖'],
            elite: ['五毒坛', '噬心潭'],
            event: ['毒手药王庐', '蛊师密室', '解毒泉'],
            mine: ['毒晶矿脉'], herb: ['断肠草谷', '七叶芝崖'], forge: ['炼毒丹炉'], shop: ['五毒货郎'],
            boss: ['万毒祭坛']
        }
    },
    {
        id: 'tianmen', name: '天门古道', tier: 5, bossName: '天门镇魔将',
        desc: '通往九天玄界的最后古道。天劫雷火常年不息，镇守的远古凶将拦于门前。',
        intro: '云海之上，一道古阶直插苍穹——这便是通往九天玄界的天门古道。雷火天劫常年不息，镇魔凶将拦于绝巅。踏破此地，便可飞升超脱；功亏一篑，则形神俱灭。',
        composition: { battle: 3, elite: 2, event: 1, mine: 1, herb: 1, forge: 1, shop: 1, rest: 1, boss: 1 },
        namePool: {
            battle: ['登天阶', '雷劫坡', '断魂桥', '问天台', '陨星谷'],
            elite: ['镇魔关', '天罚崖'],
            event: ['古道残仙', '镇魔石碑', '天机阁'],
            mine: ['星陨矿场'], herb: ['天雪莲台'], forge: ['天工神炉'], shop: ['古道行商'], rest: ['云端歇脚亭'],
            boss: ['天门绝巅']
        }
    }
];

export const REGION_MAP = Object.fromEntries(REGIONS.map(r => [r.id, r]));
