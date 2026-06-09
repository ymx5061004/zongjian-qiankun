// ============================================================
// 逻辑层：纯游戏规则，不碰 DOM、不读写 state（除随机数外无副作用）。
// 可单独测试。输入参数、输出结果，由控制层(actions)负责落地到 state/界面。
// ============================================================
import {
    ITEM_PREFIXES, MATRIX_ITEMS, SKILL_SECTS, SKILL_SUFFIXES, REALMS, MAP_NAMES, BALANCE, GEAR_TIERS,
    COMBAT_AFFIX_KEYS, GEAR_SLOTS, ACHIEVEMENTS, GUIDE_QUESTS, MATERIALS, CULTIVATION_PATHS, MAP_MODIFIERS, CRAFT_AFFIXES, ACTIVITIES
} from './config.js';
// 命格/轮回遗产 修正聚合（百世轮回）。run.js 仅依赖 config，本处单向依赖，无循环。
import { getModifiers } from './run.js';
// 第四阶段·秘籍装配：心法/禁忌图鉴（纯数据叶子，无环）。
import { HEART_ART_MAP, FORBIDDEN_ART_MAP } from './config/manuals.js';
// 第五阶段·构筑机制 / Boss 招式 / 派系特权（数据叶子 + 纯逻辑模块，单向依赖，无环）。
import { BUILD_RULES, BUILD_ARCHETYPES, BUILD_TAGS, DODGE_ENABLE_DODGE } from './config/builds.js';
import { getBossMoveSet } from './config/bossMoves.js';
import { factionBuildModifiers } from './factions.js';
const LEGENDARY_QUALITY = 5;

// —— 境界名 ——
export function getRealmName(lv) {
    const idx = Math.floor((lv - 1) / 10);
    const sub = ((lv - 1) % 10) + 1;
    if (idx >= REALMS.length) return `至高封神第${lv}重`;
    return `${REALMS[idx]}${sub}重`;
}

function ensureAchievementState(player) {
    if (!player.achievements || typeof player.achievements !== 'object') player.achievements = { unlocked: [], claimed: [], stats: {} };
    if (!Array.isArray(player.achievements.unlocked)) player.achievements.unlocked = [];
    if (!Array.isArray(player.achievements.claimed)) player.achievements.claimed = [];
    if (!player.achievements.stats || typeof player.achievements.stats !== 'object') player.achievements.stats = {}; // 策略向成就累计计数
    if (!Number.isFinite(player.totalKills) || player.totalKills < 0) player.totalKills = 0;
    if (!Number.isFinite(player.totalCoinEarned) || player.totalCoinEarned < 0) player.totalCoinEarned = 0;
    if (!Number.isFinite(player.totalForgeCount) || player.totalForgeCount < 0) player.totalForgeCount = 0;
    if (!Number.isFinite(player.maxMapCleared) || player.maxMapCleared < 0) player.maxMapCleared = 0;
}

export function getAchievementById(id) {
    return ACHIEVEMENTS.find(a => a.id === id) || null;
}

function getCurrentMetricValue(player, metric) {
    // 策略向成就的复杂条件：从 achievements.stats / quests.stats 累计读取（按动作触发累计，非每帧扫描）。
    const as = (player.achievements && player.achievements.stats) || {};
    const qs = (player.quests && player.quests.stats) || {};
    switch (metric) {
        case 'equippedLegendary':
            return Object.values(player.equips || {}).filter(eq => eq && eq.quality === LEGENDARY_QUALITY).length;
        case 'skillCount':
            return Array.isArray(player.skills) ? player.skills.length : 0;
        case 'honghuangLevel': {
            const hh = (player.skills || []).find(sk => sk && sk.isHongHuang);
            return hh ? (hh.level || 0) : 0;
        }
        // —— 第四阶段·策略向计数 ——
        case 'battleCount': return qs.battleCount || 0;
        case 'breakthroughCount': return qs.breakthroughCount || 0;
        case 'enhanceCount': return as.enhanceCount || 0;
        case 'craftCount': return as.craftCount || 0;
        case 'armorWins': return as.armorWins || 0;
        case 'lowHpWins': return as.lowHpWins || 0;
        case 'maxSingleHit': return as.maxSingleHit || 0;
        case 'dodgeCount': return as.dodgeCount || 0;
        case 'poisonKills': return as.poisonKills || 0;
        case 'bodyDamageTaken': return as.bodyDamageTaken || 0;
        case 'gotHighQuality': return as.gotHighQuality || 0;
        case 'nakedWins': return as.nakedWins || 0;
        case 'spiritVeinExp': return as.spiritVeinExp || 0;
        case 'swordPathWins': return (as.winByPath && as.winByPath.sword) || 0;
        case 'poisonMistWins': return (as.winByMod && as.winByMod.poison_mist) || 0;
        default:
            return player[metric] || 0;
    }
}

export function getAchievementProgress(player, achievement) {
    ensureAchievementState(player);
    const cur = getCurrentMetricValue(player, achievement.metric);
    const target = achievement.target || 1;
    return {
        current: Math.max(0, cur),
        target,
        done: cur >= target,
        pct: Math.max(0, Math.min(100, Math.floor((cur / target) * 100)))
    };
}

export function checkAchievements(player, triggerType = 'all') {
    ensureAchievementState(player);
    const unlocked = new Set(player.achievements.unlocked);
    const newlyUnlocked = [];
    const allowByTrigger = (achievement) => {
        if (triggerType === 'all') return true;
        if (triggerType === 'realm') return achievement.category === 'realm';
        if (triggerType === 'reborn') return achievement.category === 'reborn';
        if (triggerType === 'battle') return ['battle', 'map', 'wealth', 'challenge', 'path', 'funny'].includes(achievement.category); // 含第四阶段战斗驱动的策略向类别
        if (triggerType === 'map') return achievement.category === 'map';
        if (triggerType === 'equip') return achievement.id.startsWith('equip_');
        if (triggerType === 'skill') return achievement.category === 'skill';
        if (triggerType === 'forge') return achievement.id.startsWith('craft_');
        if (triggerType === 'coin') return achievement.category === 'wealth';
        return true;
    };

    ACHIEVEMENTS.forEach(achievement => {
        if (unlocked.has(achievement.id) || !allowByTrigger(achievement)) return;
        if (getAchievementProgress(player, achievement).done) {
            unlocked.add(achievement.id);
            newlyUnlocked.push(achievement.id);
        }
    });

    if (newlyUnlocked.length) player.achievements.unlocked = [...unlocked];
    return newlyUnlocked;
}

export function claimAchievementReward(player, achievementId) {
    ensureAchievementState(player);
    const achievement = getAchievementById(achievementId);
    if (!achievement) return { ok: false, reason: 'not_found' };
    if (!player.achievements.unlocked.includes(achievementId)) return { ok: false, reason: 'locked' };
    if (player.achievements.claimed.includes(achievementId)) return { ok: false, reason: 'claimed' };

    const reward = achievement.reward || {};
    if (reward.coin) player.coin += reward.coin;
    if (reward.exp) player.exp += reward.exp;
    if (reward.honghuangPower) player.honghuangPower = (player.honghuangPower || 0) + reward.honghuangPower;
    player.achievements.claimed.push(achievementId);
    return { ok: true, reward };
}

// 永久成就奖励（reward.perm）：把所有「已领取」成就的永久百分比加成汇总。
// computeStats 据此叠乘——claimed 列表是唯一来源、每次现算，故绝不重复叠加（验收 #4），未领取不计。
// 返回 { all, atk, hp, def, crit, dodge, dropRate, coinRate }（百分比，缺省 0）。
const PERM_KEYS = { all: 'allPct', atk: 'atkPct', hp: 'hpPct', def: 'defPct', crit: 'critPct', dodge: 'dodgePct', dropRate: 'dropRatePct', coinRate: 'coinRatePct' };
export function achievementBonuses(player) {
    const acc = { all: 0, atk: 0, hp: 0, def: 0, crit: 0, dodge: 0, dropRate: 0, coinRate: 0 };
    if (!player.achievements || !Array.isArray(player.achievements.claimed)) return acc;
    player.achievements.claimed.forEach(id => {
        const a = getAchievementById(id);
        const perm = a && a.reward && a.reward.perm;
        if (!perm) return;
        for (const k in PERM_KEYS) { const v = perm[PERM_KEYS[k]]; if (Number.isFinite(v)) acc[k] += v; }
    });
    return acc;
}

// ============================================================
// 新手指引任务链（江湖指引）——纯逻辑：进度判定 / 完成判定 / 同步 / 领奖。
// 不碰 DOM、不存档、不弹提示（与 achievement 同套路；仅就地改传入的 player.quests，
// 与 checkAchievements 改 player.achievements 一致）。落地+UI 在 actions.js / render.js。
// ============================================================
function ensureQuestState(player) {
    if (!player.quests || typeof player.quests !== 'object') player.quests = {};
    const q = player.quests;
    if (!Array.isArray(q.completed)) q.completed = [];
    if (!Array.isArray(q.claimed)) q.claimed = [];
    if (q.activeId === undefined) q.activeId = null;
    if (!q.stats || typeof q.stats !== 'object') q.stats = {};
    ['battleCount', 'breakthroughCount', 'shopVisitCount', 'affixStageWins'].forEach(k => { if (!Number.isFinite(q.stats[k]) || q.stats[k] < 0) q.stats[k] = 0; });
}

export function getGuideQuestById(id) {
    return GUIDE_QUESTS.find(q => q.id === id) || null;
}

// 任务排序后的清单（按 order；防御性排序，配置乱序也不影响推进）。
function questsInOrder() {
    return GUIDE_QUESTS.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}

// —— 派生小工具：尽量从既有状态判定，旧档早已满足条件即直接「可领取」 ——
function ownsAnyOre(player) {
    const m = player.materials || {};
    return Object.keys(m).some(k => k.startsWith('ore_') && m[k] > 0);
}
function ownsAnyPill(player) {
    const m = player.materials || {};
    return Object.keys(m).some(k => MATERIALS[k] && MATERIALS[k].pill && m[k] > 0);
}
function pillBonusSum(player) {
    const pb = player.pillBonus || {};
    return ['hp', 'atk', 'def', 'crit', 'dodge'].reduce((s, k) => s + (Number.isFinite(pb[k]) ? pb[k] : 0), 0);
}
// 读「策略向成就」累计计数（craftCount/enhanceCount…）：打造/强化等动作早已在累计，指引直接复用 → 旧档零风险、做过即可领。
function achStat(player, key) {
    const s = player.achievements && player.achievements.stats;
    return (s && Number.isFinite(s[key])) ? s[key] : 0;
}

// 单条任务进度：返回 { current, target, done, pct }。target 取自任务配置（≥1）。
export function getQuestProgress(player, quest) {
    ensureQuestState(player);
    const s = player.quests.stats;
    const target = quest.target || 1;
    let cur = 0;
    switch (quest.type) {
        case 'battleCount':  cur = s.battleCount || 0; break;                                              // 计数器（每场战斗 +1）
        case 'equipItem':    cur = Object.values(player.equips || {}).some(Boolean) ? 1 : 0; break;        // 任意部位已装备
        case 'clearMap':     cur = player.maxMapCleared || 0; break;                                       // 历史最高通关关卡
        case 'forgeCount':   cur = player.totalForgeCount || 0; break;                                     // 洪炉融合累计次数（既有字段）
        case 'breakthrough': cur = s.breakthroughCount || 0; break;                                        // 计数器（破境 +1；旧档由境界回种）
        case 'ownSkill':     cur = Array.isArray(player.skills) ? player.skills.length : 0; break;         // 已掌握秘籍数（初始 1 本）
        case 'visitShop':    cur = s.shopVisitCount || 0; break;                                           // 计数器（进入/刷新黑市 +1）
        case 'startMining':  cur = (((player.professions && player.professions.mining && player.professions.mining.exp) || 0) > 0 || ownsAnyOre(player)) ? 1 : 0; break;
        case 'startSmelting':cur = (((player.professions && player.professions.smithing && player.professions.smithing.exp) || 0) > 0) ? 1 : 0; break; // smithing 经验仅由熔炼增长 → >0 即「已熔炼过」（旧档同理直接可领）
        case 'craftCount':   cur = achStat(player, 'craftCount'); break;                                    // 「打造」累计件数（复用成就计数器，既有动作已累计，旧档已造过即可领）
        case 'enhanceCount': cur = achStat(player, 'enhanceCount'); break;                                  // 「强化」累计次数（复用成就计数器）
        case 'getPill':      cur = (((player.professions && player.professions.alchemy && player.professions.alchemy.exp) || 0) > 0 || ownsAnyPill(player) || pillBonusSum(player) > 0) ? 1 : 0; break;
        case 'questsDone':   cur = countCompletedGuideQuests(player, quest.id); break;                     // 已达成的其它任务数
        case 'choosePath':   cur = player.cultivationPath ? 1 : 0; break;                                  // 已选择任意修行流派
        case 'clearAffixStage': cur = s.affixStageWins || 0; break;                                        // 通关带词缀关卡的次数（计数器）
        case 'learnReborn':  cur = ((player.rebornCount || 0) >= 1 || (player.realmLevel || 1) >= BALANCE.reborn.minLevel) ? 1 : 0; break;
        default:             cur = 0;
    }
    cur = Math.max(0, cur);
    const done = cur >= target;
    return { current: cur, target, done, pct: Math.max(0, Math.min(100, Math.floor((cur / target) * 100))) };
}

export function isQuestCompleted(player, quest) {
    return getQuestProgress(player, quest).done;
}

// 已达成的任务数（可排除某条，供 'questsDone' 自身计数时避免自指）。
function countCompletedGuideQuests(player, excludeId) {
    return GUIDE_QUESTS.reduce((n, q) => {
        if (q.id === excludeId || q.type === 'questsDone') return n; // 排除自身 + 其它汇总型任务，避免互相递归
        return n + (getQuestProgress(player, q).done ? 1 : 0);
    }, 0);
}

// 同步任务状态：刷新 completed[] 与 activeId（推荐任务=按 order 第一条未领取的）。
// 返回「本次新达成」的任务 id 数组（供 actions 弹「可领取」提示，与 checkAchievements 同模式）。幂等，可频繁调用。
export function syncQuestProgress(player) {
    ensureQuestState(player);
    const completed = new Set(player.quests.completed);
    const newly = [];
    questsInOrder().forEach(q => {
        if (!completed.has(q.id) && getQuestProgress(player, q).done) { completed.add(q.id); newly.push(q.id); }
    });
    if (newly.length) player.quests.completed = [...completed];
    const next = questsInOrder().find(q => !player.quests.claimed.includes(q.id));
    player.quests.activeId = next ? next.id : null;
    return newly;
}

// 当前推荐任务对象（按 order 第一条未领取的）；全部领取完返回 null。
export function getCurrentGuideQuest(player) {
    ensureQuestState(player);
    const next = questsInOrder().find(q => !player.quests.claimed.includes(q.id));
    return next || null;
}

// 尚未领取的任务清单（按 order）——「待办」列表。
export function getAvailableGuideQuests(player) {
    ensureQuestState(player);
    return questsInOrder().filter(q => !player.quests.claimed.includes(q.id));
}

// 领取奖励（纯状态层）：校验「存在 / 已达成 / 未领过」→ 发放「不占背包」的奖励（碎银/修为/物料/永久根骨/洪荒）→ 标记已领取。
// item/skill 等「占背包」的奖励不在此发放，由 actions 在领取前校验背包空位后落地（背包满则拒绝领取）。返回 { ok, reward, reason }。
export function claimGuideQuestReward(player, questId) {
    ensureQuestState(player);
    const quest = getGuideQuestById(questId);
    if (!quest) return { ok: false, reason: 'not_found' };
    if (player.quests.claimed.includes(questId)) return { ok: false, reason: 'claimed' };
    if (!getQuestProgress(player, quest).done) return { ok: false, reason: 'incomplete' };

    const reward = quest.reward || {};
    if (reward.coins) player.coin += reward.coins;
    if (reward.exp) player.exp += reward.exp;
    if (reward.honghuangPower) player.honghuangPower = (player.honghuangPower || 0) + reward.honghuangPower;
    if (reward.material) {
        if (!player.materials || typeof player.materials !== 'object') player.materials = {};
        for (const [k, v] of Object.entries(reward.material)) player.materials[k] = (player.materials[k] || 0) + v;
    }
    if (reward.statBonus) {
        if (!player.pillBonus || typeof player.pillBonus !== 'object') player.pillBonus = { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0 };
        for (const [k, v] of Object.entries(reward.statBonus)) player.pillBonus[k] = (player.pillBonus[k] || 0) + v;
    }
    player.quests.claimed.push(questId);
    syncQuestProgress(player); // 领取后推进 activeId 到下一条
    return { ok: true, reward };
}

// ============================================================
// 「下一步建议」(getGameplayAdvice)——纯函数：据当前 player 给出最多 4 条可执行建议，
// 用于「江湖指引」页顶部的卡关反馈。只读、不碰 DOM、不存档（与 getQuestProgress 同为纯逻辑）。
//   返回数组，每条 { priority, key, icon, text, page? }；按 priority 升序取前 ADVICE_CAP 条。
//   覆盖：可领指引奖励 / 背包满 / 当前关卡危险 / 可突破 / 未择流派 / 缺材料 / 可采矿·熔炼·打造·强化。
//   判定尽量从既有状态派生；危险度用 simulateBattle 抽样估胜率（try/catch 兜底，异常则跳过该条）。
// ============================================================
const ADVICE_CAP = 4;

