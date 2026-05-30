// ============================================================
// 生产挂机引擎（通用）：驱动「采矿/锻造…」等一切数据驱动的挂机动作。
// 一个动作 = config.ACTIVITIES 里的一条数据（读条时长 + 消耗 + 产出 + 给哪个技能经验）。
// 与战斗挂机(battle.js)互斥：同一时间只跑一个「活计」，互斥协调放在 main.js 的委托里。
// 逻辑（经验曲线/装备生成）在 domain，这里只负责「按节奏落地产出 + 刷界面 + 离线结算」。
// ============================================================
import { state } from '../state.js';
import { BALANCE, ACTIVITIES, MATERIALS, PROFESSIONS } from '../config.js';
import { levelFromExp, generateItemByMatrix, effDurationMs, bonusYieldChance } from '../domain.js';
import { renderProduction, renderWarehouse, renderBag, updatePlayerAttributes } from './render.js';
import { isDragging } from './drag.js';
import { toast, infoDialog } from './dialog.js';
import { formatNumber } from '../util.js';

const ACT_MAP = Object.fromEntries(ACTIVITIES.map(a => [a.id, a]));
export function getActivity(id) { return ACT_MAP[id]; }
export function currentActivity() { return state.player.activity ? ACT_MAP[state.player.activity] : null; }

let timer = null;

// 按「当前技能等级的提速后读条」起循环；升级后调用即可即时加速。
function startTimer(act) {
    if (timer) clearInterval(timer);
    const lv = levelFromExp(state.player.professions[act.prof].exp);
    timer = setInterval(tick, effDurationMs(act.durationMs, lv));
}

// —— 物料仓库增减（map 形式天然堆叠；归零即删键，仓库不残留 0）——
function addMaterial(player, key, qty) {
    player.materials[key] = (player.materials[key] || 0) + qty;
    if (player.materials[key] <= 0) delete player.materials[key];
}
function hasInputs(player, act) {
    if (!act.inputs) return true;
    return Object.entries(act.inputs).every(([k, n]) => (player.materials[k] || 0) >= n);
}

// 当前是否停留在生产页（采矿/锻造）——决定 tick 要不要重绘面板。
// 挂机允许后台跑(逛别的页时不该停)，但隐藏页无需重绘，省开销。
function isProductionPageVisible() {
    return ['page-mining', 'page-smithing'].some(id => {
        const el = document.getElementById(id);
        return el && el.classList.contains('active');
    });
}

// 执行「一次」产出并落地到 player。返回 {ok, item, soldCoin, reason}。
// 原料不足时 ok=false，不扣不产，交由调用方停机。
// 打造类：背包有空位则装备进背包；背包已满则把这件打造品「自动熔炼成碎银」(在线/离线一致)，
//   既不浪费工时、也不会因 96 格上限静默丢失大量离线产出。
function runOnce(act) {
    const player = state.player;
    if (!hasInputs(player, act)) return { ok: false, reason: 'input' };

    if (act.inputs) for (const [k, n] of Object.entries(act.inputs)) addMaterial(player, k, -n);
    // 等级增产：本次有 bonusYieldChance 概率「产出翻倍」(熔炼则同矿出双锭=材料效率)
    const lv = levelFromExp(player.professions[act.prof].exp);
    const mult = (Math.random() < bonusYieldChance(lv)) ? 2 : 1;
    const yielded = {};
    if (act.outputs) for (const [k, n] of Object.entries(act.outputs)) { const q = n * mult; addMaterial(player, k, q); yielded[k] = q; }
    let item = null, soldCoin = 0;
    if (act.craftItem) {
        const gear = generateItemByMatrix(act.craftItem);
        if (player.bag.length < player.bagMax) { player.bag.push(gear); item = gear; }
        else { soldCoin = gear.price; player.coin += gear.price; }
    }
    player.professions[act.prof].exp += act.exp;
    return { ok: true, yielded, doubled: mult > 1, item, soldCoin };
}

// —— 在线 tick：每 durationMs 触发一次 ——
function tick() {
    const player = state.player;
    const act = ACT_MAP[player.activity];
    if (!act) { stopActivity(); return; }

    const before = levelFromExp(player.professions[act.prof].exp);
    const r = runOnce(act);
    if (!r.ok) {
        toast(`原料不足，「${act.name}」已停止。`, 'error');
        stopActivity();
        return;
    }
    const after = levelFromExp(player.professions[act.prof].exp);
    if (after > before) {
        toast(`【${PROFESSIONS[act.prof].name}】突破至 ${after} 级！`, 'success');
        startTimer(act); // 升级→提速生效，按新读条重置循环
    }

    // 仅当生产页可见时才重绘面板（挂机本就允许后台继续，隐藏页无需渲染）
    if (isProductionPageVisible()) { renderProduction(); renderWarehouse(); }
    // 打造产物入背包 / 满袋自动售卖 → 刷新背包与顶栏(碎银)。
    // 拖拽进行中不重渲背包（会销毁拖动源 → pointercancel 中止拖拽），拖完再补刷。
    if ((r.item || r.soldCoin) && !isDragging()) { renderBag(); updatePlayerAttributes(); }
}

// —— 开始一个生产动作（先做等级/原料/背包校验）——
export function startActivity(id) {
    const player = state.player;
    const act = ACT_MAP[id];
    if (!act) return;
    const profName = PROFESSIONS[act.prof].name;
    if (levelFromExp(player.professions[act.prof].exp) < act.levelReq) {
        toast(`需【${profName}】${act.levelReq} 级才能进行「${act.name}」。`, 'error');
        return;
    }
    if (!hasInputs(player, act)) { toast(`原料不足，无法开始「${act.name}」。`, 'error'); return; }

    player.activity = id;
    startTimer(act);
    renderProduction();
}

