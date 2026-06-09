// ============================================================
// 数据层 · 江湖委托 / 宗门订单（第四阶段）。
// 让生产资源（矿/锭/草药/丹药/碎银）产生取舍：自己用 vs 交委托换碎银·修为·声望·因果。
//
// FACTIONS：5 大派系，声望键与 player.reputation 一一对应。
// ORDER_TEMPLATES：委托模板。生成时按玩家进度(tier/境界/声望)过滤，再实例化进 player.orders.active。
//   tier      : 需求材料的最高档(1~6)，generateOrders 据玩家可达档过滤，绝不要求拿不到的材料；
//   rarity    : common/rare/epic（rare/epic 需对应派系声望达标方出现，见 BALANCE.orders）；
//   minRealm  : 最低境界门槛（可选）；
//   req       : { materials:{key:数量}, coin?:n } 真实消耗（材料键均来自 config.MATERIALS）；
//   reward    : { coin?, exp?, materials?:{key:数量}, reputation?:n, karma?:n, honghuangPower? }
//               —— coin/materials 奖励会被「对应派系声望」小幅放大（见 orders.resolveOrderRewards）；
//   tags      : mining/forging/herbal/alchemy/combat/karma（仅展示分类）。
// 数值集中在此（数据层），调手感只动这里 + BALANCE.orders。
// ============================================================
export const FACTIONS = {
    zhujian:     { id: 'zhujian',     name: '铸剑山庄', icon: '⚒️', tone: 'var(--color-orange)',   desc: '痴于铸造的匠门，重金求锭求矿，济器修者良多。' },
    yaowang:     { id: 'yaowang',     name: '药王谷',   icon: '🌿', tone: 'var(--color-success)',  desc: '悬壶济世的药宗，广收草药丹方，结之积善缘（降因果）。' },
    qingcheng:   { id: 'qingcheng',   name: '青城派',   icon: '🗡️', tone: 'var(--color-blue)',     desc: '名门正派，求兵刃材料以砥砺剑道，酬以修为感悟。' },
    blackmarket: { id: 'blackmarket', name: '黑市牙行', icon: '💰', tone: 'var(--color-accent)',   desc: '见利忘义的牙人，高价收稀货——然交易招惹因果业力。' },
    commoners:   { id: 'commoners',   name: '无名散修', icon: '🏮', tone: 'var(--color-gold)',     desc: '市井散修村镇，所求不多，结之得善缘、积微名。' }
};
export const FACTION_LIST = Object.values(FACTIONS);