// 抽样估算「对指定敌人」的胜率（纯：多次 simulateBattle 取胜场比例）。失败/异常返回 null。
// 同时服务关卡(finalizeEnemyStats)与 Boss(finalizeBossStats)——只要传进来的 enemy 有 maxHp/atk/def 即可。
function estimateWinRateVs(player, enemy, env = null, samples = 5) {
    try {
        const { stats } = computeStats(player);
        const skills = getCombatSkills(player);   // 诊断/天机与实战同源：仅「携带」的秘籍参战
        let win = 0;
        for (let i = 0; i < samples; i++) if (simulateBattle(stats, enemy, skills, env).win) win++;
        return win / samples;
    } catch (e) {
        return null;
    }
}
// 关卡胜率（薄封装：补上该关的敌人与词缀环境）。
function estimateWinRate(player, mapId, samples = 5) {
    try {
        return estimateWinRateVs(player, finalizeEnemyStats(mapId), resolveMapEnv(mapId, player), samples);
    } catch (e) { return null; }
}

// —— 战斗「缺口」诊断（纯·只读）：判断面对某敌人时是「输出不足/生存不足/势均/无碍」，供建议与流派/Boss 联动。 ——
// 胜负规则是「撑满回合存活 或 击杀」，故生存是主导维度；这里用解析式回合数(方向性，忽略暴击/技能/闪避)给出倾向，
// 危险度则用 estimateWinRateVs 的抽样胜率。enemy 同时适配关卡与 Boss。返回 { winRate, deficit, danger, roundsToKill, roundsToDie }。
function diagnoseCombat(player, enemy, env = null, samples = 5) {
    try {
        const { stats } = computeStats(player);
        const cap = BALANCE.battle.maxRounds;
        const winRate = estimateWinRateVs(player, enemy, env, samples);
        const pDmg = Math.max(1, Math.floor((stats.atk || 0) - (enemy.def || 0)));   // 玩家每回合近似实伤
        const eDmg = Math.max(1, Math.floor((enemy.atk || 0) - (stats.def || 0)));   // 受击每回合近似实伤
        const roundsToKill = Math.ceil((enemy.maxHp || 1) / pDmg);
        const roundsToDie = Math.ceil((stats.hp || 1) / eDmg);
        let deficit;
        if (winRate != null && winRate >= 0.85) deficit = 'none';
        else if (roundsToDie > cap) deficit = 'none';            // 能撑满回合 → 稳胜
        else if (roundsToKill > cap) deficit = 'survival';       // 回合内杀不掉 → 只能堆生存熬到收场
        else if (roundsToKill <= roundsToDie) deficit = 'attack';// 能在回合内先杀掉 → 推输出锁定击杀
        else deficit = 'balanced';                               // 略早于击杀阵亡 → 两端皆可
        let danger;
        if (winRate == null) danger = 'unknown';
        else if (winRate >= 0.7) danger = 'safe';
        else if (winRate >= 0.35) danger = 'risky';
        else danger = 'deadly';
        return { winRate, deficit, danger, roundsToKill, roundsToDie };
    } catch (e) {
        return { winRate: null, deficit: 'unknown', danger: 'unknown', roundsToKill: 0, roundsToDie: 0 };
    }
}

// 进攻/生存部位划分（强化建议按战斗缺口择件：输出不足强兵刃、生存不足强防具）。
const ATTACK_SLOTS = ['weapon', 'subweapon'];
const SURVIVE_SLOTS = ['armor', 'helm', 'ring', 'artifact', 'amulet', 'boots', 'gloves'];

// 生产侧建议：在「强化已装备神兵 / 缺料去采矿熔炼 / 打造装备」之间挑最有价值的，避免互相重复刷屏。
// deficit（可选 'attack'|'survival'）：卡关缺口 → 优先建议对症部位（兵刃/防具），实现「卡关→生产」联动。
function addProductionAdvice(player, add, deficit) {
    const materials = (player.materials && typeof player.materials === 'object') ? player.materials : {};
    const coin = player.coin || 0;
    let added = false; // 是否已给出「明确可做的一步」——决定要不要再补兜底的「去备料」

    // (a) 强化：扫已装备、还能继续强化的件。按缺口优先「对症部位」(输出→兵刃 / 生存→防具)，其内再挑下一级碎银最低者。
    const equips = (player.equips && typeof player.equips === 'object') ? player.equips : {};
    const preferSlots = deficit === 'attack' ? ATTACK_SLOTS : (deficit === 'survival' ? SURVIVE_SLOTS : null);
    let bestPref = null, bestAny = null;
    for (const slot of Object.keys(equips)) {
        const item = equips[slot];
        if (!item) continue;
        const cost = enhanceCost(item);
        if (!cost) continue; // 已满级
        const haveIngot = materials[cost.ingotKey] || 0;
        const lackIngot = haveIngot < cost.ingotQty;
        const affordable = !lackIngot && coin >= cost.coin;
        const cand = { slot, item, cost, haveIngot, lackIngot, affordable };
        if (!bestAny || cost.coin < bestAny.cost.coin) bestAny = cand;
        if (preferSlots && preferSlots.includes(slot) && (!bestPref || cost.coin < bestPref.cost.coin)) bestPref = cand;
    }
    const best = bestPref || bestAny;
    if (best) {
        const { item, cost, haveIngot, lackIngot, affordable } = best;
        const ingotName = MATERIALS[cost.ingotKey] ? MATERIALS[cost.ingotKey].name : cost.ingotKey;
        const tag = bestPref ? (deficit === 'attack' ? '输出不足 → 强兵刃：' : '生存不足 → 强防具：') : '';
        if (affordable) {
            add(60, 'enhance', '⚒️', `${tag}可强化【${item.name}】→ +${cost.targetLevel}（耗 ${ingotName}×${cost.ingotQty} + 碎银 ${cost.coin}），攻/防/血永久放大。`, 'enhance');
            added = true;
        } else if (lackIngot) {
            add(62, 'lackmat', '⛏️', `${tag}强化【${item.name}】缺「${ingotName}」（需 ${cost.ingotQty}、现有 ${haveIngot}）：去「采矿」开采、「锻造」熔炼成锭。`, 'mining');
            added = true;
        }
    }

    // (b) 打造：锻造等级解锁的最高可造档，若材料齐备则提示去打造一件（爬装备阶梯）。
    const smExp = (player.professions && player.professions.smithing && player.professions.smithing.exp) || 0;
    const smLv = levelFromExp(smExp);
    for (let t = MAX_CRAFTABLE_TIER; t >= 1; t--) {
        const T = GEAR_TIERS[t - 1];
        if (!T || T.craftable === false || smLv < T.smithingReq) continue;
        const have = materials[T.ingot] || 0;
        if (have >= T.ingotQty && coin >= T.coin) {
            const ingotName = MATERIALS[T.ingot] ? MATERIALS[T.ingot].name : T.ingot;
            add(66, 'craft', '🛡️', `材料齐备，可在「打造」锻造【${T.name}】装备（耗 ${ingotName}×${T.ingotQty} + 碎银 ${T.coin}）。`, 'craft');
            added = true;
        }
        break; // 只看最高可造档，给一条即可
    }

    // (c) 兜底：上面都没有「现成可做的一步」、又没在挂机、且矿石/锭储备很少 → 去采矿熔炼备料。
    if (!added && !player.activity) {
        const stock = Object.keys(materials).reduce((n, k) => n + ((k.startsWith('ore_') || k.startsWith('ingot_')) ? (materials[k] || 0) : 0), 0);
        if (stock < 6) add(80, 'produce', '⛏️', `矿石与锭储备不足：去「采矿」开采、「锻造」熔炼成锭，为打造与强化备料（可挂机）。`, 'mining');
    }
}

export function getGameplayAdvice(player) {
    if (!player || typeof player !== 'object') return [];
    const out = [];
    const add = (priority, key, icon, text, page) => out.push({ priority, key, icon, text, page });

    // —— 1. 可领取指引奖励（免费到手，最优先）——
    const claimed = (player.quests && Array.isArray(player.quests.claimed)) ? player.quests.claimed : [];
    const claimable = GUIDE_QUESTS.filter(q => !claimed.includes(q.id) && getQuestProgress(player, q).done);
    if (claimable.length) add(10, 'claim', '🎁', `有 ${claimable.length} 个指引奖励可领取（如「${claimable[0].title}」），记得在下方领取。`);

    // —— 2. 背包已满（再战掉落会丢失）——
    const bag = Array.isArray(player.bag) ? player.bag : [];
    const bagMax = Number.isFinite(player.bagMax) ? player.bagMax : 16;
    if (bag.length >= bagMax) add(20, 'bagfull', '🎒', `行囊已满（${bag.length}/${bagMax}）：清理行囊或去「珍宝黑市」扩容，否则战斗掉落会丢失。`, 'shop');

    // —— 3. 当前关卡危险（卡关核心反馈）：诊断「下一关」缺口，胜率过低则给「对症」战力建议（联动生产）——
    const cleared = Number.isFinite(player.maxMapCleared) ? player.maxMapCleared : 0;
    let frontierDeficit = null;
    if (cleared >= 1 && cleared < MAP_NAMES.length) {
        const frontier = cleared + 1;
        const diag = diagnoseCombat(player, finalizeEnemyStats(frontier), resolveMapEnv(frontier, player));
        if (diag.winRate != null && diag.winRate < 0.45) {
            frontierDeficit = diag.deficit;
            const fix = diag.deficit === 'attack' ? '输出不足 → 强化/打造兵刃、升攻击秘籍(真卷/杀诀)'
                : diag.deficit === 'survival' ? '生存不足 → 强化防具、炼气血(聚元丹)/防御(玄龟丹)丹'
                : '提升战力：破境 / 强化 / 打造';
            add(30, 'danger', '⚠️', `推进到第 ${frontier} 关偏凶险（试算胜率约 ${Math.round(diag.winRate * 100)}%）→ ${fix}；或回低关稳健刷资源。`, 'adventure');
        }
    }

    // —— 4. 可突破（修为已足，立竿见影的战力）——
    const needExp = (player.realmLevel || 1) * BALANCE.breakthrough.costPerLevel;
    if ((player.exp || 0) >= needExp) add(40, 'breakthrough', '📈', `修为已足（${Math.floor(player.exp || 0)}/${needExp}），可在「修真命格」破境冲关，全属性提升。`, 'role');

    // —— 5. 尚未择道（首次免费的长期成长选择；打过至少一场再提示，不打扰首战）——
    const battleCount = (player.quests && player.quests.stats && player.quests.stats.battleCount) || 0;
    if (!player.cultivationPath && (battleCount >= 1 || cleared >= 1)) add(50, 'path', '☯️', `尚未择道：去「修行流派」选一门确立成长方向（首次免费，影响长远强度）。`, 'path');

    // —— 6/7. 生产侧：可强化 / 缺材料 / 可打造 / 去采矿熔炼（按卡关缺口对症择件）——
    addProductionAdvice(player, add, frontierDeficit);

    return out.sort((a, b) => a.priority - b.priority).slice(0, ADVICE_CAP);
}

// ============================================================
// 中期深度·联动（纯函数，只读不碰 DOM）：地图词缀说明 / Boss 目标化 / 流派适配评价。
// 一律「复用」既有逻辑（getMapModifier·resolveMapEnv·getMapRewardMods·finalizeBossStats·diagnoseCombat），
// 不复制第二套规则；落地+UI 在 render.js / actions.js。
// ============================================================

// —— 一、地图词缀说明：把词缀的「风险/奖励/应对/宜流派」从既有解析函数派生成可读条目（不再硬列数据）——
export function getMapModifierBrief(mapId, player = null) {
    const { mod, isElite } = getMapModifier(mapId);
    const env = resolveMapEnv(mapId, player);     // 战斗环境（已封顶）；荒原→null
    const rmod = getMapRewardMods(mapId);          // 奖励修正（已封顶）
    const risk = [], reward = [], advice = [];
    // 风险：全部来自 resolveMapEnv 解析出的战斗环境字段
    if (env) {
        if (env.envDmgPctMaxHp) risk.push(`每回合「${env.label || '环境'}」损失约 ${env.envDmgPctMaxHp}% 气血上限`);
        if (env.enemyCritChance) risk.push(`守卫暴击率 ${env.enemyCritChance}%（暴击 ×${env.enemyCritMult}）`);
        if (env.dodgeReduction) risk.push(`闪避被压制 -${env.dodgeReduction} 点`);
        if (env.healMult != null && env.healMult < 1) risk.push(`回血/吸血降至 ${Math.round(env.healMult * 100)}%`);
    }
    if (isElite) risk.push('精英关：词缀强度提升');
    if (!risk.length) risk.push('无额外凶险');
    // 奖励：全部来自 getMapRewardMods
    if (rmod.expMult > 1) reward.push(`修为 +${Math.round((rmod.expMult - 1) * 100)}%`);
    if (rmod.gearDropMult > 1) reward.push(`装备掉率 ×${rmod.gearDropMult.toFixed(2)}`);
    if (rmod.gearDropMult < 1) reward.push(`装备掉率 ×${rmod.gearDropMult.toFixed(2)}（偏少）`);
    if (rmod.weaponBias) reward.push('掉落偏向兵刃/暗器');
    if (rmod.herbDropChance) reward.push('概率掉药材（喂炼丹）');
    if (rmod.skillDropChance) reward.push('概率掉秘籍');
    if (!reward.length) reward.push('常规收益');
    // 应对：由风险字段 + 契合流派派生
    const fitPaths = (mod.preferredPaths || []).map(pid => { const p = getPathById(pid); return p ? p.name : pid; });
    if (env && env.envDmgPctMaxHp) advice.push('带厚血/回血或减伤，别被环境磨死');
    if (env && env.enemyCritChance) advice.push('堆气血/防御抗暴，或速杀求快');
    if (env && env.dodgeReduction) advice.push('别依赖闪避，靠血厚甲坚硬抗');
    if (env && env.healMult != null && env.healMult < 1) advice.push('回血被削，靠高输出速杀或反伤');
    if (fitPaths.length) advice.push(`流派契合：${fitPaths.join('/')}`);
    if (!advice.length) advice.push('常规推进即可');
    return { modId: mod.id, name: mod.name, icon: mod.icon, tone: mod.tone, isElite, isWildland: mod.id === 'wildland', risk, reward, advice, fitPaths };
}

// —— 二、Boss 目标化：解锁条件 / 掉落用途 / 胜算·危险等级 / 对症准备 / 推荐先通关卡 ——
function bossPrepHints(diag) {
    const def = diag.deficit;
    const hints = [];
    if (def === 'none') { hints.push('战力大体够：保险起见先把主战装备强化 1~2 级再上。'); return hints; }
    if (def === 'attack' || def === 'balanced') hints.push('输出不足 → 强化/打造兵刃·暗器，升攻击系秘籍(真卷/杀诀)，或转剑修/毒修。');
    if (def === 'survival' || def === 'balanced') hints.push('生存不足 → 强化防具/法宝，炼聚元丹(气血)·玄龟丹(防御)，或转体修。');
    if (def === 'unknown') hints.push('先把主战装备强化几级、炼几炉根骨丹，再来试。');
    hints.push('质变手段：把玄晶档装备「神兵进阶」到神话/仙器（需先攒神魂结晶）。');
    return hints;
}
export function getBossPlan(player, boss) {
    const unlocked = (player.realmLevel || 1) >= boss.realmReq;
    const diag = diagnoseCombat(player, finalizeBossStats(boss), null);
    const cleared = player.maxMapCleared || 0;
    const recStage = boss.mapEquiv;
    const topTier = GEAR_TIERS[MAX_CRAFTABLE_TIER - 1];
    return {
        bossId: boss.id, name: boss.name, unlocked,
        unlockText: `境界达 ${getRealmName(boss.realmReq)}（${boss.realmReq} 级）`,
        dropUse: `💎神魂结晶 ×${boss.crystalMin}~${boss.crystalMax} → 用于「神兵进阶」把 ${topTier.name}档 突破到 神话/仙器（打造造不出的档）；另得碎银 ${boss.coin}`,
        danger: unlocked ? diag.danger : 'locked',
        winRate: unlocked ? diag.winRate : null,
        deficit: diag.deficit,
        recommendedClearStage: recStage,
        clearedEnough: cleared >= recStage,
        stageHint: cleared >= recStage
            ? `你已通到第 ${cleared} 关（≥推荐第 ${recStage} 关），战力大体够。`
            : `建议先通到第 ${recStage} 关左右积累战力，再来挑战。`,
        prep: bossPrepHints(diag)
    };
}

