// ============================================================
// 平衡模拟·共享核心（dev 工具，零依赖，与正式游戏完全解耦）。
// 只「读取」(import) 项目纯逻辑模块（config / domain / state）——这些模块在模块加载期不碰
// DOM / localStorage，故可在 Node 与浏览器中无 DOM 运行。正式入口 index.html 不引用本文件。
//
// 复用 domain.js 的纯逻辑：finalizeEnemyStats / computeStats / simulateBattle / resolveMapEnv /
//   getMapModifier / getMapRewardMods / makeGearPiece / unlockedGearSlots / mapTier / effDurationMs …
// 无法精确复用的（战斗胜利奖励逻辑在 ui/battle.js、离线在 ui/idle.js，二者依赖 DOM）则按 BALANCE
//   常量「再推导」——与正式逻辑可能有细微漂移，已在输出里注明，不伪造精确结果。
// ============================================================
import { makeDefaultPlayer } from '../src/state.js';
import {
    BALANCE, MAP_NAMES, GEAR_TIERS, MATERIALS, ACTIVITIES, CULTIVATION_PATHS
} from '../src/config.js';
import {
    finalizeEnemyStats, computeStats, simulateBattle, resolveMapEnv, getMapModifier,
    getMapRewardMods, makeGearPiece, unlockedGearSlots, mapTier, effDurationMs, getRealmName, ensureLoadout
} from '../src/domain.js';

// 关卡解锁所需境界（与 render.renderMapList 同式）：floor((stage-1)*1.1)+1。
export function recommendedRealm(stage) { return Math.floor((stage - 1) * 1.1) + 1; }

// 代表性玩家：在第 stage 关「按推荐配置」的角色（破境线性成长 + 该档全套装备 + 初始拳法 + 可选流派 + 轮回乘区）。
// opts: { stage, gearTier, quality, enhance, path, realmLevel, rebornCount, honghuangLevel } —— 不传则用推荐值。
//   rebornCount/honghuangLevel：乘区成长旋钮（线性破境追不上 1.5^stage，需靠轮回/洪荒乘区）；
//   pathComparison 会「自动调参」这个 rebornCount 把基线胜率拉到 ~50%，使流派差异可见。
export function buildPlayer({ stage = 1, gearTier = null, quality = 0, enhance = 0, path = null, realmLevel = null, rebornCount = 0, honghuangLevel = 0 } = {}) {
    const p = makeDefaultPlayer();
    p.name = 'Sim';
    const tier = gearTier || mapTier(stage);
    const rl = realmLevel || recommendedRealm(stage);
    p.realmLevel = rl;
    p.rebornCount = rebornCount;
    // 破境线性成长（与 BALANCE.breakthrough 同源；makeDefaultPlayer 的初始 250/35/15 起算）
    p.baseHp = 250 + (rl - 1) * BALANCE.breakthrough.hpGain;
    p.baseAtk = 35 + (rl - 1) * BALANCE.breakthrough.atkGain;
    p.baseDef = 15 + (rl - 1) * BALANCE.breakthrough.defGain;
    // 已解锁部位各配一件该档装备（成色/强化可调）
    unlockedGearSlots(rl).forEach(({ key }) => {
        const piece = makeGearPiece(tier, key, quality);
        if (piece) { piece.enhance = enhance; p.equips[key] = piece; }
    });
    // 初始拳法（与 finalizeCharacter 同源），否则战斗退化为纯普攻
    p.skills = [{ id: 's_init', name: '太祖长拳', type: 'active', level: 1, baseRate: 0.35, power: 1.3 }];
    if (honghuangLevel > 0) p.skills.push({ id: 'sk_hh', name: '混沌诀', type: 'passive', level: honghuangLevel, isHongHuang: true });
    p.cultivationPath = path;
    ensureLoadout(p);   // 第四阶段：sim 也走真实装配（初始拳法入主动槽 + 洪荒恒生效），与实战同源、基线不漂移
    return p;
}

// 自动调参：二分搜索「轮回数」让「无流派」基线在第 stage 关的胜率落到 target(≈50%) 附近，
// 作为公平对比的战力锚点（也即该关的「推荐轮回乘区」）。返回 rebornCount。
export function tuneRebornForStage(stage, baseOpts = {}, target = 0.5, trials = 120) {
    const wr = r => winRate(buildPlayer({ stage, path: null, rebornCount: r, ...baseOpts }), stage, trials).winRate;
    let lo = 0, hi = 1;
    if (wr(0) >= target) return 0;                       // 0 轮回已够 → 无需乘区
    // 指数扩张找上界：深层关卡(敌人 1.5^stage)需极大乘区，上界放到安全整数内（≈9e15）以保证二分精度。
    while (wr(hi) < target && hi < 9e15) hi *= 2;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (wr(mid) >= target) hi = mid; else lo = mid + 1; }
    return lo;
}