export const ORDER_TEMPLATES = [
    // —— 铸剑山庄（收锭/矿，酬碎银 + 山庄声望）——
    { id: 'z_copper', faction: 'zhujian', tier: 1, rarity: 'common', title: '铜料征募', desc: '山庄锻炉久燃，急需铜料补给。', tags: ['forging'],
      req: { materials: { ingot_copper: 6 } }, reward: { coin: 6000, exp: 600, reputation: 5 } },
    { id: 'z_iron', faction: 'zhujian', tier: 2, rarity: 'common', title: '精铁订货', desc: '为新锻一批兵坯，山庄收购铁锭。', tags: ['forging'],
      req: { materials: { ingot_iron: 6 } }, reward: { coin: 16000, exp: 1500, reputation: 6 } },
    { id: 'z_xuan', faction: 'zhujian', tier: 3, rarity: 'common', title: '玄铁锻单', desc: '玄铁难得，山庄高价征玄铁锭。', tags: ['forging'],
      req: { materials: { ingot_xuan: 6, ore_xuan: 4 } }, reward: { coin: 40000, exp: 3500, reputation: 7 } },
    { id: 'z_cold', faction: 'zhujian', tier: 4, rarity: 'rare', title: '寒铁秘锻', desc: '欲铸寒锋，须寒铁锭精料，酬以重金。', tags: ['forging'],
      req: { materials: { ingot_cold: 8 } }, reward: { coin: 90000, exp: 8000, reputation: 10, materials: { ingot_cold: 2 } } },
    { id: 'z_jade', faction: 'zhujian', tier: 6, rarity: 'epic', title: '玄晶神兵契', desc: '山庄欲铸传世神兵，倾力征玄晶锭。', tags: ['forging'],
      req: { materials: { ingot_jade: 6 }, coin: 20000 }, reward: { coin: 320000, exp: 30000, reputation: 14, materials: { soul_crystal: 1 } } },

    // —— 药王谷（收草药/丹药，酬修为 + 善缘降因果）——
    { id: 'y_herb1', faction: 'yaowang', tier: 1, rarity: 'common', title: '青草采办', desc: '药谷常备三叶青草入药。', tags: ['herbal'],
      req: { materials: { herb_1: 12 } }, reward: { coin: 4000, exp: 1200, reputation: 5, karma: -1 } },
    { id: 'y_pillhp', faction: 'yaowang', tier: 1, rarity: 'common', title: '聚元丹募集', desc: '谷中伤者众，募聚元丹疗伤。', tags: ['alchemy'],
      req: { materials: { pill_hp1: 2 } }, reward: { coin: 7000, exp: 2000, reputation: 7, karma: -1 } },
    { id: 'y_herb3', faction: 'yaowang', tier: 4, rarity: 'rare', title: '雪参寻访', desc: '万年雪参乃炼大丹之引，药谷重求。', tags: ['herbal'],
      req: { materials: { herb_3: 8 } }, reward: { coin: 30000, exp: 9000, reputation: 10, karma: -2 } },
    { id: 'y_great', faction: 'yaowang', tier: 4, rarity: 'rare', title: '大还丹供奉', desc: '为救一方,药谷高价请大还丹。', tags: ['alchemy'],
      req: { materials: { pill_great: 1 } }, reward: { coin: 50000, exp: 14000, reputation: 12, karma: -2 } },

    // —— 青城派（收兵刃材料/矿，酬修为感悟）——
    { id: 'q_iron', faction: 'qingcheng', tier: 2, rarity: 'common', title: '砺剑铁料', desc: '青城弟子砺剑，需精铁矿石。', tags: ['mining', 'combat'],
      req: { materials: { ore_iron: 10 } }, reward: { coin: 9000, exp: 2600, reputation: 6 } },
    { id: 'q_xuan', faction: 'qingcheng', tier: 3, rarity: 'common', title: '玄铁试剑', desc: '为铸试剑石，青城收玄铁矿。', tags: ['mining', 'combat'],
      req: { materials: { ore_xuan: 10 } }, reward: { coin: 24000, exp: 6000, reputation: 7 } },
    { id: 'q_star', faction: 'qingcheng', tier: 5, rarity: 'rare', title: '星陨问道', desc: '星陨之铁藏剑意，青城求之悟道。', tags: ['mining', 'combat'],
      req: { materials: { ore_star: 8, ingot_star: 2 } }, reward: { coin: 80000, exp: 20000, reputation: 11, honghuangPower: 1 } },

    // —— 黑市牙行（收稀货，酬高额碎银，但因果上涨）——
    { id: 'b_xuan', faction: 'blackmarket', tier: 3, rarity: 'common', title: '玄铁销赃', desc: '牙行收玄铁矿，不问来路，价高。', tags: ['mining', 'karma'],
      req: { materials: { ore_xuan: 8 } }, reward: { coin: 36000, exp: 1000, reputation: 6, karma: 1 } },
    { id: 'b_jade', faction: 'blackmarket', tier: 6, rarity: 'rare', title: '玄晶黑单', desc: '牙行豪掷千金求玄晶矿，然此财沾血。', tags: ['mining', 'karma'],
      req: { materials: { ore_jade: 6 } }, reward: { coin: 180000, exp: 3000, reputation: 10, karma: 2 } },
    { id: 'b_crystal', faction: 'blackmarket', tier: 6, rarity: 'epic', title: '神魂结晶私易', desc: '牙行垂涎神魂结晶，许以泼天富贵——业力随之。', tags: ['karma'],
      req: { materials: { soul_crystal: 2 } }, reward: { coin: 360000, exp: 6000, reputation: 14, karma: 3 } },

    // —— 无名散修（收低级丹药/草药，酬碎银 + 善缘）——
    { id: 'c_atk', faction: 'commoners', tier: 1, rarity: 'common', title: '淬体丹义售', desc: '村镇武夫求淬体丹强身。', tags: ['alchemy'],
      req: { materials: { pill_atk1: 2 } }, reward: { coin: 5000, exp: 700, reputation: 6, karma: -1 } },
    { id: 'c_herb', faction: 'commoners', tier: 1, rarity: 'common', title: '草药募捐', desc: '散修结庐采药，募三叶青草。', tags: ['herbal'],
      req: { materials: { herb_1: 8 } }, reward: { coin: 3500, exp: 500, reputation: 5, karma: -1 } },
    { id: 'c_def', faction: 'commoners', tier: 1, rarity: 'common', title: '玄龟丹援助', desc: '村中老者需玄龟丹护体。', tags: ['alchemy'],
      req: { materials: { pill_def1: 2 } }, reward: { coin: 6000, exp: 900, reputation: 7, karma: -1 } }
];

export const ORDER_TEMPLATE_MAP = Object.fromEntries(ORDER_TEMPLATES.map(t => [t.id, t]));
export function getFaction(id) { return FACTIONS[id] || null; }
export function getOrderTemplate(id) { return ORDER_TEMPLATE_MAP[id] || null; }