// —— 三、流派适配评价：据玩家当前装备/属性/材料/卡点，给每派 推荐度 + 理由 + 短板 + 适配方向（不替玩家选）——
// 每派一份「画像」(适配缺口 / 装备词条 / 丹药 / 秘籍 / 生产方向)，与游戏既有内容对齐（CRAFT_AFFIXES/丹药/秘籍后缀）。
const PATH_FIT = {
    sword:   { serves: 'attack',   affix: '锋锐(暴击)',     pills: '锐金丹(暴击)',           skills: '真卷(攻·暴击)/杀诀(暴伤)', production: '打造·强化兵刃' },
    body:    { serves: 'survival', affix: '坚铠(防/血)',    pills: '聚元丹(气血)·玄龟丹(防御)', skills: '心法(防·闪)/护体诀(减伤)', production: '强化防具/护符' },
    poison:  { serves: 'attack',   affix: '淬毒(暗器)',     pills: '锐金丹(暴击)',           skills: '血刃(流血)/噬血术(吸血)',   production: '打造暗器 + 采药炼丹' },
    agility: { serves: 'survival', affix: '轻灵(闪避)',     pills: '轻灵丹(闪避)',           skills: '心法(闪避)/疾风式(先发)',   production: '强化轻甲' },
    artisan: { serves: 'both',     affix: '精工(升成色)',   pills: '大还丹(全能)',           skills: '(器修弱化被动秘籍收益)',     production: '主打 打造/强化（放大装备）' }
};
// 玩家当前「战斗倾向」信号：用于流派契合打分（抽样仅在 diagnoseCombat 内发生一次）。
function buildSignals(player) {
    let stats = {};
    try { stats = computeStats(player).stats || {}; } catch (e) { stats = {}; }
    const equips = (player.equips && typeof player.equips === 'object') ? player.equips : {};
    const enhanceTotal = Object.values(equips).reduce((n, it) => n + (it ? (it.enhance || 0) : 0), 0);
    const frontier = Math.min(MAP_NAMES.length, (player.maxMapCleared || 0) + 1);
    const diag = (player.maxMapCleared || 0) >= 1
        ? diagnoseCombat(player, finalizeEnemyStats(frontier), resolveMapEnv(frontier, player))
        : { deficit: 'none', danger: 'safe' };
    const smExp = (player.professions && player.professions.smithing && player.professions.smithing.exp) || 0;
    return {
        crit: stats.crit || 0, dodge: stats.dodge || 0,
        hasSub: !!equips.subweapon, enhanceTotal, smithingLv: levelFromExp(smExp),
        deficit: diag.deficit, danger: diag.danger
    };
}
export function explainPathFit(player, path, signals = null) {
    const prof = PATH_FIT[path.id] || {};
    const sig = signals || buildSignals(player);
    const unlocked = isPathUnlocked(player, path);
    const isCurrent = player.cultivationPath === path.id;
    let score = 1; // 0=low 1=medium 2+=high
    const reasons = [], shortfalls = [];

    // (1) 是否对症当前卡关缺口（仅在确有卡点时计入，避免对舒适期玩家瞎打分）
    if (sig.danger && sig.danger !== 'safe' && sig.deficit !== 'none' && sig.deficit !== 'unknown') {
        if (prof.serves === sig.deficit || prof.serves === 'both') { score++; reasons.push(sig.deficit === 'survival' ? '当前生存吃紧，此道补生存最对症' : '当前输出不足，此道补输出最对症'); }
        else if (prof.serves === 'attack' || prof.serves === 'survival') { score--; shortfalls.push(sig.deficit === 'survival' ? '偏进攻，但你当前更缺生存' : '偏生存，但你当前更缺输出'); }
    }
    // (2) 与当前 build 的契合 / 短板
    if (path.id === 'sword') { if (sig.crit >= 10) { score++; reasons.push('暴击已起步，剑修放大爆发'); } else shortfalls.push('暴击偏低：配暴击装/锐金丹/真卷秘籍'); }
    if (path.id === 'poison') { if (sig.hasSub) reasons.push('已装暗器，毒修加成可吃满'); else { score = Math.max(0, score - 1); shortfalls.push('未装暗器：毒修需暗器 + 采药炼丹'); } }
    if (path.id === 'agility') { if (sig.dodge >= 10) { score++; reasons.push('闪避已有基础，身法更灵动'); } else shortfalls.push('闪避偏低：配闪避装/轻灵丹'); }
    if (path.id === 'body') reasons.push('血厚甲坚，最稳、最宜长时间挂机');
    if (path.id === 'artisan') { if (sig.enhanceTotal >= 3 || sig.smithingLv >= 12) { score++; reasons.push('你已投入装备/锻造，器修以器养道收益高'); } else shortfalls.push('器修需配合打造/强化投入才显威'); }
    // (3) 未解锁提示（不参与高低分，只作短板提醒）
    if (!unlocked) shortfalls.unshift(`未解锁：需${getRealmName(path.unlockRealmLevel)}`);

    const fit = score >= 2 ? 'high' : (score <= 0 ? 'low' : 'medium');
    return {
        pathId: path.id, name: path.name, unlocked, isCurrent, fit,
        reason: reasons.length ? reasons.join('；') : '通用可选，按你想要的风格来',
        shortfall: shortfalls.length ? shortfalls.join('；') : '无明显短板',
        direction: `装备词条「${prof.affix || '—'}」 · 丹药「${prof.pills || '—'}」 · 秘籍「${prof.skills || '—'}」 · 生产「${prof.production || '—'}」`
    };
}
export function getPathRecommendations(player) {
    if (!player || typeof player !== 'object') return [];
    const sig = buildSignals(player);   // 抽样仅一次，五派共用，避免重复跑战斗
    return CULTIVATION_PATHS.map(p => explainPathFit(player, p, sig));
}

// ============================================================
// UI 信息表达·只读派生（纯函数）：敌我评估 / 生产下一解锁 / 材料来源指引。
// 复用既有逻辑（finalizeEnemyStats·computeStats·diagnoseCombat·getMapModifierBrief·levelFromExp·expForLevel），
// 仅把「数据」算好交给 render；不拼复杂 HTML、不改任何数值。
// ============================================================

// 据战斗缺口给「变强方向」短句（敌我评估/失败提示共用，措辞与生产/流派联动一致）。
function deficitFixHints(deficit) {
    if (deficit === 'attack') return ['强化/打造兵刃·暗器', '升攻击系秘籍(真卷/杀诀)', '或转剑修/毒修'];
    if (deficit === 'survival') return ['强化防具/法宝', '炼聚元丹(气血)·玄龟丹(防御)', '或转体修'];
    if (deficit === 'balanced') return ['强化主战装备', '炼根骨丹', '或破境提升境界'];
    if (deficit === 'none') return ['战力充裕，放心推进'];
    return ['强化装备 / 炼丹 / 破境'];
}

// —— 冒险页「敌我评估」：当前关卡敌人属性 + 我方属性 + 危险等级 + 词缀风险 + 变强建议（全部复用既有纯函数）——
export function getStageAssessment(player, mapId) {
    const id = Math.max(1, Math.min(MAP_NAMES.length, mapId || 1));
    const enemy = finalizeEnemyStats(id);
    let ps = {};
    try { ps = computeStats(player).stats || {}; } catch (e) { ps = {}; }
    const env = resolveMapEnv(id, player);
    const diag = diagnoseCombat(player, enemy, env);
    return {
        mapId: id, name: MAP_NAMES[id - 1] || '神秘禁区',
        enemy: { hp: enemy.maxHp, atk: enemy.atk, def: enemy.def },
        me: { hp: ps.hp || 0, atk: ps.atk || 0, def: ps.def || 0, crit: ps.crit || 0, dodge: ps.dodge || 0 },
        winRate: diag.winRate, danger: diag.danger, deficit: diag.deficit,
        mod: getMapModifierBrief(id, player),
        fixHints: deficitFixHints(diag.deficit)
    };
}

// ============================================================
// 第四阶段·天机推演（卡关诊断增强）：胜算 / 失败主因细分 / 可执行建议(模拟对比·真实估算收益)。
// 纯函数·只读：深拷贝 player 临时施加某改动，重模拟比胜率，给出真实估算收益（绝非假建议）。
// 不碰 DOM；落地+UI 在 render.js。采样次数/建议条数见 BALANCE.tianji（on-demand 计算，勿过大以免拖慢）。
// ============================================================
// 多次模拟取详细统计（胜率/平均回合/受伤/阵亡回合/击杀回合）。与实战同源(getCombatSkills)。
function sampleBattleStats(player, enemy, env, samples) {
    let stats, skills;
    try { stats = computeStats(player).stats; skills = getCombatSkills(player); } catch (e) { return null; }
    let wins = 0, roundsSum = 0, deaths = 0, deathRoundSum = 0, kills = 0, killRoundSum = 0, dmgTakenSum = 0;
    for (let i = 0; i < samples; i++) {
        const r = simulateBattle(stats, enemy, skills, env);
        const lastR = r.events.length ? r.events[r.events.length - 1].round : 0;
        if (r.win) wins++;
        roundsSum += lastR; dmgTakenSum += r.dmgTaken || 0;
        if (r.remainingHp <= 0) { deaths++; deathRoundSum += lastR; }
        if (r.enemyDead) { kills++; killRoundSum += lastR; }
    }
    return {
        winRate: wins / samples, avgRounds: roundsSum / samples, avgDmgTaken: dmgTakenSum / samples,
        deaths, avgDeathRound: deaths ? deathRoundSum / deaths : 0,
        kills, avgKillRound: kills ? killRoundSum / kills : 0
    };
}

// 失败主因分类（综合 模拟统计 + 敌人词条/机制 + 解析式缺口 diagnoseCombat）。≥6 类来源。
function classifyChallengeCause(st, enemy, env, diag) {
    const cap = BALANCE.battle.maxRounds;
    if (st.winRate >= 0.85) return { key: 'none', text: '战力充裕，此战可稳进。' };
    if ((enemy.regenPct || 0) > 0 && st.kills <= st.deaths) return { key: 'regen', text: `败因：敌附【再生】，${cap} 回合内难斩杀、被其回血拖死——需提高爆发速杀。` };
    if ((enemy.thornsPct || 0) > 0 && st.deaths > 0 && st.avgDeathRound <= cap * 0.6) return { key: 'thorns', text: '败因：敌附【荆棘反伤】，猛攻反噬自身——宜堆生存/减伤，忌一味拼输出。' };
    if ((enemy.chargeEvery || 0) > 0 && st.deaths > 0) return { key: 'boss_charge', text: `败因：区域之主每 ${enemy.chargeEvery} 回合蓄力大招，未能在其爆发前压制或扛住。` };
    if (((env && env.enemyCritChance) || 0) > 0 && st.deaths > 0 && st.avgDeathRound <= cap * 0.6) return { key: 'crit', text: '败因：此地守卫暴击凶猛，连遭重击而陨——宜堆气血/防御抗暴或速杀。' };
    if (diag.deficit === 'survival') return { key: 'survival', text: `败因：约第 ${Math.max(1, Math.round(st.avgDeathRound || diag.roundsToDie))} 回合气血见底，生存缺口明显。` };
    if (diag.deficit === 'attack') return { key: 'attack', text: `败因：${cap} 回合内难以斩杀（约需 ${diag.roundsToKill} 回合），输出不足。` };
    return { key: 'balanced', text: '败因：势均力敌，略增战力或调整装配/策略即可破局。' };
}

// 候选改动（每条 apply 深拷贝后的 player，返回 true=改动成功）。覆盖 强化/心法/禁忌/丹药/破境 多源。
//   kind：天机三策归类 safe(稳)/risky(险)/detour(绕)；cost：代价文案（三策每策都要有代价）。
function buildTianjiCandidates() {
    const B = BALANCE;
    return [
        { text: '强化兵刃 +2（提输出）', page: 'enhance', kind: 'safe', cost: '耗锭+碎银', apply: p => { const it = p.equips && (p.equips.weapon || p.equips.subweapon); if (!it) return false; it.enhance = Math.min(B.enhance.maxLevel, (it.enhance || 0) + 2); return true; } },
        { text: '强化防具 +2（提生存）', page: 'enhance', kind: 'safe', cost: '耗锭+碎银', apply: p => { for (const s of ['armor', 'helm', 'ring', 'artifact', 'amulet', 'boots', 'gloves']) { const it = p.equips && p.equips[s]; if (it) { it.enhance = Math.min(B.enhance.maxLevel, (it.enhance || 0) + 2); return true; } } return false; } },
        { text: '装配心法《玄龟息壤功》（防御/减伤）', page: 'kungfu', kind: 'safe', cost: '占心法槽·攻-8%', apply: p => { if ((p.realmLevel || 1) < 8) return false; p.loadout = p.loadout || {}; if (p.loadout.heart === 'heart_guard') return false; p.loadout.heart = 'heart_guard'; return true; } },
        { text: '装配心法《奔雷剑心》（攻击/暴伤）', page: 'kungfu', kind: 'risky', cost: '占心法槽·防-6%', apply: p => { if ((p.realmLevel || 1) < 8) return false; p.loadout = p.loadout || {}; if (p.loadout.heart === 'heart_sword') return false; p.loadout.heart = 'heart_sword'; return true; } },
        { text: '参修禁忌《血河禁卷》（暴伤暴涨·气血大损，赌）', page: 'kungfu', kind: 'risky', cost: '气血-18%·占禁忌槽', apply: p => { p.loadout = p.loadout || {}; if (p.loadout.forbidden === 'forbid_blood') return false; p.loadout.forbidden = 'forbid_blood'; return true; } },
        { text: '服「聚元丹」补气血（炼丹或药王谷委托）', page: 'alchemy', kind: 'safe', cost: '耗草药/委托', apply: p => { p.pillBonus = p.pillBonus || {}; p.pillBonus.hp = (p.pillBonus.hp || 0) + 300; return true; } },
        { text: '服「淬体丹」增攻击', page: 'alchemy', kind: 'safe', cost: '耗草药/委托', apply: p => { p.pillBonus = p.pillBonus || {}; p.pillBonus.atk = (p.pillBonus.atk || 0) + 80; return true; } },
        { text: '破境提升境界（全属性质变）', page: 'role', kind: 'safe', cost: '耗大量修为', apply: p => { p.realmLevel = (p.realmLevel || 1) + 1; p.baseHp += B.breakthrough.hpGain; p.baseAtk += B.breakthrough.atkGain; p.baseDef += B.breakthrough.defGain; return true; } }
    ];
}

// 天机三策（第五阶段·F）：把候选改动按 稳/险/绕 归类，各取「模拟胜算增益最高」者，缺则给静态对症策。
//   返回 [{ id, name, desc, estimatedGain(可空), cost, page }]，每策都标代价。
function buildPlans(player, enemy, env, baseWin) {
    const T = BALANCE.tianji;
    const sims = [];
    for (const c of buildTianjiCandidates()) {
        let clone;
        try { clone = JSON.parse(JSON.stringify(player)); } catch (e) { continue; }
        let changed = false;
        try { changed = c.apply(clone); } catch (e) { changed = false; }
        if (!changed) continue;
        ensureLoadout(clone);
        const w = estimateWinRateVs(clone, enemy, env, T.samples);
        if (w == null) continue;
        sims.push(Object.assign({}, c, { gain: Math.round((w - baseWin) * 100) }));
    }
    const best = kind => sims.filter(s => s.kind === kind).sort((a, b) => b.gain - a.gain)[0] || null;
    const mk = (id, name, cand, fb) => cand
        ? { id, name, desc: cand.text, estimatedGain: cand.gain, cost: cand.cost || '—', page: cand.page }
        : fb;
    return [
        mk('safe', '稳策', best('safe'),
            { id: 'safe', name: '稳策', desc: '强化主战装备 + 炼根骨丹（聚元/玄龟），或破境——稳健提升、风险最低。', estimatedGain: null, cost: '锭+碎银/修为', page: 'enhance' }),
        mk('risky', '险策', best('risky'),
            { id: 'risky', name: '险策', desc: '参禁忌（血河/燃寿）博爆发，或精英/Boss 前「炉心过载」硬破——高收益、有反噬。', estimatedGain: null, cost: '气血/材料·有代价', page: 'kungfu' }),
        { id: 'detour', name: '绕策', desc: '做药王谷/铸剑山庄委托换补给（换聚元丹补血、换锭强化），或回低关刷资源、生产备料——绕开硬刚。', estimatedGain: null, cost: '时间·生产产能', page: 'orders' }
    ];
}

// 模拟对比给建议（每条带真实「胜算 +X%」）。末尾恒附对症静态建议(含委托/因果来源)，确保总有可执行的下一步。
function suggestImprovements(player, enemy, env, baseWin, cause) {
    const T = BALANCE.tianji;
    const sim = [];
    for (const c of buildTianjiCandidates()) {
        let clone;
        try { clone = JSON.parse(JSON.stringify(player)); } catch (e) { continue; }
        let changed = false;
        try { changed = c.apply(clone); } catch (e) { changed = false; }
        if (!changed) continue;
        ensureLoadout(clone);
        const w = estimateWinRateVs(clone, enemy, env, T.samples);
        if (w == null) continue;
        const gain = Math.round((w - baseWin) * 100);
        if (gain >= 2) sim.push({ text: c.text, gain, page: c.page });
    }
    sim.sort((a, b) => b.gain - a.gain);
    const picked = sim.slice(0, Math.max(1, T.suggestCap - 2));
    const fix = (cause.key === 'attack' || cause.key === 'regen')
        ? '强化兵刃·升攻击系秘籍(真卷/杀诀)·提暴击；再生之敌须速杀'
        : (cause.key === 'none' ? '战力充裕，可放心推进或挑战更高关卡'
            : '强化防具/法宝·炼聚元丹(气血)·玄龟丹(防御)，或转体修');
    picked.push({ text: fix, gain: null, page: 'enhance' });
    picked.push({ text: '善用「江湖委托」：药王谷换聚元丹补血、铸剑山庄换锭强化', gain: null, page: 'orders' });
    return picked;
}

