// ============================================================
// 数据层 · 战前策略（Tactic）—— 百世轮回 Roguelite 第一阶段。
// 战斗前选择一种策略，进入 domain.simulateBattle 的回合结算真实生效（非 UI 假按钮）。
// 字段被 simulateBattle 读取（见 domain.js 的「策略结算」块），缺省字段＝该策略无此效果：
//   openerRounds / openerDmgPct : 前 N 回合额外增伤 %（疾攻）
//   outPct                      : 全程出招伤害 %（守心为负＝输出降低）
//   takenPct                    : 受到伤害 %（疾攻为正＝更脆；守心为负＝减伤）
//   poisonPctPerStack           : 每回合叠 1 层毒，单层每回合造成「攻击×此% 」真伤（淬毒，越久越痛）
//   chargeAt / prePct / burstPct: 第 chargeAt 回合爆发：之前 outPct=prePct，当回合额外 +burstPct（养剑）
// 加新策略 = 在此加一条 + UI（ui/run.js 的策略条）自动列出。
// ============================================================
export const TACTICS = [
    {
        id: 'balanced', name: '稳扎稳打', icon: '⚖️',
        brief: '无明显增减，攻守均衡。',
        desc: '不偏不倚，按本身战力厮杀，最稳健的打法。'
    },
    {
        id: 'aggressive', name: '疾攻', icon: '🗡️',
        brief: '前 3 回合 +40% 伤害，但全程受到伤害 +25%。',
        desc: '抢攻速胜，适合速杀脆皮；拖久了自身也更脆。',
        openerRounds: 3, openerDmgPct: 40, takenPct: 25
    },
    {
        id: 'defensive', name: '守心', icon: '🛡️',
        brief: '受到伤害 -35%，但自身输出 -30%。',
        desc: '以守代攻、稳中求胜，适合越级磨怪与高危精英。',
        outPct: -30, takenPct: -35
    },
    {
        id: 'poison', name: '淬毒', icon: '☠️',
        brief: '每回合叠毒，单层每回合按攻击 7% 造成真伤（无视防御）。',
        desc: '毒势随回合累积，越是长战越致命，专克高血厚甲。',
        poisonPctPerStack: 7
    },
    {
        id: 'charge', name: '养剑', icon: '🌀',
        brief: '前 4 回合伤害 -50% 蓄力，第 5 回合一剑爆发 +250%。',
        desc: '以静蓄势，一剑断山河；撑过前期蓄力即可雷霆一击。',
        chargeAt: 5, prePct: -50, burstPct: 250
    }
];

export const TACTIC_MAP = Object.fromEntries(TACTICS.map(t => [t.id, t]));
export function getTactic(id) { return TACTIC_MAP[id] || TACTIC_MAP['balanced']; }
