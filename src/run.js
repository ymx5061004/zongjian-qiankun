// ============================================================
// 轮回引擎（纯逻辑层）—— 百世轮回 Roguelite 的规则核心。
// 不碰 DOM、不存档、不弹提示；只读/改传入的 player（随机数除外无副作用）。
// 仅依赖「数据层」(config / config/*)，绝不依赖 domain.js —— 从而 domain.js 可反向依赖本模块
// (computeStats 取本模块的修正)，无循环。需要 makeGearPiece/generateSkillByMatrix 等「生成器」的环节
// (奇遇物品/秘籍奖励、装备掉落) 一律以「奖励计划(plan/descriptor)」返回，交由 ui 控制层实体化。
//
// 核心循环：开局命格 → 江湖路线选择 → 节点(事件/战斗/生产/奇遇) → 流派构筑 → 生死结算 → 轮回遗产 → 下一世变局。
// ============================================================
import { BALANCE, GEAR_TIERS } from './config.js';
import { REGIONS, NODE_MODIFIERS, MODIFIER_MAP } from './config/regions.js';
import { EVENTS } from './config/events.js';
import { LIFEPATHS, LIFEPATH_MAP } from './config/lifepaths.js';
import { LEGACIES, LEGACY_MAP } from './config/legacy.js';
import { RUN_TALENTS, RUN_TALENT_MAP, TALENT_SYNERGY } from './config/runtalents.js';
import { ENEMY_AFFIX_MAP, ENEMY_AFFIX_POOL } from './config/enemyaffixes.js';

// 节点类型展示信息（label/icon/描述模板，纯展示）。
export const NODE_TYPE_INFO = {
    battle: { label: '普通战斗', icon: '⚔️', desc: '寻常匪类妖兽拦路，练手砺锋之地。' },
    elite:  { label: '精英战斗', icon: '💀', desc: '一方悍匪强敌，凶险而厚赏。' },
    boss:   { label: '区域之主', icon: '👹', desc: '镇守此域的强敌，击破方可深入或功成身退。' },
    event:  { label: '奇遇事件', icon: '❓', desc: '机缘与凶险并存，何去何从全凭抉择。' },
    mine:   { label: '矿脉', icon: '⛏️', desc: '蕴藏矿石的脉络，采之以炼神兵。' },
    herb:   { label: '药谷', icon: '🌿', desc: '天材地宝丛生，采之以炼丹药。' },
    forge:  { label: '锻造机缘', icon: '🔨', desc: '残破丹炉古灶，可得锻材或现成神兵。' },
    shop:   { label: '黑市商人', icon: '💰', desc: '行踪诡秘的商人，货色随缘。' },
    rest:   { label: '调息恢复', icon: '🏕️', desc: '安全的歇脚处，运功疗伤、恢复气血。' }
};

// —— 各档草药键（采药/药谷节点产出，按区域档位映射）——
function herbKeyForTier(tier) {
    if (tier >= 4) return 'herb_3';
    if (tier >= 3) return 'herb_2';
    return 'herb_1';
}