// 天机推演入口（纯函数）：分析当前(或指定)百关关卡的 胜算/平均回合/失败主因/建议。无目标返回 {ok:false}。
export function analyzeChallenge(player, mapId) {
    if (!player || typeof player !== 'object') return { ok: false, reason: 'no_target' };
    const T = BALANCE.tianji;
    const id = Math.max(1, Math.min(MAP_NAMES.length, mapId || player.currentMapId || ((player.maxMapCleared || 0) + 1)));
    let enemy, env, name;
    try { enemy = finalizeEnemyStats(id); env = resolveMapEnv(id, player); name = `第 ${id} 关 · ${MAP_NAMES[id - 1] || '神秘禁区'}`; }
    catch (e) { return { ok: false, reason: 'no_target' }; }
    const st = sampleBattleStats(player, enemy, env, T.samples);
    if (!st) return { ok: false, reason: 'no_target' };
    const diag = diagnoseCombat(player, enemy, env, T.samples);
    const cause = classifyChallengeCause(st, enemy, env, diag);
    const suggestions = suggestImprovements(player, enemy, env, st.winRate, cause);
    const plans = buildPlans(player, enemy, env, st.winRate);   // 第五阶段·F 天机三策
    return {
        ok: true, targetName: name, mapId: id,
        winRate: st.winRate, avgRounds: st.avgRounds, danger: diag.danger,
        cause: cause.key, causeText: cause.text, suggestions, plans
    };
}

// ============================================================
// 第五阶段·Boss 招式速览（天机识别 Boss 威胁 + 玩家当前构筑能否破招）。纯只读，无招式牌返回 null。
// 供轮回页 Boss 节点卡 / 战前面板展示「招式·威胁·可破招方式（高亮玩家能否破）」。
// ============================================================
export function describeBossMoves(player, regionId) {
    const set = getBossMoveSet(regionId);
    if (!set) return null;
    let stats = {};
    try { stats = computeStats(player).stats || {}; } catch (e) { stats = {}; }
    const build = stats.build || {};
    const karma = (player && player.run && player.run.karma) || 0;
    const can = b => canBreakWithBuild(b, build, stats, karma);
    return {
        bossName: set.bossName,
        moves: (set.moves || []).map(m => ({
            id: m.id, name: m.name, telegraph: m.telegraph || '', trigger: m.trigger || {},
            threat: bossMoveThreatText(m.effect, m.trigger),
            breaks: (m.breakBy || []).map(b => ({ text: b.text, can: can(b) })),
            breakable: (m.breakBy || []).some(can)
        }))
    };
}
// 玩家当前构筑能否满足某破招条件（机制类看 enabled，属性/因果/特权看实值）。
function canBreakWithBuild(b, build, stats, karma) {
    if (!b) return false;
    switch (b.type) {
        case 'swordForce':      return !!(build.sword && build.sword.enabled);
        case 'poisonStacks':    return !!(build.poison && build.poison.enabled);
        case 'guardStacks':     return !!(build.guard && build.guard.enabled);
        case 'afterimage':      return !!(build.dodge && build.dodge.enabled);
        case 'overcharge':      return !!(build.forge && build.forge.enabled);
        case 'critRate':        return (stats.crit || 0) >= b.value;
        case 'dodgeRate':       return (stats.dodge || 0) >= b.value;
        case 'damageThisRound': return true; // 速杀向，凭爆发尝试
        case 'karmaLow':        return (karma || 0) <= b.value;
        case 'factionPerk':     return (build.factionPerks || []).includes(b.value);
        default:                return false;
    }
}
// ============================================================
// 第五阶段·F 构筑摘要（analyzeBuild）：据当前 stats.build 给「主构筑/已启用机制/强项/弱点/可破 Boss 招/缺件」。
// 纯只读，供「秘籍装配」页的构筑摘要面板。无构筑时给出「未成形 + 如何激活」的指引。
// ============================================================
export function analyzeBuild(player) {
    let stats = {};
    try { stats = computeStats(player).stats || {}; } catch (e) { stats = {}; }
    const build = stats.build || {};
    const keys = ['sword', 'poison', 'guard', 'dodge', 'forge'];
    const enabled = keys.filter(k => build[k] && build[k].enabled);
    const primary = (build.primary && build.primary !== 'none' && build.primary !== 'mixed') ? build.primary : (enabled[0] || 'none');
    const arche = BUILD_ARCHETYPES[primary] || null;
    const strengths = [], weaknesses = [], bossCounters = [];
    enabled.forEach(k => { const a = BUILD_ARCHETYPES[k]; if (a) { strengths.push(...a.strengths); bossCounters.push(...a.counters); } });
    if (arche) weaknesses.push(...arche.weaknesses);
    // 缺件：机制启用但触发条件不足 / 完全无构筑。
    const missing = [];
    if (!enabled.length) missing.push('未启用任何构筑机制：选一门修行流派，或装配心法/禁忌，激活 剑势/毒蚀/守势/影步/炉心 之一');
    if (build.sword && build.sword.enabled && (stats.crit || 0) < 15) missing.push('剑势靠暴击攒势：补暴击装/锐金丹/真卷秘籍');
    if (build.dodge && build.dodge.enabled && (stats.dodge || 0) < 15) missing.push('影步靠闪避攒残影：补闪避装/轻灵丹');
    if (build.poison && build.poison.enabled && !((stats.bleedPct || 0) > 0 || stats.poison)) missing.push('毒蚀缺持续毒源：配流血词条/蚀骨毒经/转毒修');
    if (build.guard && build.guard.enabled && (stats.def || 0) < 1) missing.push('守势宜配厚血高防：强化防具/法宝');
    if (build.forge && build.forge.enabled) missing.push('炉心需战前过载方显威：精英/Boss 前备好锭与碎银');
    if (enabled.length >= 3) weaknesses.push('多线构筑：单项触发频率被摊薄，不如专精');
    return {
        primaryArchetype: primary,
        primaryName: arche ? arche.name : '尚未成形',
        primaryIcon: arche ? arche.icon : '○',
        enabledMechanics: enabled.map(k => (BUILD_TAGS[k] ? `${BUILD_TAGS[k].icon}${BUILD_TAGS[k].name}` : k)),
        strengths: [...new Set(strengths)],
        weaknesses: [...new Set(weaknesses)],
        bossCounters: [...new Set(bossCounters)],
        missingPieces: missing
    };
}

function bossMoveThreatText(ef, tr) {
    ef = ef || {}; tr = tr || {};
    const when = Number.isFinite(tr.every) ? `每 ${tr.every} 回合` : (Number.isFinite(tr.hpBelow) ? `残血<${tr.hpBelow}%` : '');
    const parts = [];
    if (ef.chargeMult) parts.push(`蓄力重击 ×${ef.chargeMult}`);
    if (ef.atkBuff) parts.push(`狂怒 攻×${ef.atkBuff}`);
    if (ef.heal) parts.push(`回血 ${Math.round(ef.heal * 100)}%`);
    if (ef.lifesteal) parts.push(`命中吸血 ${Math.round(ef.lifesteal * 100)}%`);
    if (ef.unavoidable) parts.push('无可闪避');
    if (ef.poisonResist != null) parts.push('毒抗');
    return (when ? when + '：' : '') + (parts.join('·') || '强力一击');
}

// —— 生产页「下一解锁」：当前等级 / 距下一级经验 / 下一个解锁动作 / 当前活动产出（按 prof）——
function activityOutputText(a) {
    if (!a) return '';
    if (a.outputs) return Object.entries(a.outputs).map(([k, n]) => `${MATERIALS[k] ? MATERIALS[k].name : k}×${n}`).join('、');
    if (a.craftItem) return '随机神兵→行囊';
    return '';
}
export function getNextUnlock(player, prof) {
    const exp = (player.professions && player.professions[prof]) ? (player.professions[prof].exp || 0) : 0;
    const lv = levelFromExp(exp);
    const max = BALANCE.idle.maxLevel;
    const curBase = expForLevel(lv), nextBase = expForLevel(lv + 1);
    const acts = ACTIVITIES.filter(a => a.prof === prof);
    const next = acts.filter(a => a.levelReq > lv).sort((a, b) => a.levelReq - b.levelReq)[0] || null;
    const curAct = player.activity ? acts.find(a => a.id === player.activity) || null : null; // 仅当全局活动属于本技能才显示
    return {
        level: lv, atMax: lv >= max,
        expInLevel: Math.max(0, exp - curBase), expSpan: Math.max(1, nextBase - curBase),
        toNext: lv >= max ? 0 : Math.max(0, nextBase - exp),
        nextUnlock: next ? { name: next.name, levelReq: next.levelReq, output: activityOutputText(next) } : null,
        current: curAct ? { name: curAct.name, output: activityOutputText(curAct) } : null
    };
}

// —— 材料「去哪获得」指引：打造/强化「材料缺口」提示用（按 key 前缀派生，复用 GEAR_TIERS 的 矿↔锭 对应）——
export function materialSourceHint(key) {
    if (!key) return '';
    if (key.startsWith('ore_')) return '去「采矿」开采';
    if (key.startsWith('ingot_')) {
        const tier = GEAR_TIERS.find(t => t.ingot === key);
        const ore = tier && MATERIALS[tier.ore] ? MATERIALS[tier.ore].name : '对应矿石';
        return `去「采矿」挖${ore}、再「锻造」熔炼`;
    }
    if (key.startsWith('herb_')) return '去「采药」采集';
    if (key === 'soul_crystal') return '去「秘境」击败 Boss';
    return '去生产页获取';
}

// —— 生产技能经验曲线（纯函数）——
// 到达 level 级所需的「累计」经验（level=1 时为 0）。曲线参数集中在 BALANCE.idle。
export function expForLevel(level) {
    const { expC, expP } = BALANCE.idle;
    return Math.floor(expC * Math.pow(Math.max(0, level - 1), expP));
}
// 给定累计经验，反推当前等级（封顶 BALANCE.idle.maxLevel）。
export function levelFromExp(exp) {
    const max = BALANCE.idle.maxLevel;
    let lv = 1;
    while (lv < max && exp >= expForLevel(lv + 1)) lv++;
    return lv;
}

// —— 生产效率（随技能等级提升）：练级本身=提效途径，不只是解锁高档 ——
// 提速：等级越高单次读条越短(封顶)；增产：等级越高越大概率「本次产出翻倍」。
export function idleSpeedFactor(level) {
    return 1 - Math.min(BALANCE.idle.speedCap, BALANCE.idle.speedPerLevel * (level - 1));
}
export function effDurationMs(durationMs, level) {
    return Math.max(500, Math.round(durationMs * idleSpeedFactor(level))); // 不低于 0.5s
}
export function bonusYieldChance(level) {
    return Math.min(BALANCE.idle.yieldCap, BALANCE.idle.yieldPerLevel * (level - 1));
}

// —— 神兵强化下一级花费（纯函数）。返回 {targetLevel, ingotKey, ingotQty, coin}；已满级返回 null。——
// 目标级越高 → 跨到越高级的锭(levelsPerTier 一档)，逼着玩家往深矿挖；碎银随目标级与品阶上扬。
export function enhanceCost(item) {
    const E = BALANCE.enhance;
    const target = (item.enhance || 0) + 1;
    if (target > E.maxLevel) return null;
    const tierIdx = Math.min(E.ingotTiers.length - 1, Math.floor((target - 1) / E.levelsPerTier));
    return {
        targetLevel: target,
        ingotKey: E.ingotTiers[tierIdx],
        ingotQty: target,
        coin: target * E.coinPerLevel * (1 + (item.quality || 0))
    };
}

// ============================================================
// 修行流派：取派 / 解锁判定 / 切换花费 / 数值归一化(mods)。纯逻辑——computeStats 与 simulateBattle 据此接入。
// ============================================================
export function getPathById(id) {
    return CULTIVATION_PATHS.find(p => p.id === id) || null;
}
export function getActivePath(player) {
    return player ? getPathById(player.cultivationPath) : null;
}
export function isPathUnlocked(player, path) {
    return (player.realmLevel || 1) >= (path.unlockRealmLevel || 1);
}
// 下一次「改换门庭」的碎银花费（首次择道免费 → 返回 null）。已切换次数越多越贵（几何递增，取整到千）。
export function pathSwitchCost(player) {
    if (!player.cultivationPath) return null; // 首次择道免费
    const P = BALANCE.path;
    const n = Math.max(0, player.pathSwitchCount || 0);
    const raw = P.switchCoinBase * Math.pow(P.switchCoinGrowth, n);
    return { coin: Math.max(P.switchCoinBase, Math.round(raw / 1000) * 1000) };
}
// 把当前流派归一化成引擎可读数值（无派/缺字段 → 全零默认；computeStats/simulateBattle 据此恒等于「未择道」原行为）。
export function pathModifiers(player) {
    const def = { mult: {}, flat: {}, gearStatMult: 0, subweaponMult: 0, enhanceMult: 0, skillMult: 0, craftQualityBonus: 0, poison: null };
    const path = getActivePath(player);
    if (!path || !path.mods) return def;
    const m = path.mods;
    return {
        mult: m.mult || {}, flat: m.flat || {},
        gearStatMult: m.gearStatMult || 0, subweaponMult: m.subweaponMult || 0,
        enhanceMult: m.enhanceMult || 0, skillMult: m.skillMult || 0,
        craftQualityBonus: m.craftQualityBonus || 0, poison: m.poison || null
    };
}

// ============================================================
// 第四阶段·秘籍装配（loadout）：拥有 ≠ 携带。
//   active/passives 引用「已拥有 skills 的 id」；heart/forbidden 引用「内置图鉴 id」(config/manuals.js)。
//   洪荒功法(isHongHuang)恒生效、不占槽。纯逻辑：computeStats 据此过滤生效、simulateBattle 据此取主动技池。
// ============================================================
// 某门「已拥有秘籍」归属的装配槽类型：主动→active；洪荒→honghuang(恒生效·不入槽)；其余被动→passive。
export function skillSlotKind(sk) {
    if (!sk) return null;
    if (sk.isHongHuang) return 'honghuang';
    return sk.type === 'active' ? 'active' : 'passive';
}

// 被动秘籍「装配价值」粗评分（自动配招/排序用）：五维数值 + 战斗词条点数，× 重数。
function passiveSkillScore(sk) {
    if (!sk) return 0;
    let s = 0;
    ['hp', 'atk', 'def'].forEach(k => { if (sk[k]) s += Math.abs(sk[k]); });
    ['crit', 'dodge', 'dropRate', 'coinRate'].forEach(k => { if (sk[k]) s += Math.abs(sk[k]) * 8; });
    COMBAT_AFFIX_KEYS.forEach(k => { if (sk[k]) s += Math.abs(sk[k]) * 6; });
    return s * (sk.level || 1);
}

// 校验/补全 loadout（幂等）：清理悬空/越类 id；旧档若 active/passives 全空而已有可装秘籍 →
// 自动配「最强主动 1 + 最强被动 3」，避免老玩家骤弱。心法/禁忌默认留空（让玩家主动取舍）。洪荒恒生效、不进槽。
export function ensureLoadout(player) {
    if (!player || typeof player !== 'object') return null;
    let lo = player.loadout;
    if (!lo || typeof lo !== 'object') lo = player.loadout = { active: null, passives: [], heart: null, forbidden: null };
    if (typeof lo.active !== 'string') lo.active = null;
    if (!Array.isArray(lo.passives)) lo.passives = [];
    if (typeof lo.heart !== 'string') lo.heart = null;
    if (typeof lo.forbidden !== 'string') lo.forbidden = null;

    const skills = Array.isArray(player.skills) ? player.skills : [];
    const byId = new Map(skills.map(s => [s && s.id, s]));
    const L = BALANCE.loadout;

    // 清理悬空 / 越类 id
    if (lo.active && (!byId.has(lo.active) || skillSlotKind(byId.get(lo.active)) !== 'active')) lo.active = null;
    const seen = new Set();
    lo.passives = lo.passives.filter(id => {
        const sk = byId.get(id);
        if (!sk || skillSlotKind(sk) !== 'passive' || seen.has(id)) return false;
        seen.add(id); return true;
    }).slice(0, L.passiveSlots);
    if (lo.heart && !HEART_ART_MAP[lo.heart]) lo.heart = null;
    if (lo.forbidden && !FORBIDDEN_ART_MAP[lo.forbidden]) lo.forbidden = null;

    // 自动配招（仅在「该类槽全空」时；不抢占玩家已有选择）
    if (!lo.active) {
        const actives = skills.filter(s => skillSlotKind(s) === 'active');
        if (actives.length) {
            const sc = BALANCE.battle.activeLevelScale;
            actives.sort((a, b) => ((b.power || 1) + (b.level || 1) * sc) - ((a.power || 1) + (a.level || 1) * sc));
            lo.active = actives[0].id;
        }
    }
    if (!lo.passives.length) {
        const passives = skills.filter(s => skillSlotKind(s) === 'passive');
        passives.sort((a, b) => passiveSkillScore(b) - passiveSkillScore(a));
        lo.passives = passives.slice(0, L.passiveSlots).map(s => s.id);
    }
    return lo;
}

// 「携带进战斗」的 skills 子集（active 槽 + passives 槽 + 恒生效的洪荒）。
//   无 loadout（dev 模拟器手搓的 player / 未经 normalize 的对象）→ 回退全量 skills，向后兼容、不破坏平衡基线。
export function getCombatSkills(player) {
    if (!player || !Array.isArray(player.skills)) return [];
    const lo = player.loadout;
    if (!lo || typeof lo !== 'object') return player.skills; // 兼容：无装配信息时全量生效（dev sim / 旧逻辑）
    const ids = new Set();
    if (lo.active) ids.add(lo.active);
    if (Array.isArray(lo.passives)) lo.passives.forEach(id => ids.add(id));
    return player.skills.filter(sk => sk && (ids.has(sk.id) || sk.isHongHuang)); // 洪荒恒生效
}

