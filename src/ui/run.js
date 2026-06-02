// ============================================================
// 视图 + 控制层 · 百世轮回（Roguelite）。
// 渲染「轮回主页」（轮回信息 / 战前策略 / 江湖棋盘 / 永久遗产 / 收尾控制），
// 并以弹窗串起：命格三选一 → 节点(战斗/事件/生产/奇遇/黑市/调息) → 生死结算 → 轮回遗产三选一 → 下一世。
// 纯规则在 run.js（不依赖 domain）；本模块负责把规则落地、实体化奖励(装备/秘籍)、演出与存档。
// ============================================================
import { state } from '../state.js';
import { BALANCE, MATERIALS, PROFESSIONS } from '../config.js';
import { REGIONS, MODIFIER_MAP } from '../config/regions.js';
import { TACTICS, getTactic } from '../config/tactics.js';
import { LIFEPATHS, getLifepath } from '../config/lifepaths.js';
import { LEGACIES, getLegacy } from '../config/legacy.js';
import { RUN_TALENTS, getRunTalent } from '../config/runtalents.js';
import { ENEMY_AFFIXES, getEnemyAffix } from '../config/enemyaffixes.js';
import {
    getModifiers, rollLifepathChoices, rollLegacyChoices, rollRunTalentChoices, grantRunTalent,
    startLife, advanceRegion, grantLegacy, currentRegion, currentRegionIndex, nodeById, reachableNodeIds,
    finalizeNodeEnemy, vsBonusPctFor, nodeAgeCost, pickEventForNode, markEventSeen, choiceAvailable,
    applyEventChoice, planNodeReward, settleLife, applyDeathPenalty, clampHp, isLifeActive, NODE_TYPE_INFO
} from '../run.js';
import { computeStats, simulateBattle, makeGearPiece, generateSkillByMatrix, unlockedGearSlots, rollQuality } from '../domain.js';
import { updatePlayerAttributes, renderBag, hideTooltip } from './render.js';
import { toast, chooseCard, infoDialog, confirmDialog } from './dialog.js';
import { saveGame } from '../storage.js';
import { formatNumber } from '../util.js';
import { checkAchievementsAndNotify } from './achievement.js';

let busy = false; // 异步弹窗期间防重复点击节点