function lastRound(events) { return events.length ? events[events.length - 1].round : 0; }

// 指定玩家在第 stage 关的胜率与平均回合数（跑 trials 场；useEnv=是否计入地图词缀环境）。
export function winRate(player, stage, trials = 300, { useEnv = true } = {}) {
    const stats = computeStats(player).stats;
    const enemy = finalizeEnemyStats(stage);
    const env = useEnv ? resolveMapEnv(stage, player) : null;
    let wins = 0, roundsSum = 0;
    for (let i = 0; i < trials; i++) {
        const r = simulateBattle(stats, enemy, player.skills, env);
        if (r.win) wins++;
        roundsSum += lastRound(r.events);
    }
    return { winRate: wins / trials, avgRounds: roundsSum / trials, stats };
}

// 采样关卡（默认覆盖 1~100 的代表点）。
export const SAMPLE_STAGES = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100];

// ① 关卡 → 敌人气血/攻击/防御（+ 准入境界 / 装备档 / 词缀）。直接复用 finalizeEnemyStats。
export function enemyCurve(stages = SAMPLE_STAGES) {
    return stages.map(stage => {
        const e = finalizeEnemyStats(stage);
        const { mod, isElite } = getMapModifier(stage);
        return {
            关卡: stage, 地名: MAP_NAMES[stage - 1] || '?',
            敌气血: e.maxHp, 敌攻击: e.atk, 敌防御: e.def,
            准入境界: getRealmName(recommendedRealm(stage)), 装备档: GEAR_TIERS[mapTier(stage) - 1].name,
            词缀: mod.name + (isElite ? '·精英' : '')
        };
    });
}

// ② 玩家基础成长 → 推荐战力（在推荐配置下的派生属性）。复用 computeStats。
export function powerCurve(stages = SAMPLE_STAGES, opts = {}) {
    return stages.map(stage => {
        const p = buildPlayer({ stage, ...opts });
        const s = computeStats(p).stats;
        return {
            关卡: stage, 境界: getRealmName(p.realmLevel),
            气血: s.hp, 攻击: s.atk, 防御: s.def, 暴击: s.crit + '%', 闪避: s.dodge + '%'
        };
    });
}

// ③④ 各流派同等装备下的预期胜率 + 平均回合数（同一 stage、同一基础配置下只改流派）。
// 默认「自动调参」轮回乘区把无流派基线拉到 ~50%，使流派强弱可区分；传 opts.rebornCount 可固定战力锚。
// 返回 { reborn, rows }：reborn=本次对比采用的轮回数（战力锚）。
export function pathComparison(stage, opts = {}) {
    const trials = opts.trials || 300;
    const { autoTune = true, target = 0.5, ...baseOpts } = opts;
    const reborn = (baseOpts.rebornCount != null) ? baseOpts.rebornCount
        : (autoTune ? tuneRebornForStage(stage, baseOpts, target) : 0);
    const rows = [null, ...CULTIVATION_PATHS.map(p => p.id)].map(pid => {
        const p = buildPlayer({ stage, path: pid, rebornCount: reborn, ...baseOpts });
        const wr = winRate(p, stage, trials);
        const name = pid ? CULTIVATION_PATHS.find(x => x.id === pid).name : '无流派';
        return {
            流派: name, 气血: wr.stats.hp, 攻击: wr.stats.atk, 防御: wr.stats.def,
            暴击: wr.stats.crit + '%', 闪避: wr.stats.dodge + '%',
            胜率: (wr.winRate * 100).toFixed(1) + '%', 平均回合: wr.avgRounds.toFixed(1)
        };
    });
    return { reborn, rows };
}

// ⑤ 掉落/铜钱/材料收益（每场胜利）。奖励逻辑在 ui/battle.js（依赖 DOM）→ 此处按 BALANCE.reward + 词缀「再推导」。
export function rewardCurve(stages = SAMPLE_STAGES) {
    const rw = BALANCE.reward;
    return stages.map(stage => {
        const rmod = getMapRewardMods(stage);
        const tier = mapTier(stage);
        const oreKey = GEAR_TIERS[tier - 1].ore;
        return {
            关卡: stage,
            碎银每胜: Math.floor(rw.coinBase + stage * rw.coinPerMap),       // 财运率 100% 基准
            修为每胜: Math.floor((rw.expBase + stage * rw.expPerMap) * rmod.expMult),
            必掉矿: `${MATERIALS[oreKey] ? MATERIALS[oreKey].name : oreKey}×1~${rw.oreDropMax}`,
            装备掉率: (rw.baseDrop * rmod.gearDropMult * 100).toFixed(0) + '%',
            词缀: getMapModifier(stage).mod.name
        };
    });
}