// 心法 + 禁忌 的「叠加层修正」聚合（与 pathModifiers 同构，折进 computeStats）。缺省全 0、未装配零影响。
export function loadoutArtModifiers(player) {
    const out = { mult: { hp: 0, atk: 0, def: 0 }, flat: { crit: 0, dodge: 0 }, affix: {} };
    const lo = player && player.loadout;
    if (!lo || typeof lo !== 'object') return out;
    [HEART_ART_MAP[lo.heart], FORBIDDEN_ART_MAP[lo.forbidden]].forEach(art => {
        if (!art || !art.mods) return;
        const m = art.mods;
        if (m.mult) ['hp', 'atk', 'def'].forEach(k => { if (Number.isFinite(m.mult[k])) out.mult[k] += m.mult[k]; });
        if (m.flat) ['crit', 'dodge'].forEach(k => { if (Number.isFinite(m.flat[k])) out.flat[k] += m.flat[k]; });
        if (m.affix) for (const k in m.affix) { if (Number.isFinite(m.affix[k])) out.affix[k] = (out.affix[k] || 0) + m.affix[k]; }
    });
    return out;
}

// ============================================================
// 第五阶段·构筑机制：据「流派 / 心法 / 禁忌 / 装备词条 / 派系特权」判定五机制是否启用，
// 并把阈值/概率/倍率写进 stats.build，供 simulateBattle 的战斗状态引擎读取。
//   ⚠️ 全部 enabled=false（无任何构筑条件）时 → 战斗引擎对其全程跳过 → 与第四阶段战斗一致（旧档/dev sim 零影响）。
// 入参 stats 须为已算好的属性对象（读 bleedPct/poison/dodge 判定启用源）。fb=派系特权战斗修正。
// ============================================================
export function deriveBuild(player, stats, fb) {
    const R = BUILD_RULES;
    const lo = (player && player.loadout && typeof player.loadout === 'object') ? player.loadout : {};
    const path = (player && player.cultivationPath) || null;
    const perkIds = (fb && Array.isArray(fb.perkIds)) ? fb.perkIds : [];
    const hasPerkPrefix = pre => perkIds.some(id => id.indexOf(pre) === 0);

    const swordEnabled  = path === 'sword'   || lo.heart === 'heart_sword'   || hasPerkPrefix('qc_');
    const poisonEnabled = path === 'poison'  || lo.heart === 'heart_poison'  || lo.forbidden === 'forbid_poison' || (stats.bleedPct || 0) > 0 || !!stats.poison || perkIds.includes('yw_antidote');
    const guardEnabled  = path === 'body'    || lo.heart === 'heart_guard';
    const dodgeEnabled  = path === 'agility' || lo.forbidden === 'forbid_void' || (stats.dodge || 0) >= DODGE_ENABLE_DODGE;
    const forgeEnabled  = path === 'artisan' || hasPerkPrefix('zj_');

    // 主构筑（UI/摘要展示用）：优先取与流派一致者，否则取首个启用者。
    const enabledList = [['sword', swordEnabled], ['poison', poisonEnabled], ['guard', guardEnabled], ['dodge', dodgeEnabled], ['forge', forgeEnabled]].filter(e => e[1]).map(e => e[0]);
    const pathToBuild = { sword: 'sword', poison: 'poison', body: 'guard', agility: 'dodge', artisan: 'forge' };
    let primary = pathToBuild[path] && enabledList.includes(pathToBuild[path]) ? pathToBuild[path] : (enabledList[0] || 'none');
    if (enabledList.length > 1 && primary === 'none') primary = 'mixed';

    return {
        sword: { enabled: swordEnabled, threshold: R.sword.threshold, forceOnCrit: R.sword.forceOnCrit, forceOnActive: R.sword.forceOnActive,
                 breakDmgMult: R.sword.breakDmgMult, breakArmorPen: Math.min(0.95, R.sword.breakArmorPen + (fb ? fb.swordBreakArmor : 0)),
                 executeLowPct: R.sword.executeLowPct, executeMult: R.sword.executeMult,
                 forceChance: fb ? fb.swordForceChance : 0, refundOnBossBreak: fb ? fb.swordRefundOnBreak : 0 },
        poison: { enabled: poisonEnabled, threshold: R.poison.threshold, maxStacks: R.poison.maxStacks, maxHpPct: R.poison.maxHpPct,
                  bossEff: R.poison.bossEff, regenBonus: R.poison.regenBonus, lifesteal: fb ? fb.poisonLifesteal : 0 },
        guard: { enabled: guardEnabled, threshold: R.guard.threshold,
                 gainPerHit: R.guard.gainPerHit + (path === 'body' ? 1 : 0) + (lo.heart === 'heart_guard' ? 1 : 0),
                 absorbPct: R.guard.absorbPct, counterPct: R.guard.counterPct, bigHitPct: R.guard.bigHitPct },
        dodge: { enabled: dodgeEnabled, threshold: R.dodge.threshold, followAtkPct: R.dodge.followAtkPct, maxStacks: R.dodge.maxStacks },
        forge: { enabled: forgeEnabled, dmgBonusPct: R.forge.dmgBonusPct + (fb ? fb.overchargePowerBonus : 0),
                 dmgReductionPct: R.forge.dmgReductionPct + (fb ? fb.overchargeReductionBonus : 0),
                 costIngot: R.forge.costIngot, costCoin: Math.max(0, Math.round(R.forge.costCoin * (1 + (fb ? fb.overchargeCostMult : 0)))), perLifeCap: R.forge.perLifeCap },
        factionPerks: perkIds,
        primary
    };
}

// —— 由 player 派生当前战斗属性。纯函数：返回 {stats, honghuangPower} ——
export function computeStats(player) {
    const rebornMult = 1 + player.rebornCount * BALANCE.rebornMultPerCount;

    // —— 修行流派数值（无派时全为零默认 → 下面各项恒等于原行为，旧档/未择道零影响）——
    const M = pathModifiers(player);
    const pm = M.mult, pf = M.flat;
    // —— 第四阶段·秘籍装配：仅「携带」的秘籍生效（getCombatSkills）；心法/禁忌折成叠加层 art（缺省零影响）——
    const combatSkills = getCombatSkills(player);
    const art = loadoutArtModifiers(player);
    const skillM = 1 + M.skillMult / 100;     // 器修代价：被动秘籍五维收益 ×(1+skillMult%)
    const gearM = 1 + M.gearStatMult / 100;   // 器修：装备基础属性贡献 ×(1+gearStatMult%)
    const subM = 1 + M.subweaponMult / 100;   // 毒修：暗器(subweapon)贡献 ×(1+subweaponMult%)
    const enhBoost = 1 + M.enhanceMult / 100; // 器修：强化收益放大 ×(1+enhanceMult%)

    // —— 永久成就奖励（已领取成就的 perm 加成，集中读取叠乘；未领取/无 perm 为 ×1，不写回基础属性 → 不重复叠加）——
    const AB = achievementBonuses(player);
    const abMul = k => 1 + ((AB.all || 0) + (AB[k] || 0)) / 100;

    // 丹药永久增益(pillBonus)与基础值同层：攻防血吃轮回乘区(根骨厚→修炼放大)，暴击/闪避同 base 不乘
    const pill = player.pillBonus || {};
    // 本世临时属性（tempBonus）：事件 stats 效果，不吃轮回乘区（临时机缘，非永久根骨），轮回后清零
    const tmp = (player.run && player.run.tempBonus) || {};
    let calcHp = Math.floor((player.baseHp + (pill.hp || 0)) * rebornMult) + (tmp.hp || 0);
    let calcAtk = Math.floor((player.baseAtk + (pill.atk || 0)) * rebornMult) + (tmp.atk || 0);
    let calcDef = Math.floor((player.baseDef + (pill.def || 0)) * rebornMult) + (tmp.def || 0);
    let calcCrit = player.baseCrit + (pill.crit || 0) + (tmp.crit || 0);
    let calcDodge = player.baseDodge + (pill.dodge || 0) + (tmp.dodge || 0);

    combatSkills.forEach(sk => {
        if (sk.type === 'passive') {
            // 器修代价：被动秘籍五维收益 ×skillM（无派 skillM=1 → 原值）。攻防血取整保持整数。
            if (sk.hp) calcHp += Math.floor(sk.hp * sk.level * skillM);
            if (sk.atk) calcAtk += Math.floor(sk.atk * sk.level * skillM);
            if (sk.def) calcDef += Math.floor(sk.def * sk.level * skillM);
            if (sk.dodge) calcDodge += (sk.dodge * sk.level * skillM);
            if (sk.crit) calcCrit += (sk.crit * sk.level * skillM);
        }
    });

    for (const slot in player.equips) {
        const eq = player.equips[slot];
        if (eq) {
            // 强化(enhance)只放大攻/防/血等主属性，不碰暴击/闪避(%)，避免闪避被堆爆。
            // 器修：enhBoost 放大强化收益、gearM 抬装备基础属性；毒修：暗器(subweapon)额外 ×subM。（无派均为 ×1，结果不变）
            const em = 1 + (eq.enhance || 0) * BALANCE.enhance.perLevel * enhBoost;
            const slotMult = gearM * (slot === 'subweapon' ? subM : 1);
            if (eq.atk) calcAtk += Math.floor(eq.atk * em * slotMult);
            if (eq.def) calcDef += Math.floor(eq.def * em * slotMult);
            if (eq.hp) calcHp += Math.floor(eq.hp * em * slotMult);
            if (eq.crit) calcCrit += eq.crit;
            if (eq.dodge) calcDodge += eq.dodge;
        }
    }

    // 属性计算顺序（勿随意调换）：
    //   1) 基础值 + 被动技能 + 装备(已逐件按强化 em 放大攻/防/血) 求和 → calcHp/Atk/Def
    //   2) 整体再乘洪荒倍率 hhMultiplier
    // 即：强化是「装备层」的放大，洪荒是「全身」的乘区——强化溢价也会被洪荒进一步放大，系有意设计。
    // 洪荒之力 = 洪荒功法的当前等级
    let honghuangPower = 0;
    player.skills.forEach(sk => { if (sk.isHongHuang) honghuangPower = sk.level; });
    const hhMultiplier = 1 + (honghuangPower * BALANCE.honghuangMultPerLevel);

    // 流派 + 心法/禁忌 固定值：暴击/闪避「百分点」加成（与 pill/被动同层，pre-洪荒；无派/未装配为 0）。
    calcCrit += (pf.crit || 0) + art.flat.crit;
    calcDodge += (pf.dodge || 0) + art.flat.dodge;

    // 流派百分比乘区：五维均 ×(1+mult%)，与洪荒同层叠乘（无派/未配该项为 ×1，恒等于原行为）。
    // 五维一致支持 mult（虽现有 5 派只对 暴击/闪避 用 flat 点数加成，但 mult.crit/mult.dodge 也生效，避免将来配置静默失效）。
    // 暴击/闪避最终钳到 ≥0，防代价把数值压成负；闪避另有 dodgeCap 硬上限。
    // 叠乘顺序：基础+被动+装备 → 洪荒 → 流派mult → 永久成就(abMul)。各层独立、缺省 ×1。
    const stats = {
        hp: Math.floor(calcHp * hhMultiplier * (1 + (pm.hp || 0) / 100) * (1 + art.mult.hp / 100) * abMul('hp')),
        atk: Math.floor(calcAtk * hhMultiplier * (1 + (pm.atk || 0) / 100) * (1 + art.mult.atk / 100) * abMul('atk')),
        def: Math.floor(calcDef * hhMultiplier * (1 + (pm.def || 0) / 100) * (1 + art.mult.def / 100) * abMul('def')),
        crit: parseFloat(Math.max(0, calcCrit * hhMultiplier * (1 + (pm.crit || 0) / 100) * abMul('crit')).toFixed(1)),
        dodge: parseFloat(Math.max(0, Math.min(BALANCE.dodgeCap, calcDodge * hhMultiplier * (1 + (pm.dodge || 0) / 100) * abMul('dodge'))).toFixed(1)),
        dropRate: 100,
        coinRate: 100
    };

    // —— 命格 / 轮回遗产 修正（百世轮回）——
    // 在洪荒乘区之后再叠一层「本世命格 + 永久遗产」的乘区/加点；旧档/未入轮回者修正为恒等，零影响。
    const mods = getModifiers(player);
    stats.hp = Math.max(1, Math.floor(stats.hp * mods.hpMult));
    stats.atk = Math.max(1, Math.floor(stats.atk * mods.atkMult));
    stats.def = Math.max(0, Math.floor(stats.def * mods.defMult));
    stats.crit = parseFloat((stats.crit + mods.critAdd).toFixed(1));
    stats.dodge = parseFloat(Math.max(0, Math.min(BALANCE.dodgeCap, stats.dodge + mods.dodgeAdd)).toFixed(1));

    combatSkills.forEach(sk => {
        if (sk.type === 'passive') {
            if (sk.dropRate) stats.dropRate += (sk.dropRate * sk.level);
            if (sk.coinRate) stats.coinRate += (sk.coinRate * sk.level);
        }
    });
    // 永久成就：掉宝/财运为加法百分点（与上面被动同层）。
    stats.dropRate += AB.dropRate || 0;
    stats.coinRate += AB.coinRate || 0;

    // —— 词条战斗 mod 聚合（暗黑式 affix）——
    // 纯百分比，按「字段值 × 重数」线性叠加；不吃轮回/洪荒乘区（它们已是相对值，再乘会失控）。
    // 缺省全为 0 → 旧档/无词条玩家对战斗零影响。各 cap 在 simulateBattle 里收口。
    COMBAT_AFFIX_KEYS.forEach(k => { stats[k] = 0; });
    combatSkills.forEach(sk => {
        if (sk.type === 'passive') {
            COMBAT_AFFIX_KEYS.forEach(k => { if (sk[k]) stats[k] += (sk[k] * sk.level); });
        }
    });
    // 流派词条加成（剑修暴伤 / 体修反震 / 身法先发 等）——叠加进对应词条池。
    COMBAT_AFFIX_KEYS.forEach(k => { if (pf[k]) stats[k] += pf[k]; });
    // 心法/禁忌 词条加成（与秘籍/流派词条同字段累加；未装配 art.affix 为空 → 零影响）。
    COMBAT_AFFIX_KEYS.forEach(k => { if (art.affix[k]) stats[k] += art.affix[k]; });
    // 毒修：把中毒参数随属性带入战斗（无派/非毒修为 null → simulateBattle 不触发中毒、零影响）。
    stats.poison = M.poison;
    // —— 第二阶段·本世奇珍/感悟 的「战斗词条增量」叠加（缺省 0；与秘籍词条/流派词条同字段累加，不影响旧档）——
    stats.dmgReduction += mods.dmgReductionAdd || 0;
    stats.regenPct += mods.regenAdd || 0;
    stats.thornsPct += mods.thornsAdd || 0;
    stats.lifestealPct += mods.lifestealAdd || 0;

    // —— 第五阶段·派系特权（战斗向）+ 构筑机制派生 ——
    const fb = factionBuildModifiers(player);
    // 黑市「禁卷研习」：携带禁忌秘籍时增伤（risk 特权，folded 进增伤池；无特权/无禁忌为 0）。
    const lo = (player.loadout && typeof player.loadout === 'object') ? player.loadout : {};
    if (lo.forbidden && fb.forbiddenDmgBonus) stats.dmgBonus += fb.forbiddenDmgBonus;
    // 构筑机制开关 + 参数（缺省全禁用 → 战斗引擎跳过 → 旧战斗原样）。
    stats.build = deriveBuild(player, stats, fb);

    return { stats, honghuangPower };
}

// ============================================================
// 地图词缀（关卡特性）：分配 / 战斗环境解析 / 奖励修正。纯逻辑·确定性（按关卡号，无随机、无副作用）。
// ============================================================
const DEFAULT_MAP_MOD = MAP_MODIFIERS.find(m => m.id === 'wildland') || MAP_MODIFIERS[0];
export function getMapModifierById(id) { return MAP_MODIFIERS.find(m => m.id === id) || null; }

// 关卡词缀分配（确定性·可解释·配置化）：前 earlySafeStages 关与非里程碑关均为荒原；
// 里程碑关（milestoneEvery 的倍数）按「非默认词缀顺序」轮转；未达 unlockFromMapLevel 则回落荒原（早关更温和）。
// 里程碑里再每 eliteEvery 关为「精英」（词缀强度 ×eliteIntensity）。返回 { mod, intensity, isElite }。
export function getMapModifier(mapLevel) {
    const MM = BALANCE.mapMod;
    const lv = Math.max(1, Math.floor(mapLevel || 1));
    if (lv <= MM.earlySafeStages || lv % MM.milestoneEvery !== 0) return { mod: DEFAULT_MAP_MOD, intensity: 1, isElite: false };
    const pool = MAP_MODIFIERS.filter(m => m.id !== DEFAULT_MAP_MOD.id);
    let mod = pool.length ? pool[((lv / MM.milestoneEvery) - 1) % pool.length] : DEFAULT_MAP_MOD;
    if (!mod || lv < (mod.unlockFromMapLevel || 1)) mod = DEFAULT_MAP_MOD; // 未解锁 → 回落荒原
    const isElite = (lv % MM.eliteEvery === 0) && mod.id !== DEFAULT_MAP_MOD.id;
    return { mod, intensity: isElite ? MM.eliteIntensity : 1, isElite };
}