// ---------- 小工具 ----------
function pickArr(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function matName(k) { return MATERIALS[k] ? MATERIALS[k].name : k; }
function maxHpOf(player) { return computeStats(player).stats.hp; }
// 本世气血池：null/非法 → 填满；超出当前上限 → 夹取。返回最大气血。
function ensureRunHp(player) {
    const mx = maxHpOf(player);
    if (player.run.hp === null || !Number.isFinite(player.run.hp)) player.run.hp = mx;
    else player.run.hp = Math.max(0, Math.min(player.run.hp, mx));
    return mx;
}

// 把装备描述符实体化进背包；背包满则自动熔成碎银（与生产引擎一致，不浪费奖励）。
function addGear(player, tier, slot, quality) {
    const slots = unlockedGearSlots(player.realmLevel);
    const key = (slot && slots.find(s => s.key === slot)) ? slot : pickArr(slots).key;
    const q = Number.isFinite(quality) ? quality : rollQuality();
    const piece = makeGearPiece(tier, key, q);
    if (!piece) return { piece: null, sold: false };
    if (player.bag.length < player.bagMax) { player.bag.push(piece); return { piece, sold: false }; }
    player.coin += piece.price; player.totalCoinEarned = (player.totalCoinEarned || 0) + piece.price;
    return { piece, sold: true };
}
function addSkill(player) {
    const sk = generateSkillByMatrix(player.realmLevel);
    if (player.bag.length < player.bagMax) {
        player.bag.push({ id: 'bk_' + Date.now() + Math.random(), name: `秘籍·《${sk.name}》`, type: 'book', payload: sk, price: Math.floor(sk.price / 5) });
        return { sk, stored: true };
    }
    const c = Math.floor(sk.price / 5); player.coin += c; player.totalCoinEarned = (player.totalCoinEarned || 0) + c;
    return { sk, stored: false };
}

// 执行节点奖励计划（planNodeReward 的产物）→ 落地到 player，返回中文日志数组。
function applyPlan(player, plan, maxHp) {
    const logs = [];
    if (plan.coin) { player.coin += plan.coin; player.totalCoinEarned = (player.totalCoinEarned || 0) + plan.coin; player.run.coinGained += plan.coin; logs.push(`碎银+${formatNumber(plan.coin)}`); }
    if (plan.exp) { player.exp += plan.exp; player.run.expGained += plan.exp; logs.push(`修为+${formatNumber(plan.exp)}`); }
    for (const [k, q] of Object.entries(plan.materials)) { player.materials[k] = (player.materials[k] || 0) + q; logs.push(`${matName(k)}×${q}`); }
    if (plan.profExp && player.professions[plan.profExp.prof]) {
        player.professions[plan.profExp.prof].exp += plan.profExp.amount;
        logs.push(`${PROFESSIONS[plan.profExp.prof].name}经验+${plan.profExp.amount}`);
    }
    (plan.items || []).forEach(it => {
        const r = addGear(player, it.tier, it.slot, it.quality);
        if (r.piece) logs.push(r.sold ? `机缘神兵→熔银+${formatNumber(r.piece.price)}` : `获得[${r.piece.name}]`);
    });
    for (let i = 0; i < (plan.skills || 0); i++) { const r = addSkill(player); logs.push(r.stored ? `习得秘籍《${r.sk.name}》` : `秘籍→熔银`); }
    if (plan.heal) { player.run.hp = clampHp((player.run.hp ?? maxHp) + plan.heal, maxHp); logs.push(`气血回复+${formatNumber(plan.heal)}`); }
    return logs;
}

// 事件选项效果预览（短文案）。
const STAT_LABEL = { hp: '气血', atk: '攻击', def: '防御', crit: '暴击', dodge: '闪避' };
function statTag(k, v, prefix) {
    return `${prefix}${STAT_LABEL[k]}${v > 0 ? '+' : ''}${v}${(k === 'crit' || k === 'dodge') ? '%' : ''}`;
}
function effectPreview(eff = {}) {
    const p = [];
    // 本世临时属性（stats）
    if (eff.stats) {
        ['atk', 'def', 'hp', 'crit', 'dodge'].forEach(k => { if (eff.stats[k]) p.push(statTag(k, eff.stats[k], '本世')); });
    }
    // 永久根骨（permStats）
    if (eff.permStats) {
        ['atk', 'def', 'hp', 'crit', 'dodge'].forEach(k => { if (eff.permStats[k]) p.push(statTag(k, eff.permStats[k], '永久')); });
    }
    // 向后兼容：旧版直接写 atk/def/... 的事件（视为本世临时）
    if (!eff.stats && !eff.permStats) {
        ['atk', 'def', 'hp', 'crit', 'dodge'].forEach(k => { if (eff[k]) p.push(statTag(k, eff[k], '本世')); });
    }
    if (eff.hpNow) p.push(`${eff.hpNow > 0 ? '疗伤+' : '受创'}${eff.hpNow}`);
    if (eff.coin) p.push(`碎银${eff.coin > 0 ? '+' : ''}${formatNumber(eff.coin)}`);
    if (eff.exp) p.push(`修为+${formatNumber(eff.exp)}`);
    if (eff.honghuangPower) p.push(`洪荒+${eff.honghuangPower}`);
    if (eff.karma) p.push(`因果${eff.karma > 0 ? '+' : ''}${eff.karma}`);
    if (eff.age) p.push(`寿元${eff.age > 0 ? '+' : ''}${eff.age}`);
    if (eff.material) for (const [k, v] of Object.entries(eff.material)) p.push(`${matName(k)}×${v}`);
    if (eff.item) p.push('随机神兵');
    if (eff.skill) p.push('随机秘籍');
    if (eff.tactic) p.push(`流派转向·${getTactic(eff.tactic).name}`);
    return p.length ? p.join('，') : '（结果未知）';
}
function requireText(req = {}) {
    if (req.flag) return '需特定际遇';
    if (Number.isFinite(req.karmaMin)) return `需因果≥${req.karmaMin}`;
    if (Number.isFinite(req.karmaMax)) return `需因果≤${req.karmaMax}`;
    if (Number.isFinite(req.minAtk)) return `需攻击≥${req.minAtk}`;
    return '条件未满足';
}
function gearStatStr(it) {
    return ['atk', 'def', 'hp', 'crit', 'dodge'].filter(k => it[k]).map(k => `${({ atk: '攻', def: '防', hp: '血', crit: '暴', dodge: '闪' })[k]}${it[k]}${(k === 'crit' || k === 'dodge') ? '%' : ''}`).join(' ');
}
function skillStr(sk) { return sk.type === 'active' ? `主动·${sk.power || 0}倍` : '被动功法'; }

// ============================================================
// 主渲染：轮回主页
// ============================================================
export function renderRunPage() {
    const box = document.getElementById('run-root');
    if (!box) return;
    const player = state.player;
    const legacyBar = renderLegacyBar(player);

    if (!isLifeActive(player)) {
        // 尚未开启本世：引导 + 永久遗产展示 + 开启按钮
        box.innerHTML = `
            <div class="act-card" style="text-align:center;padding:22px;">
                <div style="font-size:30px;margin-bottom:8px;">☯</div>
                <div style="color:var(--color-gold);font-size:16px;font-weight:bold;margin-bottom:10px;">百世轮回 · 江湖路</div>
                <div style="color:#bbb;font-size:13px;line-height:1.9;max-width:640px;margin:0 auto 14px;">
                    每一世，从<b style="color:var(--color-gold)">开局命格</b>起步，踏入分布着<b>战斗·奇遇·矿脉·药谷·黑市·调息</b>的<b>江湖棋盘</b>；
                    寿元(回合)有限，气血一脉相承——节点会消耗寿元、战斗会持续损血。
                    生死有命，<b style="color:var(--color-accent)">陨落或寿尽即结算</b>，可承一缕<b style="color:var(--color-honghuang)">轮回遗产</b>永久带入下一世。
                    旧有的境界、装备、秘籍、生产与丹药皆为<b>永久成长</b>，跨世保留。
                </div>
                ${legacyBar}
                <button class="btn btn-success" style="margin-top:12px;font-size:15px;padding:10px 26px;" data-act="roguelite-begin">⚔️ 开启第一世（选择命格）</button>
            </div>`;
        return;
    }

    const run = player.run;
    const maxHp = ensureRunHp(player);
    const region = currentRegion(player);
    const lp = getLifepath(run.lifepathId);
    const tactic = getTactic(run.selectedTactic);
    const hpPct = Math.max(0, Math.min(100, Math.round((run.hp / maxHp) * 100)));
    const agePct = Math.max(0, Math.min(100, Math.round((run.age / run.maxAge) * 100)));

    // —— ① 轮回信息条 ——
    const info = `
        <div class="act-card" style="margin-bottom:12px;">
            <div class="act-head"><span class="act-title">📜 第 <b style="color:var(--color-gold)">${run.lifeNo}</b> 世 · ${region.name}</span>
                <span style="font-size:12px;color:var(--text-muted)">命格【<b style="color:var(--color-gold)">${lp ? lp.name : '未定'}</b>】 · 因果 <b style="color:${run.karma >= BALANCE.roguelite.karma.highThresh ? 'var(--color-accent)' : (run.karma <= BALANCE.roguelite.karma.lowThresh ? 'var(--color-success)' : 'var(--color-gold)')}">${run.karma}</b></span>
            </div>
            <div class="act-meta" style="margin-top:8px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">气血
                    <span style="flex:1;height:8px;background:#0a0a0a;border:1px solid #222;border-radius:4px;overflow:hidden;"><i style="display:block;height:100%;width:${hpPct}%;background:linear-gradient(90deg,#7b241c,#2ecc71);"></i></span>
                    <b style="color:var(--color-success)">${formatNumber(run.hp)}/${formatNumber(maxHp)}</b>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">寿元
                    <span style="flex:1;height:8px;background:#0a0a0a;border:1px solid #222;border-radius:4px;overflow:hidden;"><i style="display:block;height:100%;width:${agePct}%;background:linear-gradient(90deg,#2d6630,#f1c40f);"></i></span>
                    <b style="color:var(--color-gold)">${run.age}/${run.maxAge} 岁</b>
                </div>
            </div>
        </div>`;

    // —— ② 战前策略选择条 ——
    const tacticBar = `
        <div class="act-card" style="margin-bottom:12px;">
            <div class="act-head"><span class="act-title">🎯 战前策略</span><span style="font-size:12px;color:var(--color-gold)">${tactic.icon} ${tactic.name}</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                ${TACTICS.map(t => `<button class="craft-tab ${t.id === run.selectedTactic ? 'active' : ''}" data-act="set-tactic" data-tactic="${t.id}" title="${t.desc}">${t.icon} ${t.name}</button>`).join('')}
            </div>
            <div class="act-meta" style="margin-top:6px;">${tactic.brief}</div>
        </div>`;

    // —— 本世感悟（runTalents，仅此世）——
    const talentBar = (run.runTalents && run.runTalents.length)
        ? `<div class="act-card" style="margin-bottom:12px;"><div class="act-meta">🌀 本世感悟（仅此世，轮回清空）：${run.runTalents.map(id => { const t = getRunTalent(id); return t ? `<span title="${t.desc}" style="color:var(--color-blue)">${t.icon}${t.name}</span>` : ''; }).join('　')}</div></div>`
        : '';

    // —— ③ 江湖棋盘（分支节点图：分层 + 当前路径可达）——
    const reachable = new Set(reachableNodeIds(player));
    const branched = run.nodeMap.some(n => Number.isFinite(n.row));
    let boardInner;
    if (branched) {
        const rows = {};
        run.nodeMap.forEach(n => { (rows[n.row] = rows[n.row] || []).push(n); });
        const rowKeys = Object.keys(rows).map(Number).sort((a, b) => a - b);
        boardInner = rowKeys.map(rk => {
            const isBossRow = rows[rk].some(n => n.type === 'boss');
            const label = isBossRow ? '⚑ 终·区域之主' : `第 ${rk + 1} 程`;
            const cards = rows[rk].map(n => nodeCardHtml(n, reachable.has(n.id))).join('');
            return `<div style="margin-bottom:8px;"><div style="font-size:11px;color:var(--text-muted);margin:2px 0 4px;letter-spacing:1px;">${label}</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">${cards}</div></div>`;
        }).join('');
    } else {
        boardInner = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">${run.nodeMap.map(n => nodeCardHtml(n, reachable.has(n.id))).join('')}</div>`;
    }
    const board = `
        <div class="act-card" style="margin-bottom:12px;">
            <div class="act-head"><span class="act-title">🗺️ 江湖棋盘 · ${region.name}</span>
                <span style="font-size:12px;color:var(--text-muted)">择路而进，沿当前路径前行</span></div>
            <div id="run-board" style="margin-top:10px;position:relative;">
                <svg id="run-edges" style="position:absolute;left:0;top:0;pointer-events:none;z-index:0;overflow:visible;"></svg>
                <div style="position:relative;z-index:1;">${boardInner}</div>
            </div>
        </div>`;

    // —— ④ 收尾控制（深入下一区域 / 主动轮回） ——
    const bossNode = run.nodeMap.find(n => n.type === 'boss');
    const bossCleared = bossNode && bossNode.visited;
    const isLastRegion = currentRegionIndex(player) >= REGIONS.length - 1;
    let controls = `<div class="act-card"><div class="act-head"><span class="act-title">🕯️ 轮回抉择</span></div><div class="act-meta" style="margin-top:6px;">`;
    if (bossCleared) {
        controls += isLastRegion
            ? '已踏破最后区域【天门古道】！可<b style="color:var(--color-honghuang)">飞升通天</b>（终局结局 + 厚赏 3 缕遗产），或主动轮回承遗产再战。'
            : '已击破区域之主！可<b style="color:var(--color-success)">深入下一区域</b>继续，或<b style="color:var(--color-gold)">急流勇退</b>主动轮回承遗产。';
    } else {
        controls += '探索节点、构筑流派、积攒战力；随时可<b>主动轮回</b>结算本世、换取轮回遗产。';
    }
    controls += `</div><div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">`;
    if (bossCleared && isLastRegion) controls += `<button class="btn" style="background:#3a1020;border-color:var(--color-honghuang);color:var(--color-honghuang);font-weight:bold;" data-act="roguelite-ascend">⭐ 飞升·通天</button>`;
    if (bossCleared && !isLastRegion) controls += `<button class="btn btn-success" data-act="roguelite-advance">⬆️ 深入下一区域</button>`;
    controls += `<button class="btn btn-danger" data-act="roguelite-rebirth">🕯️ 主动轮回（结算本世）</button></div></div>`;

    box.innerHTML = legacyBar + info + talentBar + tacticBar + board + controls;
    // 分支连线：DOM 落地后测量绘制；并绑定一次 resize 重绘（仅轮回页激活时）
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(drawBoardEdges); else drawBoardEdges();
    if (!edgeResizeBound) {
        edgeResizeBound = true;
        window.addEventListener('resize', () => {
            if (document.getElementById('page-run')?.classList.contains('active')) {
                if (typeof requestAnimationFrame === 'function') requestAnimationFrame(drawBoardEdges); else drawBoardEdges();
            }
        });
    }
}

function renderLegacyBar(player) {
    const legacies = player.legacies || [];
    if (!legacies.length) return `<div class="act-meta" style="margin-bottom:10px;color:var(--text-muted)">永久轮回遗产：尚无（首次结算后获得）</div>`;
    // 统计每个遗产的层数
    const count = {};
    legacies.forEach(id => count[id] = (count[id] || 0) + 1);
    const chips = Object.entries(count).map(([id, n]) => {
        const lg = getLegacy(id); if (!lg) return '';
        return `<span title="${lg.desc}" style="display:inline-block;background:#101820;border:1px solid var(--border-color);border-radius:12px;padding:3px 10px;margin:3px;font-size:12px;color:var(--color-gold);">${lg.icon} ${lg.name}${n > 1 ? ` ×${n}` : ''}</span>`;
    }).join('');
    return `<div style="margin-bottom:12px;"><div class="act-meta" style="margin-bottom:4px;">☯ 永久轮回遗产（跨世继承）：</div><div>${chips}</div></div>`;
}

function nodeCardHtml(node, reachable) {
    const info = NODE_TYPE_INFO[node.type] || { icon: '•', label: node.type };
    const stars = '★'.repeat(node.difficulty || 1);
    const mod = node.modifier ? MODIFIER_MAP[node.modifier] : null;
    const modTag = mod ? ` · <span style="color:var(--color-accent)" title="${mod.desc}">【${mod.name}】</span>` : '';
    // 精英/Boss 敌人词条预览
    const affTag = (node.enemyAffixes && node.enemyAffixes.length)
        ? ' · ' + node.enemyAffixes.map(id => { const a = getEnemyAffix(id); return a ? `<span style="color:var(--color-honghuang)" title="${a.desc}">⟨${a.icon}${a.name}⟩</span>` : ''; }).join('')
        : '';
    let btn, dim = '';
    if (node.visited) { btn = `<button class="btn" disabled>✓ 已探索</button>`; dim = 'opacity:0.45;'; }
    else if (!reachable) { btn = `<button class="btn" disabled>🔒 未达</button>`; dim = 'opacity:0.6;'; }
    else btn = `<button class="btn ${node.type === 'boss' ? 'btn-danger' : (node.type === 'rest' ? 'btn-success' : '')}" data-act="roguelite-node" data-node="${node.id}">进入</button>`;
    return `<div class="act-card" data-nid="${node.id}" style="${dim}padding:8px 10px;margin-bottom:0;">
        <div class="act-head"><span class="act-title" style="font-size:13px;">${info.icon} ${node.name}</span>${btn}</div>
        <div class="act-meta">${info.label} · 难度 <span style="color:var(--color-orange)">${stars}</span>${modTag}${affTag}<br>🎁 ${node.rewardHint}</div>
    </div>`;
}

// 棋盘分支连线（SVG 覆盖层）：在 renderRunPage 写入 DOM 后用 rAF 测量节点位置绘制。
// 颜色：已走过(金) / 当前可前往(绿) / 未来(暗灰)。旧平铺图无 next → 不画。
let edgeResizeBound = false;
function drawBoardEdges() {
    const container = document.getElementById('run-board');
    const svg = document.getElementById('run-edges');
    if (!container || !svg) return;
    const player = state.player;
    if (!isLifeActive(player)) { svg.innerHTML = ''; return; }
    const run = player.run;
    const nm = run.nodeMap || [];
    if (!nm.some(n => Array.isArray(n.next))) { svg.innerHTML = ''; return; }
    const reachable = new Set(reachableNodeIds(player));
    const cur = run.currentNodeId;
    const crect = container.getBoundingClientRect();
    svg.setAttribute('width', Math.max(1, Math.round(crect.width)));
    svg.setAttribute('height', Math.max(1, container.scrollHeight));
    const centerOf = (id, edge) => {
        const el = container.querySelector(`[data-nid="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left - crect.left + r.width / 2, y: r.top - crect.top + (edge === 'bottom' ? r.height : 0) };
    };
    let paths = '';
    nm.forEach(src => {
        if (!Array.isArray(src.next)) return;
        const a = centerOf(src.id, 'bottom');
        if (!a) return;
        src.next.forEach(tid => {
            const tgt = nm.find(n => n.id === tid);
            const b = centerOf(tid, 'top');
            if (!tgt || !b) return;
            let col = 'rgba(120,120,120,0.25)', w = 1.5;
            if (src.visited && tgt.visited) { col = 'rgba(241,196,15,0.55)'; w = 2.5; }
            else if (cur && src.id === cur && reachable.has(tid)) { col = 'rgba(46,204,113,0.9)'; w = 3; }
            const midY = (a.y + b.y) / 2;
            paths += `<path d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${a.x.toFixed(1)} ${midY.toFixed(1)}, ${b.x.toFixed(1)} ${midY.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}" stroke="${col}" stroke-width="${w}" fill="none"/>`;
        });
    });
    svg.innerHTML = paths;
}