export function stopActivity() {
    if (timer) { clearInterval(timer); timer = null; }
    if (state.player.activity) {
        state.player.activity = null;
        renderProduction();
    }
}

// 切后台时调用：只暂停 tick 循环、保留 player.activity（切回前台据此补算离线并续挂）。
// 不暂停的话后台定时器被浏览器节流仍会零星空转，且与切回时的离线补算重复计数。
export function pauseActivity() {
    if (timer) { clearInterval(timer); timer = null; }
}

// —— 离线结算：读档时按 (now - lastTickTime) 估算这段时间的产出，封顶 offlineCapMs，
//    并受原料/背包真实约束（逐次 runOnce，料尽/背包满即止）。返回汇总报告或 null。——
export function applyOfflineProgress() {
    const player = state.player;
    const act = ACT_MAP[player.activity];
    if (!act) {
        if (player.activity) console.warn('[生产] 挂机动作已失效(或被移除)，已清空:', player.activity);
        player.activity = null;
        return null;
    }
    const last = player.lastTickTime || 0;
    if (!last) return null;

    const beforeLv = levelFromExp(player.professions[act.prof].exp);
    const effDur = effDurationMs(act.durationMs, beforeLv);                               // 按离线开始时的等级提速估算(略保守)
    const elapsed = Math.max(0, Math.min(Date.now() - last, BALANCE.idle.offlineCapMs));  // 防系统时钟回拨成负值
    const cycles = Math.min(Math.floor(elapsed / effDur), 20000);                         // 上限防极端循环(正常会被原料约束更早停)
    if (cycles <= 0) return null;

    const gained = {};
    let expGained = 0, items = 0, soldCoin = 0, done = 0, stoppedReason = null;
    for (let i = 0; i < cycles; i++) {
        const r = runOnce(act);
        if (!r.ok) { stoppedReason = r.reason; break; }
        expGained += act.exp;
        for (const [k, q] of Object.entries(r.yielded)) gained[k] = (gained[k] || 0) + q; // 含等级增产翻倍
        if (r.item) items++;
        if (r.soldCoin) soldCoin += r.soldCoin;
        done++;
    }
    if (stoppedReason) player.activity = null; // 离线途中料尽 → 停机，回来不再空转
    if (done === 0) return null;

    const afterLv = levelFromExp(player.professions[act.prof].exp);
    return {
        act, profName: PROFESSIONS[act.prof].name, elapsedMs: done * effDur,
        cycles: done, expGained, gained, items, soldCoin, stoppedReason,
        levelUp: afterLv > beforeLv ? { from: beforeLv, to: afterLv } : null
    };
}

// 读档后调用：先结算离线，再（若仍在挂机）重启 tick 循环。返回离线报告供 UI 提示。
export function resumeActivityAfterLoad() {
    const report = applyOfflineProgress();
    const act = ACT_MAP[state.player.activity];
    if (act) startTimer(act);
    return report;
}

function formatDuration(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} 秒`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} 分`;
    return `${Math.floor(m / 60)} 时 ${m % 60} 分`;
}

// 离线收益弹窗（梅尔沃式「欢迎回来」）：技能图标 + 离开时长 + 上限 + 分项收益 + 收功按钮。
export function showOfflineReport(rep) {
    if (!rep) return;
    const capH = Math.round(BALANCE.idle.offlineCapMs / 3600000);
    const profIcon = PROFESSIONS[rep.act.prof] ? PROFESSIONS[rep.act.prof].icon : '⏳';
    const lines = [`获得 <b style="color:var(--color-success)">${formatNumber(rep.expGained)}</b> 点【${rep.profName}】经验`];
    if (rep.levelUp) lines.push(`【${rep.profName}】升至 <b style="color:var(--color-gold)">${rep.levelUp.to}</b> 级`);
    for (const [k, n] of Object.entries(rep.gained)) lines.push(`${MATERIALS[k] ? MATERIALS[k].icon : '📦'} ${MATERIALS[k] ? MATERIALS[k].name : k} ×<b style="color:var(--color-gold)">${formatNumber(n)}</b>`);
    if (rep.items > 0) lines.push(`🗡️ 神兵 ×<b>${rep.items}</b>`);
    if (rep.soldCoin > 0) lines.push(`满袋自动熔炼得碎银 <b style="color:var(--color-gold)">${formatNumber(rep.soldCoin)}</b> 文`);
    const stop = rep.stoppedReason ? `<div style="color:var(--color-accent);font-size:12px;margin-top:10px;">（中途原料耗尽，已停工）</div>` : '';
    const html =
        `<div style="font-size:42px;line-height:1;margin-bottom:6px;">${profIcon}</div>` +
        `<div>你离开了约 <b style="color:#fff;">${formatDuration(rep.elapsedMs)}</b></div>` +
        `<div style="color:var(--color-blue);font-size:12px;margin-bottom:12px;">（离线进度上限 ${capH} 小时）</div>` +
        `<div style="color:#888;font-size:13px;margin-bottom:6px;">闭关「${rep.act.name}」期间：</div>` +
        `<div style="text-align:left;display:inline-block;line-height:2;">${lines.map(l => `<div>· ${l}</div>`).join('')}</div>` +
        stop;
    infoDialog(html, '✨ 闭关出关！', '收功');
}