// 把关卡词缀解析为 simulateBattle 可读的「战斗环境」对象（各项已按 BALANCE.mapMod 封顶；含流派抗性）。
// 无战斗效果（荒原/灵脉/秘境）→ 返回 null，对战斗零影响。player 用于流派联动（如毒修抗毒瘴）。
export function resolveMapEnv(mapLevel, player) {
    const { mod, intensity } = getMapModifier(mapLevel);
    const c = mod && mod.combat ? mod.combat : null;
    if (!c) return null;
    const MM = BALANCE.mapMod;
    const path = player ? player.cultivationPath : null;
    const env = { label: c.envLabel || mod.name, modName: mod.name };
    let any = false;
    if (c.enemyCritChance) { env.enemyCritChance = Math.min(MM.enemyCritCap, c.enemyCritChance * intensity); env.enemyCritMult = c.enemyCritMult || 1.5; any = true; }
    if (c.dodgeReduction) { env.dodgeReduction = Math.min(MM.dodgeReductionCap, c.dodgeReduction * intensity); any = true; }
    if (c.healMult != null) { env.healMult = Math.max(MM.healMultFloor, 1 - (1 - c.healMult) * intensity); any = true; }
    if (c.envDmgPctMaxHp) {
        let pct = c.envDmgPctMaxHp * intensity;
        if (c.resistPath && path === c.resistPath) pct *= (c.resistFactor != null ? c.resistFactor : 1); // 对应流派减伤（毒修抗毒瘴）
        env.envDmgPctMaxHp = Math.min(MM.envDmgPctCap, pct);
        any = true;
    }
    return any ? env : null;
}

// 关卡词缀对「战斗奖励/掉落」的修正（确定性·全部封顶，避免经济爆炸）。返回归一化对象（无修正项 → 中性默认值）。
export function getMapRewardMods(mapLevel) {
    const { mod, intensity } = getMapModifier(mapLevel);
    const r = mod && mod.reward ? mod.reward : {};
    const MM = BALANCE.mapMod;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    return {
        modId: mod ? mod.id : DEFAULT_MAP_MOD.id,
        expMult: r.expMult ? Math.min(MM.expMultCap, 1 + (r.expMult - 1) * intensity) : 1,
        // 与 expMult 同样按 intensity「相对缩放」并 clamp 到允许范围：精英关的掉率倾向(灵脉的少掉)一并加深，保持一致。
        // 注意是相对式 1+(base-1)*intensity（base=0.7→精英0.55），而非 base*intensity（那会把惩罚 0.7×1.5 翻成 1.05 的加成）。
        gearDropMult: r.gearDropMult != null ? clamp(1 + (r.gearDropMult - 1) * intensity, MM.gearDropMultRange[0], MM.gearDropMultRange[1]) : 1,
        weaponBias: r.weaponBias ? Math.min(1, r.weaponBias) : 0,
        herbDropChance: r.herbDropChance ? Math.min(MM.herbDropChanceCap, r.herbDropChance * intensity) : 0,
        skillDropChance: r.skillDropChance ? Math.min(MM.skillDropChanceCap, r.skillDropChance * intensity) : 0
    };
}

// —— 关卡难度 / 敌人属性 ——
export function getMapDifficulty(mapId) {
    return Math.pow(BALANCE.enemy.diffBase, mapId - 1); // 难度逐关 ×diffBase（调缓后堆装备/强化能明显多推关卡）
}

// 关卡所属装备档(1~6)：100 关分 6 段(每段约 17 关)。用于"推荐装备档"里程碑与战斗掉落档位。
// 封顶在「可锻造最高档」——区域只掉可锻造档的矿(T7/T8 神话/仙器无对应矿，仅秘境进阶产出)。
export function mapTier(mapId) {
    return Math.min(MAX_CRAFTABLE_TIER, Math.max(1, Math.ceil(mapId / 17)));
}

export function finalizeEnemyStats(mapId) {
    const diffMult = getMapDifficulty(mapId);
    const { baseHp, baseAtk, baseDef } = BALANCE.enemy;
    return {
        name: `${MAP_NAMES[mapId - 1]}守卫`,
        maxHp: Math.floor(baseHp * diffMult),
        atk: Math.floor(baseAtk * diffMult),
        def: Math.floor(baseDef * diffMult)
    };
}

// —— 秘境 Boss 属性：难度 = getMapDifficulty(mapEquiv) * toughness ——
export function finalizeBossStats(boss) {
    const diff = getMapDifficulty(boss.mapEquiv) * boss.toughness;
    const { baseHp, baseAtk, baseDef } = BALANCE.enemy;
    return {
        name: boss.name,
        maxHp: Math.floor(baseHp * diff),
        atk: Math.floor(baseAtk * diff),
        def: Math.floor(baseDef * diff),
        isBoss: true   // 毒修中毒对 Boss 降效(bossEff)，避免越级磨杀过夸张
    };
}

// —— 随机装备生成 ——
export function generateItemByMatrix(levelFact) {
    const slotKeys = Object.keys(MATRIX_ITEMS);
    const rType = slotKeys[Math.floor(Math.random() * slotKeys.length)];

    const rollQ = Math.random() * 100;
    let quality = 0;
    for (const t of BALANCE.qualityRoll) { if (rollQ > t.min) { quality = t.q; break; } }

    const preIdx = Math.min(ITEM_PREFIXES.length - 1, Math.floor(Math.random() * (quality + 2 + levelFact / 8)));
    const fullName = ITEM_PREFIXES[preIdx] + "·" + MATRIX_ITEMS[rType][Math.floor(Math.random() * MATRIX_ITEMS[rType].length)];
    const mult = (quality + 1) * (1 + (levelFact % 3) * 0.4);

    let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;
    switch (rType) {
        case "weapon": atk = Math.floor(22 * mult); if (quality >= 3) crit = quality * 2; break;
        case "subweapon": atk = Math.floor(12 * mult); if (quality >= 3) crit = Math.floor(quality * 2.5); break;
        case "armor": def = Math.floor(10 * mult); hp = Math.floor(50 * mult); break;
        case "helm": def = Math.floor(6 * mult); hp = Math.floor(40 * mult); break;
        case "ring": hp = Math.floor(80 * mult); if (quality >= 3) dodge = Math.min(75, Math.floor(quality * 1.5)); break;
        case "artifact": atk = Math.floor(10 * mult); def = Math.floor(6 * mult); hp = Math.floor(60 * mult); if (quality >= 4) { crit = quality; dodge = quality; } break;
    }
    return {
        id: "it_" + Date.now() + Math.random(),
        name: fullName, type: rType, quality,
        atk, def, hp, crit, dodge,
        price: Math.floor(BALANCE.itemPrice.base * Math.pow(BALANCE.itemPrice.growth, quality))
    };
}

// —— 品阶(成色)掷骰：按 BALANCE.qualityRoll 从高到低命中，余数为 0(凡品)。打造/黑市进货共用。——
export function rollQuality() {
    const r = Math.random() * 100;
    for (const t of BALANCE.qualityRoll) if (r > t.min) return t.q;
    return 0;
}

// —— 命名套装阶梯：按「档(tier)+部位(slot)」确定属性打造一件装备（梅尔沃式循序渐进的核心）。——
// 属性 = 部位基础 × 档倍率(GEAR_TIERS.power) × 成色(quality 微调)。产出结构与随机装备完全一致(多带 tier 字段)，
// 故背包/穿戴/洪炉/熔炼/tooltip 全部沿用、无需改。强化(item.enhance)再在档内放大攻防血。
export function makeGearPiece(tier, slot, quality = 0) {
    const T = GEAR_TIERS[tier - 1];
    const names = MATRIX_ITEMS[slot];
    if (!T || !names) return null;
    const p = T.power * (1 + quality * BALANCE.gear.qualityStep);
    let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;
    switch (slot) {
        case "weapon":    atk = Math.floor(22 * p); if (tier >= 3) crit = tier * 2; break;
        case "subweapon": atk = Math.floor(12 * p); if (tier >= 3) crit = Math.floor(tier * 2.5); break;
        case "armor":     def = Math.floor(10 * p); hp = Math.floor(50 * p); break;
        case "helm":      def = Math.floor(6 * p);  hp = Math.floor(40 * p); break;
        case "ring":      hp = Math.floor(80 * p);  if (tier >= 3) dodge = Math.min(75, Math.floor(tier * 1.2)); break;
        case "artifact":  atk = Math.floor(10 * p); def = Math.floor(6 * p); hp = Math.floor(60 * p); if (tier >= 4) { crit = tier; dodge = tier; } break;
        // —— 新增部位(按境界解锁，见 GEAR_SLOTS.realmReq) ——
        case "amulet":    hp = Math.floor(30 * p); if (tier >= 2) crit = Math.floor(tier * 3); if (tier >= 4) atk = Math.floor(6 * p); break; // 护符：暴击/血
        case "gloves":    atk = Math.floor(14 * p); if (tier >= 3) crit = Math.floor(tier * 1.8); break;                                    // 护腕：攻击/暴击
        case "boots":     hp = Math.floor(45 * p); def = Math.floor(4 * p); if (tier >= 2) dodge = Math.min(75, Math.floor(tier * 1.5)); break; // 战靴：闪避/血
        default: return null;
    }
    return {
        id: "it_" + Date.now() + Math.random(),
        name: `${T.name}·${names[Math.floor(Math.random() * names.length)]}`,
        type: slot, tier, quality, atk, def, hp, crit, dodge,
        price: Math.floor(BALANCE.itemPrice.base * Math.pow(BALANCE.itemPrice.growth, quality))
    };
}

// ============================================================
// 打造副词条 + 生产建议（随打造系统上线·纯逻辑）。
// ============================================================
export function getCraftAffixById(id) { return CRAFT_AFFIXES.find(a => a.id === id) || null; }

// 给打造出的装备施加副词条（按档 tier 缩放，就地改 piece 并返回）。'none'/'refine' 不改五维（refine 走成色，在 craftGear 处理）。
// 仅改 atk/def/hp/crit/dodge（computeStats 装备层只读这五项），不会引入 NaN；闪避受 75 上限保护。
export function applyCraftAffix(piece, affixId, tier) {
    const a = getCraftAffixById(affixId);
    if (!a || a.id === 'none' || a.id === 'refine' || !piece) return piece;
    const t = tier || piece.tier || 1;
    switch (a.id) {
        case 'sharp': piece.crit = (piece.crit || 0) + Math.round(t * 2 + 4); break;                          // 剑修：暴击
        case 'guard': piece.def = Math.floor((piece.def || 0) * 1.15); piece.hp = Math.floor((piece.hp || 0) * 1.10); break; // 体修：防御+气血
        case 'swift': piece.dodge = Math.min(75, (piece.dodge || 0) + Math.round(t * 1.5 + 2)); break;        // 身法：闪避
        case 'venom': piece.atk = Math.floor((piece.atk || 0) * 1.08); piece.crit = (piece.crit || 0) + Math.round(t * 1.5); break; // 毒修：攻击+暴击
    }
    piece.name = `${a.name}·${piece.name}`; // 名称冠以副词条，便于辨识
    return piece;
}

// 根据当前流派给一句生产/打造建议（UI 展示用）。未择道则提示先确立方向。
export function pathProductionAdvice(player) {
    const id = player ? player.cultivationPath : null;
    switch (id) {
        case 'sword':   return '剑修建议：优先强化高暴击装备，打造「锋锐」兵刃/暗器。';
        case 'body':    return '体修建议：堆气血/防御，打造「坚铠」防具，多采药备突破。';
        case 'agility': return '身法建议：优先闪避装备，打造「轻灵」护符/战靴。';
        case 'poison':  return '毒修建议：多采药炼丹，打造「淬毒」暗器，毒瘴地图如鱼得水。';
        case 'artisan': return '器修建议：多挖矿多强化多打造，「精工」副词条必出高成色。';
        default:        return '尚未择道：先去「修行流派」确立方向，再针对性备料打造。';
    }
}

// 当前境界已解锁的装备部位（按 GEAR_SLOTS.realmReq 过滤）。掉落/打造/装备共用，保证不出现「拿到却装不了」的部位。
export function unlockedGearSlots(realmLevel) {
    return GEAR_SLOTS.filter(s => (realmLevel || 1) >= s.realmReq);
}

// 打造「一件」装备的花费（按档）。返回 {ingotKey, ingotQty, coin} 或 null。
export function gearCraftCost(tier) {
    const T = GEAR_TIERS[tier - 1];
    return T ? { ingotKey: T.ingot, ingotQty: T.ingotQty, coin: T.coin } : null;
}

// 可锻造的最高档(craftable!==false 的数量)。打造/洪炉升档以此封顶，再往上只能靠神兵进阶。
export const MAX_CRAFTABLE_TIER = GEAR_TIERS.filter(t => t.craftable !== false).length;

// —— 神兵进阶花费：仅 T6/T7 档可进阶(T6→T7神话、T7→T8仙器；T8 已满顶，低于 T6 走打造)。吃神魂结晶+碎银。返回 {nextTier,crystal,coin} 或 null。——
export function gearUpgradeCost(item) {
    if (!item || !item.tier) return null;
    if (item.tier < MAX_CRAFTABLE_TIER || item.tier >= GEAR_TIERS.length) return null;
    const next = item.tier + 1;
    const crystal = BALANCE.upgrade.crystalCost[next];
    const coin = BALANCE.upgrade.coinCost[next];
    if (crystal === undefined || coin === undefined) return null; // 配置缺该档花费 → 视为不可进阶，避免算出 NaN
    return { nextTier: next, crystal, coin };
}

// —— 背包扩容下一格花费（梅尔沃 Bank Slot 式：+1格/次，几何递增）——
// 入参当前 bagMax，返回 { cost, addSlots, nextMax }；已达上限返回 null。
// 已扩次数 n = bagMax - base（step=1），单价 = round(priceStart * growth^n / 100)*100。
// 老存档 bagMax 已是 96 → n=80≥可扩范围 → 直接返回 null(已满级)，天然兼容、不缩水。
export function bagExpandCost(bagMax) {
    const B = BALANCE.bag;
    if (!Number.isFinite(bagMax) || bagMax >= B.max) return null; // 已满 / 非法
    const n = Math.max(0, Math.round(bagMax - B.base));           // 已扩次数（每次+1）
    const raw = B.priceStart * Math.pow(B.priceGrowth, n);
    const cost = Math.max(B.priceStart, Math.round(raw / 100) * 100); // 取整到百，且不低于首格价
    return { cost, addSlots: 1, nextMax: bagMax + 1 };
}

// —— 黑市手动刷新费用（纯函数）：steps 为「已衰减后的连刷步数」，费用 = base×growth^steps（取整到百，不低于 base）。——
export function shopRefreshCost(steps) {
    const R = BALANCE.shopRefresh;
    return Math.max(R.base, Math.round(R.base * Math.pow(R.growth, Math.max(0, steps)) / 100) * 100);
}
// 计算「当前生效的连刷步数」：在存档计数基础上，按距上次刷新经过的时间衰减（每 decayMs 回落一步）。now 由调用方传入(Date.now)。
export function decayedRefreshSteps(shop, now) {
    if (!shop) return 0;
    let c = shop.refreshCount || 0;
    if (shop.lastRefreshAt) {
        const d = Math.floor((now - shop.lastRefreshAt) / BALANCE.shopRefresh.decayMs);
        if (d > 0) c = Math.max(0, c - d);
    }
    return c;
}

// —— 随机秘籍生成（价格随境界）——
export function generateSkillByMatrix(realmLevel) {
    const suff = SKILL_SUFFIXES[Math.floor(Math.random() * SKILL_SUFFIXES.length)];
    const sk = {
        id: "sk_" + Math.floor(Math.random() * 1000000),
        name: SKILL_SECTS[Math.floor(Math.random() * SKILL_SECTS.length)] + suff.name,
        type: suff.type, level: 1, baseRate: BALANCE.skill.baseRate,
        power: suff.power || 0, hp: suff.hp || 0, atk: suff.atk || 0, def: suff.def || 0,
        dodge: suff.dodge || 0, crit: suff.crit || 0, dropRate: suff.dropRate || 0,
        coinRate: suff.coinRate || 0, healRate: suff.healRate || 0,
        desc: suff.desc,
        price: Math.floor(Math.random() * 15000) + 4000 + (realmLevel * 400)
    };
    // 复制新词条字段（暗黑式 affix）——只复制后缀上确有的，避免给每个技能塞满 0 字段
    COMBAT_AFFIX_KEYS.forEach(k => { if (suff[k]) sk[k] = suff[k]; });
    return sk;
}