// ============================================================
// 控制器 · 命格 / 节点 / 结算
// ============================================================
// 开启第一世（新玩家 / 旧档首次入轮回）。
// busy 统一交互锁：不再单靠弹窗遮罩串行化，显式防住「开启/节点/轮回」三类入口的并发重入。
export async function beginRoguelite() {
    if (busy) return;
    busy = true;
    try { await openLifepathChoice(false); } finally { busy = false; }
}

async function openLifepathChoice(nextLife) {
    const player = state.player;
    const ids = rollLifepathChoices();
    const cards = ids.map(id => { const lp = getLifepath(id); return { title: `${lp.icon} ${lp.name}`, desc: lp.desc, value: id }; });
    const nextNo = (player.run.lifeNo || 1) + (nextLife ? 1 : 0);
    const chosen = await chooseCard(`📜 第 ${nextNo} 世 · 开局命格（三选一）`, '命格只影响这一世，轮回后重新抉择。', cards);
    if (!chosen) return; // 理论上不可取消，防御
    startLife(player, chosen, { nextLife });
    ensureRunHp(player);
    saveGame();
    hideTooltip();
    updatePlayerAttributes();
    renderBag();
    renderRunPage();
    const lp = getLifepath(chosen);
    toast(`✨ 第 ${player.run.lifeNo} 世开启 · 命格【${lp.name}】！`, 'success');
    if (player.run.lifeNo === 1) await showRegionIntro(player); // 首世入场叙事（轮回后不再重复首区域引子）
}

