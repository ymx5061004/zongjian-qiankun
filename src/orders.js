// ============================================================
// 逻辑层 · 江湖委托 / 宗门订单（第四阶段）。纯规则：生成 / 校验 / 结算 / 刷新 / 声望。
// 不碰 DOM、不存档、不弹提示；只读/改传入的 player（随机数、Date.now 除外无副作用）。
// 仅依赖「数据层」(config / config/orders) 与 domain 的纯工具(levelFromExp/mapTier)——单向，无循环。
// 控制层(actions)负责扣费校验后的落地、刷新界面、存档。
// ============================================================
import { MATERIALS, BALANCE } from './config.js';
import { ORDER_TEMPLATES, getFaction } from './config/orders.js';
import { levelFromExp, mapTier } from './domain.js';
import { factionRunModifiers } from './factions.js';

function matName(k) { return MATERIALS[k] ? MATERIALS[k].name : k; }

// 玩家「可达档位」粗估（1~6）：取 已通关卡档 与 采矿/锻造等级档 的较大者。
// 据此过滤委托，绝不要求玩家此刻拿不到的高档材料（避免出现无法完成的空委托）。
function estimatePlayerTier(player) {
    const cleared = player.maxMapCleared || 0;
    const mapT = mapTier(Math.max(1, cleared + 1));
    const mineLv = levelFromExp((player.professions && player.professions.mining && player.professions.mining.exp) || 0);
    const smithLv = levelFromExp((player.professions && player.professions.smithing && player.professions.smithing.exp) || 0);
    const lv = Math.max(mineLv, smithLv);
    const prodT = lv >= 80 ? 6 : lv >= 60 ? 5 : lv >= 40 ? 4 : lv >= 25 ? 3 : lv >= 10 ? 2 : 1;
    return Math.max(1, Math.max(mapT, prodT));
}

// 实例化一个委托模板 → 可提交的委托对象（uid 唯一；req/reward 深拷贝，避免改到模板）。
let _uidSeq = 0;
function instantiate(t) {
    return {
        uid: 'od_' + Date.now() + '_' + (_uidSeq++),
        templateId: t.id, faction: t.faction, title: t.title, desc: t.desc,
        tags: (t.tags || []).slice(), rarity: t.rarity, tier: t.tier,
        req: { materials: Object.assign({}, t.req.materials || {}), coin: t.req.coin || 0 },
        reward: JSON.parse(JSON.stringify(t.reward || {}))
    };
}

// 生成 n 个委托：按玩家进度(tier/境界/声望)过滤模板，随机抽取并尽量错开派系。
export function generateOrders(player, n = BALANCE.orders.slots) {
    const tierCap = estimatePlayerTier(player);
    const realm = player.realmLevel || 1;
    const rep = player.reputation || {};
    const O = BALANCE.orders;
    const cut = factionRunModifiers(player).rareRepReqCut || 0; // 黑市·销金窟：稀有/史诗委托声望门槛下调
    const eligible = ORDER_TEMPLATES.filter(t => {
        if (t.tier > tierCap) return false;
        if ((t.minRealm || 1) > realm) return false;
        if (t.rarity === 'rare' && (rep[t.faction] || 0) < Math.max(0, O.rareRepReq - cut)) return false;
        if (t.rarity === 'epic' && (rep[t.faction] || 0) < Math.max(0, O.epicRepReq - cut)) return false;
        return true;
    });
    // 兜底：可选池不足 → 放宽到「≤档的 common」→ 仍空则最低档 common，保证总能凑出委托。
    let pool = eligible.length >= n ? eligible
        : ORDER_TEMPLATES.filter(t => t.tier <= Math.max(1, tierCap) && (t.minRealm || 1) <= realm && t.rarity === 'common');
    if (pool.length < n) pool = ORDER_TEMPLATES.filter(t => t.rarity === 'common' && t.tier <= 2);

    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const out = [], usedFaction = new Set();
    // 第一轮：错开派系
    for (const t of shuffled) {
        if (out.length >= n) break;
        if (usedFaction.has(t.faction)) continue;
        out.push(instantiate(t)); usedFaction.add(t.faction);
    }
    // 第二轮：不足则放开派系去重补齐
    for (const t of shuffled) {
        if (out.length >= n) break;
        if (out.some(o => o.templateId === t.id)) continue;
        out.push(instantiate(t));
    }
    return out.slice(0, n);
}

// 校验能否提交：逐项检查材料/碎银，返回 { ok, missing:[{key,need,have}] }（key '__coin' 表示碎银缺口）。
export function canSubmitOrder(player, order) {
    const missing = [];
    const mats = player.materials || {};
    const req = order.req || {};
    for (const [k, need] of Object.entries(req.materials || {})) {
        const have = mats[k] || 0;
        if (have < need) missing.push({ key: k, need, have });
    }
    const needCoin = req.coin || 0;
    if ((player.coin || 0) < needCoin) missing.push({ key: '__coin', need: needCoin, have: player.coin || 0 });
    return { ok: missing.length === 0, missing };
}

// 缺口的中文描述（UI 置灰时显示缺什么）。
export function missingText(missing) {
    return missing.map(m => m.key === '__coin'
        ? `碎银 ${m.have}/${m.need}`
        : `${matName(m.key)} ${m.have}/${m.need}`).join('、');
}