// —— 战斗纯模拟：把整场战斗算完，返回胜负 + 逐回合事件，供视图层播放动画 ——
// stats: computeStats 的 stats（已含词条 mod 字段，缺省 0）；enemy: finalizeEnemyStats 结果；skills: player.skills
//
// 词条结算顺序（每回合，玩家先手）：
//   ① 攒「增伤池」bonusPct = 增伤 + 先发(前N回合) + 连击(逐回合叠) + 斩杀(敌残血) + 背水(自残血)
//   ② 基础攻击 → 主动技倍率 → ×(1+增伤池) → 暴击 ×(暴伤乘区) → 减敌防(破甲后)
//   ③ 流血(真伤) / 吸血(主动 healRate + 被动吸血)
//   ④ 敌方出手：定身→格挡→闪避→命中(背水/减伤削减)→反伤
//   ⑤ 回合末：龟息回血
// opts（百世轮回扩展，全部可选，缺省＝原行为；现有 3 参调用零影响）：
//   tactic / startHp / vsBonusPct / poisonMult —— Roguelite 节点战斗扩展
//   env —— 地图词缀环境对象（百关征途地图词缀扩展）；也可直接把 env 对象作为 opts 传入（向后兼容）
export function simulateBattle(stats, enemy, skills, opts = {}) {
    opts = opts || {};   // 调用方传 null（如 resolveMapEnv 荒原返回 null）时恢复默认
    // 提取 env：支持两种调用约定 { env: {...} } 或直接把 env 对象作为第4参传入
    const env = opts.env || (opts.envDmgPctMaxHp != null || opts.enemyCritChance != null || opts.healMult != null ? opts : null);
    const B = BALANCE.battle;
    const C = BALANCE.combat;
    const tactic = opts.tactic || null;
    const vsBonusPct = opts.vsBonusPct || 0;
    const poisonMult = Number.isFinite(opts.poisonMult) ? opts.poisonMult : 1;
    const maxPHp = stats.hp;
    const eMaxHp = enemy.maxHp;
    let eHp = enemy.maxHp;
    let pHp = Number.isFinite(opts.startHp) ? Math.max(1, Math.min(maxPHp, opts.startHp)) : maxPHp;
    let tacticPoisonStacks = 0;  // 战前策略「淬毒」的叠层计数（与修行流派的毒修 poisonStacks 分开）
    const events = [];
    const activePool = skills.filter(s => s.type === 'active');
    // —— 敌人词条（第二阶段·精英/Boss 词条化；缺省 0 → 百关/秘境敌人零影响）——
    const eRegen = enemy.regenPct || 0;        // 每回合回复最大气血%
    const eThorns = enemy.thornsPct || 0;      // 受击反弹你本次伤害%（真伤）
    const eDmgRed = enemy.dmgReduction || 0;   // 受到伤害-%
    const eLifesteal = enemy.lifesteal || 0;   // 命中你时回血%（按命中伤害）
    // —— 区域之主·机制（第三阶段；缺省无效 → 百关/秘境/普通节点零影响）——
    const enrageAt = enemy.enrageAt || 0;      // 残血<此%触发一次性狂暴
    const enrageMult = enemy.enrageMult || 1;
    const chargeEvery = enemy.chargeEvery || 0;// 逢此回合数蓄力大招
    const chargeMult = enemy.chargeMult || 1;
    let enemyAtk = enemy.atk;                   // 可变敌攻（狂暴提升）
    let enraged = false;

    // —— 取词条 mod（缺省 0；带 cap 的就地封顶）——
    const critDmg = stats.critDmg || 0;
    const dmgBonus = stats.dmgBonus || 0;
    const armorPen = Math.min(C.armorPenCap, stats.armorPen || 0);
    const dmgReduction = stats.dmgReduction || 0;
    const regenPct = stats.regenPct || 0;
    const thornsPct = stats.thornsPct || 0;
    const blockPct = Math.min(C.blockCap, stats.blockPct || 0);
    const bleedPct = stats.bleedPct || 0;
    const lifestealPct = stats.lifestealPct || 0;
    const executeBonus = stats.executeBonus || 0;
    const lastStandBonus = stats.lastStandBonus || 0;
    const openerBonus = stats.openerBonus || 0;
    const rampPerRound = stats.rampPerRound || 0;
    const stunChance = stats.stunChance || 0;

    // —— 毒修中毒(DOT)：出手概率叠毒、逐回合按层数造成真伤(无视防御)；层数封顶、对 Boss 降效，绝不无限叠爆。
    //    无派 / 非毒修时 stats.poison=null → 全程不触发，对原战斗零影响。
    const poison = stats.poison || null;
    const poisonChance = poison ? (poison.chance || 0) : 0;
    const poisonMaxStacks = poison ? Math.max(0, poison.maxStacks || 0) : 0;
    const poisonEff = poison ? (enemy.isBoss ? (poison.bossEff != null ? poison.bossEff : 1) : 1) : 0;
    const poisonPerStack = poison ? Math.floor(stats.atk * (poison.pctOfAtk || 0) / 100 * poisonEff) : 0; // 每层每回合真伤(战斗内固定)
    let poisonStacks = 0, poisonDealt = 0;
    let dodges = 0, maxHit = 0, dmgTaken = 0; // 第四阶段成就统计：闪避数 / 单次最高伤害 / 累计受伤

    // —— 第五阶段·构筑状态引擎（缺省全禁用 → 全程跳过 → 与第四阶段战斗完全一致）——
    const build = stats.build || {};
    const swB = (build.sword && build.sword.enabled) ? build.sword : null;     // 剑势
    const poB = (build.poison && build.poison.enabled) ? build.poison : null;  // 毒蚀
    const guB = (build.guard && build.guard.enabled) ? build.guard : null;     // 守势
    const afB = (build.dodge && build.dodge.enabled) ? build.dodge : null;     // 影步
    const ocB = (build.forge && build.forge.enabled && opts.overcharge) ? build.forge : null; // 炉心过载（仅战前抉择过载时生效）
    let swordForce = 0, guardStacks = 0, afterimage = 0, buildPoison = 0;       // 战斗状态计数
    const buildSummary = { swordBreaks: 0, poisonBursts: 0, guardCounters: 0, afterimageHits: 0, overcharges: 0, bossBreaks: 0 };
    const perkIds = build.factionPerks || [];
    const runKarma = opts.karma || 0;
    const guardTactic = (tactic && Number.isFinite(tactic.takenPct) && tactic.takenPct < 0) ? 1 : 0; // 守心策略额外攒守势
    // 炉心过载：开战即生效的一次性增伤/减伤
    const ocDmgBonus = ocB ? (ocB.dmgBonusPct || 0) : 0;
    const ocDmgRed = ocB ? (ocB.dmgReductionPct || 0) : 0;
    if (ocB) { buildSummary.overcharges = 1; events.push({ side: 'overcharge', round: 1, text: '炉心过载，兵刃赤明，本战攻防大涨' }); }
    // Boss 招式牌（仅区域 Boss 有 enemy.moves；其余敌人无 → useMoves=false，沿用旧 Boss 蓄力逻辑）。
    const bossMoves = Array.isArray(enemy.moves) ? enemy.moves : [];
    const useMoves = bossMoves.length > 0;
    const moveFired = bossMoves.map(() => false);  // hpBelow 阶段招只触发一次
    // 毒抗 Boss：招式带 poisonResist 则「毒蚀爆发」恒按该系数降效（万毒老祖天生毒抗，专克毒蚀流）。
    let bossPoisonResist = 1;
    bossMoves.forEach(mv => { if (mv.effect && Number.isFinite(mv.effect.poisonResist)) bossPoisonResist = Math.min(bossPoisonResist, mv.effect.poisonResist); });

    // —— 地图词缀「战斗环境」（来自 resolveMapEnv；荒原/秘境为 null → 全程零影响）。各项已在 resolveMapEnv 封顶。——
    const envEnemyCrit = env ? (env.enemyCritChance || 0) : 0;          // 剑冢：敌方暴击率
    const envEnemyCritMult = env ? (env.enemyCritMult || 1.5) : 1.5;
    const envDodgeCut = env ? (env.dodgeReduction || 0) : 0;            // 雷泽：玩家闪避削减(百分点)
    const envHealMult = env && env.healMult != null ? env.healMult : 1; // 魔窟：回血/吸血乘区
    const envDmg = env && env.envDmgPctMaxHp ? Math.floor(maxPHp * env.envDmgPctMaxHp / 100) : 0; // 毒瘴/雷泽：每回合环境真伤(占气血上限%，已封顶，绝不秒杀)
    const envLabel = env ? (env.label || '环境') : '';
    const effDodge = Math.max(0, stats.dodge - envDodgeCut);           // 词缀削减后的有效闪避(≥0)

    const enemyEffDef = enemy.def * (1 - armorPen / 100);     // 破甲后的敌防（全程固定）
    const bleedDmg = bleedPct > 0 ? Math.floor(stats.atk * bleedPct / 100) : 0;       // 每回合流血真伤
    const thornsDmg = thornsPct > 0 ? Math.floor(stats.atk * thornsPct / 100) : 0;    // 受击反弹真伤
    const regenAmt = regenPct > 0 ? Math.floor(maxPHp * regenPct / 100) : 0;          // 每回合龟息

    let round = 1;
    while (eHp > 0 && pHp > 0 && round <= B.maxRounds) {
        const lowHp = (pHp / maxPHp) * 100 < C.lastStandThresh;   // 背水：本回合自身残血？(回合初判定)

        // 策略·养剑：到达爆发回合，先记一条日志（演出/结果面板可见）
        if (tactic && tactic.chargeAt === round) events.push({ side: 'tactic', round, text: '⚡ 养剑·爆发！' });

        // ① 增伤池
        let bonusPct = dmgBonus + vsBonusPct + ocDmgBonus;                                  // 词条增伤 + 对精英/Boss 针对增伤 + 炉心过载增伤
        if (round <= C.openerRounds) bonusPct += openerBonus;                              // 先发制人
        if (rampPerRound) bonusPct += rampPerRound * Math.min(round - 1, C.rampMaxStacks); // 越战越勇
        if ((eHp / enemy.maxHp) * 100 < C.executeThresh) bonusPct += executeBonus;          // 斩杀
        if (lowHp) bonusPct += lastStandBonus;                                              // 背水(进攻侧)
        // —— 战前策略·出招修正（疾攻先发增伤 / 守心降攻 / 养剑前期蓄力·第N回合爆发）——
        if (tactic) {
            if (tactic.openerRounds && round <= tactic.openerRounds) bonusPct += (tactic.openerDmgPct || 0);
            if (tactic.outPct) bonusPct += tactic.outPct;
            if (tactic.chargeAt) {
                if (round < tactic.chargeAt) bonusPct += (tactic.prePct || 0);
                else if (round === tactic.chargeAt) bonusPct += (tactic.burstPct || 0);
            }
        }

        // ② 玩家出手
        const isCrit = Math.random() * 100 < stats.crit;
        let dmg = stats.atk;
        const active = activePool.length > 0 && Math.random() < B.activeSkillChance
            ? pickActive(activePool)   // 不再随机稀释：触发时固定施展「最强」一招（多学不再变弱）
            : null;
        // 兜底：power 缺失/非有限数时按 1 倍处理，绝不让伤害退化成 NaN（旧档里可能存在缺 power 的主动技）
        if (active) {
            const power = Number.isFinite(active.power) ? active.power : 1;
            dmg = Math.floor(dmg * (power + active.level * B.activeLevelScale));
        }
        if (bonusPct) dmg = Math.floor(dmg * (1 + bonusPct / 100));
        if (isCrit) dmg = Math.floor(dmg * (B.critMult + critDmg / 100));   // 暴伤为暴击乘区的额外加成

        let dmgToE = Math.max(1, Math.floor(dmg - enemyEffDef));
        if (eDmgRed > 0) dmgToE = Math.max(1, Math.floor(dmgToE * (1 - eDmgRed / 100))); // 敌·护体减伤
        if (dmgToE > maxHit) maxHit = dmgToE;                               // 成就：单次最高伤害
        eHp -= dmgToE;
        if (bleedDmg > 0) eHp -= bleedDmg;                                  // ③ 流血(无视防御)

        // 吸血：主动技 healRate（按对敌实伤）+ 被动吸血词条
        let heal = 0;
        if (active && active.healRate) heal += Math.floor(dmgToE * active.healRate);
        if (lifestealPct > 0) heal += Math.floor(dmgToE * lifestealPct / 100);
        if (envHealMult !== 1) heal = Math.floor(heal * envHealMult);   // 魔窟：回血/吸血削减
        // 上报「实际生效回血」(封顶后增量)而非名义值：满血时溢出部分不计，飘字才与血条涨幅一致
        if (heal > 0) { const before = pHp; pHp = Math.min(maxPHp, pHp + heal); heal = pHp - before; }

        events.push({ side: 'player', round, dmg: dmgToE, isCrit, heal, bleed: bleedDmg, eHpPct: Math.max(0, (eHp / enemy.maxHp) * 100) });

        // —— 剑势：暴击/主动命中攒势，满阈值触发「破绽斩」(额外伤害·部分无视防御·残血追加斩杀) ——
        if (swB && eHp > 0) {
            if (isCrit) { swordForce += swB.forceOnCrit; if (swB.forceChance > 0 && Math.random() < swB.forceChance) swordForce += 1; }
            if (active) swordForce += swB.forceOnActive;
            if (swordForce >= swB.threshold) {
                swordForce -= swB.threshold;
                const pen = Math.min(0.95, swB.breakArmorPen || 0);
                let breakDmg = Math.floor(stats.atk * swB.breakDmgMult - enemy.def * (1 - pen));
                if ((eHp / eMaxHp) * 100 < swB.executeLowPct) breakDmg += Math.floor(stats.atk * swB.executeMult); // 残血追加斩杀
                breakDmg = Math.max(1, breakDmg);
                eHp -= breakDmg; buildSummary.swordBreaks++;
                if (breakDmg > maxHit) maxHit = breakDmg;
                events.push({ side: 'sword', round, dmg: breakDmg, eHpPct: Math.max(0, (eHp / eMaxHp) * 100) });
            }
        }
        // —— 影步：上回合留下的残影 → 本回合追加一击较弱攻击（对必中/雷罚 Boss 招式当回合失效）——
        if (afB && afterimage > 0 && eHp > 0) {
            afterimage -= 1;
            let f = Math.max(1, Math.floor(stats.atk * afB.followAtkPct - enemyEffDef));
            if (eDmgRed > 0) f = Math.max(1, Math.floor(f * (1 - eDmgRed / 100)));
            eHp -= f; buildSummary.afterimageHits++;
            if (f > maxHit) maxHit = f;
            events.push({ side: 'afterimage', round, dmg: f, eHpPct: Math.max(0, (eHp / eMaxHp) * 100) });
        }

        // 毒修中毒（修行流派·毒修）：出手有概率叠一层，再按当前层数对敌造成真伤。
        if (poison && eHp > 0) {
            if (poisonStacks < poisonMaxStacks && Math.random() * 100 < poisonChance) poisonStacks++;
            if (poisonStacks > 0 && poisonPerStack > 0) {
                const pdmg = poisonPerStack * poisonStacks;
                eHp -= pdmg; poisonDealt += pdmg;
                events.push({ side: 'poison', round, dmg: pdmg, stacks: poisonStacks, eHpPct: Math.max(0, (eHp / enemy.maxHp) * 100) });
            }
        }
        // 战前策略·淬毒（Roguelite）：与毒修分轴，各自独立叠层（一个来自流派，一个来自策略选择）。
        if (tactic && tactic.poisonPctPerStack) {
            tacticPoisonStacks += 1;
            const pd = Math.floor(stats.atk * (tactic.poisonPctPerStack * tacticPoisonStacks) / 100 * poisonMult);
            if (pd > 0) {
                eHp -= pd;
                events.push({ side: 'tactic', round, text: `淬毒(${tacticPoisonStacks}层) -${pd}`, poison: pd, eHpPct: Math.max(0, (eHp / enemy.maxHp) * 100) });
            }
        }
        // —— 毒蚀：流血/淬毒/毒修出手攒毒层，满阈值「毒蚀爆发」(敌最大气血百分比真伤·对再生敌增效·对毒抗Boss降效) ——
        if (poB && eHp > 0) {
            const sourceActive = bleedDmg > 0 || !!poison || (tactic && tactic.poisonPctPerStack); // 有毒/流血源才攒
            if (sourceActive) buildPoison = Math.min(poB.maxStacks, buildPoison + 1);
            if (buildPoison >= poB.threshold) {
                buildPoison -= poB.threshold;
                let eff = (enemy.isBoss ? poB.bossEff : 1) * bossPoisonResist;        // Boss/毒抗 降效
                if ((enemy.regenPct || 0) > 0) eff *= (1 + poB.regenBonus);            // 对再生敌增效
                const burst = Math.max(1, Math.floor(eMaxHp * poB.maxHpPct * eff));
                eHp -= burst; poisonDealt += burst; buildSummary.poisonBursts++;
                if (poB.lifesteal > 0) { const h = Math.floor(burst * poB.lifesteal); if (h > 0) pHp = Math.min(maxPHp, pHp + h); } // 药王谷·毒蚀回血
                events.push({ side: 'poisonburst', round, dmg: burst, stacks: poB.threshold, eHpPct: Math.max(0, (eHp / enemy.maxHp) * 100) });
            }
        }
        // 敌·荆棘：受击反弹你本次伤害的真伤（可能反杀你）
        if (eThorns > 0) {
            const t = Math.floor(dmgToE * eThorns / 100);
            if (t > 0) { pHp -= t; events.push({ side: 'ethorns', round, dmg: t, pHpPct: Math.max(0, (pHp / maxPHp) * 100) }); }
        }
        if (pHp <= 0) break;
        if (eHp <= 0) break;

        // —— 第五阶段·Boss 招式牌：发动 / 破招（仅区域 Boss 有 moves；其余敌人 useMoves=false 跳过）——
        // 在敌方出手前结算：破招成功 → 该招有害效果被打断(减伤/打断/降 buff)；否则发动重击/回血/狂怒/必中/吸血。
        let moveCharge = 1, moveUnavoidable = false, moveLifesteal = 0;
        if (useMoves) {
            for (let mi = 0; mi < bossMoves.length; mi++) {
                const mv = bossMoves[mi], tr = mv.trigger || {};
                let fires = false;
                if (Number.isFinite(tr.every) && tr.every > 0 && round % tr.every === 0) fires = true;
                else if (Number.isFinite(tr.hpBelow) && !moveFired[mi] && (eHp / eMaxHp) * 100 < tr.hpBelow) fires = true;
                if (!fires) continue;
                moveFired[mi] = true;
                const ctx = { swordForce, guardStacks, buildPoison, afterimage, crit: stats.crit, dodge: effDodge, dmgThisRound: dmgToE, eMaxHp, karma: runKarma, overcharge: !!ocB, perkIds };
                const brk = (mv.breakBy || []).find(b => meetsBreakCondition(b, ctx));
                if (brk) {
                    buildSummary.bossBreaks++;
                    if (swB && enemy.isBoss && swB.refundOnBossBreak) swordForce += swB.refundOnBossBreak; // 青城·归鞘再发
                    events.push({ side: 'bossmove', round, name: mv.name, broken: true, by: brk.text });
                    continue; // 破招成功 → 跳过该招效果
                }
                const ef = mv.effect || {};
                events.push({ side: 'bossmove', round, name: mv.name, broken: false, telegraph: mv.telegraph || '' });
                if (Number.isFinite(ef.chargeMult)) moveCharge *= ef.chargeMult;
                if (Number.isFinite(ef.atkBuff)) enemyAtk = Math.floor(enemyAtk * ef.atkBuff);
                if (Number.isFinite(ef.heal) && eHp > 0) { const h = Math.floor(eMaxHp * ef.heal); eHp = Math.min(eMaxHp, eHp + h); events.push({ side: 'eregen', round, heal: h, eHpPct: Math.max(0, (eHp / eMaxHp) * 100) }); }
                if (Number.isFinite(ef.lifesteal)) moveLifesteal = Math.max(moveLifesteal, ef.lifesteal);
                if (ef.unavoidable) moveUnavoidable = true;
            }
        }

        // ④ 敌方出手：定身 → 格挡 → 闪避(影步) → 命中
        if (stunChance > 0 && Math.random() * 100 < stunChance) {
            events.push({ side: 'evade', round, text: '定身' });
        } else if (blockPct > 0 && Math.random() * 100 < blockPct) {
            events.push({ side: 'evade', round, text: '格挡' });
        } else if (!moveUnavoidable && Math.random() * 100 < effDodge) {     // 必中/雷罚招式(moveUnavoidable)无视闪避
            dodges++;                                                        // 成就：闪避计数
            if (afB) afterimage = Math.min(afB.maxStacks, afterimage + 1);   // 影步：闪避成功攒残影
            events.push({ side: 'evade', round, text: '闪避' });
        } else {
            // 区域之主·残血狂暴（一次性提攻）
            if (!enraged && enrageAt > 0 && (eHp / eMaxHp) * 100 < enrageAt) {
                enraged = true; enemyAtk = Math.floor(enemyAtk * enrageMult);
                events.push({ side: 'tactic', round, text: '⚠ 区域之主·狂暴！' });
            }
            // 蓄力大招：有招式牌时由 moveCharge 接管(避免双重大招)；否则沿用通用周期蓄力。
            const charged = useMoves ? (moveCharge > 1) : (chargeEvery > 0 && round % chargeEvery === 0);
            const curAtk = useMoves ? Math.floor(enemyAtk * moveCharge) : (charged ? Math.floor(enemyAtk * chargeMult) : enemyAtk);
            let dmgToP = Math.max(1, curAtk - stats.def);
            const red = Math.min(C.dmgReductionCap, dmgReduction + (lowHp ? lastStandBonus : 0) + ocDmgRed); // 减伤(背水 + 炉心过载，统一封顶)
            if (red > 0) dmgToP = Math.max(1, Math.floor(dmgToP * (1 - red / 100)));
            let eCrit = false;
            if (envEnemyCrit > 0 && Math.random() * 100 < envEnemyCrit) { dmgToP = Math.floor(dmgToP * envEnemyCritMult); eCrit = true; } // 剑冢：守卫暴击
            if (tactic && tactic.takenPct) dmgToP = Math.max(1, Math.floor(dmgToP * (1 + tactic.takenPct / 100)));
            // —— 守势：受击攒势，满阈值后「仅在大伤害(蓄力招/单击≥bigHitPct×最大气血)来临时」抵消并反震 ——
            //   只接大招＝守势是抗爆发工具，普通小伤害不消耗守势、不在常规战无脑堆生存（体修不被拉满）。
            let guardAbsorbed = 0, guardCounter = 0;
            if (guB) {
                guardStacks += guB.gainPerHit + guardTactic;
                const bigHit = charged || dmgToP >= maxPHp * (guB.bigHitPct || 0.15);
                if (guardStacks >= guB.threshold && bigHit) {
                    guardStacks -= guB.threshold;
                    guardAbsorbed = Math.floor(dmgToP * guB.absorbPct);
                    dmgToP = Math.max(1, dmgToP - guardAbsorbed);
                    guardCounter = Math.floor(stats.atk * guB.counterPct);
                    if (guardCounter > 0 && eHp > 0) eHp -= guardCounter;
                    buildSummary.guardCounters++;
                    events.push({ side: 'guard', round, absorbed: guardAbsorbed, counter: guardCounter, eHpPct: Math.max(0, (eHp / eMaxHp) * 100) });
                }
            }
            pHp -= dmgToP;
            dmgTaken += dmgToP;                                            // 成就：累计受伤
            if (thornsDmg > 0) eHp -= thornsDmg;                           // 我方反伤(真伤)
            let eHeal = 0;                                                  // 敌·嗜血 + Boss 招式吸血：命中你时回血
            const totalLeech = eLifesteal + (moveLifesteal * 100);
            if (totalLeech > 0 && eHp > 0) { eHeal = Math.floor(dmgToP * totalLeech / 100); if (eHeal > 0) eHp = Math.min(eMaxHp, eHp + eHeal); }
            events.push({ side: 'enemy', round, dmg: dmgToP, reflect: thornsDmg, eHeal, charged, crit: eCrit, pHpPct: Math.max(0, (pHp / maxPHp) * 100) });
            if (eHp <= 0) break;                                            // 反伤/反震也可能反杀
        }
        if (pHp <= 0) break;

        // ⑤ 龟息回血（回合末）。上报实际生效增量(封顶后)，飘字与血条一致。魔窟同样削减龟息。
        if (regenAmt > 0 && pHp < maxPHp) {
            const before = pHp;
            const regenEff = envHealMult !== 1 ? Math.floor(regenAmt * envHealMult) : regenAmt;
            pHp = Math.min(maxPHp, pHp + regenEff);
            events.push({ side: 'regen', round, heal: pHp - before, pHpPct: Math.max(0, (pHp / maxPHp) * 100) });
        }

        // ⑥ 地图词缀环境伤害（毒瘴/雷泽）：回合末灼身，占气血上限%。可能致死→记为战败。
        if (envDmg > 0 && pHp > 0) {
            pHp -= envDmg;
            events.push({ side: 'env', round, dmg: envDmg, text: envLabel, pHpPct: Math.max(0, (pHp / maxPHp) * 100) });
            if (pHp <= 0) break;
        }
        // 敌·再生（回合末）：按最大气血回血，逼你提高 DPS / 速杀
        if (eRegen > 0 && eHp > 0 && eHp < eMaxHp) {
            const h = Math.floor(eMaxHp * eRegen / 100);
            if (h > 0) { eHp = Math.min(eMaxHp, eHp + h); events.push({ side: 'eregen', round, heal: h, eHpPct: Math.max(0, (eHp / eMaxHp) * 100) }); }
        }
        round++;
    }

    // enemyDead：敌人是否真被打死(用于 Boss——撑满回合"存活"不算击杀)。win 沿用旧义(玩家存活)，地图挂机不变。
    // remainingHp：玩家剩余气血（百世轮回节点战斗的持久血量池据此更新；负数夹到 0）。
    // poisonDealt/dodges/maxHit/dmgTaken/finalPHpPct：策略向成就统计。
    return { win: pHp > 0, enemyDead: eHp <= 0, events, remainingHp: Math.max(0, pHp), poisonDealt, dodges, maxHit, dmgTaken, finalPHpPct: Math.max(0, (pHp / maxPHp) * 100), buildSummary };
}