// 区域开场叙事（首世入场 / 深入新区域时）。
async function showRegionIntro(player) {
    const region = currentRegion(player);
    if (!region || !region.intro) return;
    await infoDialog(`<div style="color:#d7cfae;line-height:1.95;font-style:italic;">${region.intro}</div>`, `🏞️ ${region.name}`, '踏入江湖');
}

export function setTactic(id) {
    const player = state.player;
    if (!getTactic(id) || !isLifeActive(player)) return;
    player.run.selectedTactic = id;
    saveGame();
    renderRunPage();
}

export async function manualRebirth() {
    const player = state.player;
    if (busy) return;
    if (!isLifeActive(player)) { toast('尚未开启轮回。', 'error'); return; }
    const ok = await confirmDialog('确定主动了结此生、进行轮回结算？本世就此落幕，可换取一缕永久轮回遗产。', '主动轮回');
    if (!ok) return;
    busy = true;
    try { await triggerSettlement('manual'); } finally { busy = false; }
}

export async function advanceRegionAction() {
    const player = state.player;
    if (busy || !isLifeActive(player)) return;
    const bossNode = player.run.nodeMap.find(n => n.type === 'boss');
    if (!bossNode || !bossNode.visited) { toast('需先击破本区域之主，方可深入下一区域。', 'error'); return; }
    if (currentRegionIndex(player) >= REGIONS.length - 1) { toast('已抵最后区域，可飞升通天或渡轮回。', 'info'); return; }
    advanceRegion(player);
    if (player.records) player.records.deepestRegion = Math.max(player.records.deepestRegion || 0, currentRegionIndex(player));
    saveGame();
    updatePlayerAttributes();
    renderRunPage();
    toast(`⬆️ 深入【${currentRegion(player).name}】，新的江湖节点已铺展。`, 'success');
    await showRegionIntro(player);
}

// ⭐ 飞升·通天：踏破最后区域之主后的终局。按因果/流派给不同结局 + 厚赐 + 记录飞升，随后开启新一世。
export async function ascendEnding() {
    const player = state.player;
    if (busy) return;
    if (!isLifeActive(player)) return;
    const bossNode = player.run.nodeMap.find(n => n.type === 'boss');
    const isLast = currentRegionIndex(player) >= REGIONS.length - 1;
    if (!bossNode || !bossNode.visited || !isLast) { toast('需踏破最后区域之主，方可飞升通天。', 'error'); return; }
    busy = true;
    try { await triggerSettlement('ascend'); } finally { busy = false; }
}

// 结局判定：因果优先（魔/善），其次本世主修流派，再退中庸。
function pickEnding(player) {
    const k = player.run.karma || 0;
    const K = BALANCE.roguelite.karma;
    if (k >= K.highThresh) return { title: '⚔️ 煞神临世', text: '你以杀止杀、因果滔天，终以血与煞踏破天门——三界为之战栗，一尊煞神就此降世。' };
    if (k <= K.lowThresh) return { title: '🕊️ 仙道飞升', text: '你广积阴德、护佑苍生，功德圆满。紫气东来，霞光万道，你乘风白日飞升。' };
    const cnt = {};
    (player.run.runTalents || []).forEach(id => { const t = getRunTalent(id); if (t && t.school && t.school !== 'common') cnt[t.school] = (cnt[t.school] || 0) + 1; });
    let top = null, max = 0;
    Object.entries(cnt).forEach(([s, n]) => { if (n > max) { max = n; top = s; } });
    if (top === 'sword') return { title: '🗡️ 剑仙', text: '一剑破万法，剑意通天彻地。你以纯粹的剑道叩开仙门，名列剑仙。' };
    if (top === 'poison') return { title: '☠️ 毒尊', text: '万毒朝宗，奇毒镇压古道。你以一身毒功成就一代毒尊，令正邪两道皆忌。' };
    if (top === 'guard') return { title: '🛡️ 不灭金身', text: '千锤百炼，金身不灭。你以无上守御之道立于天门绝巅，万法不侵。' };
    return { title: '🌟 通天', text: '你踏破五域、登临天门绝巅，超凡入圣，从此名动古今。' };
}