// 对应派系声望 → 委托「碎银/物料」奖励倍率（1 ~ 1+repMax*step）。
export function reputationRewardMult(player, faction) {
    const rep = (player.reputation && player.reputation[faction]) || 0;
    return 1 + rep * BALANCE.orders.repRewardStep;
}

// 声望增减（封顶 [0, repMax]）。
export function addReputation(player, faction, amount) {
    if (!player.reputation || typeof player.reputation !== 'object') player.reputation = {};
    const cur = player.reputation[faction] || 0;
    player.reputation[faction] = Math.max(0, Math.min(BALANCE.orders.repMax, cur + amount));
}

// 结算委托（调用方须先 canSubmitOrder 通过）：扣材料/碎银 → 发奖励(声望放大 coin/物料) → 返回中文日志数组。
export function resolveOrderRewards(player, order) {
    const logs = [];
    const req = order.req || {}, reward = order.reward || {};
    const O = BALANCE.orders;
    if (!player.materials || typeof player.materials !== 'object') player.materials = {};
    // 扣需求
    for (const [k, need] of Object.entries(req.materials || {})) {
        player.materials[k] = (player.materials[k] || 0) - need;
        if (player.materials[k] <= 0) delete player.materials[k];
    }
    if (req.coin) player.coin = Math.max(0, (player.coin || 0) - req.coin);
    // 奖励（碎银/物料受对应派系声望放大）
    const mult = reputationRewardMult(player, order.faction);
    if (reward.coin) { const v = Math.round(reward.coin * mult); player.coin = (player.coin || 0) + v; player.totalCoinEarned = (player.totalCoinEarned || 0) + v; logs.push(`碎银+${v}`); }
    if (reward.exp) { player.exp = (player.exp || 0) + reward.exp; logs.push(`修为+${reward.exp}`); }
    if (reward.honghuangPower) { player.honghuangPower = (player.honghuangPower || 0) + reward.honghuangPower; logs.push(`洪荒之力+${reward.honghuangPower}`); }
    if (reward.materials) for (const [k, q] of Object.entries(reward.materials)) { const v = Math.max(1, Math.round(q * mult)); player.materials[k] = (player.materials[k] || 0) + v; logs.push(`${matName(k)}×${v}`); }
    if (reward.reputation) { addReputation(player, order.faction, reward.reputation); const f = getFaction(order.faction); logs.push(`${f ? f.name : ''}声望+${reward.reputation}`); }
    // 因果：写入当前一世 run.karma（黑市牙行另叠固定业力风险）。未入轮回时 run 仍存在，下次开世会清零。
    let karma = reward.karma || 0;
    if (order.faction === 'blackmarket') karma += O.blackmarketKarmaPerSubmit;
    if (karma && player.run) { player.run.karma = (player.run.karma || 0) + karma; logs.push(`因果${karma > 0 ? '+' : ''}${karma}`); }
    return logs;
}

// 提交后：从 active 移除该委托并补一个新委托（保持 slots 个，尽量不重复模板）。
export function refillOrder(player, uid) {
    const orders = player.orders;
    orders.active = orders.active.filter(o => o.uid !== uid);
    const existing = new Set(orders.active.map(o => o.templateId));
    const fresh = generateOrders(player, BALANCE.orders.slots * 2).filter(o => !existing.has(o.templateId));
    if (fresh.length) orders.active.push(fresh[0]);
    orders.active = orders.active.slice(0, BALANCE.orders.slots);
}

// 刷新「已衰减的连刷步数」（空闲每 decayMs 回落一步；偶尔刷便宜、连刷暴涨）。now 由调用方传 Date.now()。
export function orderRefreshSteps(orders, now) {
    if (!orders) return 0;
    let c = orders.refreshCount || 0;
    if (orders.lastRefreshAt) { const d = Math.floor((now - orders.lastRefreshAt) / BALANCE.orders.refreshDecayMs); if (d > 0) c = Math.max(0, c - d); }
    return c;
}
export function orderRefreshCost(steps, player) {
    const O = BALANCE.orders;
    const mult = player ? (1 + (factionRunModifiers(player).orderRefreshMult || 0)) : 1; // 黑市·牙行门路：刷新降价
    const base = Math.max(1, Math.round(O.refreshBase * mult));
    const raw = O.refreshBase * mult * Math.pow(O.refreshGrowth, Math.max(0, steps));
    return Math.max(base, Math.round(raw / 100) * 100);
}

// 委托态兜底 + 惰性生成（active 为空时填满）。供 render/actions 进页前调用，幂等。
export function ensureOrders(player) {
    if (!player.orders || typeof player.orders !== 'object') player.orders = { active: [], completedCount: 0, refreshCount: 0, lastRefreshAt: 0 };
    if (!Array.isArray(player.orders.active)) player.orders.active = [];
    if (player.orders.active.length === 0) player.orders.active = generateOrders(player);
    return player.orders;
}

// 声望等级文案（UI 展示）。
export function reputationLabel(rep) {
    if (rep >= 80) return '声名远扬';
    if (rep >= 60) return '德高望重';
    if (rep >= 35) return '信誉卓著';
    if (rep >= 15) return '略有交情';
    if (rep > 0) return '初识';
    return '陌路';
}