// 随机工具
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffleInPlace(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
// 分支连边：把当前行 col=ci 的节点连向下一行「位置最近」的 1~2 个节点。
function nearestTargets(ci, curLen, nxt) {
    if (nxt.length <= 1) return nxt.slice(0, 1);
    const p = curLen <= 1 ? 0.5 : ci / (curLen - 1);
    const center = Math.round(p * (nxt.length - 1));
    const out = [nxt[center]];
    if (Math.random() < 0.5) {
        const adj = center + (Math.random() < 0.5 ? -1 : 1);
        if (adj >= 0 && adj < nxt.length && nxt[adj] !== out[0]) out.push(nxt[adj]);
    }
    return out;
}

// ============================================================
// 命格 / 轮回遗产 修正聚合（lifepath 仅当前一世，legacy 永久累积，二者共用同一套修正键）。
// 返回统一的「修正包」，被 computeStats / 战斗 / 资源收益 / 商店 读取。
// ============================================================
function emptyMods() {
    return {
        atkMult: 1, hpMult: 1, defMult: 1, dodgeAdd: 0, critAdd: 0,
        shopDiscount: 0, poisonMult: 0, mineYieldMult: 0, herbYieldMult: 0,
        vsEliteMult: 0, vsBossMult: 0, eventRewardMult: 0, karmaGainMult: 0,
        coinMult: 0, expMult: 0, dropMult: 0, pillPowerMult: 0, maxAgeAdd: 0, loseExtra: 0,
        // —— 第二阶段·战斗词条增量（本世奇珍/感悟来源，computeStats 叠到对应词条上）——
        dmgReductionAdd: 0, regenAdd: 0, thornsAdd: 0, lifestealAdd: 0
    };
}

// 聚合 命格 + 永久遗产 + 本世奇珍(runTalents) 的修正，并计算「三系协同」加成。
export function getModifiersFor(lifepathId, legacies, runTalents) {
    const m = emptyMods();
    const sources = [];
    const lp = LIFEPATH_MAP[lifepathId];
    if (lp && lp.mods) sources.push(lp.mods);
    (legacies || []).forEach(id => { const lg = LEGACY_MAP[id]; if (lg && lg.mods) sources.push(lg.mods); });
    const talents = runTalents || [];
    const schoolCount = {};
    talents.forEach(id => {
        const t = RUN_TALENT_MAP[id];
        if (!t) return;
        if (t.mods) sources.push(t.mods);
        if (t.school) schoolCount[t.school] = (schoolCount[t.school] || 0) + 1;
    });
    // 三系协同：某系持有 ≥2 件 → 每多 1 件追加 TALENT_SYNERGY[系] 的加成
    Object.entries(schoolCount).forEach(([school, n]) => {
        const syn = TALENT_SYNERGY[school];
        if (syn && n >= 2) { const extra = {}; for (const [k, v] of Object.entries(syn)) extra[k] = v * (n - 1); sources.push(extra); }
    });
    sources.forEach(mod => {
        for (const [k, v] of Object.entries(mod)) {
            if (!Number.isFinite(v)) continue;
            if (m[k] === undefined) continue; // 只接受已知修正键，未知键忽略（防脏数据）
            m[k] += v;
        }
    });
    // 乘区下限保护，避免叠加削弱后变 0/负
    m.atkMult = Math.max(0.2, m.atkMult);
    m.hpMult = Math.max(0.2, m.hpMult);
    m.defMult = Math.max(0.2, m.defMult);
    m.shopDiscount = Math.max(0, Math.min(0.6, m.shopDiscount));
    return m;
}

// 由 player 派生修正包：当前命格 + 永久遗产 + 本世奇珍 + 因果(善缘)。
// 旧档/未入轮回的玩家：恒等修正，对原有玩法零影响。
export function getModifiers(player) {
    const run = player && player.run ? player.run : null;
    const m = getModifiersFor(run ? run.lifepathId : null, player ? player.legacies : [], run ? run.runTalents : []);
    // 因果·善缘庇佑：低因果(广积阴德)本世获得黑市折扣 + 奇遇收益加成。高因果的反噬体现在 Boss(见 finalizeNodeEnemy)。
    const K = BALANCE.roguelite.karma;
    if (run && Number.isFinite(run.karma) && run.karma <= K.lowThresh) {
        m.shopDiscount = Math.min(0.6, m.shopDiscount + K.goodShopDiscount);
        m.eventRewardMult += K.goodEventBonus;
    }
    return m;
}

// ============================================================
// 命格 / 遗产 抽选
// ============================================================
function sampleN(pool, n) {
    const arr = pool.slice();
    const out = [];
    for (let i = 0; i < n && arr.length; i++) out.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    return out;
}
// 本世命格 3 选 1（每世重选）。
export function rollLifepathChoices() {
    return sampleN(LIFEPATHS, 3).map(l => l.id);
}
// 轮回遗产 N 选 1：优先抽「尚未拥有」的（先广后深——先集齐 13 种，封顶早期属性膨胀且每世给新东西）；
// 未拥有不足 N 时再用「已拥有」补足（此后才出现重复＝叠加，多见于高评价/集齐后的深局）。
export function rollLegacyChoices(player, n = 3) {
    const owned = (player && Array.isArray(player.legacies)) ? player.legacies : [];
    const unowned = LEGACIES.filter(l => !owned.includes(l.id));
    const ownedPool = LEGACIES.filter(l => owned.includes(l.id));
    let pool = sampleN(unowned, n);
    if (pool.length < n) pool = pool.concat(sampleN(ownedPool, n - pool.length));
    return pool.map(l => l.id);
}

// 本世奇珍/感悟 N 选 1：优先抽「本世尚未领悟」的（同一世不重复领同一件，鼓励铺开流派）；不足再补。
export function rollRunTalentChoices(player, n = 3) {
    const have = (player && player.run && Array.isArray(player.run.runTalents)) ? player.run.runTalents : [];
    const fresh = RUN_TALENTS.filter(t => !have.includes(t.id));
    const rest = RUN_TALENTS.filter(t => have.includes(t.id));
    let pool = sampleN(fresh, n);
    if (pool.length < n) pool = pool.concat(sampleN(rest, n - pool.length));
    return pool.map(t => t.id);
}
export function grantRunTalent(player, talentId) {
    if (!RUN_TALENT_MAP[talentId]) return false;
    if (!player.run.runTalents) player.run.runTalents = [];
    player.run.runTalents.push(talentId);
    return true;
}

// ============================================================
// 一世的开启 / 节点地图生成
// ============================================================
export function currentRegionIndex(player) {
    const idx = player.run ? (player.run.regionIndex || 0) : 0;
    return Math.max(0, Math.min(REGIONS.length - 1, idx));
}
export function currentRegion(player) {
    return REGIONS[currentRegionIndex(player)];
}

// 为某区域生成一张「分层分支」节点图（DAG）：按 composition 把节点类型铺到若干行，
// 每行 mapPerRow 个；逐行向下连边（每节点连下一行最近 1~2 个，并保证每个下行节点都有入边）；
// boss 独占末行、由末行所有节点汇入。玩家沿当前路径前行（见 reachableNodeIds），形成路线抉择。
export function generateNodeMap(regionIndex, lifeNo) {
    const region = REGIONS[Math.max(0, Math.min(REGIONS.length - 1, regionIndex))];
    const comp = region.composition || {};
    let counter = 0;
    const mk = (type, row, col) => {
        const pool = (region.namePool && region.namePool[type]) || [NODE_TYPE_INFO[type] ? NODE_TYPE_INFO[type].label : type];
        const info = NODE_TYPE_INFO[type] || { desc: '' };
        const node = {
            id: `n${regionIndex}_${counter++}`,
            regionId: region.id, type, name: pick(pool), desc: info.desc || '',
            difficulty: type === 'boss' ? 5 : randInt(1, 4),
            modifier: (['battle', 'elite', 'event'].includes(type) && Math.random() < 0.35) ? pick(NODE_MODIFIERS).id : null,
            rewardHint: rewardHintFor(type, region),
            visited: false, row, col, next: []
        };
        // 精英/Boss 预分配敌人词条（棋盘可预览；Boss 因果反噬时再叠「天罚」，见 finalizeNodeEnemy）
        if (type === 'elite' || type === 'boss') node.enemyAffixes = [pick(ENEMY_AFFIX_POOL)];
        return node;
    };

    // 非 boss 类型池 → 打散 → 按 perRow 切行
    const typePool = [];
    Object.entries(comp).forEach(([t, c]) => { if (t !== 'boss') for (let i = 0; i < c; i++) typePool.push(t); });
    shuffleInPlace(typePool);
    const perRow = BALANCE.roguelite.mapPerRow || 3;
    const nodes = [];
    const rowNodes = [];
    for (let i = 0, r = 0; i < typePool.length; i += perRow, r++) {
        const slice = typePool.slice(i, i + perRow);
        const rowArr = slice.map((t, c) => { const n = mk(t, r, c); nodes.push(n); return n; });
        rowNodes.push(rowArr);
    }
    // boss 末行
    const bossNode = mk('boss', rowNodes.length, 0);
    nodes.push(bossNode);
    rowNodes.push([bossNode]);

    // 连边
    for (let r = 0; r < rowNodes.length - 1; r++) {
        const cur = rowNodes[r], nxt = rowNodes[r + 1];
        cur.forEach((node, ci) => { node.next = nearestTargets(ci, cur.length, nxt).map(n => n.id); });
        // 入边覆盖：下一行没人连到的节点，挂到位置最近的 cur 节点
        nxt.forEach((nn, ni) => {
            if (cur.some(node => node.next.includes(nn.id))) return;
            const idx = nxt.length <= 1 ? 0 : Math.round((ni / (nxt.length - 1)) * (cur.length - 1));
            const src = cur[Math.max(0, Math.min(cur.length - 1, idx))] || cur[0];
            if (src && !src.next.includes(nn.id)) src.next.push(nn.id);
        });
    }
    return nodes;
}

function rewardHintFor(type, region) {
    switch (type) {
        case 'battle': return '碎银·修为·矿石，偶得神兵';
        case 'elite': return '丰厚碎银修为，必得机缘';
        case 'boss': return '巨额奖励 · 击破可深入/轮回';
        case 'event': return '未知奇遇，福祸自择';
        case 'mine': return `矿石 ×数枚（${region.name}矿脉）`;
        case 'herb': return '草药 ×数株';
        case 'forge': return '锻材锭，或现成神兵';
        case 'shop': return '黑市淘货（可议价）';
        case 'rest': return '恢复大量气血';
        default: return '';
    }
}

// 开启 / 重开一世：重建 player.run（保留 lifeNo / legacies / worldFlags 不在此处理）。
//   nextLife=true → 世数 +1（轮回进入下一世）；否则沿用当前世数（首世）。
//   返回所设的 run（hp 置 null，由控制层按当前最大气血填满）。
export function startLife(player, lifepathId, { nextLife = false } = {}) {
    const prevNo = (player.run && player.run.lifeNo) || 1;
    const lifeNo = nextLife ? prevNo + 1 : prevNo;
    const mods = getModifiersFor(lifepathId, player.legacies);
    const R = BALANCE.roguelite;
    const run = {
        lifeNo,
        age: R.startAge,
        maxAge: R.maxAge + (mods.maxAgeAdd || 0),
        hp: null,                       // 控制层据最大气血填满
        karma: 0,
        regionId: REGIONS[0].id,
        regionIndex: 0,
        nodeMap: generateNodeMap(0, lifeNo),
        currentNodeId: null,
        visitedNodes: [],
        nodesDone: 0,
        clearedBosses: 0,
        coinGained: 0,
        expGained: 0,
        selectedTactic: (player.run && player.run.selectedTactic) || 'balanced',
        lifepathId,
        runTalents: [],                 // 预留：本世临时增益（二期）
        worldFlags: {}
    };
    player.run = run;
    return run;
}

// 进入下一区域（击破 Boss 后选择「深入」）：区域 +1、重生节点图，保留寿元/气血/世数/命格。
export function advanceRegion(player) {
    const run = player.run;
    const next = Math.min(REGIONS.length - 1, (run.regionIndex || 0) + 1);
    run.regionIndex = next;
    run.regionId = REGIONS[next].id;
    run.nodeMap = generateNodeMap(next, run.lifeNo);
    run.currentNodeId = null;
    run.visitedNodes = [];
    return run;
}

// 追加一枚永久遗产（可重复 → 叠加）。
export function grantLegacy(player, legacyId) {
    if (!LEGACY_MAP[legacyId]) return false;
    if (!Array.isArray(player.legacies)) player.legacies = [];
    player.legacies.push(legacyId);
    return true;
}

export function nodeById(player, id) {
    return (player.run && player.run.nodeMap || []).find(n => n.id === id) || null;
}

// 当前「可进入」的节点 id 集合（分支地图：沿当前路径前行）。
//   起点(无 currentNodeId) → 首行所有未访问节点；之后 → 当前节点 next 中的未访问节点。
//   currentNodeId 只在节点「完成(visited)」后推进，故 Boss 未斩时不会更新、可重战（其前置节点 next 仍含 Boss）。
//   旧平铺图(节点无 next)兼容：所有未访问节点均可进（沿用一期行为）。
export function reachableNodeIds(player) {
    const run = player.run;
    const nm = (run && run.nodeMap) || [];
    if (!nm.length) return [];
    if (!nm.some(n => Array.isArray(n.next))) return nm.filter(n => !n.visited).map(n => n.id);
    const cur = run.currentNodeId ? nm.find(n => n.id === run.currentNodeId) : null;
    if (!cur) {
        const minRow = Math.min(...nm.map(n => Number.isFinite(n.row) ? n.row : 0));
        return nm.filter(n => (n.row || 0) === minRow && !n.visited).map(n => n.id);
    }
    return (cur.next || []).filter(id => { const n = nm.find(x => x.id === id); return n && !n.visited; });
}
export function isNodeReachable(player, nodeId) { return reachableNodeIds(player).includes(nodeId); }

// Boss 是否可挑战（当前路径已抵末行、Boss 进入可达集）。
export function isBossUnlocked(player) {
    return reachableNodeIds(player).some(id => { const n = nodeById(player, id); return n && n.type === 'boss'; });
}

// ============================================================
// 战斗 · 敌人属性（按 区域/世数/节点难度/类型/修饰 缩放；不走百关 2^关 的陡峭曲线）
// ============================================================
export function finalizeNodeEnemy(player, node) {
    const R = BALANCE.roguelite;
    const regionIndex = currentRegionIndex(player);
    const lifeNo = (player.run && player.run.lifeNo) || 1;
    const mod = node.modifier ? MODIFIER_MAP[node.modifier] : null;
    const regionFactor = 1 + regionIndex * R.regionStep;
    const lifeFactor = 1 + (lifeNo - 1) * R.lifeStep;
    const diffFactor = 1 + ((node.difficulty || 1) - 1) * R.nodeDiffStep;
    const enemyMult = mod ? mod.enemyMult : 1;
    const scale = regionFactor * lifeFactor * diffFactor * enemyMult;
    const typ = R.typeMult[node.type] || R.typeMult.battle;
    const b = R.enemy;
    const info = NODE_TYPE_INFO[node.type] || { label: '' };
    const enemy = {
        name: `${node.name}·${info.label}`,
        maxHp: Math.max(1, Math.floor(b.hp * typ.hp * scale)),
        atk: Math.max(1, Math.floor(b.atk * typ.atk * scale)),
        def: Math.max(0, Math.floor(b.def * typ.def * scale)),
        affixes: [], regenPct: 0, thornsPct: 0, dmgReduction: 0, lifesteal: 0, backlash: false,
        enrageAt: 0, enrageMult: 1, chargeEvery: 0, chargeMult: 1
    };
    // 区域之主·机制化（仅 boss）：残血狂暴 + 周期蓄力大招
    if (node.type === 'boss') {
        const BM = R.bossMech;
        enemy.enrageAt = BM.enrageAt; enemy.enrageMult = BM.enrageMult;
        enemy.chargeEvery = BM.chargeEvery; enemy.chargeMult = BM.chargeMult;
    }
    // 敌人词条：节点预设(精英1/Boss1) + Boss 因果反噬「天罚」（高因果触发）
    const affixIds = (node.enemyAffixes || []).slice();
    if (node.type === 'boss' && ((player.run && player.run.karma) || 0) >= R.karma.highThresh) {
        affixIds.push('heavenly');
        enemy.backlash = true;
        enemy.name = `天罚·${enemy.name}`;
    }
    let hpMul = 1, atkMul = 1;
    affixIds.forEach(id => {
        const a = ENEMY_AFFIX_MAP[id];
        if (!a) return;
        enemy.affixes.push({ id: a.id, name: a.name, icon: a.icon, desc: a.desc });
        const e = a.e || {};
        if (e.atkMult) atkMul += e.atkMult;
        if (e.hpMult) hpMul += e.hpMult;
        if (e.regenPct) enemy.regenPct += e.regenPct;
        if (e.thornsPct) enemy.thornsPct += e.thornsPct;
        if (e.dmgReduction) enemy.dmgReduction += e.dmgReduction;
        if (e.lifesteal) enemy.lifesteal += e.lifesteal;
    });
    enemy.maxHp = Math.max(1, Math.floor(enemy.maxHp * hpMul));
    enemy.atk = Math.max(1, Math.floor(enemy.atk * atkMul));
    return enemy;
}

// 战斗对该节点的「针对性增伤%」(对精英/Boss 的遗产/命格加成，进入战斗加到增伤池)。
export function vsBonusPctFor(player, node) {
    const mods = getModifiers(player);
    if (node.type === 'elite') return Math.round(mods.vsEliteMult * 100);
    if (node.type === 'boss') return Math.round(mods.vsBossMult * 100);
    return 0;
}

// 进入一个节点消耗的寿元（rest 较省）。
export function nodeAgeCost(node) {
    return node.type === 'rest' ? BALANCE.roguelite.ageCostRest : BALANCE.roguelite.ageCostPerNode;
}

// ============================================================
// 奇遇事件：抽取 / 选项可用性 / 结算
// ============================================================
// 为 event 节点抽一个事件：优先匹配区域 tag，且尽量不重复本世已遇过的。
export function pickEventForNode(player, node) {
    const seen = (player.run.worldFlags && player.run.worldFlags.__seenEvents) || [];
    const regionId = node.regionId;
    const matches = e => !e.regionTags || e.regionTags.includes(regionId);
    let pool = EVENTS.filter(matches);
    let fresh = pool.filter(e => !seen.includes(e.id));
    if (!fresh.length) { fresh = EVENTS.filter(e => !seen.includes(e.id)); } // 区域内遇尽 → 放宽到全池
    if (!fresh.length) { fresh = pool.length ? pool : EVENTS; }              // 全遇过 → 允许重复
    // 事件链偏重：若某事件含「当前已满足前置(require)」的选项（多为铺垫后的 payoff），优先抽它让链路兑现。
    const ready = fresh.filter(e => (e.choices || []).some(c => c.require && choiceAvailable(player, c)));
    if (ready.length && Math.random() < 0.6) return pick(ready);
    return pick(fresh);
}

// 标记某事件本世已遇（避免一世内频繁重复）。
export function markEventSeen(player, eventId) {
    if (!player.run.worldFlags) player.run.worldFlags = {};
    const seen = player.run.worldFlags.__seenEvents || (player.run.worldFlags.__seenEvents = []);
    if (!seen.includes(eventId)) seen.push(eventId);
}

// 选项是否可选（require 校验）。
export function choiceAvailable(player, choice) {
    const req = choice.require;
    if (!req) return true;
    const run = player.run;
    const flags = run.worldFlags || {};
    if (req.flag && !flags[req.flag]) return false;
    if (req.notFlag && flags[req.notFlag]) return false;
    if (Number.isFinite(req.karmaMin) && (run.karma || 0) < req.karmaMin) return false;
    if (Number.isFinite(req.karmaMax) && (run.karma || 0) > req.karmaMax) return false;
    if (Number.isFinite(req.minAtk)) {
        // 以「当前命格/遗产放大后的攻击近似」为门槛；这里只用 baseAtk*atkMult 粗算，够用即可
        const mods = getModifiers(player);
        const approxAtk = (player.baseAtk || 0) * mods.atkMult;
        if (approxAtk < req.minAtk) return false;
    }
    return true;
}

// 结算事件选项：落地「不依赖生成器」的效果，返回需控制层实体化的部分(item/skill)与日志。
//   maxHp 用于 hpNow 夹取；返回 { needItem, needSkill, logs, dead }。
export function applyEventChoice(player, event, choice, maxHp) {
    const run = player.run;
    const mods = getModifiers(player);
    const eff = choice.effects || {};
    const logs = [];
    if (!player.pillBonus) player.pillBonus = { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0 };

    // 永久根骨（写入 pillBonus，跨世保留、不被渡劫重置）
    ['atk', 'def', 'hp', 'crit', 'dodge'].forEach(k => {
        if (eff[k]) { player.pillBonus[k] = (player.pillBonus[k] || 0) + eff[k]; logs.push(`永久${labelStat(k)} ${eff[k] > 0 ? '+' : ''}${eff[k]}${pctSuffix(k)}`); }
    });
    // 当前气血
    let dead = false;
    if (eff.hpNow) {
        run.hp = clampHp((run.hp ?? maxHp) + eff.hpNow, maxHp);
        logs.push(`${eff.hpNow > 0 ? '气血回复' : '受创'} ${eff.hpNow > 0 ? '+' : ''}${eff.hpNow}`);
        if (run.hp <= 0) dead = true;
    }
    // 碎银 / 修为 / 洪荒（碎银/修为部分吃 coinMult/expMult? 事件碎银统一吃 eventRewardMult，更直观）
    if (eff.coin) {
        const v = eff.coin > 0 ? Math.floor(eff.coin * (1 + mods.eventRewardMult)) : eff.coin;
        player.coin = Math.max(0, player.coin + v);
        if (v > 0) { player.totalCoinEarned = (player.totalCoinEarned || 0) + v; run.coinGained += v; }
        logs.push(`碎银 ${v > 0 ? '+' : ''}${v}`);
    }
    if (eff.exp) { player.exp += eff.exp; if (eff.exp > 0) run.expGained += eff.exp; logs.push(`修为 +${eff.exp}`); }
    if (eff.honghuangPower) { player.honghuangPower = (player.honghuangPower || 0) + eff.honghuangPower; logs.push(`洪荒之力 +${eff.honghuangPower}`); }
    // 因果（正向因果受 karmaGainMult 放大）
    if (eff.karma) {
        const k = eff.karma > 0 ? Math.round(eff.karma * (1 + mods.karmaGainMult)) : eff.karma;
        run.karma = (run.karma || 0) + k;
        logs.push(`因果 ${k > 0 ? '+' : ''}${k}`);
    }
    // 寿元
    if (eff.age) { run.age = Math.max(0, run.age + eff.age); logs.push(`寿元 ${eff.age > 0 ? '+' : ''}${eff.age}`); }
    // 物料（吃 eventRewardMult）
    if (eff.material) {
        if (!player.materials || typeof player.materials !== 'object') player.materials = {};
        for (const [key, qty] of Object.entries(eff.material)) {
            const q = Math.max(1, Math.floor(qty * (1 + mods.eventRewardMult)));
            player.materials[key] = (player.materials[key] || 0) + q;
            logs.push(`${matLabel(key)}×${q}`);
        }
    }
    // 世界标记 / 流派倾向
    if (eff.flag) { for (const [k, v] of Object.entries(eff.flag)) run.worldFlags[k] = v; }
    if (eff.tactic) { run.selectedTactic = eff.tactic; logs.push(`流派转向【${eff.tactic}】`); }

    return {
        needItem: eff.item || null,     // true | {tier,slot,quality}
        needSkill: !!eff.skill,
        needTalent: !!eff.runTalent,    // 由控制层弹「本世感悟」三选一
        logs, dead
    };
}

// ============================================================
// 节点奖励计划（mine/herb/forge/shop/rest 与 战斗胜利后的战利品）
// 返回「计划」(纯数值 + 描述符)，由控制层执行(物料直加、makeGearPiece 生成装备、run.hp 夹取等)。
// ============================================================
export function planNodeReward(player, node, maxHp) {
    const mods = getModifiers(player);
    const region = currentRegion(player);
    const tier = region.tier || 1;
    const mod = node.modifier ? MODIFIER_MAP[node.modifier] : null;
    const rMult = mod ? mod.rewardMult : 1;
    const R = BALANCE.roguelite;
    const plan = { coin: 0, exp: 0, materials: {}, items: [], skills: 0, heal: 0, profExp: null, openShop: false };

    const addMat = (k, q) => { plan.materials[k] = (plan.materials[k] || 0) + q; };
    const diffFactor = 1 + ((node.difficulty || 1) - 1) * 0.15;
    const baseCoin = Math.floor(R.coinPerNode * (tier) * diffFactor * rMult * (1 + mods.coinMult));
    const baseExp = Math.floor(R.expPerNode * (tier) * diffFactor * rMult * (1 + mods.expMult));

    switch (node.type) {
        case 'battle': {
            plan.coin = baseCoin; plan.exp = baseExp;
            const ore = (GEAR_TIERS[tier - 1] && GEAR_TIERS[tier - 1].ore) || 'ore_copper';
            addMat(ore, Math.max(1, Math.floor(randInt(1, 2) * rMult)));
            // 掉宝：基础概率 × 掉宝修正
            if (Math.random() < (0.30 * (1 + mods.dropMult))) plan.items.push({ tier, quality: null });
            break;
        }
        case 'elite': {
            plan.coin = Math.floor(baseCoin * 2.2); plan.exp = Math.floor(baseExp * 2.2);
            const ore = (GEAR_TIERS[tier - 1] && GEAR_TIERS[tier - 1].ore) || 'ore_copper';
            addMat(ore, Math.max(2, Math.floor(randInt(2, 4) * rMult)));
            plan.items.push({ tier, quality: null });   // 精英必掉机缘
            break;
        }
        case 'boss': {
            plan.coin = Math.floor(baseCoin * 5); plan.exp = Math.floor(baseExp * 5);
            addMat('soul_crystal', randInt(1, 2));
            plan.items.push({ tier, quality: null });
            break;
        }
        case 'mine': {
            const ore = (GEAR_TIERS[tier - 1] && GEAR_TIERS[tier - 1].ore) || 'ore_copper';
            const qty = Math.max(1, Math.floor(randInt(R.mineQty[0], R.mineQty[1]) * rMult * (1 + mods.mineYieldMult)));
            addMat(ore, qty);
            plan.profExp = { prof: 'mining', amount: 30 + tier * 10 };
            break;
        }
        case 'herb': {
            const hk = herbKeyForTier(tier);
            const qty = Math.max(1, Math.floor(randInt(R.herbQty[0], R.herbQty[1]) * rMult * (1 + mods.herbYieldMult)));
            addMat(hk, qty);
            plan.profExp = { prof: 'herb', amount: 30 + tier * 10 };
            break;
        }
        case 'forge': {
            const ingot = (GEAR_TIERS[tier - 1] && GEAR_TIERS[tier - 1].ingot) || 'ingot_copper';
            const qty = Math.max(1, Math.floor(randInt(R.forgeIngot[0], R.forgeIngot[1]) * rMult));
            addMat(ingot, qty);
            plan.profExp = { prof: 'smithing', amount: 30 + tier * 10 };
            if (Math.random() < 0.5) plan.items.push({ tier, quality: null }); // 半数概率多得一件现成神兵
            break;
        }
        case 'shop': {
            plan.openShop = true;   // 由控制层开「黑市」议价小窗
            break;
        }
        case 'rest': {
            plan.heal = Math.floor((maxHp || 0) * R.restHealPct);
            break;
        }
    }
    return plan;
}

// ============================================================
// 生死结算（轮回）：本世评价（不修改 player）。
// ============================================================
export function settleLife(player) {
    const run = player.run || {};
    const regionIndex = currentRegionIndex(player);
    const nodesDone = run.nodesDone || 0;
    const clearedBosses = run.clearedBosses || 0;
    const karma = run.karma || 0;
    const score = nodesDone * 2 + clearedBosses * 8 + regionIndex * 3;
    let grade, gradeColor, gradeDesc;
    if (score >= 40) { grade = 'S'; gradeColor = 'var(--color-honghuang)'; gradeDesc = '一世传奇，名动江湖！'; }
    else if (score >= 25) { grade = 'A'; gradeColor = 'var(--color-orange)'; gradeDesc = '武道有成，一方豪杰。'; }
    else if (score >= 12) { grade = 'B'; gradeColor = 'var(--color-blue)'; gradeDesc = '崭露头角，前路可期。'; }
    else { grade = 'C'; gradeColor = 'var(--text-muted)'; gradeDesc = '初涉江湖，便已落幕。'; }
    const KK = BALANCE.roguelite.karma;
    const karmaDesc = karma >= KK.highThresh ? '杀孽深重，天道反噬。' : (karma <= KK.lowThresh ? '广积阴德，善缘加身。' : '善恶相抵，因果两清。');
    return {
        lifeNo: run.lifeNo || 1,
        regionName: (REGIONS[regionIndex] || {}).name || '',
        nodesDone, clearedBosses,
        coinGained: run.coinGained || 0,
        expGained: run.expGained || 0,
        karma, grade, gradeColor, gradeDesc, karmaDesc, score
    };
}

// 陨落/战败惩罚：损失当前碎银的比例（逆命者等 loseExtra 放大）。返回损失额。
export function applyDeathPenalty(player) {
    const mods = getModifiers(player);
    const rate = BALANCE.reward.loseCoinRate * (1 + mods.loseExtra);
    const lost = Math.floor((player.coin || 0) * rate);
    player.coin = Math.max(0, (player.coin || 0) - lost);
    return lost;
}

// ============================================================
// 小工具（纯）
// ============================================================
export function clampHp(hp, maxHp) {
    if (!Number.isFinite(hp)) return maxHp || 0;
    return Math.max(0, Math.min(maxHp || hp, Math.floor(hp)));
}
function labelStat(k) { return ({ hp: '气血', atk: '攻击', def: '防御', crit: '暴击', dodge: '闪避' })[k] || k; }
function pctSuffix(k) { return (k === 'crit' || k === 'dodge') ? '%' : ''; }
function matLabel(k) {
    // 物料中文名（避免 import MATERIALS 造成噪音，这里只做兜底，UI 层有完整名）
    return k;
}

// 是否处于「一世进行中」（已选命格、有节点图、未待结算）。
export function isLifeActive(player) {
    return !!(player.run && player.run.lifepathId && Array.isArray(player.run.nodeMap) && player.run.nodeMap.length);
}