// 进入一个节点（核心循环入口）。
export async function enterNode(nodeId) {
    if (busy) return;
    const player = state.player;
    if (!isLifeActive(player)) { toast('请先选择本世命格，开启江湖路。', 'error'); return; }
    const node = nodeById(player, nodeId);
    if (!node) return;
    if (node.visited) { toast('此节点已探索过。', 'error'); return; }
    if (!reachableNodeIds(player).includes(nodeId)) { toast('此处尚不可达，请沿当前路径前行。', 'error'); return; }
    const maxHp = ensureRunHp(player);
    if (player.run.hp <= 0) { toast('气血已竭，无法行动。', 'error'); return; }

    busy = true;
    try {
        hideTooltip();
        player.run.age += nodeAgeCost(node);   // 进入即流逝寿元
        let dead = false;

        if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
            dead = await resolveBattleNode(player, node, maxHp);
        } else if (node.type === 'event') {
            await resolveEventNode(player, node, maxHp);
        } else if (node.type === 'shop') {
            await resolveShopNode(player, node);
        } else {
            await resolveResourceNode(player, node, maxHp);
        }

        // 仅当节点「完成(visited)」时推进当前位置 —— Boss 未斩则不前进、其前置节点 next 仍含 Boss，可重战。
        if (node.visited) player.run.currentNodeId = node.id;

        if (player.run.hp <= 0) dead = true;
        if (dead) { await triggerSettlement('death'); return; }
        if (player.run.age >= player.run.maxAge) { toast('⏳ 寿元已尽，此生落幕。', 'info'); await triggerSettlement('age'); return; }

        saveGame();
        updatePlayerAttributes();
        renderBag();
        renderRunPage();
    } finally {
        busy = false;
    }
}

async function resolveBattleNode(player, node, maxHp) {
    const stats = computeStats(player).stats;
    const enemy = finalizeNodeEnemy(player, node);
    const mods = getModifiers(player);
    const tactic = getTactic(player.run.selectedTactic);
    const result = simulateBattle(stats, enemy, player.skills, {
        tactic, startHp: player.run.hp, vsBonusPct: vsBonusPctFor(player, node), poisonMult: 1 + mods.poisonMult
    });
    player.run.hp = clampHp(result.remainingHp, maxHp);

    let outcome, rewardLogs = [];
    if (result.remainingHp <= 0) {
        outcome = 'dead';
    } else if (result.enemyDead) {
        outcome = 'win';
        node.visited = true; player.run.visitedNodes.push(node.id);
        const plan = planNodeReward(player, node, maxHp);
        rewardLogs = applyPlan(player, plan, maxHp);
        // 因果反噬·天罚 Boss 厚赏 + 斩之洗去部分业力
        if (enemy.backlash) {
            const K = BALANCE.roguelite.karma;
            const bonusCoin = Math.floor((plan.coin || 0) * K.backlashCoin);
            player.coin += bonusCoin; player.totalCoinEarned = (player.totalCoinEarned || 0) + bonusCoin; player.run.coinGained += bonusCoin;
            player.materials.soul_crystal = (player.materials.soul_crystal || 0) + K.backlashCrystal;
            const before = player.run.karma; player.run.karma = Math.max(0, player.run.karma - K.backlashKarmaCleanse);
            rewardLogs.push(`⚡天罚厚赏 碎银+${formatNumber(bonusCoin)} · 💎×${K.backlashCrystal} · 洗业 ${before}→${player.run.karma}`);
        }
        player.run.nodesDone++;
        player.totalKills = (player.totalKills || 0) + 1;
        if (node.type === 'boss') player.run.clearedBosses++;
        checkAchievementsAndNotify('battle');
    } else {
        outcome = 'survive';
        if (node.type !== 'boss') { node.visited = true; player.run.visitedNodes.push(node.id); } // Boss 未杀可重战
    }
    await battleResultModal(node, enemy, tactic, result, outcome, rewardLogs, maxHp);
    // 精英/Boss 战胜 → 领悟一门本世感悟（流派构筑）
    if (outcome === 'win' && (node.type === 'elite' || node.type === 'boss')) await grantRunTalentChoice(player);
    return outcome === 'dead';
}

// 本世感悟三选一（精英/Boss 战胜、部分奇遇触发）。可「暂不领悟」。
async function grantRunTalentChoice(player) {
    const ids = rollRunTalentChoices(player, 3);
    if (!ids.length) return;
    const cards = ids.map(id => { const t = getRunTalent(id); const owned = (player.run.runTalents || []).includes(id); return { title: `${t.icon} ${t.name}`, desc: t.desc + (owned ? ' <span style="color:var(--color-gold)">（已悟 → 叠加/协同）</span>' : ''), value: id }; });
    const chosen = await chooseCard('🌀 战后感悟 · 三选一（仅此世）', '精此一战，福至心灵——择一门本世感悟，构筑你的流派（剑/毒/守 同系 ≥2 触发协同）。', cards, { cancelLabel: '暂不领悟' });
    if (!chosen) return;
    grantRunTalent(player, chosen);
    if (player.records && Array.isArray(player.records.talentsSeen) && !player.records.talentsSeen.includes(chosen)) player.records.talentsSeen.push(chosen);
    saveGame();
    const t = getRunTalent(chosen);
    toast(`🌀 领悟【${t.name}】！`, 'success');
}

function battleLogHtml(events) {
    const lines = events.slice(-18).map(ev => {
        if (ev.side === 'player') return `<div>第${ev.round}回 · <span style="color:#fff">你</span> ${ev.isCrit ? '<b style="color:var(--color-orange)">暴击</b> ' : ''}-${formatNumber(ev.dmg)}${ev.heal > 0 ? ` <span style="color:var(--color-success)">吸血+${formatNumber(ev.heal)}</span>` : ''}${ev.bleed > 0 ? ` <span style="color:var(--color-accent)">流血-${formatNumber(ev.bleed)}</span>` : ''}</div>`;
        if (ev.side === 'enemy') return `<div>第${ev.round}回 · <span style="color:var(--color-accent)">敌</span> ${ev.charged ? '<b style="color:var(--color-honghuang)">⚡蓄力一击</b> ' : ''}-${formatNumber(ev.dmg)}${ev.reflect > 0 ? ` <span style="color:var(--color-accent)">反伤-${formatNumber(ev.reflect)}</span>` : ''}${ev.eHeal > 0 ? ` <span style="color:var(--color-honghuang)">敌吸血+${formatNumber(ev.eHeal)}</span>` : ''}</div>`;
        if (ev.side === 'tactic') return `<div style="color:var(--color-orange)">第${ev.round}回 · ${ev.text}</div>`;
        if (ev.side === 'ethorns') return `<div style="color:var(--color-accent)">第${ev.round}回 · 敌·荆棘反伤 -${formatNumber(ev.dmg)}</div>`;
        if (ev.side === 'regen') return `<div style="color:var(--color-success)">第${ev.round}回 · 回血+${formatNumber(ev.heal)}</div>`;
        if (ev.side === 'eregen') return `<div style="color:var(--color-honghuang)">第${ev.round}回 · 敌·再生+${formatNumber(ev.heal)}</div>`;
        return `<div style="color:var(--color-blue)">第${ev.round}回 · ${ev.text || '闪避'}</div>`;
    });
    return lines.join('');
}

