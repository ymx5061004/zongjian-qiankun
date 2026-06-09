// ============================================================
// 数据层 · 本世誓约（Run Contract）—— 第五阶段·D。
// 每一世除「走到 Boss」外，开局可主动立一誓，决定这世的打法目标；达成发一次奖励，违誓则失败。
// 仅当前一世有效（存 player.run.contract = { id, progress, failed, completed, claimed }），轮回清空。
//
// 字段：
//   id/name/icon/desc/rarity/tags  : 展示。
//   objective / restriction / failConditionText / reward(展示文案，与 reward 数值一致即可) : 卡面文案。
//   reward    : { coin?, exp?, karma?, honghuangPower?, reputation?:{派系:量}, materials?:{key:量}, permStats?:{} } —— 达成时一次性发放（run.grantContractReward）。
//   —— 机器可读判定（run.noteContract 据此推进/核验）——
//   goal      : { kind, count } 单目标 | { all:[{kind,count}...] } 复合目标。kind 取值见下：
//       bossKill / poisonBurstKill / bossBreak / overchargeKill / afterimage / blackmarketTrade / townDeed / nodeAdvance
//   withinNodes : N —— 须在「本世已探索节点数 ≤ N」时达成目标，超出即失败（十步一杀）。
//   failOn    : kind —— 一旦发生该行为即违誓失败（清修不染：blackmarketTrade）。
// ============================================================
export const RUN_CONTRACTS = [
    {
        id: 'c_qingxiu', name: '清修不染', icon: '🧘', rarity: 'common', tags: ['karma', 'yaowang'],
        desc: '不沾黑市浊财，以清白之身斩落区域之主。',
        objective: '击败本区域 Boss', restriction: '本世不得进行任何黑市交易（节点黑市/黑市委托）',
        failConditionText: '一旦黑市交易即破誓', reward: { karma: -3, reputation: { yaowang: 8, commoners: 6 } },
        goal: { kind: 'bossKill', count: 1 }, failOn: 'blackmarketTrade'
    },
    {
        id: 'c_tenstep', name: '十步一杀', icon: '🗡️', rarity: 'rare', tags: ['sword', 'qingcheng'],
        desc: '剑走轻灵，速取敌首——在六个节点之内踏破区域之主。',
        objective: '在探索 ≤6 个节点内击败 Boss', restriction: '时限紧迫，不容拖延',
        failConditionText: '探索超过 6 个节点仍未斩 Boss 即破誓', reward: { reputation: { qingcheng: 12 }, exp: 8000, coin: 12000 },
        goal: { kind: 'bossKill', count: 1 }, withinNodes: 6
    },
    {
        id: 'c_poison', name: '百毒行', icon: '☠️', rarity: 'rare', tags: ['poison', 'yaowang'],
        desc: '以毒蚀爆发了结四名强敌，方显毒道真章。',
        objective: '用「毒蚀爆发」击杀 4 名敌人', restriction: '非毒构筑较难达成',
        failConditionText: '（无硬性失败条件，结算未达成即作罢）', reward: { reputation: { yaowang: 10 }, materials: { herb_3: 4 }, exp: 5000 },
        goal: { kind: 'poisonBurstKill', count: 4 }
    },
    {
        id: 'c_ironwall', name: '铁壁苦修', icon: '🛡️', rarity: 'rare', tags: ['guard', 'zhujian'],
        desc: '以守势硬接，两度破去敌之强招，方为铁壁。',
        objective: '以守势/构筑破招成功 2 次', restriction: '需防守/守势构筑',
        failConditionText: '（无硬性失败条件）', reward: { reputation: { zhujian: 10 }, materials: { ingot_cold: 3 }, exp: 5000 },
        goal: { kind: 'bossBreak', count: 2 }
    },
    {
        id: 'c_blackpact', name: '黑契入命', icon: '💰', rarity: 'rare', tags: ['blackmarket', 'karma'],
        desc: '三度与黑市交易，再斩区域之主——财与孽并取。',
        objective: '黑市交易 3 次 + 击败 Boss', restriction: '因果随交易上涨',
        failConditionText: '（无硬性失败条件）', reward: { reputation: { blackmarket: 16 }, coin: 40000, exp: 4000 },
        goal: { all: [{ kind: 'blackmarketTrade', count: 3 }, { kind: 'bossKill', count: 1 }] }
    },
    {
        id: 'c_forge', name: '炉火不熄', icon: '🔥', rarity: 'rare', tags: ['forge', 'zhujian'],
        desc: '以炉心过载击破精英或区域之主，证器修之威。',
        objective: '用炉心过载击杀 1 名精英/Boss', restriction: '需消耗锭与碎银过载',
        failConditionText: '（无硬性失败条件）', reward: { reputation: { zhujian: 12 }, materials: { ingot_star: 3 }, exp: 5000 },
        goal: { kind: 'overchargeKill', count: 1 }
    },
    {
        id: 'c_relief', name: '救厄济民', icon: '🏮', rarity: 'common', tags: ['commoners', 'yaowang'],
        desc: '三度行善济世——完成药王谷/无名村镇的委托。',
        objective: '完成药王谷/村镇委托 3 次', restriction: '前期收益偏低',
        failConditionText: '（无硬性失败条件）', reward: { reputation: { commoners: 10, yaowang: 6 }, karma: -3, coin: 8000 },
        goal: { kind: 'townDeed', count: 3 }
    },
    {
        id: 'c_shadow', name: '影渡雷劫', icon: '🪶', rarity: 'rare', tags: ['dodge'],
        desc: '以影步补刀八次，身似惊鸿、雷罚难加。',
        objective: '触发「影步补刀」8 次', restriction: '雷系/必中 Boss 克制影步',
        failConditionText: '（无硬性失败条件）', reward: { coin: 12000, exp: 6000, permStats: { dodge: 2 } },
        goal: { kind: 'afterimage', count: 8 }
    }
];

export const RUN_CONTRACT_MAP = Object.fromEntries(RUN_CONTRACTS.map(c => [c.id, c]));
export function getRunContract(id) { return RUN_CONTRACT_MAP[id] || null; }