// ⑥ 离线收益（按生产动作再推导：cycles=floor(elapsed/读条)，封顶 offlineCapMs）。+ 与「在线战斗」同资源对比。
//   注：离线只产「生产材料/技能经验」；在线战斗产「碎银/修为/矿/装备」。二者资源轴不同，仅就「矿」可同轴对比。
export function offlineEstimate(activityId = 'mine_copper', hoursList = [1, 8, 12], level = 1) {
    const act = ACTIVITIES.find(a => a.id === activityId);
    if (!act) return { error: `未找到生产动作 ${activityId}` };
    const effDur = effDurationMs(act.durationMs, level);
    const capMs = BALANCE.idle.offlineCapMs;
    const capH = Math.round(capMs / 3600000);
    return hoursList.map(h => {
        const elapsed = Math.min(h * 3600 * 1000, capMs);
        const cycles = Math.floor(elapsed / effDur);
        const out = {};
        if (act.outputs) for (const [k, n] of Object.entries(act.outputs)) out[MATERIALS[k] ? MATERIALS[k].name : k] = n * cycles;
        return {
            动作: act.name, 离线: `${h}h`, 实际结算: `${(elapsed / 3600000).toFixed(1)}h${h * 3600000 > capMs ? `(封顶${capH}h)` : ''}`,
            次数: cycles, 技能经验: act.exp * cycles, 产出: Object.entries(out).map(([k, v]) => `${k}×${v}`).join('、') || '-'
        };
    });
}

// 「离线是否远超在线」专项：同轴(矿石/时)对比。在线=战斗掉矿；离线=对应档采矿。
export function incomeComparison(stage = 10, level = 1) {
    const B = BALANCE.battle, rw = BALANCE.reward;
    const battlesPerHour = Math.floor(3600000 / B.intervalMs);
    const avgOrePerWin = (1 + rw.oreDropMax) / 2; // 每胜掉 1~oreDropMax，取均值
    const onlineOrePerHour = Math.round(battlesPerHour * avgOrePerWin);
    const onlineCoinPerHour = Math.round(battlesPerHour * (rw.coinBase + stage * rw.coinPerMap));
    const onlineExpPerHour = Math.round(battlesPerHour * (rw.expBase + stage * rw.expPerMap));
    // 离线采矿（对应档矿）
    const tier = mapTier(stage);
    const mineAct = ACTIVITIES.find(a => a.prof === 'mining' && a.tier === tier) || ACTIVITIES.find(a => a.id === 'mine_copper');
    const effDur = effDurationMs(mineAct.durationMs, level);
    const offlineOrePerHour = Math.round(3600000 / effDur);
    return {
        关卡: stage,
        在线每时: `矿×${onlineOrePerHour} · 碎银${onlineCoinPerHour} · 修为${onlineExpPerHour}`,
        离线采矿每时: `${mineAct.name} 矿×${offlineOrePerHour}（无碎银/修为）`,
        结论: offlineOrePerHour <= onlineOrePerHour
            ? `离线矿/时 ≤ 在线（${offlineOrePerHour} ≤ ${onlineOrePerHour}），且离线封顶${Math.round(BALANCE.idle.offlineCapMs / 3600000)}h、无碎银修为 → 不会远超在线`
            : `⚠️ 离线矿/时 > 在线（${offlineOrePerHour} > ${onlineOrePerHour}），需关注`
    };
}

// 新手前 N 分钟「粗略投影」（假设第1关全胜·不停机·修为全用于破境）。不是精确模拟，已注明假设。
export function newbie30min({ minutes = 30, stage = 1 } = {}) {
    const rw = BALANCE.reward, B = BALANCE.battle;
    const battles = Math.floor(minutes * 60 * 1000 / B.intervalMs);
    const totalCoin = battles * (rw.coinBase + stage * rw.coinPerMap);
    let exp = battles * (rw.expBase + stage * rw.expPerMap);
    const totalExp = exp;
    let lv = 1, breaks = 0;
    while (exp >= lv * BALANCE.breakthrough.costPerLevel && breaks < 999) { exp -= lv * BALANCE.breakthrough.costPerLevel; lv++; breaks++; }
    return {
        说明: `粗略投影：假设第${stage}关全胜·不停机·修为全用于破境（实际会更慢）`,
        时长: `${minutes} 分`, 战斗场次: battles, 累计碎银: totalCoin, 累计修为: totalExp,
        可破境次数: breaks, 投影境界: getRealmName(lv)
    };
}