async function battleResultModal(node, enemy, tactic, result, outcome, rewardLogs, maxHp) {
    const titleMap = { win: '⚔️ 战斗胜利', survive: '🏃 缠斗·敌遁', dead: '☠️ 力竭身陨' };
    const player = state.player;
    const spoils = outcome === 'win'
        ? `<div style="color:var(--color-success);font-size:13px;margin-top:8px;">战利：${rewardLogs.join('　') || '无'}</div>`
        : (outcome === 'survive' ? `<div style="color:var(--color-orange);font-size:12px;margin-top:8px;">缠斗二十回合未能斩杀，敌人遁走，未得战利。</div>` : '');
    const affLine = (enemy.affixes && enemy.affixes.length)
        ? `<div style="color:var(--color-honghuang);font-size:12px;margin-bottom:6px;">敌方词条：${enemy.affixes.map(a => `<span title="${a.desc}">${a.icon}${a.name}</span>`).join('　')}</div>`
        : '';
    const html = `
        <div style="color:#ccc;font-size:13px;margin-bottom:6px;">遭遇【${enemy.name}】(血 ${formatNumber(enemy.maxHp)} / 攻 ${formatNumber(enemy.atk)} / 防 ${formatNumber(enemy.def)})</div>
        ${affLine}
        <div style="color:var(--color-gold);font-size:12px;margin-bottom:8px;">策略：${tactic.icon} ${tactic.name} —— ${tactic.brief}</div>`;
    const html2 = `
        <div style="text-align:left;background:#0a0a0a;border:1px solid #222;border-radius:5px;padding:8px 10px;font-size:12px;line-height:1.7;max-height:200px;overflow-y:auto;font-family:'Consolas',monospace;">${battleLogHtml(result.events)}</div>
        <div style="margin-top:8px;color:${result.remainingHp > 0 ? 'var(--color-success)' : 'var(--color-accent)'};">剩余气血：${formatNumber(Math.max(0, result.remainingHp))} / ${formatNumber(maxHp)}</div>
        ${spoils}`;
    await infoDialog(html + html2, titleMap[outcome] || '战斗', outcome === 'dead' ? '魂归轮回' : '收功');
}

async function resolveEventNode(player, node, maxHp) {
    node.visited = true; player.run.visitedNodes.push(node.id);
    const ev = pickEventForNode(player, node);
    markEventSeen(player, ev.id);
    const cards = ev.choices.map((c, i) => {
        const ok = choiceAvailable(player, c);
        return { title: c.text, desc: effectPreview(c.effects), value: i, disabled: !ok, locked: ok ? null : requireText(c.require) };
    });
    const idx = await chooseCard(`${NODE_TYPE_INFO.event.icon} ${ev.title}`, ev.desc, cards, { cancelLabel: '按兵不动，离去' });
    player.run.nodesDone++;
    if (idx === null || idx === undefined) return;
    const choice = ev.choices[idx];
    const r = applyEventChoice(player, ev, choice, maxHp);
    const logs = r.logs.slice();
    if (r.needItem) {
        const it = r.needItem === true ? { tier: currentRegion(player).tier } : r.needItem;
        const g = addGear(player, it.tier || currentRegion(player).tier, it.slot, it.quality);
        if (g.piece) logs.push(g.sold ? `机缘神兵→熔银+${formatNumber(g.piece.price)}` : `获得[${g.piece.name}]`);
    }
    if (r.needSkill) { const s = addSkill(player); logs.push(s.stored ? `习得秘籍《${s.sk.name}》` : `秘籍→熔银`); }
    if (r.logs.some(l => l.includes('因果'))) checkAchievementsAndNotify('coin'); // 顺带刷新（因果/碎银可能变动）
    const dieNote = player.run.hp <= 0 ? `<div style="color:var(--color-accent);margin-top:8px;">气血耗尽，恐难支撑……</div>` : '';
    await infoDialog(
        `<div style="color:#bbb;line-height:1.8;margin-bottom:10px;">${choice.resultText || ''}</div>` +
        `<div style="color:var(--color-success);font-size:13px;">${logs.join('　') || '（无明显变化）'}</div>${dieNote}`,
        '✦ 际遇', '了然');
    // 奇遇·感悟：触发本世感悟三选一（未陨落时）
    if (r.needTalent && player.run.hp > 0) await grantRunTalentChoice(player);
}

async function resolveResourceNode(player, node, maxHp) {
    node.visited = true; player.run.visitedNodes.push(node.id);
    const plan = planNodeReward(player, node, maxHp);
    const logs = applyPlan(player, plan, maxHp);
    player.run.nodesDone++;
    const info = NODE_TYPE_INFO[node.type];
    await infoDialog(
        `<div style="color:#bbb;margin-bottom:8px;">${node.name} · ${info.desc}</div>` +
        `<div style="color:var(--color-success);font-size:13px;line-height:1.8;">${logs.join('　') || '（无所获）'}</div>`,
        `${info.icon} ${info.label}`, '收下');
}

