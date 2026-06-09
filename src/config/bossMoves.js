// ============================================================
// 数据层 · Boss 招式牌（Boss Move Sets）—— 第五阶段「Boss 招式 / 破招条件」。
// 让区域之主从「数值更高」升级为「有可读招式 + 可被构筑机制破解」。
// 由 run.finalizeNodeEnemy 据 node.regionId 取对应招式牌挂到 enemy.moves，simulateBattle 结算破招。
//   ⚠️ 仅区域 Boss 节点生效；普通/精英/百关/秘境敌人无 moves → 战斗逻辑原样（与旧版一致）。
//
// 招式字段：
//   id/name/telegraph : 标识 / 中文名 / 蓄招预兆文案（UI 与战斗日志展示）。
//   trigger           : { every:N } 每 N 回合发动一次（蓄力招） | { hpBelow:pct } 残血<pct% 首次发动（阶段招）。
//   effect            : 发动效果（未被破招时生效，词汇有限，simulateBattle 可识别）：
//       chargeMult    : 本回合敌攻 ×倍率（重击）；
//       atkBuff       : 永久把敌攻 ×倍率（狂怒，一次性）；
//       heal          : 回复敌「最大气血」此比例；
//       lifesteal     : 本回合敌命中你时按伤害回血此比例；
//       unavoidable   : true → 本回合无视玩家闪避/影步（雷罚/剑气必中，专克影步）；
//       poisonResist  : 0~1 → 本 Boss「毒蚀爆发」效果 ×此系数（毒抗，专克毒蚀流）。
//   breakBy           : 破招条件数组，命中任一即「破招成功」→ 该招有害效果被打断/削弱 + 记一次破招。
//       type ∈ swordForce/poisonStacks/guardStacks/afterimage/overcharge/critRate/dodgeRate/damageThisRound/karmaLow/factionPerk
//       value : 阈值（stacks 为层数；critRate/dodgeRate 为%；damageThisRound 为伤害；karmaLow 为因果上限；factionPerk 为特权 id）。
//       text  : 破招方式中文（UI「可破招方式」与日志展示）。
// 数值集中在此，调手感只动这里。区域 id 与 config/regions.js 一一对应。
// ============================================================
export const BOSS_MOVE_SETS = {
    // —— 青州边境：爆发重击，宜以守势硬接或剑势抢断 ——
    qingzhou: {
        bossName: '黑风寨主·秃鹫',
        moves: [
            { id: 'blackwind_charge', name: '黑风压寨', telegraph: '黑风聚顶，下回合重击将至。',
              trigger: { every: 4 }, effect: { chargeMult: 1.6 },
              breakBy: [
                { type: 'guardStacks', value: 3, text: '以守势硬接' },
                { type: 'swordForce', value: 3, text: '以剑势抢断' }
              ] },
            { id: 'blackwind_fury', name: '困兽之怒', telegraph: '寨主负伤暴起，攻势转狂。',
              trigger: { hpBelow: 30 }, effect: { atkBuff: 1.4 },
              breakBy: [
                { type: 'swordForce', value: 3, text: '剑势破绽斩压制' },
                { type: 'damageThisRound', value: 0.25, text: '一击重创打断（单击≥25%血）' }
              ] }
        ]
    },
    // —— 云梦泽：回血/幻雾，宜以毒蚀爆发或高爆速杀破解 ——
    yunmeng: {
        bossName: '泽国蛟魔',
        moves: [
            { id: 'mist_regen', name: '吞波回元', telegraph: '蛟魔沉入深潭，吐纳吞波回血。',
              trigger: { every: 4 }, effect: { heal: 0.12 },
              breakBy: [
                { type: 'poisonStacks', value: 5, text: '以毒蚀爆发断其回元' },
                { type: 'damageThisRound', value: 0.25, text: '高爆速杀压血线（单击≥25%血）' }
              ] },
            { id: 'phantom_mist', name: '幻雾噬魂', telegraph: '毒雾弥漫，蛟魔借雾噬血。',
              trigger: { hpBelow: 40 }, effect: { lifesteal: 0.4 },
              breakBy: [
                { type: 'poisonStacks', value: 5, text: '毒蚀爆发穿雾' },
                { type: 'critRate', value: 30, text: '高暴击撕开幻雾' }
              ] }
        ]
    },
    // —— 剑冢荒原：剑壁/剑气，宜以剑势破防或影步绕击 ——
    jianzhong: {
        bossName: '剑冢守墓人',
        moves: [
            { id: 'sword_storm', name: '万剑归墟', telegraph: '剑冢震鸣，万剑欲归墟一击。',
              trigger: { every: 4 }, effect: { chargeMult: 1.7, unavoidable: true },
              breakBy: [
                { type: 'swordForce', value: 3, text: '以剑势破阵' },
                { type: 'guardStacks', value: 4, text: '守势硬接剑潮' }
              ] },
            { id: 'sword_wall', name: '剑壁反噬', telegraph: '守墓人立剑成壁，借势反击。',
              trigger: { hpBelow: 35 }, effect: { atkBuff: 1.5 },
              breakBy: [
                { type: 'afterimage', value: 1, text: '影步绕至壁后' },
                { type: 'swordForce', value: 3, text: '剑势破壁' }
              ] }
        ]
    },
    // —— 万毒岭：毒潮/腐蚀（毒抗），宜以药王谷特权、速杀或过载破解 ——
    wandu: {
        bossName: '万毒老祖',
        moves: [
            { id: 'venom_tide', name: '万毒潮涌', telegraph: '毒潮翻涌，老祖引毒为兵。',
              trigger: { every: 4 }, effect: { chargeMult: 1.5, poisonResist: 0.5 },
              breakBy: [
                { type: 'factionPerk', value: 'yw_antidote', text: '药王谷解毒秘传' },
                { type: 'overcharge', value: 1, text: '炉心过载硬破' },
                { type: 'damageThisRound', value: 0.25, text: '速杀抢在毒发前（单击≥25%血）' }
              ] },
            { id: 'corrosion', name: '腐骨蚀心', telegraph: '老祖喷吐腐毒，蚀骨削甲。',
              trigger: { hpBelow: 35 }, effect: { atkBuff: 1.45, poisonResist: 0.5 },
              breakBy: [
                { type: 'guardStacks', value: 4, text: '守势御毒' },
                { type: 'factionPerk', value: 'yw_antidote', text: '药王谷解毒秘传' }
              ] }
        ]
    },
    // —— 天门古道：雷劫/天罚（必中），宜以守势、低因果或过载硬破 ——
    tianmen: {
        bossName: '天门镇魔将',
        moves: [
            { id: 'thunder_trib', name: '九霄雷劫', telegraph: '雷云压顶，天劫将至——此击无可回避。',
              trigger: { every: 4 }, effect: { chargeMult: 1.8, unavoidable: true },
              breakBy: [
                { type: 'guardStacks', value: 4, text: '守势硬接雷劫' },
                { type: 'overcharge', value: 1, text: '炉心过载硬破' },
                { type: 'karmaLow', value: -4, text: '善缘庇佑卸雷' }
              ] },
            { id: 'heaven_punish', name: '天罚加身', telegraph: '镇魔将引动天罚，杀机暴涨。',
              trigger: { hpBelow: 30 }, effect: { atkBuff: 1.5 },
              breakBy: [
                { type: 'guardStacks', value: 4, text: '守势镇罚' },
                { type: 'karmaLow', value: -4, text: '低因果免罚' }
              ] }
        ]
    }
};

export function getBossMoveSet(regionId) { return BOSS_MOVE_SETS[regionId] || null; }