// 破招条件判定（纯）：ctx 提供战斗状态计数 + 静态属性 + 因果/过载/特权。value 语义见 config/bossMoves.js。
//   damageThisRound 的 value ≤1 时视为「敌最大气血比例」(速杀)，否则为绝对伤害。
function meetsBreakCondition(b, ctx) {
    if (!b) return false;
    switch (b.type) {
        case 'swordForce':     return (ctx.swordForce || 0) >= b.value;
        case 'guardStacks':    return (ctx.guardStacks || 0) >= b.value;
        case 'poisonStacks':   return (ctx.buildPoison || 0) >= b.value;
        case 'afterimage':     return (ctx.afterimage || 0) >= b.value;
        case 'overcharge':     return !!ctx.overcharge;
        case 'critRate':       return (ctx.crit || 0) >= b.value;
        case 'dodgeRate':      return (ctx.dodge || 0) >= b.value;
        case 'damageThisRound': { const need = b.value <= 1 ? (ctx.eMaxHp || 0) * b.value : b.value; return (ctx.dmgThisRound || 0) >= need; }
        case 'karmaLow':       return (ctx.karma || 0) <= b.value;
        case 'factionPerk':    return (ctx.perkIds || []).includes(b.value);
        default:               return false;
    }
}

// 触发主动技时择招：取「有效倍率最高」的一门（power + level*scale）。
// 旧逻辑是随机择一 → 多学主动技反而稀释每招触发；改为固定放最强招，治掉「越学越亏」。
// (二期会加「武学栏位」做有意识的双主动 combo，此处先作单招收口。)
function pickActive(pool) {
    const sc = BALANCE.battle.activeLevelScale;
    let best = pool[0];
    let bestEff = (Number.isFinite(best.power) ? best.power : 1) + (best.level || 1) * sc;
    for (let i = 1; i < pool.length; i++) {
        const s = pool[i];
        const eff = (Number.isFinite(s.power) ? s.power : 1) + (s.level || 1) * sc;
        if (eff > bestEff) { best = s; bestEff = eff; }
    }
    return best;
}

// —— 洪炉：花费 + 合成结果（纯计算，不扣钱、不动背包，交给控制层）——
export function computeForgeCost(i1, i2) {
    return Math.floor((i1.price + i2.price) * BALANCE.forge.costRate) + BALANCE.forge.costBase;
}

export function computeForgeResult(i1, i2, realmLevel, cost) {
    const F = BALANCE.forge;

    // 1) 装备 + 装备
    if (i1.type !== 'book' && i2.type !== 'book') {
        // 打造套装件(带 tier)走「升级合成」：同档有概率升一档、否则取较高档；属性按 tier 重算，绝不退化成随机装。
        // 任一为旧随机装/掉落装(无 tier)则落到下方原「品阶升阶」逻辑，保持向下兼容。
        if (i1.tier && i2.tier) {
            const targetType = Math.random() < 0.5 ? i1.type : i2.type;
            const sameTier = i1.tier === i2.tier;
            // 洪炉升档封顶在「可锻造最高档(T6)」——突破到神话/仙器只能走神兵进阶(吃神魂结晶)
            const upTier = sameTier && i1.tier < MAX_CRAFTABLE_TIER && Math.random() < F.upgradeSameQ;
            const newTier = upTier ? i1.tier + 1 : Math.max(i1.tier, i2.tier);
            const baseQ = Math.max(i1.quality || 0, i2.quality || 0);
            const newQ = (Math.random() < (sameTier ? F.upgradeSameQ : F.upgradeDiffQ)) ? Math.min(5, baseQ + 1) : baseQ;
            const piece = makeGearPiece(newTier, targetType, newQ);
            if (upTier) piece.name = "灵铸·" + piece.name;          // 升档标记
            piece.price = Math.floor(cost * F.resultPriceMult);
            return piece;
        }

        const baseQ = Math.max(i1.quality, i2.quality);
        const upgradeChance = (i1.quality === i2.quality) ? F.upgradeSameQ : F.upgradeDiffQ;
        const finalQ = (Math.random() < upgradeChance) ? Math.min(5, baseQ + 1) : baseQ;

        const targetType = Math.random() < 0.5 ? i1.type : i2.type;
        const targetNameBase = Math.random() < 0.5 ? (i1.name.split('·')[1] || i1.name) : (i2.name.split('·')[1] || i2.name);

        const prefix = ITEM_PREFIXES[Math.min(ITEM_PREFIXES.length - 1, Math.floor(Math.random() * (finalQ + 2)))];
        const fullName = (finalQ > baseQ ? "灵铸·" : "") + prefix + "·" + targetNameBase;

        const mult = (finalQ + 1) * (1 + realmLevel * F.multRealmScale) * F.multBonus;
        let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;
        // 注意：洪炉的属性比随机生成更高（多 +2 暴击 / +1 闪避，护甲 hp 触发条件不同），系有意设计，勿与 generateItemByMatrix 合并。
        switch (targetType) {
            case "weapon": atk = Math.floor(22 * mult); if (finalQ >= 3) crit = finalQ * 2 + 2; break;
            case "subweapon": atk = Math.floor(12 * mult); if (finalQ >= 3) crit = Math.floor(finalQ * 2.5 + 2); break;
            case "armor": def = Math.floor(10 * mult); if (finalQ >= 3) hp = Math.floor(50 * mult); break;
            case "helm": def = Math.floor(6 * mult); hp = Math.floor(40 * mult); break;
            case "ring": hp = Math.floor(80 * mult); if (finalQ >= 3) dodge = Math.min(75, Math.floor(finalQ * 1.5 + 1)); break;
            case "artifact": atk = Math.floor(10 * mult); def = Math.floor(6 * mult); hp = Math.floor(60 * mult); if (finalQ >= 4) { crit = finalQ; dodge = finalQ; } break;
        }
        return {
            id: "it_" + Date.now(), name: fullName, type: targetType, quality: finalQ,
            atk, def, hp, crit, dodge, price: Math.floor(cost * F.resultPriceMult)
        };
    }

    // 2) 秘籍 + 秘籍
    if (i1.type === 'book' && i2.type === 'book') {
        const isHH = (i1.payload.isHongHuang || i2.payload.isHongHuang) ? (Math.random() < 0.4) : false;
        if (isHH) {
            const hhSkill = {
                id: "sk_hh_" + Date.now(), name: "融合·混沌诀", type: "passive", level: 1, isHongHuang: true,
                desc: "【洪荒法则】最高修炼至 100 重。每重洪荒之力+1%，五维暴增2%。", price: BALANCE.hhSkillPrice
            };
            return { name: `禁忌秘籍·《${hhSkill.name}》`, type: "book", payload: hhSkill, price: hhSkill.price };
        }
        const generated = generateSkillByMatrix(realmLevel);
        generated.name = "绝世·" + generated.name;
        generated.power = generated.power ? parseFloat((generated.power * 1.5).toFixed(1)) : 0;
        if (generated.hp) generated.hp *= 2;
        if (generated.atk) generated.atk *= 2;
        return { name: `秘籍·《${generated.name}》`, type: "book", payload: generated, price: Math.floor(generated.price * 1.5) };
    }

    // 3) 装备 + 秘籍（附魔）
    const gear = i1.type !== 'book' ? i1 : i2;
    const book = i1.type === 'book' ? i1 : i2;
    const result = JSON.parse(JSON.stringify(gear));
    result.id = "it_" + Date.now();
    result.name = "附魔·" + result.name;
    result.quality = Math.min(5, result.quality + 1);
    const p = book.payload;
    if (p.hp) result.hp = (result.hp || 0) + p.hp * F.enchantPayloadMult;
    if (p.atk) result.atk = (result.atk || 0) + p.atk * F.enchantPayloadMult;
    if (p.def) result.def = (result.def || 0) + p.def * F.enchantPayloadMult;
    if (p.dodge) result.dodge = (result.dodge || 0) + p.dodge;
    if (p.crit) result.crit = (result.crit || 0) + p.crit;
    if (p.type === 'active' && p.power) {
        result.atk = (result.atk || 0) + Math.floor(p.power * 100);
        result.crit = (result.crit || 0) + 2;
    }
    result.price += book.price;
    return result;
}

// —— 熔炼：把背包按品阶/全部装备拆分为 {保留, 所得碎银}（纯函数）——
export function partitionByQuality(bag, qualities) {
    const remain = [];
    let gold = 0;
    bag.forEach(it => {
        if (it.quality !== undefined && qualities.includes(it.quality) && it.type !== "book") gold += it.price;
        else remain.push(it);
    });
    return { remain, gold };
}

export function partitionAllGear(bag) {
    const remain = [];
    let gold = 0;
    bag.forEach(it => {
        if (it.type !== "book") gold += it.price;
        else remain.push(it);
    });
    return { remain, gold };
}