async function resolveShopNode(player, node) {
    node.visited = true; player.run.visitedNodes.push(node.id);
    player.run.nodesDone++;
    const mods = getModifiers(player);
    const disc = mods.shopDiscount;
    const tier = currentRegion(player).tier;
    const slots = unlockedGearSlots(player.realmLevel);

    // 商品缓存：首次生成后存入 node.shopGoods，避免重入时重摇
    if (!node.shopGoods) {
        const itemTier = Math.min(2, tier); // 节点黑市装备 tier 上限 2，防止后期直接购买顶装
        const goods = [];
        for (let i = 0; i < 3; i++) {
            const piece = makeGearPiece(itemTier, pickArr(slots).key, rollQuality());
            piece.price = Math.max(1, Math.floor(piece.price * (1 - disc)));
            goods.push({ kind: 'item', obj: piece });
        }
        // 秘籍：过滤已学会 / 背包已有同名（至多尝试 6 次，找不到则放行）
        const learnedNames = new Set(player.skills.map(sk => sk.name));
        const bagBookNames = new Set(player.bag.filter(it => it.type === 'book' && it.payload).map(it => it.payload.name));
        let found = false;
        for (let t = 0; t < 6; t++) {
            const sk = generateSkillByMatrix(player.realmLevel);
            if (!learnedNames.has(sk.name) && !bagBookNames.has(sk.name)) {
                sk.price = Math.max(1, Math.floor(6000 * (1 - disc)));
                goods.push({ kind: 'skill', obj: sk });
                found = true;
                break;
            }
        }
        if (!found) {
            const sk = generateSkillByMatrix(player.realmLevel);
            sk.price = Math.max(1, Math.floor(6000 * (1 - disc)));
            goods.push({ kind: 'skill', obj: sk });
        }
        node.shopGoods = goods;
    }

    const goods = node.shopGoods;
    const learnedNames = new Set(player.skills.map(sk => sk.name));
    const bagBookNames = new Set(player.bag.filter(it => it.type === 'book' && it.payload).map(it => it.payload.name));
    const cards = goods.map((g, i) => {
        const price = g.obj.price;
        const afford = player.coin >= price;
        const full = player.bag.length >= player.bagMax;
        const name = g.kind === 'item' ? `[装备] ${g.obj.name}` : `[秘籍] ${g.obj.name}`;
        const desc = `${g.kind === 'item' ? gearStatStr(g.obj) : skillStr(g.obj)} · <b style="color:var(--color-gold)">${formatNumber(price)}文</b>`;
        let locked = null;
        if (full) locked = '行囊已满';
        else if (!afford) locked = '银两不足';
        else if (g.kind === 'skill' && learnedNames.has(g.obj.name)) locked = '已修炼此秘籍';
        else if (g.kind === 'skill' && bagBookNames.has(g.obj.name)) locked = '背包已有此秘籍';
        return { title: name, desc, value: i, disabled: !!(locked), locked };
    });
    const idx = await chooseCard(`💰 黑市商人${disc > 0 ? `（享 ${Math.round(disc * 100)}% 折扣）` : ''}`, `行踪诡秘的商人摆开货摊（你有碎银 ${formatNumber(player.coin)} 文）。`, cards, { cancelLabel: '不买，离开' });
    if (idx === null || idx === undefined) return;
    const g = goods[idx];
    if (player.coin < g.obj.price) { toast('碎银不足。', 'error'); return; }
    if (player.bag.length >= player.bagMax) { toast('行囊已满。', 'error'); return; }
    if (g.kind === 'skill' && learnedNames.has(g.obj.name)) { toast('已修炼此秘籍。', 'error'); return; }
    if (g.kind === 'skill' && bagBookNames.has(g.obj.name)) { toast('背包已有此秘籍。', 'error'); return; }
    player.coin -= g.obj.price;
    if (g.kind === 'item') player.bag.push(g.obj);
    else player.bag.push({ id: 'bk_' + Date.now() + Math.random(), name: `秘籍·《${g.obj.name}》`, type: 'book', payload: g.obj, price: Math.floor(g.obj.price / 5) });
    toast(`购得【${g.obj.name}】。`, 'success');
}

// 生死结算 → 轮回遗产三选一 → 开启下一世。
async function triggerSettlement(reason) {
    const player = state.player;
    const ascend = reason === 'ascend';
    const lost = reason === 'death' ? applyDeathPenalty(player) : 0;
    const s = settleLife(player);
    updateRecords(player, s);
    // 本世就此落幕：先把 run 标记为非活跃并落盘。这样即便玩家在随后『轮回遗产 / 下一世命格』
    // 两个强制弹窗中途关闭页面（其间可能被 5 秒自动存档/pagehide 落盘），重载也会落回
    // 「未开启本世」引导页，而非卡在 hp0/寿尽 的死亡 run 上（点开启即可重新进入）。
    player.run.lifepathId = null;
    saveGame();

    // 飞升·通天：终局厚赐 + 记录飞升 + 结局判定
    let endBanner = '';
    if (ascend) {
        const ending = pickEnding(player);
        player.records.ascensions = (player.records.ascensions || 0) + 1;
        const coinB = 50000 + s.lifeNo * 5000, cryB = 5;
        player.coin += coinB; player.totalCoinEarned = (player.totalCoinEarned || 0) + coinB;
        if (!player.materials) player.materials = {};
        player.materials.soul_crystal = (player.materials.soul_crystal || 0) + cryB;
        saveGame();
        endBanner = `<div style="text-align:center;margin-bottom:10px;border-bottom:1px dashed #333;padding-bottom:10px;">
            <div style="font-size:24px;color:var(--color-honghuang);font-weight:bold;text-shadow:0 0 10px rgba(255,51,102,0.5);">${ending.title}</div>
            <div style="color:#d7cfae;font-style:italic;line-height:1.95;margin-top:8px;">${ending.text}</div>
            <div style="color:var(--color-gold);margin-top:8px;">飞升厚赐：碎银+${formatNumber(coinB)} · 💎神魂结晶×${cryB}</div></div>`;
    }

    const reasonText = ascend ? '——踏破天门，超脱凡尘！' : (reason === 'death' ? '你在江湖厮杀中力竭身陨……' : (reason === 'age' ? '寿元已尽，油尽灯枯……' : '你急流勇退，主动了结此生因果……'));

    // 功绩门槛：本世须达「≥legacyMinNodes 节点 或 击破过 Boss」才发放轮回遗产（反空轮回刷属性）；飞升必得且更丰。
    const minNodes = BALANCE.roguelite.legacyMinNodes;
    const earned = ascend || (s.nodesDone >= minNodes || s.clearedBosses >= 1);
    // 按本世评价缩放：飞升 → 抽 3 缕、池 4；S → 2 缕、池 4；A → 1 缕、池 4；B/C → 1 缕、池 3。
    const draws = !earned ? 0 : (ascend ? 3 : (s.grade === 'S' ? 2 : 1));
    const poolSize = (ascend || s.grade === 'S' || s.grade === 'A') ? 4 : 3;

    const summary = `
        <div style="color:#ccc;line-height:1.9;text-align:left;display:inline-block;">
            <div style="text-align:center;color:${ascend ? 'var(--color-honghuang)' : 'var(--color-accent)'};margin-bottom:8px;">${reasonText}</div>
            <div>第 <b style="color:var(--color-gold)">${s.lifeNo}</b> 世 · 终于 <b>${s.regionName}</b></div>
            <div>探索节点 <b>${s.nodesDone}</b> · 斩区域之主 <b>${s.clearedBosses}</b></div>
            <div>本世进账：碎银 <b style="color:var(--color-gold)">${formatNumber(s.coinGained)}</b> · 修为 <b style="color:var(--color-success)">${formatNumber(s.expGained)}</b></div>
            <div>因果 <b>${s.karma}</b>（${s.karmaDesc}）</div>
            ${lost ? `<div style="color:var(--color-accent)">陨落遗失碎银 ${formatNumber(lost)} 文</div>` : ''}
            <div style="margin-top:8px;">本世评价：<b style="color:${s.gradeColor};font-size:20px;">${s.grade}</b> — ${s.gradeDesc}</div>
        </div>`;

    if (!earned) {
        // 碌碌一生：不发遗产（但本世仍落幕、进入下一世——空轮回只会让世数虚增、敌人随世数走强，得不偿失）。
        await infoDialog(summary + `<div style="margin-top:12px;color:var(--text-muted);">此生功绩浅薄（探索不足 <b>${minNodes}</b> 节点、亦未斩区域之主），<b style="color:var(--color-accent)">未能留下轮回传承</b>。</div>`,
            '☯ 生死结算 · 百世轮回', '黯然轮回');
    } else {
        const drawNote = draws > 1 ? `（${ascend ? '飞升通天' : '评价 ' + s.grade} → 可承 ${draws} 缕遗产！）` : '';
        for (let i = 0; i < draws; i++) {
            const ids = rollLegacyChoices(player, poolSize);
            const cards = ids.map(id => {
                const lg = getLegacy(id); const owned = (player.legacies || []).includes(id);
                return { title: `${lg.icon} ${lg.name}`, desc: lg.desc + (owned ? ' <span style="color:var(--color-gold)">（已有 → 叠加增强）</span>' : ''), value: id };
            });
            const intro = i === 0
                ? endBanner + summary + `<div style="margin-top:10px;color:var(--color-gold);">⬇ 择一缕轮回遗产，永久承入下一世${drawNote}：</div>`
                : `再择一缕遗产承入下一世（${i + 1}/${draws}）：`;
            const chosen = await chooseCard(ascend ? '⭐ 飞升通天 · 轮回遗产' : '☯ 生死结算 · 轮回遗产', intro, cards);
            if (chosen) grantLegacy(player, chosen);
            saveGame();
        }
    }
    await openLifepathChoice(true);
}

// 更新历世记录（江湖录·元进度）。在每次结算（死亡/寿尽/主动/飞升）时调用。
function updateRecords(player, s) {
    const r = player.records;
    if (!r) return;
    r.maxLifeNo = Math.max(r.maxLifeNo || 1, s.lifeNo || 1);
    r.deepestRegion = Math.max(r.deepestRegion || 0, currentRegionIndex(player));
    r.bossKills = (r.bossKills || 0) + (s.clearedBosses || 0);
    if ((s.score || 0) > (r.bestScore || 0)) { r.bestScore = s.score; r.bestGrade = s.grade; }
}

// ============================================================
// 江湖录 · 图鉴 + 历世记录（只读页）
// ============================================================
const SCHOOL_LABEL = { sword: '剑', poison: '毒', guard: '守', common: '通用' };
export function renderCodex() {
    const box = document.getElementById('codex-root');
    if (!box) return;
    const player = state.player;
    const rec = player.records || {};
    const ownedCount = {};
    (player.legacies || []).forEach(id => ownedCount[id] = (ownedCount[id] || 0) + 1);
    const distinctLeg = Object.keys(ownedCount).length;
    const seenTal = (rec.talentsSeen || []).length;
    const deepName = (REGIONS[rec.deepestRegion] || {}).name || '—';

    const recHtml = `<div class="act-card" style="margin-bottom:12px;">
        <div class="act-head"><span class="act-title">📓 历世记录</span></div>
        <div class="act-meta" style="line-height:2;margin-top:6px;font-size:13px;">
            最高世数 <b style="color:var(--color-gold)">${rec.maxLifeNo || 1}</b> · 最深抵达 <b>${deepName}</b> · 最佳评价 <b style="color:var(--color-orange)">${rec.bestGrade || '-'}</b>（${rec.bestScore || 0} 分）<br>
            累计斩区域之主 <b style="color:var(--color-accent)">${rec.bossKills || 0}</b> · 飞升通天 <b style="color:var(--color-honghuang)">${rec.ascensions || 0}</b> 次<br>
            轮回遗产收集 <b style="color:var(--color-gold)">${distinctLeg}/${LEGACIES.length}</b> · 本世感悟见识 <b style="color:var(--color-blue)">${seenTal}/${RUN_TALENTS.length}</b>
        </div></div>`;

    const sec = (title, rows) => `<div class="act-card" style="margin-bottom:12px;"><div class="act-head"><span class="act-title">${title}</span></div><div style="margin-top:6px;">${rows}</div></div>`;
    const row = (head, body, dim) => `<div class="prop-row" style="${dim ? 'opacity:.5;' : ''}flex-direction:column;align-items:flex-start;gap:2px;"><span style="color:var(--color-gold);font-weight:bold;">${head}</span><span style="color:#aaa;font-size:12px;">${body}</span></div>`;

    const tacticsHtml = sec('🎯 战前策略', TACTICS.map(t => row(`${t.icon} ${t.name}`, t.brief)).join(''));
    const lifeHtml = sec('📜 命格（仅当世）', LIFEPATHS.map(l => row(`${l.icon} ${l.name}`, l.desc)).join(''));
    const legHtml = sec(`☯ 轮回遗产（永久 · 已集 ${distinctLeg}/${LEGACIES.length}）`, LEGACIES.map(l => { const n = ownedCount[l.id] || 0; return row(`${l.icon} ${l.name}${n ? ` <span style="color:var(--color-gold)">×${n}</span>` : ''}`, l.desc, !n); }).join(''));
    const talHtml = sec(`🌀 本世奇珍/感悟（已识 ${seenTal}/${RUN_TALENTS.length}）`, RUN_TALENTS.map(t => { const seen = (rec.talentsSeen || []).includes(t.id); return row(`${t.icon} ${t.name} <span style="color:#666;font-size:11px;">[${SCHOOL_LABEL[t.school] || ''}系]</span>`, t.desc, !seen); }).join(''));
    const affHtml = sec('💀 敌人词条', ENEMY_AFFIXES.map(a => row(`${a.icon} ${a.name}`, a.desc)).join(''));
    const tips = `<div class="act-card"><div class="act-head"><span class="act-title">🧭 流派构筑建议</span></div><div class="act-meta" style="line-height:1.95;margin-top:6px;font-size:13px;">
        · <b style="color:var(--color-accent)">剑系</b>：疾攻/养剑 + 剑气纵横/破阵杀意，命格天生剑骨/孤煞命，对精英Boss 爆发。<br>
        · <b style="color:var(--color-blue)">毒系</b>：淬毒 + 毒入骨髓/蚀肌散 + 命格玄阴体 + 遗产毒谱残页，长战碾压高血厚甲。<br>
        · <b style="color:var(--color-success)">守系</b>：守心 + 金钟罩/龟息诀/荆棘护体 + 厚土命/命硬，越级磨怪、稳过反噬 Boss。<br>
        · 同系奇珍 ≥2 触发<b>流派协同</b>；高因果引<b style="color:var(--color-honghuang)">天罚反噬</b>（厚赏+洗业），低因果得善缘庇佑。</div></div>`;

    box.innerHTML = recHtml + tacticsHtml + lifeHtml + legHtml + talHtml + affHtml + tips;
}
