// ============================================================
// 渲染层：读 state 把界面画出来。只写 DOM、不改游戏数据。
// 含：属性面板 / 各列表 / 洪炉 / 背包 / 技能 / 切页 / 浮动提示(tooltip)。
// 交互一律走 data-act 属性 + main.js 的事件委托，HTML 里不再有 onclick。
// ============================================================
import { QUALITY_NAMES, QUALITY_COLORS, MAP_NAMES, BALANCE, SKILL_SUFFIXES, REALMS, PROFESSIONS, MATERIALS, ACTIVITIES, GEAR_TIERS, BOSSES, COMBAT_AFFIXES, GEAR_SLOTS, GUIDE_QUESTS, CULTIVATION_PATHS, CRAFT_AFFIXES } from '../config.js';
import { state } from '../state.js';
import { computeStats, getRealmName, generateSkillByMatrix, levelFromExp, expForLevel, enhanceCost, makeGearPiece, gearCraftCost, rollQuality, mapTier, gearUpgradeCost, MAX_CRAFTABLE_TIER, effDurationMs, bonusYieldChance, idleSpeedFactor, bagExpandCost, unlockedGearSlots, syncQuestProgress, getQuestProgress, getCurrentGuideQuest, getGameplayAdvice, getActivePath, isPathUnlocked, pathSwitchCost, getMapModifier, getPathById, pathProductionAdvice, getCraftAffixById, getMapModifierBrief, getBossPlan, getPathRecommendations, getStageAssessment, getNextUnlock, materialSourceHint, shopRefreshCost, decayedRefreshSteps } from '../domain.js';
import { getModifiers } from '../run.js';
import { formatNumber } from '../util.js';
import { renderAchievementPanel } from './achievement.js';

// 装备 6 部位键与中文名（打造/强化/黑市/对比共用）
// 部位中文名从 config.GEAR_SLOTS 派生（含全部部位）。加部位只改 config，渲染自动跟随。
const GEAR_SLOT_LABEL = Object.fromEntries(GEAR_SLOTS.map(s => [s.key, s.label]));

// ---------- 浮动提示 tooltip ----------
export function hideTooltip() {
    const tip = document.getElementById('global-tooltip');
    if (tip) tip.style.display = 'none';
}

function generateHtmlColumn(info, titlePrefix = "", isCurrentlyEquipped = false) {
    if (!info) return `<div class="tooltip-column" style="color:#444; text-align:center; padding-top:40px;">[未装备对应部位]</div>`;
    let html = `<div class="tooltip-column">`;
    if (isCurrentlyEquipped) html += `<div class="equipped-badge">已装备</div>`;

    if (info.type === "book") {
        const isSpecial = info.payload && info.payload.isHongHuang;
        html += `<div class="tooltip-title" style="color:${isSpecial ? 'var(--color-honghuang)' : 'var(--color-gold)'}">${titlePrefix}${info.name}</div>`;
        html += `<div class="tooltip-attr"><span>分类:</span><span style="color:var(--color-blue)">${isSpecial ? '禁忌至高绝学' : '江湖武学秘籍'}</span></div>`;
        html += `<div class="tooltip-attr"><span>回收价值:</span><span style="color:var(--color-gold)">${info.price} 文</span></div>`;

        const pld = info.payload || {};
        let dynamicDesc = (pld.desc || "").replace("[伤害]", pld.power);
        if (pld.hp) dynamicDesc = dynamicDesc.replace("[气血]", pld.hp);
        if (pld.atk) dynamicDesc = dynamicDesc.replace("[攻击]", pld.atk);
        if (pld.def) dynamicDesc = dynamicDesc.replace("[防御]", pld.def);
        if (pld.dodge) dynamicDesc = dynamicDesc.replace("[闪避]", pld.dodge);
        if (pld.crit) dynamicDesc = dynamicDesc.replace("[暴击]", pld.crit);

        html += `<div class="tooltip-desc">【功效】:<br>${dynamicDesc}</div>`;
    } else {
        const qColor = QUALITY_COLORS[info.quality || 0] || "#7f8c8d";
        const enh = info.enhance || 0;
        const em = 1 + enh * BALANCE.enhance.perLevel;
        html += `<div class="tooltip-title" style="color:${qColor}">${titlePrefix}${info.name}${enh ? ` <span style="color:var(--color-gold)">+${enh}</span>` : ''}</div>`;
        html += `<div class="tooltip-attr"><span>品阶质量:</span><span style="color:${qColor}">${QUALITY_NAMES[info.quality || 0] || '未知'} 成色</span></div>`;
        if (info.tier && GEAR_TIERS[info.tier - 1]) html += `<div class="tooltip-attr"><span>套装档:</span><span style="color:var(--color-blue)">T${info.tier}·${GEAR_TIERS[info.tier - 1].name}</span></div>`;
        if (enh) html += `<div class="tooltip-attr"><span>强化等级:</span><span style="color:var(--color-gold)">+${enh}（攻防血 ×${em.toFixed(2)}）</span></div>`;
        html += `<div class="tooltip-attr"><span>回收碎银:</span><span style="color:var(--color-gold)">${info.price} 文</span></div>`;
        html += `<hr style="border:0; border-top:1px dashed #222; margin:6px 0;">`;

        // 攻/防/血受强化放大(与 computeStats 同源)，暴击/闪避不受影响
        const fields = [
            { k: 'atk', n: '攻击力', c: 'var(--color-accent)', enh: true },
            { k: 'def', n: '防御力', c: 'var(--color-blue)', enh: true },
            { k: 'hp', n: '气血总量', c: 'var(--color-success)', enh: true },
            { k: 'crit', n: '暴击率', c: 'var(--color-orange)', s: '%' },
            { k: 'dodge', n: '闪避率', c: 'var(--color-success)', s: '%' }
        ];
        fields.forEach(f => {
            const val = info[f.k] || 0;
            if (val > 0) {
                const show = f.enh ? Math.floor(val * em) : val;
                html += `<div class="tooltip-attr"><span>${f.n}:</span><span style="color:${f.c}">+${show}${f.s || ''}</span></div>`;
            }
        });
    }
    html += `</div>`;
    return html;
}

function generateDiffColumn(curItem, eqItem) {
    let html = `<div class="tooltip-column diff-column">`;
    html += `<div class="tooltip-title" style="color:#aaa;">🔀 变更对比</div>`;
    const fields = [{ k: 'atk', n: '攻击' }, { k: 'def', n: '防御' }, { k: 'hp', n: '气血' }, { k: 'crit', n: '暴击' }, { k: 'dodge', n: '闪避' }];
    // 攻/防/血按各自强化等级放大后再比（与主列、computeStats 同源）——否则把已强化的在装备低估、误导升/降级判断
    const per = BALANCE.enhance.perLevel;
    const enhScaled = { atk: 1, def: 1, hp: 1 };
    const curEm = 1 + (curItem.enhance || 0) * per;
    const eqEm = 1 + (eqItem ? (eqItem.enhance || 0) : 0) * per;
    fields.forEach(f => {
        const curVal = enhScaled[f.k] ? Math.floor((curItem[f.k] || 0) * curEm) : (curItem[f.k] || 0);
        const eqVal = !eqItem ? 0 : (enhScaled[f.k] ? Math.floor((eqItem[f.k] || 0) * eqEm) : (eqItem[f.k] || 0));
        const diff = curVal - eqVal;
        if (diff > 0) html += `<div class="tooltip-attr"><span>${f.n}:</span><span class="compare-tag comp-up">▲ +${diff}</span></div>`;
        else if (diff < 0) html += `<div class="tooltip-attr"><span>${f.n}:</span><span class="compare-tag comp-down">▼ ${diff}</span></div>`;
        else html += `<div class="tooltip-attr"><span>${f.n}:</span><span class="compare-tag comp-equal">--</span></div>`;
    });
    html += `</div>`;
    return html;
}

// 被动功法可叠加的属性（k=字段, n=名称, c=配色, s=后缀）。秘籍列表与详情卡共用，避免两处漂移。
const PASSIVE_ATTRS = [
    { k: 'hp', n: '气血', c: 'var(--color-success)' },
    { k: 'atk', n: '攻击', c: 'var(--color-accent)' },
    { k: 'def', n: '防御', c: 'var(--color-blue)' },
    { k: 'dodge', n: '闪避', c: 'var(--color-success)', s: '%' },
    { k: 'crit', n: '暴击', c: 'var(--color-orange)', s: '%' },
    { k: 'dropRate', n: '掉宝', c: 'var(--color-gold)', s: '%' },
    { k: 'coinRate', n: '碎银', c: 'var(--color-gold)', s: '%' }
];
// 旧五维 + 新词条(暗黑式 affix) 合并表：被动技能的全部可叠属性，列表/详情卡共用一份，避免漂移。
const ALL_PASSIVE_ATTRS = [...PASSIVE_ATTRS, ...COMBAT_AFFIXES];

// 把一门被动技能的所有词条渲染成 "名+值后缀" 片段数组。mult=1 为每重基础值，mult=sk.level 为当前合计。
function passiveParts(sk, mult) {
    return ALL_PASSIVE_ATTRS.filter(d => sk[d.k]).map(d => `${d.n}+${sk[d.k] * mult}${d.s || ''}`);
}

// 一行技能摘要（类型 + 关键加成）：背包操作弹窗 / 移动端点按用，与详情卡同源 BALANCE。
export function skillBrief(sk) {
    if (!sk) return '江湖武学秘籍';
    if (sk.isHongHuang) return `洪荒法则 · 每重五维总量 +${BALANCE.honghuangMultPerLevel * 100}%`;
    if (sk.type === 'active') {
        const heal = sk.healRate ? ` · 吸血 ${Math.round(sk.healRate * 100)}%` : '';
        return `主动招式 · ${sk.power || 0} 倍伤害（每重 +${BALANCE.battle.activeLevelScale}）${heal}`;
    }
    const parts = passiveParts(sk, 1);
    return `被动功法 · 每重 ${parts.length ? parts.join('　') : '（详见功效）'}`;
}

// 把秘籍 desc 里的 [伤害]/[气血]… 占位符替换为实际数值（占位对应字段有值才替换，避免 undefined）。
export function skillDescText(sk) {
    if (!sk || !sk.desc) return '江湖武学秘籍';
    let d = sk.desc.replace('[伤害]', sk.power);
    if (sk.hp) d = d.replace('[气血]', sk.hp);
    if (sk.atk) d = d.replace('[攻击]', sk.atk);
    if (sk.def) d = d.replace('[防御]', sk.def);
    if (sk.dodge) d = d.replace('[闪避]', sk.dodge);
    if (sk.crit) d = d.replace('[暴击]', sk.crit);
    return d;
}

// 绝学详情卡（百修秘籍页 🔍 / 行囊·黑市·洪炉里的秘籍书共用）：按类型展示「每重加成」与「当前等级合计」。
// 倍率/暴击/概率等取自 BALANCE，确保与实战一致（不再用旧版 0.15 的显示近似值）。
// opts.asBook=true：未学的书，把「修为进度」改为「研习上限」；opts.price：显示回收碎银。
function generateSkillColumn(sk, opts = {}) {
    const B = BALANCE.battle;
    const isHH = sk.isHongHuang;
    const lv = sk.level || 1;
    const maxLevel = isHH ? BALANCE.skill.hhMaxLevel : BALANCE.skill.normalMaxLevel;
    const typeName = isHH ? '洪荒法则' : (sk.type === 'active' ? '主动招式' : '被动功法');
    const tColor = isHH ? 'var(--color-honghuang)' : (sk.type === 'active' ? 'var(--color-orange)' : 'var(--color-blue)');

    let html = `<div class="tooltip-column">`;
    html += `<div class="tooltip-title" style="color:${tColor}">《${sk.name}》</div>`;
    html += `<div class="tooltip-attr"><span>类型:</span><span style="color:${tColor}">${typeName}</span></div>`;
    if (opts.asBook) {
        html += `<div class="tooltip-attr"><span>研习上限:</span><span style="color:var(--color-gold)">${maxLevel} 重</span></div>`;
    } else {
        html += `<div class="tooltip-attr"><span>修为:</span><span style="color:var(--color-gold)">第 ${lv} / ${maxLevel} 重${lv >= maxLevel ? '（已满）' : ''}</span></div>`;
    }
    if (opts.price !== undefined) html += `<div class="tooltip-attr"><span>回收碎银:</span><span style="color:var(--color-gold)">${opts.price} 文</span></div>`;
    html += `<hr style="border:0; border-top:1px dashed #222; margin:6px 0;">`;

    if (isHH) {
        html += `<div class="tooltip-attr"><span>每重:</span><span style="color:var(--color-honghuang)">洪荒之力 +1%（五维总量 +2%）</span></div>`;
        html += `<div class="tooltip-attr"><span>当前 ${lv} 重:</span><span style="color:var(--color-honghuang)">洪荒之力 +${lv}% · 五维总量 +${lv * 2}%</span></div>`;
    } else if (sk.type === 'active') {
        const cur = (sk.power || 0) + lv * B.activeLevelScale;
        html += `<div class="tooltip-attr"><span>基础倍率:</span><span>${sk.power || 0} 倍</span></div>`;
        html += `<div class="tooltip-attr"><span>每重:</span><span style="color:var(--color-success)">+${B.activeLevelScale} 倍</span></div>`;
        html += `<div class="tooltip-attr"><span>当前 ${lv} 重:</span><span style="color:var(--color-orange)">${cur.toFixed(2)} 倍伤害</span></div>`;
        html += `<div class="tooltip-attr"><span>暴击时:</span><span style="color:var(--color-orange)">再 ×${B.critMult}</span></div>`;
        if (sk.healRate) html += `<div class="tooltip-attr"><span>吸血:</span><span style="color:var(--color-success)">伤害的 ${Math.round(sk.healRate * 100)}%</span></div>`;
        // 实战：每回合 activeSkillChance 概率施展；多门主动技不再稀释——触发时固定放「有效倍率最高」的一招。
        const pct = Math.round(B.activeSkillChance * 100);
        const activeCount = state.player.skills.filter(s => s.type === 'active').length || 1;
        html += `<div style="font-size:11px;color:#777;margin-top:5px;">战斗中每回合 ${pct}% 概率施展${activeCount > 1 ? `（多门主动技取最强一招，不再稀释）` : ''}</div>`;
    } else {
        const rows = ALL_PASSIVE_ATTRS.filter(d => sk[d.k]);
        if (!rows.length) html += `<div style="color:#777;font-size:12px;">（无直接五维加成，详见下方功效）</div>`;
        rows.forEach(d => {
            html += `<div class="tooltip-attr"><span>${d.n}:</span><span style="color:${d.c}">每重 +${sk[d.k]}${d.s || ''} · 当前 +${sk[d.k] * lv}${d.s || ''}</span></div>`;
        });
    }

    if (sk.desc) html += `<div class="tooltip-desc" style="margin-top:6px;">${skillDescText(sk)}</div>`;
    html += `</div>`;
    return html;
}

function buildTooltipHtml(target) {
    const info = JSON.parse(target.getAttribute('data-tip'));
    const isEquippedSlot = target.id && target.id.startsWith("slot-container-");
    const isForgeSlot = target.id && target.id.startsWith("forge-slot-");
    let finalHtml = `<div class="tooltip-container">`;

    if (info.kind === 'skill') {
        finalHtml += generateSkillColumn(info.sk); // 百修秘籍页绝学详情，需先于 type 判断
    } else if (info.type === "book") {
        // 行囊/黑市/洪炉里的秘籍书：统一复用技能详情卡，明确标注主动/被动/洪荒类型（payload 即完整技能对象）
        finalHtml += info.payload ? generateSkillColumn(info.payload, { price: info.price, asBook: true }) : generateHtmlColumn(info);
    } else if (isEquippedSlot || isForgeSlot) {
        finalHtml += generateHtmlColumn(info, "", isEquippedSlot);
    } else {
        const matchedEquip = state.player.equips[info.type];
        finalHtml += generateHtmlColumn(info, "👉 ", false);
        finalHtml += generateHtmlColumn(matchedEquip, "临·", true);
        finalHtml += generateDiffColumn(info, matchedEquip);
    }
    finalHtml += `</div>`;
    return finalHtml;
}

function showTooltip(target, tipNode) {
    if (document.body.classList.contains('dragging-active')) return; // 拖拽中不弹提示
    try {
        tipNode.innerHTML = buildTooltipHtml(target);
        tipNode.style.display = 'block';
    } catch (err) { hideTooltip(); /* data-tip 解析失败：隐藏，避免残留旧内容 */ }
}

export function initTooltipEvent() {
    const tipNode = document.getElementById('global-tooltip');

    // 触摸设备无 hover：改为点按 [data-tip] 弹出底部信息卡（CSS 媒体查询负责样式）。
    // 带 data-act 的格子（背包/洪炉）交给原有点击委托，避免与操作弹窗冲突。
    if (window.matchMedia('(hover: none)').matches) {
        document.body.addEventListener('click', function (e) {
            if (e.target.closest('#global-tooltip')) { hideTooltip(); return; }
            const tipEl = e.target.closest('[data-tip]');
            const actEl = e.target.closest('[data-act]');
            if (tipEl && !actEl) { showTooltip(tipEl, tipNode); return; }
            hideTooltip();
        });
        return;
    }

    document.body.addEventListener('mouseover', function (e) {
        const target = e.target.closest('[data-tip]');
        if (target) showTooltip(target, tipNode);
    });
    document.body.addEventListener('mousemove', function (e) {
        if (tipNode.style.display === 'block') {
            let x = e.clientX + 15, y = e.clientY + 15;
            if (x + tipNode.offsetWidth > window.innerWidth) x = e.clientX - tipNode.offsetWidth - 15;
            if (y + tipNode.offsetHeight > window.innerHeight) y = e.clientY - tipNode.offsetHeight - 5;
            tipNode.style.left = x + 'px';
            tipNode.style.top = y + 'px';
        }
    });
    document.body.addEventListener('mouseout', function (e) {
        if (e.target.closest('[data-tip]')) tipNode.style.display = 'none';
    });
}

// ---------- 角色属性面板 + 顶栏 + 装备槽 ----------
export function updatePlayerAttributes() {
    const player = state.player;
    if (!player.name) return;

    const { stats, honghuangPower } = computeStats(player);
    state.finalStats = stats;
    player.honghuangPower = honghuangPower;

    document.getElementById('p-name').innerText = player.name;
    document.getElementById('p-realm').innerText = getRealmName(player.realmLevel);
    document.getElementById('p-honghuang').innerText = player.honghuangPower + " %";
    document.getElementById('p-hp').innerText = `${stats.hp}/${stats.hp}`;
    document.getElementById('p-atk').innerText = stats.atk;
    document.getElementById('p-def').innerText = stats.def;
    document.getElementById('p-crit').innerText = stats.crit + "%";
    document.getElementById('p-dodge').innerText = stats.dodge + "%";
    document.getElementById('p-droprate').innerText = stats.dropRate + "%";
    document.getElementById('p-coinrate').innerText = stats.coinRate + "%";

    document.getElementById('global-coin').innerText = player.coin;
    document.getElementById('global-exp').innerText = player.exp;
    document.getElementById('global-reborn').innerText = player.rebornCount;
    document.getElementById('sprite-p-name').innerText = player.name;

    GEAR_SLOTS.forEach(({ key: s, realmReq }) => {
        const eq = player.equips[s];
        const el = document.getElementById(`eq-${s}`);
        const container = document.getElementById(`slot-container-${s}`);
        if (!el || !container) return;                 // 该部位 HTML 槽位不存在则跳过
        const unequipBtn = container.querySelector('[data-act="unequip"]');
        // 未到解锁境界且该槽为空：灰显需求、隐藏卸下按钮（已装备的边界——如轮回回退境界——仍正常显示+可卸）
        if (player.realmLevel < realmReq && !eq) {
            el.innerText = `未解锁（需${getRealmName(realmReq)}）`; el.className = "q-0";
            container.removeAttribute('data-tip');
            if (unequipBtn) unequipBtn.style.display = 'none';
            return;
        }
        if (unequipBtn) unequipBtn.style.display = '';
        if (eq) {
            el.innerText = eq.name + (eq.enhance ? ` +${eq.enhance}` : ''); el.className = `q-${eq.quality}`;
            container.setAttribute('data-tip', JSON.stringify(eq));
        } else {
            el.innerText = `空`; el.className = "q-0";
            container.removeAttribute('data-tip');
        }
    });
    document.getElementById('bag-count').innerText = player.bag.length;
}

// ---------- 百关征途列表 ----------
// 危险等级 → 标签+配色（敌我评估 / Boss 共用风格）。
const DANGER_BADGE = {
    safe: ['🟢 安全', 'var(--color-success)'], risky: ['🟡 有风险', 'var(--color-gold)'],
    deadly: ['🔴 凶险', 'var(--color-accent)'], unknown: ['⚪ 未知', 'var(--text-muted)']
};
// 冒险页「敌我评估」：当前(挂机)关或前沿关的 敌我属性 / 危险等级 / 词缀风险 / 变强建议。复用 getStageAssessment 纯函数。
function renderCombatAssessment(player) {
    const box = document.getElementById('combat-assessment');
    if (!box) return;
    const targetMap = player.currentMapId || Math.min(100, (player.maxMapCleared || 0) + 1);
    const a = getStageAssessment(player, targetMap);
    const [dl, dc] = DANGER_BADGE[a.danger] || DANGER_BADGE.unknown;
    const wr = a.winRate != null ? `（胜率约 ${Math.round(a.winRate * 100)}%）` : '';
    const riskLine = a.mod.isWildland ? '' : `<div class="act-meta" style="color:${a.mod.tone};">${a.mod.icon} 词缀风险：${a.mod.risk.join('、')}</div>`;
    box.innerHTML = `<div class="act-card" style="margin-bottom:0;">
        <div class="act-head"><span class="act-title">⚔️ 敌我评估 · 第${a.mapId}关 ${a.name}</span><span style="color:${dc};font-weight:bold;white-space:nowrap;">${dl}${wr}</span></div>
        <div class="act-meta" style="display:flex;flex-wrap:wrap;gap:2px 14px;">
            <span>👹 敌　血 ${formatNumber(a.enemy.hp)} · 攻 ${formatNumber(a.enemy.atk)} · 防 ${formatNumber(a.enemy.def)}</span>
            <span>🧍 我　血 ${formatNumber(a.me.hp)} · 攻 ${formatNumber(a.me.atk)} · 防 ${formatNumber(a.me.def)} · 暴 ${a.me.crit}% · 闪 ${a.me.dodge}%</span>
        </div>
        ${riskLine}
        <div class="act-meta" style="color:#8fb8e0;">💪 变强建议：${a.fixHints.join(' · ')}</div>
    </div>`;
}

export function renderMapList() {
    const player = state.player;
    renderCombatAssessment(player);   // 顶部敌我评估
    const box = document.getElementById('map-list-box');
    box.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
        const reqLevel = Math.floor((i - 1) * 1.1) + 1;
        const isUnlocked = player.realmLevel >= reqLevel;
        const card = document.createElement('div');
        card.className = `list-card`;
        if (!isUnlocked) card.style.opacity = "0.3";
        const recTier = GEAR_TIERS[mapTier(i) - 1];
        // 地图词缀（确定性，刷新不变）：荒原不显示；其余显示 图标+名称(+精英) 与 描述/推荐流派。
        const { mod, isElite } = getMapModifier(i);
        const isDefaultMod = mod.id === 'wildland';
        const modLabel = isDefaultMod ? '' : ` · <span style="color:${mod.tone};">${mod.icon}${mod.name}${isElite ? '·精英' : ''}</span>`;
        // 词缀说明：复用 getMapModifierBrief（内部即 resolveMapEnv + getMapRewardMods 派生），展示 风险/奖励/应对。
        const brief = isDefaultMod ? null : getMapModifierBrief(i, player);
        const modDesc = brief
            ? `<br><small style="color:${mod.tone};opacity:0.9;">${mod.icon} ${mod.desc}</small>`
            + `<br><small style="color:#d9a06b;">⚠️ 风险：${brief.risk.join('、')}</small>`
            + `<br><small style="color:var(--color-success);opacity:0.9;">🎁 奖励：${brief.reward.join('、')}</small>`
            + `<br><small style="color:#8fb8e0;">💡 应对：${brief.advice.join('；')}</small>`
            : '';
        card.innerHTML = `<div><strong>关卡 ${i}：${MAP_NAMES[i - 1] || `神秘禁区`}</strong> ${!isUnlocked ? '🔒' : ''}<br><small style="color:var(--text-muted)">准入: ${getRealmName(reqLevel)} · 推荐 <span style="color:var(--color-blue)">${recTier.name}套</span> · 掉 ${recTier.name}矿${modLabel}</small>${modDesc}</div><button class="btn" ${isUnlocked ? '' : 'disabled'} data-act="hangup" data-map="${i}">${player.currentMapId === i ? '历练中' : '挑战'}</button>`;
        box.appendChild(card);
    }
}

// ---------- 珍宝黑市（商品存入 player.shop.goods，页面刷新不重摇；按索引购买）----------
function ensureShop(player) {
    if (!player.shop || typeof player.shop !== 'object') {
        player.shop = { goods: [], refreshCount: 0, lastRefreshAt: 0, lifeRefreshCount: 0, booksBoughtThisLife: 0, gearBoughtThisLife: 0 };
    }
    if (!Array.isArray(player.shop.goods)) player.shop.goods = [];
    return player.shop;
}
export function getShopGood(idx) {
    const shop = ensureShop(state.player);
    return shop.goods[idx] ?? null;
}

// 把对象序列化成可安全嵌入「单引号」HTML 属性(data-tip)的串。
// 否则 desc 里的 style='...' 单引号会提前闭合属性，把 JSON 泄漏成可见文本（洪荒孤本即此症）。
// 仅需转义 & 与 '：getAttribute 读取时浏览器自动解码回原 JSON，tooltip 的 JSON.parse 照常工作。
function tipAttr(obj) {
    return JSON.stringify(obj).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
}

// 进货：重随机生成整架商品。只在「付费手动刷新」或「新世初次进入黑市」时调用——切页/购买都不该换货。
// 数据存 player.shop.goods（入存档），页面刷新后货架保持不变。
export function rollShopGoods() {
    const player = state.player;
    const shop = ensureShop(player);
    shop.goods = [];
    if (Math.random() < BALANCE.shopHHChance) {
        shop.goods.push({ kind: 'skill', obj: {
            id: "sk_honghuang_unique", name: "老区长混沌诀", type: "passive", level: 1, isHongHuang: true,
            desc: "远古老区长遗留的法则具现。<br><br><span style='color:var(--color-honghuang)'>【洪荒法则】</span>：本功法最高可修炼至 100 重！每研习精进一重，【老区长的洪荒之力】永久 +1%（即全身各项基础属性暴增 2%）。研习此神功需要极其庞大的天地造化修为！",
            price: BALANCE.hhSkillPrice
        } });
    }
    // 黑市只卖「凡铁/精铁」低档基础套装件，不卖高阶毕业装
    const slotPool = unlockedGearSlots(player.realmLevel);
    const disc = getModifiers(player).shopDiscount || 0;
    const cut = p => Math.max(1, Math.floor(p * (1 - disc)));
    for (let i = 0; i < 3; i++) {
        const lowTier = 1 + Math.floor(Math.random() * 2); // 1=凡铁 / 2=精铁
        const slot = slotPool[Math.floor(Math.random() * slotPool.length)].key;
        const piece = makeGearPiece(lowTier, slot, rollQuality());
        piece.price = cut(piece.price);
        shop.goods.push({ kind: 'item', obj: piece });
    }
    // 普通黑市秘籍：每世最多买 1 本，优先生成未学过/未在背包的
    const skillCount = shop.goods.some(g => g.obj && g.obj.isHongHuang) ? 2 : 3;
    const learnedNames = new Set(player.skills.map(sk => sk.name));
    const bagBookNames = new Set(player.bag.filter(it => it.type === 'book' && it.payload).map(it => it.payload.name));
    for (let i = 0; i < skillCount; i++) {
        let sk = null;
        for (let t = 0; t < 8; t++) {
            const candidate = generateSkillByMatrix(player.realmLevel);
            if (!learnedNames.has(candidate.name) && !bagBookNames.has(candidate.name)) { sk = candidate; break; }
        }
        if (!sk) sk = generateSkillByMatrix(player.realmLevel); // fallback
        sk.price = cut(6000);
        shop.goods.push({ kind: 'skill', obj: sk });
    }
    // 黑市应急材料（价偏高，应急补料用，不能取代采集）
    [{ key: 'ore_copper', qty: 20 }, { key: 'ore_iron', qty: 10 }, { key: 'herb_1', qty: 15 }].forEach(m => {
        const unit = MATERIALS[m.key] ? (MATERIALS[m.key].price || 10) : 10;
        shop.goods.push({ kind: 'material', key: m.key, qty: m.qty, price: Math.round(unit * m.qty * 4) });
    });
    renderShopGoods();
}

// 初始化黑市（启动时调用）：若已有存档货架则直接渲染，否则随机生成。
export function initShopGoods() {
    const shop = ensureShop(state.player);
    if (shop.goods.length) renderShopGoods();
    else rollShopGoods();
}

// 买走一件后从货架移除（不重随机，保留其余）。控制层购买成功后调用，再 renderShopGoods。
export function removeShopGood(idx) {
    const shop = ensureShop(state.player);
    if (idx >= 0 && idx < shop.goods.length) shop.goods.splice(idx, 1);
}

// 纯渲染当前货架（切页 / 购买后调用，不重随机）。货架为空时提示去刷新。
export function renderShopGoods() {
    const player = state.player;
    const shop = ensureShop(player);
    const shopGoods = shop.goods;
    const box = document.getElementById('shop-goods-box');
    box.innerHTML = "";
    // 本世刷新上限（基础 2 次 + 遗产「黑市旧识」每层 +1）
    const lifeRefreshCount = shop.lifeRefreshCount || 0;
    const maxRefresh = 2 + (player.legacies || []).filter(id => id === 'blackmarket').length;
    const canRefresh = lifeRefreshCount < maxRefresh;
    // 刷新按钮：动态价 + 本世次数提示
    const refreshBtn = document.querySelector('[data-act="refresh-shop"]');
    if (refreshBtn) {
        if (canRefresh) {
            refreshBtn.textContent = `手动刷新 (${formatNumber(shopRefreshCost(decayedRefreshSteps(shop, Date.now())))}文) [${lifeRefreshCount}/${maxRefresh}]`;
            refreshBtn.disabled = false;
        } else {
            refreshBtn.textContent = `本世刷新已达上限 (${lifeRefreshCount}/${maxRefresh})`;
            refreshBtn.disabled = true;
        }
    }
    // 本世购书状态
    const booksBought = shop.booksBoughtThisLife || 0;
    const bookLimit = 1;
    const booksLimitReached = booksBought >= bookLimit;
    const learnedNames = new Set(player.skills.map(sk => sk.name));
    const bagBookNames = new Set(player.bag.filter(it => it.type === 'book' && it.payload).map(it => it.payload.name));
    if (shopGoods.length === 0) {
        box.innerHTML = `<div class="list-card" style="justify-content:center; color:var(--text-muted);">— 黑市货已售罄，${canRefresh ? '点上方「刷新」可重新进货' : '本世刷新次数已达上限'} —</div>`;
        return;
    }
    shopGoods.forEach((g, idx) => {
        const card = document.createElement('div');
        card.className = "list-card";
        if (g.kind === 'item') {
            const it = g.obj;
            card.innerHTML = `<span data-tip='${tipAttr(it)}' style="cursor:help;"><b class="q-${it.quality}">[装备] ${it.name} 🔍</b></span><button class="btn btn-success" data-act="buy-item" data-idx="${idx}">购买 (${it.price}文)</button>`;
        } else if (g.kind === 'material') {
            const mn = MATERIALS[g.key] ? MATERIALS[g.key].name : g.key;
            const ico = MATERIALS[g.key] ? MATERIALS[g.key].icon : '📦';
            card.innerHTML = `<span><b>${ico} [材料] ${mn} ×${g.qty}</b> <small style="color:var(--text-muted)">应急补料·价偏高</small></span><button class="btn" data-act="buy-material" data-idx="${idx}">购买 (${formatNumber(g.price)}文)</button>`;
        } else if (g.obj.isHongHuang) {
            const hhSkill = g.obj;
            const bookItem = { name: `禁忌秘籍·《${hhSkill.name}》`, type: "book", payload: hhSkill, price: hhSkill.price };
            card.style.border = "1px solid var(--color-honghuang)";
            card.style.background = "linear-gradient(90deg, #1a050c 0%, #111 100%)";
            card.innerHTML = `<span data-tip='${tipAttr(bookItem)}' style="cursor:help;"><strong class="q-hh">🔥 绝世孤本《${hhSkill.name}》 🔍</strong></span><button class="btn btn-danger" data-act="buy-skill" data-idx="${idx}">购买 (${hhSkill.price}文)</button>`;
        } else {
            const sk = g.obj;
            const bookItem = { name: `秘籍·《${sk.name}》`, type: "book", payload: sk, price: sk.price };
            const alreadyLearned = learnedNames.has(sk.name);
            const inBag = bagBookNames.has(sk.name);
            const skillBlocked = booksLimitReached || alreadyLearned || inBag;
            const blockReason = alreadyLearned ? '已修炼' : (inBag ? '背包已有' : (booksLimitReached ? `本世限购${bookLimit}本` : ''));
            const btnHtml = skillBlocked
                ? `<button class="btn" disabled title="${blockReason}" style="opacity:.5;">购买 (${sk.price}文) <small>${blockReason}</small></button>`
                : `<button class="btn btn-success" data-act="buy-skill" data-idx="${idx}">购买 (${sk.price}文)</button>`;
            card.innerHTML = `<span data-tip='${tipAttr(bookItem)}' style="cursor:help;"><strong style="color:${skillBlocked ? 'var(--text-muted)' : 'var(--color-gold)'};">📜 绝学《${sk.name}》 🔍</strong></span>${btnHtml}`;
        }
        box.appendChild(card);
    });
    // 购书状态提示
    if (booksBought > 0) {
        const note = document.createElement('div');
        note.className = "list-card";
        note.style.justifyContent = 'center';
        note.style.color = 'var(--text-muted)';
        note.style.fontSize = '12px';
        note.textContent = `本世已购 ${booksBought}/${bookLimit} 本秘籍（轮回后重置）`;
        box.appendChild(note);
    }
}

// ---------- 黑市常驻：行囊扩容（梅尔沃 Bank Slot 式，不随刷新售罄）----------
export function renderBagExpand() {
    const box = document.getElementById('bag-expand-box');
    if (!box) return;
    const player = state.player;
    const info = bagExpandCost(player.bagMax);
    if (!info) { // 已达上限
        box.innerHTML = `<div class="list-card" style="justify-content:space-between;">
            <span>🎒 行囊容量 <b class="q-5">${player.bagMax}</b> 格</span>
            <span style="color:var(--color-gold);">已扩至上限</span>
        </div>`;
        return;
    }
    const afford = player.coin >= info.cost;
    box.innerHTML = `<div class="list-card" style="justify-content:space-between;">
        <span>🎒 行囊容量 <b style="color:var(--color-gold);">${player.bagMax}</b> / ${BALANCE.bag.max} 格 —— 再 +${info.addSlots} 格</span>
        <button class="btn btn-success" data-act="buy-bag-slot"${afford ? '' : ' disabled style="opacity:.5;"'}>扩容 (${formatNumber(info.cost)}文)</button>
    </div>`;
}

// ---------- 天地洪炉两槽 ----------
export function renderForge() {
    const forgeItems = state.forgeItems;
    for (let i = 0; i < 2; i++) {
        const slot = document.getElementById('forge-slot-' + i);
        const item = forgeItems[i];
        if (item) {
            const qClass = (item.payload && item.payload.isHongHuang) ? 'q-hh' : (item.quality !== undefined ? `q-${item.quality}` : '');
            slot.className = "item-slot forge-glow " + qClass;
            slot.innerHTML = `<b>${item.name.substring(0, 5)}</b>`;
            slot.setAttribute('data-tip', JSON.stringify(item));
        } else {
            slot.className = "item-slot";
            slot.innerHTML = "空";
            slot.removeAttribute('data-tip');
        }
    }
}

// ---------- 背包格子 ----------
export function renderBag() {
    const player = state.player;
    const grid = document.getElementById('bag-grid');
    grid.innerHTML = "";
    for (let i = 0; i < player.bagMax; i++) {
        const item = player.bag[i];
        const slot = document.createElement('div');
        slot.className = "item-slot";
        if (item) {
            if (item.payload && item.payload.isHongHuang) slot.classList.add(`q-hh`);
            else if (item.quality !== undefined) slot.classList.add(`q-${item.quality}`);
            let tag = '装', tagColor = '#666';
            if (item.type === 'book') {
                const p = item.payload || {};
                if (p.isHongHuang) { tag = '洪'; tagColor = 'var(--color-honghuang)'; }
                else if (p.type === 'active') { tag = '主'; tagColor = 'var(--color-orange)'; }
                else { tag = '被'; tagColor = 'var(--color-blue)'; }
            }
            slot.innerHTML = `<b>${item.name.split('·')[1]?.substring(0, 5) || item.name.substring(0, 5)}</b><br><span style="color:${tagColor};font-size:9px;">${tag}</span>`;
            slot.setAttribute('data-tip', JSON.stringify(item));
            slot.setAttribute('data-act', 'use-bag');
            slot.setAttribute('data-idx', String(i));
        } else {
            slot.innerHTML = "<span style='color:#1a1a1a'>.</span>";
        }
        grid.appendChild(slot);
    }
    document.getElementById('bag-count').innerText = player.bag.length;
}

// ---------- 秘籍列表 ----------
export function renderPlayerSkills() {
    const player = state.player;
    const box = document.getElementById('player-skills-box');
    box.innerHTML = "";
    player.skills.forEach((sk, index) => {
        const card = document.createElement('div');
        card.className = "list-card";
        const isHH = sk.isHongHuang;
        const maxLevel = isHH ? BALANCE.skill.hhMaxLevel : BALANCE.skill.normalMaxLevel;
        const cost = isHH ? (sk.level * BALANCE.skill.hhUpgradeCostPerLevel) : (sk.level * BALANCE.skill.normalUpgradeCostPerLevel);

        let eff = "";
        if (isHH) {
            card.style.border = "1px solid rgba(255,51,102,0.3)";
            eff = `<span style="color:var(--color-honghuang)">洪荒之力 +${sk.level}%（五维总量 +${sk.level * 2}%）</span>`;
        } else if (sk.type === "active") {
            const cur = ((sk.power || 0) + sk.level * BALANCE.battle.activeLevelScale).toFixed(2);
            eff = `主战招式 · 当前 ${cur} 倍伤害${sk.healRate ? ` · 吸血 ${Math.round(sk.healRate * 100)}%` : ''}`;
        } else {
            const parts = passiveParts(sk, sk.level);
            eff = `功法被动 · ${parts.length ? parts.join('　') : '点 🔍 查看功效'}`;
        }

        const tip = tipAttr({ kind: 'skill', sk }); // 详情卡数据；tipAttr 转义单引号，避免洪荒 desc 截断属性
        const upgradeBtn = `<button class="btn" ${sk.level >= maxLevel ? 'disabled' : ''} data-act="upgrade-skill" data-idx="${index}">${sk.level >= maxLevel ? '已至化境' : `潜心研习(耗${formatNumber(cost)}修为)`}</button>`;
        // 仅「主动招式」可遗忘（精简主动技池、提高强招触发率）；被动/洪荒不显示遗忘按钮。
        const forgetBtn = (sk.type === 'active' && !isHH) ? `<button class="btn btn-danger" style="padding:8px 10px;" data-act="forget-skill" data-idx="${index}">遗忘</button>` : '';
        card.innerHTML = `<div><span data-tip='${tip}' style="cursor:help;"><strong class="${isHH ? 'q-hh' : ''}">《${sk.name}》 🔍</strong></span> <span style="color:var(--color-gold);">[第${sk.level}/${maxLevel}重]</span><br><small style="color:var(--text-muted)">${eff}</small></div><div class="skill-btns">${upgradeBtn}${forgetBtn}</div>`;
        box.appendChild(card);
    });
}

// ---------- 生产技能页（采矿 / 锻造…通用，数据来自 config.ACTIVITIES）----------
function matName(k) { return MATERIALS[k] ? MATERIALS[k].name : k; }
function matIcon(k) { return MATERIALS[k] ? MATERIALS[k].icon : '📦'; }

function activityCardHtml(act, player) {
    const lv = levelFromExp(player.professions[act.prof].exp);
    const locked = lv < act.levelReq;
    const running = player.activity === act.id;
    const profName = PROFESSIONS[act.prof].name;

    const outParts = [];
    if (act.outputs) for (const [k, n] of Object.entries(act.outputs)) outParts.push(`${matName(k)}×${n}`);
    if (act.craftItem) outParts.push('随机神兵→行囊');
    const effDur = effDurationMs(act.durationMs, lv);
    const meta = [`产出 ${outParts.join('、')}`, `经验+${act.exp}`, `${(effDur / 1000).toFixed(1)}秒`];
    // 每小时预估产出（按当前提速读条；不计离线/双倍，故为保守下限）
    if (act.outputs) {
        const [k0, n0] = Object.entries(act.outputs)[0];
        meta.push(`约 ${formatNumber(Math.round(3600000 / effDur * n0))} ${matName(k0)}/时`);
    }
    if (act.inputs) {
        const inParts = Object.entries(act.inputs).map(([k, n]) => `${matName(k)}×${n}`);
        meta.push(`消耗 ${inParts.join('、')}`);
    }
    const ico = act.craftItem ? '🗡️' : (act.outputs ? matIcon(Object.keys(act.outputs)[0]) : '⛏️');

    let btn;
    if (locked) btn = `<button class="btn" disabled>🔒 需${profName}${act.levelReq}级</button>`;
    else if (running) btn = `<button class="btn btn-danger" data-act="stop-activity">⏹ 停止</button>`;
    else btn = `<button class="btn btn-success" data-act="start-activity" data-id="${act.id}">▶ 开始</button>`;

    return `<div class="act-card ${locked ? 'locked' : ''} ${running ? 'running' : ''}">
        <div class="act-head"><span class="act-title">${ico} ${act.name}</span>${btn}</div>
        <div class="act-meta">${meta.join(' · ')}</div>
        <div class="act-progress"><i style="animation-duration:${effDur}ms"></i></div>
    </div>`;
}

// 渲染所有生产技能区块（等级/经验条/动作列表）。各 DOM 不存在时静默跳过，故未建页也安全。
export function renderProduction() {
    const player = state.player;
    const maxLv = BALANCE.idle.maxLevel;
    Object.keys(PROFESSIONS).forEach(prof => {
        const lvEl = document.getElementById(`${prof}-level`);
        if (!lvEl) return;
        const exp = player.professions[prof] ? player.professions[prof].exp : 0;
        const lv = levelFromExp(exp);
        lvEl.innerText = `Lv.${lv}`;
        const cur = expForLevel(lv), next = expForLevel(lv + 1);
        const bar = document.getElementById(`${prof}-exp-bar`);
        if (bar) bar.style.width = (lv >= maxLv ? 100 : Math.floor(((exp - cur) / (next - cur)) * 100)) + '%';
        const expTxt = document.getElementById(`${prof}-exp-text`);
        if (expTxt) {
            const spd = Math.round((1 - idleSpeedFactor(lv)) * 100);
            const yld = Math.round(bonusYieldChance(lv) * 100);
            const base = lv >= maxLv ? '已臻化境（满级）' : `修为 ${formatNumber(exp - cur)} / ${formatNumber(next - cur)}`;
            // 下一解锁 + 当前活动产出（复用 getNextUnlock 纯函数）——让玩家清楚「再练多少能解锁啥、现在在产啥」。
            const nu = getNextUnlock(player, prof);
            const unlockLine = nu.atMax ? '已满级，动作全解锁'
                : (nu.nextUnlock ? `下一解锁：Lv.${nu.nextUnlock.levelReq}「${nu.nextUnlock.name}」(产 ${nu.nextUnlock.output})，还差修为 ${formatNumber(nu.toNext)}`
                    : '本技能动作已全部解锁');
            const curLine = nu.current ? `　·　▶ 当前：${nu.current.name} → 每次产 ${nu.current.output}` : '';
            expTxt.innerHTML = `${base} · 提速 ${spd}% · 双倍产出 ${yld}%<br><span style="color:var(--color-blue);">🔓 ${unlockLine}${curLine}</span>`;
        }
        const list = document.getElementById(`${prof}-list`);
        if (list) list.innerHTML = ACTIVITIES.filter(a => a.prof === prof).map(a => activityCardHtml(a, player)).join('');
    });
}

// 渲染物料仓库（采矿/锻造两页各有一个容器，内容相同：列出所有持有量>0 的物料）。
// 物料用途提示（第五阶段）：让玩家明白每种料能干什么，并体会「同一批料只能挪作一处」的选择成本。
function matUsage(k) {
    if (k.startsWith('ore_')) return '熔炼→锭';
    if (k.startsWith('ingot_')) return '强化 / 打造';
    if (k.startsWith('herb_')) return '炼丹';
    if (k === 'soul_crystal') return '神兵进阶';
    return '';
}
export function renderWarehouse() {
    const player = state.player;
    const advice = `<div class="prof-exp-text" style="margin-bottom:6px;color:var(--color-blue);">📌 ${pathProductionAdvice(player)}</div>`;
    const legend = `<div class="prof-exp-text" style="margin-bottom:8px;font-size:11px;">用途：矿石→熔炼成锭；锭→强化神兵 / 打造装备（二者抢同一产能）；草药→炼丹；神魂结晶→神兵进阶。</div>`;
    const keys = Object.keys(MATERIALS).filter(k => (player.materials[k] || 0) > 0 && !MATERIALS[k].pill); // 丹药不入仓库(改在丹房服用)
    const grid = keys.length
        ? `<div class="wh-grid">` + keys.map(k => {
            const qty = player.materials[k], price = MATERIALS[k].price || 0, use = matUsage(k);
            const sell = price > 0 ? `<button class="btn wh-sell" data-act="sell-material" data-key="${k}">卖 ${formatNumber(qty * price)}文</button>` : '';
            return `<div class="wh-item"><div class="wh-ico">${MATERIALS[k].icon}</div>${MATERIALS[k].name}<br><span class="wh-qty">${formatNumber(qty)}</span>${use ? `<div style="font-size:9px;color:var(--text-muted);">${use}</div>` : ''}${sell}</div>`;
        }).join('') + `</div>`
        : `<div class="wh-empty">— 仓库空空如也，去采矿 / 熔炼积攒物料吧 —</div>`;
    const html = advice + legend + grid;
    ['warehouse-mining', 'warehouse-smithing', 'warehouse-herb', 'warehouse-alchemy'].forEach(id => {
        const box = document.getElementById(id);
        if (box) box.innerHTML = html;
    });
}

// 丹房：列已炼丹药(materials 里带 pill 标记者) + 服用按钮，并显示当前永久根骨增益累计。
const PILL_STAT_LABEL = { hp: '气血', atk: '攻击', def: '防御', crit: '暴击', dodge: '闪避' };
function pillEffStr(bonus) {
    return Object.entries(bonus).map(([k, v]) => `${PILL_STAT_LABEL[k]}+${v}${(k === 'crit' || k === 'dodge') ? '%' : ''}`).join('、');
}
export function renderPills() {
    const box = document.getElementById('pill-box');
    if (!box) return;
    const player = state.player;
    const pb = player.pillBonus || {};
    const cur = Object.keys(PILL_STAT_LABEL).filter(k => pb[k]).map(k => `${PILL_STAT_LABEL[k]}+${pb[k]}${(k === 'crit' || k === 'dodge') ? '%' : ''}`).join('　') || '尚无';
    const head = `<div class="prof-exp-text" style="margin-bottom:10px;">当前丹药永久根骨：<b style="color:var(--color-gold)">${cur}</b>（跨轮回保留）</div>`;
    const pillKeys = Object.keys(MATERIALS).filter(k => MATERIALS[k].pill && (player.materials[k] || 0) > 0);
    if (!pillKeys.length) {
        box.innerHTML = head + `<div class="wh-empty">— 暂无丹药。去左侧「炼丹」炼制，丹成后在此服用 —</div>`;
        return;
    }
    box.innerHTML = head + pillKeys.map(k => {
        const m = MATERIALS[k], qty = player.materials[k];
        return `<div class="act-card">
            <div class="act-head"><span class="act-title">${m.icon} ${m.name} ×${formatNumber(qty)}</span>
                <button class="btn btn-success" data-act="take-pill" data-key="${k}">服用</button></div>
            <div class="act-meta">服后永久 ${pillEffStr(m.pill)}</div>
        </div>`;
    }).join('');
}

// ---------- 神兵强化页（用锭+碎银强化已装备的装备）----------
export function renderEnhance() {
    const player = state.player;
    const box = document.getElementById('enhance-slots');
    if (box) {
        const maxEm = (1 + BALANCE.enhance.maxLevel * BALANCE.enhance.perLevel).toFixed(2);
        const tip = `<div style="font-size:11px;color:var(--text-muted);line-height:1.6;margin-bottom:10px;">每 +1 让该装备「攻/防/血」×(1+${BALANCE.enhance.perLevel}·N)，最高 +${BALANCE.enhance.maxLevel}（满级 ×${maxEm}）。越高 +级越吃高级锭——黑市/战斗都给不了，只能挖矿熔炼来堆。</div>`;
        box.innerHTML = tip + unlockedGearSlots(player.realmLevel).map(({ key: slot, label }) => {
            const it = player.equips[slot];
            if (!it) {
                return `<div class="act-card locked"><div class="act-head"><span class="act-title">【${label}】</span><span style="color:var(--text-muted);font-size:12px;">— 未装备 —</span></div></div>`;
            }
            const lv = it.enhance || 0;
            const em = 1 + lv * BALANCE.enhance.perLevel;
            const qC = QUALITY_COLORS[it.quality || 0] || '#7f8c8d';
            const statNow = ['atk', 'def', 'hp'].filter(k => it[k])
                .map(k => `${({ atk: '攻', def: '防', hp: '血' })[k]} ${Math.floor(it[k] * em)}`).join('　') || '无主属性';
            const cost = enhanceCost(it);
            let btn, costLine;
            if (!cost) {
                btn = `<button class="btn" disabled>已满强化</button>`;
                costLine = `已达上限 +${BALANCE.enhance.maxLevel}`;
            } else {
                const have = player.materials[cost.ingotKey] || 0;
                const okMat = have >= cost.ingotQty, okCoin = player.coin >= cost.coin;
                const matName = MATERIALS[cost.ingotKey] ? MATERIALS[cost.ingotKey].name : cost.ingotKey;
                const matCol = okMat ? 'var(--color-success)' : 'var(--color-accent)';
                const coinCol = okCoin ? 'var(--color-gold)' : 'var(--color-accent)';
                costLine = `升 +${cost.targetLevel} 需 <span style="color:${matCol}">${matName}×${cost.ingotQty}(有${formatNumber(have)})</span> · <span style="color:${coinCol}">碎银 ${formatNumber(cost.coin)}</span>`;
                if (!okMat) costLine += `<br><span style="color:var(--color-accent);">缺口：还差 ${matName}×${formatNumber(cost.ingotQty - have)} → ${materialSourceHint(cost.ingotKey)}</span>`;
                btn = `<button class="btn btn-success" data-act="enhance-equip" data-slot="${slot}" ${okMat && okCoin ? '' : 'disabled'}>⚒ 强化 +${cost.targetLevel}</button>`;
            }
            return `<div class="act-card ${lv > 0 ? 'running' : ''}">
                <div class="act-head"><span class="act-title" style="color:${qC}">【${label}】${it.name}${lv ? ` <b style="color:var(--color-gold)">+${lv}</b>` : ''}</span>${btn}</div>
                <div class="act-meta">当前 ${statNow}（强化倍率 ×${em.toFixed(2)}）<br>${costLine}</div>
            </div>`;
        }).join('');
    }
    // 锻材库存：只列「锭」（强化燃料），并提示去哪备料
    const matBox = document.getElementById('enhance-mats');
    if (matBox) {
        const keys = Object.keys(MATERIALS).filter(k => k.startsWith('ingot_') && (player.materials[k] || 0) > 0);
        matBox.innerHTML = keys.length
            ? `<div class="wh-grid">` + keys.map(k =>
                `<div class="wh-item"><div class="wh-ico">${MATERIALS[k].icon}</div>${MATERIALS[k].name}<br><span class="wh-qty">${formatNumber(player.materials[k])}</span></div>`).join('') + `</div>`
            : `<div class="wh-empty">— 暂无锭。去「采矿」挖矿、「锻造」熔炼成锭，再回来强化神兵 —</div>`;
    }
}

// ---------- 打造图谱页（按档×部位确定性打造命名套装；档由采矿/锻造等级解锁）----------
let selectedCraftTier = 0;          // 0=未选(首次打开自动落到已解锁最高档)
let selectedCraftAffix = 'none';    // 第五阶段：当前选中的打造副词条（模块级，不入存档）
export function selectCraftTier(tier) { selectedCraftTier = tier; renderCraft(); }
export function selectCraftAffix(id) { selectedCraftAffix = id; renderCraft(); }

export function renderCraft() {
    const player = state.player;
    const tabs = document.getElementById('craft-tier-tabs');
    const box = document.getElementById('craft-slots');
    if (!tabs || !box) return;
    const smLv = levelFromExp(player.professions.smithing.exp);
    const maxUnlocked = GEAR_TIERS.filter(T => smLv >= T.smithingReq).length; // 恒 ≥1(凡铁锻造1)
    // 选中档越界(首次未选/超出已解锁/手选档被锁) → 落到已解锁最高档；玩家手选的合法档则保留
    if (selectedCraftTier < 1 || selectedCraftTier > maxUnlocked) selectedCraftTier = maxUnlocked;

    // 仅列「可锻造」档(T7/T8 神话/仙器打造造不出，只能秘境进阶)
    tabs.innerHTML = GEAR_TIERS.filter(T => T.craftable !== false).map(T => {
        const locked = smLv < T.smithingReq;
        return `<button class="craft-tab ${T.tier === selectedCraftTier ? 'active' : ''}" ${locked ? 'disabled' : ''} data-act="select-craft-tier" data-tier="${T.tier}">${locked ? '🔒' : ''}${T.name}${locked ? `·锻${T.smithingReq}` : ''}</button>`;
    }).join('');

    const T = GEAR_TIERS[selectedCraftTier - 1];
    if (smLv < T.smithingReq) {
        box.innerHTML = `<div class="wh-empty">需【锻造】${T.smithingReq} 级才能打造 ${T.name} 套装。<br>去「采矿」挖矿、「锻造」熔炼把锻造练上去。</div>`;
        return;
    }
    const cost = gearCraftCost(selectedCraftTier);
    const have = player.materials[cost.ingotKey] || 0;
    const matName = MATERIALS[cost.ingotKey] ? MATERIALS[cost.ingotKey].name : cost.ingotKey;
    const slots = unlockedGearSlots(player.realmLevel);

    // —— 第五阶段：流派建议 + 副词条选择器（★ 标记契合当前流派的词条）——
    const path = getActivePath(player);
    if (selectedCraftAffix !== 'none' && !getCraftAffixById(selectedCraftAffix)) selectedCraftAffix = 'none';
    const curAffix = getCraftAffixById(selectedCraftAffix) || getCraftAffixById('none');
    const needIngot = cost.ingotQty + (curAffix.extraIngot || 0);
    const adviceLine = `<div class="prof-exp-text" style="margin-bottom:8px;color:var(--color-blue);">📌 ${pathProductionAdvice(player)}${path && path.mods && path.mods.craftQualityBonus ? '（器修：打造更易出高成色）' : ''}</div>`;
    const affixBtns = CRAFT_AFFIXES.map(a => {
        const rec = path && a.path === path.id;
        return `<button class="craft-tab ${a.id === selectedCraftAffix ? 'active' : ''}" data-act="select-craft-affix" data-affix="${a.id}" title="${a.desc}">${a.name}${rec ? '★' : ''}</button>`;
    }).join('');
    const affixLine = `<div style="margin-bottom:6px;"><span style="font-size:12px;color:var(--text-muted);">副词条：</span><span class="craft-tabs">${affixBtns}</span></div>` +
        `<div class="prof-exp-text" style="margin-bottom:10px;">${curAffix.desc}${curAffix.extraIngot ? ` <span style="color:var(--color-accent)">（额外耗 ${matName}×${curAffix.extraIngot}）</span>` : ''}</div>`;
    const gapLine = have < needIngot ? `<br><span style="color:var(--color-accent);">材料缺口：每件还差 ${matName}×${needIngot - have}（现有 ${formatNumber(have)}）→ ${materialSourceHint(cost.ingotKey)}</span>` : '';
    const setLine = `<div class="prof-exp-text" style="margin-bottom:10px;">完整 ${T.name} 套装(${slots.length} 件)：每件耗 ${matName}×${needIngot} + 碎银 ${formatNumber(cost.coin)}（副词条与强化另计）${gapLine}</div>`;

    box.innerHTML = adviceLine + affixLine + setLine + slots.map(({ key: slot }) => {
        const pv = makeGearPiece(selectedCraftTier, slot, 0); // 预览(凡品成色)属性
        const statStr = ['atk', 'def', 'hp', 'crit', 'dodge'].filter(k => pv[k])
            .map(k => `${({ atk: '攻', def: '防', hp: '血', crit: '暴', dodge: '闪' })[k]} ${pv[k]}${(k === 'crit' || k === 'dodge') ? '%' : ''}`).join('　');
        const okMat = have >= needIngot, okCoin = player.coin >= cost.coin, okBag = player.bag.length < player.bagMax;
        const matCol = okMat ? 'var(--color-success)' : 'var(--color-accent)';
        const coinCol = okCoin ? 'var(--color-gold)' : 'var(--color-accent)';
        const affixTag = selectedCraftAffix !== 'none' ? ` · <span style="color:var(--color-orange)">${curAffix.name}</span>` : '';
        return `<div class="act-card">
            <div class="act-head"><span class="act-title">${curAffix.id !== 'none' ? curAffix.name + '·' : ''}${T.name}·${GEAR_SLOT_LABEL[slot]}</span>
                <button class="btn btn-success" data-act="craft-gear" data-tier="${selectedCraftTier}" data-slot="${slot}" data-affix="${selectedCraftAffix}" ${okMat && okCoin && okBag ? '' : 'disabled'}>🛡 打造</button></div>
            <div class="act-meta">${statStr}${affixTag}<br>耗 <span style="color:${matCol}">${matName}×${needIngot}(有${formatNumber(have)})</span> · <span style="color:${coinCol}">碎银 ${formatNumber(cost.coin)}</span>${okBag ? '' : ' · <span style="color:var(--color-accent)">行囊已满</span>'} · 成色随机</div>
        </div>`;
    }).join('');
}

// ---------- 秘境页（Boss 挑战 + 神兵进阶）----------
export function renderDungeon() {
    const player = state.player;
    // Boss 列表
    const bossBox = document.getElementById('boss-list');
    if (bossBox) {
        const DANGER = {
            safe: ['🟢 胜算高', 'var(--color-success)'], risky: ['🟡 有风险', 'var(--color-gold)'],
            deadly: ['🔴 凶险', 'var(--color-accent)'], locked: ['🔒 未解锁', 'var(--text-muted)'], unknown: ['⚪ 未知', 'var(--text-muted)']
        };
        bossBox.innerHTML = BOSSES.map(b => {
            const plan = getBossPlan(player, b);          // 复用：解锁/掉落用途/胜算/对症准备/推荐关卡
            const locked = !plan.unlocked;
            const [dLabel, dCol] = DANGER[plan.danger] || DANGER.unknown;
            const wrTxt = (plan.winRate != null) ? `（试算胜率约 ${Math.round(plan.winRate * 100)}%）` : '';
            return `<div class="act-card ${locked ? 'locked' : ''}">
                <div class="act-head"><span class="act-title">👹 ${b.name}</span>
                    <button class="btn btn-danger" data-act="challenge-boss" data-boss="${b.id}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' + getRealmName(b.realmReq) : '挑战'}</button></div>
                <div class="act-meta">🔑 解锁：${plan.unlockText}</div>
                <div class="act-meta" style="color:#bbb;">🎁 掉落用途：${plan.dropUse}</div>
                <div class="act-meta">📊 胜算：<b style="color:${dCol}">${dLabel}</b>${wrTxt}</div>
                <div class="act-meta" style="color:#8fb8e0;">📍 ${plan.stageHint}</div>
                <div class="act-meta" style="color:#caa;">🛠 准备：${plan.prep.join('　')}</div>
            </div>`;
        }).join('');
    }
    // 神兵进阶（已解锁装备槽）+ 神魂结晶持有量
    const upBox = document.getElementById('upgrade-slots');
    if (upBox) {
        const cry = player.materials.soul_crystal || 0;
        const head = `<div class="prof-exp-text" style="margin-bottom:10px;">持有 💎神魂结晶 ×${cry}。进阶把 ${GEAR_TIERS[MAX_CRAFTABLE_TIER - 1].name}档 装备突破到 神话→仙器（打造造不出的档），保留成色与强化。</div>`;
        upBox.innerHTML = head + unlockedGearSlots(player.realmLevel).map(({ key: slot, label }) => {
            const it = player.equips[slot];
            if (!it) return `<div class="act-card locked"><div class="act-head"><span class="act-title">【${label}】</span><span style="color:var(--text-muted);font-size:12px;">— 未装备 —</span></div></div>`;
            const tierName = (it.tier && GEAR_TIERS[it.tier - 1]) ? GEAR_TIERS[it.tier - 1].name : '杂项';
            const cost = gearUpgradeCost(it);
            const qC = QUALITY_COLORS[it.quality || 0] || '#7f8c8d';
            let btn, note;
            if (!cost) {
                btn = `<button class="btn" disabled>不可进阶</button>`;
                note = (it.tier >= GEAR_TIERS.length) ? '已达顶档（仙器）' : `需先到 ${GEAR_TIERS[MAX_CRAFTABLE_TIER - 1].name}档`;
            } else {
                const okCry = cry >= cost.crystal, okCoin = player.coin >= cost.coin;
                const cryCol = okCry ? 'var(--color-success)' : 'var(--color-accent)';
                const coinCol = okCoin ? 'var(--color-gold)' : 'var(--color-accent)';
                note = `进阶→${GEAR_TIERS[cost.nextTier - 1].name}：<span style="color:${cryCol}">💎×${cost.crystal}(有${cry})</span> · <span style="color:${coinCol}">碎银 ${formatNumber(cost.coin)}</span>`;
                btn = `<button class="btn btn-success" data-act="upgrade-gear" data-slot="${slot}" ${okCry && okCoin ? '' : 'disabled'}>⬆ 进阶</button>`;
            }
            return `<div class="act-card"><div class="act-head"><span class="act-title" style="color:${qC}">【${label}】${it.name}${it.enhance ? ` +${it.enhance}` : ''}</span>${btn}</div><div class="act-meta">当前 ${tierName}档 · ${note}</div></div>`;
        }).join('');
    }
}

// ---------- 左侧菜单抽屉开关（仅移动端 ≤768 生效：桌面侧栏常驻、无 .open 类，调用无副作用）----------
export function toggleMenu() {
    const sb = document.getElementById('nav-sidebar');
    if (!sb) return;
    const open = sb.classList.toggle('open');
    document.getElementById('menu-overlay')?.classList.toggle('visible', open);
}
export function closeMenu() {
    document.getElementById('nav-sidebar')?.classList.remove('open');
    document.getElementById('menu-overlay')?.classList.remove('visible');
}

// ---------- 切换页签（tabEl 由委托传入，取代原全局 event.currentTarget）----------
export function switchPage(pageId, tabEl) {
    hideTooltip();
    const pageEl = document.getElementById(`page-${pageId}`);
    if (!pageEl) return;   // 防御：未知页签不抛错（如「前往」传入异常 page）
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    pageEl.classList.add('active');
    // 高亮对应导航项：无论点导航、还是程序化「前往」跳转都正确高亮（tabEl 仅作兜底）。
    const navItem = document.querySelector(`.menu-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');
    else if (tabEl && tabEl.classList.contains('menu-item')) tabEl.classList.add('active');
    closeMenu();   // 移动端：点菜单项后收起抽屉
    if (pageId === 'quest') renderQuestPanel();
    if (pageId === 'path') renderPathPage();
    if (pageId === 'role' || pageId === 'bag') updatePlayerAttributes();
    if (pageId === 'kungfu') renderPlayerSkills();
    if (pageId === 'shop') { renderBagExpand(); renderShopGoods(); }
    if (pageId === 'adventure') renderMapList();
    if (pageId === 'bag') { renderForge(); renderBag(); } // renderBag：补刷挂机期间打造入袋的装备
    if (pageId === 'achievement') renderAchievementPanel();
    if (pageId === 'guide') renderGuide();
    if (pageId === 'mining' || pageId === 'smithing') { renderProduction(); renderWarehouse(); }
    if (pageId === 'herb' || pageId === 'alchemy') { renderProduction(); renderWarehouse(); if (pageId === 'alchemy') renderPills(); }
    if (pageId === 'enhance') renderEnhance();
    if (pageId === 'craft') renderCraft();
    if (pageId === 'dungeon') renderDungeon();
}

// ---------- 江湖指引：新手任务链（可领奖的目标系统，引导前 30 分钟）----------
// 奖励文案：把 reward 对象转成中文片段。actions 领取提示与本页奖励预览共用，避免漂移。
const QUEST_STAT_LABEL = { hp: '气血', atk: '攻击', def: '防御', crit: '暴击', dodge: '闪避' };
export function fmtQuestReward(reward = {}) {
    const parts = [];
    if (reward.coins) parts.push(`碎银+${formatNumber(reward.coins)}`);
    if (reward.exp) parts.push(`修为+${formatNumber(reward.exp)}`);
    if (reward.honghuangPower) parts.push(`洪荒+${reward.honghuangPower}%`);
    if (reward.material) for (const [k, v] of Object.entries(reward.material)) parts.push(`${MATERIALS[k] ? MATERIALS[k].name : k}×${v}`);
    if (reward.statBonus) for (const [k, v] of Object.entries(reward.statBonus)) parts.push(`永久${QUEST_STAT_LABEL[k] || k}+${v}${(k === 'crit' || k === 'dodge') ? '%' : ''}`);
    if (reward.item) parts.push('随机装备×1');
    if (reward.skill) parts.push('随机秘籍×1');
    return parts.length ? parts.join(' · ') : '无';
}

// 进度文案：通关类显示「第 x / y 关」，其余显示「x / y」。
function questProgressText(quest, progress) {
    if (quest.type === 'clearMap') return `第 ${Math.min(progress.current, progress.target)} / ${progress.target} 关`;
    return `${progress.current} / ${progress.target}`;
}

// 渲染「江湖指引」页：进入即静默同步进度（不弹提示）→ 概览条 + 当前推荐大卡 + 全部任务清单。
// 容器不存在时静默跳过（未建页也安全）。
export function renderQuestPanel() {
    const player = state.player;
    syncQuestProgress(player); // 进页即同步 completed/activeId（静默，不弹提示）
    const summary = document.getElementById('quest-summary');
    const box = document.getElementById('quest-list-box');
    if (!summary || !box) return;

    const claimed = (player.quests && player.quests.claimed) || [];
    const total = GUIDE_QUESTS.length;
    const doneCount = GUIDE_QUESTS.filter(q => getQuestProgress(player, q).done).length;
    const claimedCount = claimed.length;
    const pct = total ? Math.floor((claimedCount / total) * 100) : 0;
    const current = getCurrentGuideQuest(player);

    summary.innerHTML =
        `<div class="achievement-summary-bar"><i style="width:${pct}%"></i></div>` +
        `<div class="achievement-summary-text">已达成 ${doneCount}/${total} · 已领取 ${claimedCount}/${total}（${pct}%）` +
        `${current ? ` · 当前指引：<b style="color:var(--color-gold)">${current.title}</b>` : ' · 🎉 新手指引全部完成！'}</div>`;

    // —— 顶部「下一步建议」（卡关反馈）：纯函数 getGameplayAdvice 据当前状态派生，最多 4 条 ——
    const advice = getGameplayAdvice(player);
    let html =
        `<div class="sub-panel" style="margin-bottom:14px;border:1px solid var(--color-gold);background:rgba(194,169,95,0.06);">
            <div style="font-weight:bold;color:var(--color-gold);margin-bottom:6px;">🧭 下一步建议</div>` +
        (advice.length
            ? advice.map(a =>
                `<div style="display:flex;align-items:center;gap:8px;padding:6px 2px;border-top:1px solid rgba(255,255,255,0.06);">
                    <span style="font-size:16px;">${a.icon}</span>
                    <span style="flex:1;font-size:13px;color:#ddd;line-height:1.5;">${a.text}</span>
                    ${a.page ? `<button class="btn" style="padding:3px 12px;flex:none;" data-act="switch-page" data-page="${a.page}">前往</button>` : ''}
                </div>`).join('')
            : `<div style="font-size:13px;color:var(--text-muted);padding:4px 2px;">✅ 当前没有紧要待办，放心挂机历练吧。</div>`) +
        `</div>`;

    // 当前推荐任务（醒目大卡）
    if (current) {
        const p = getQuestProgress(player, current);
        const claimable = p.done; // current 恒为「第一条未领取」，故 done 即可领取
        html +=
            `<div class="act-card running" style="margin-bottom:14px;">
                <div class="act-head">
                    <span class="act-title">🧭 当前指引 · ${current.title}</span>
                    <span style="font-size:12px;color:${claimable ? 'var(--color-success)' : 'var(--text-muted)'};">${claimable ? '✅ 可领取' : '进行中'}</span>
                </div>
                <div class="act-meta" style="font-size:13px;color:#ccc;">${current.desc}</div>
                <div class="achievement-progress" style="margin-top:8px;">
                    <div class="achievement-progress-bar"><i style="width:${p.pct}%;background:linear-gradient(90deg,#c2a95f,#2ecc71);"></i></div>
                    <span>${questProgressText(current, p)}</span>
                </div>
                <div class="act-meta">🎁 奖励：${fmtQuestReward(current.reward)}</div>
                <div class="act-meta" style="color:#888;">📍 ${current.unlockHint}</div>
                <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
                    ${current.page ? `<button class="btn" data-act="switch-page" data-page="${current.page}">前往</button>` : ''}
                    <button class="btn ${claimable ? 'btn-success' : ''}" data-act="claim-quest" data-id="${current.id}" ${claimable ? '' : 'disabled'}>${claimable ? '领取奖励' : '未达成'}</button>
                </div>
            </div>`;
    }

    // 全部任务清单（紧凑；复用成就卡样式：可领取=绿框、已领取=金框淡显）
    html += GUIDE_QUESTS.map(q => {
        const p = getQuestProgress(player, q);
        const isClaimed = claimed.includes(q.id);
        const claimable = p.done && !isClaimed;
        const cls = isClaimed ? 'claimed' : (claimable ? 'unlocked' : 'locked');
        const statusTxt = isClaimed ? '✅ 已领取' : (claimable ? '🎁 可领取' : '进行中');
        const statusCol = isClaimed ? 'var(--color-gold)' : (claimable ? 'var(--color-success)' : 'var(--text-muted)');
        const op = isClaimed
            ? `<button class="btn" disabled>已领取</button>`
            : `<button class="btn ${claimable ? 'btn-success' : ''}" data-act="claim-quest" data-id="${q.id}" ${claimable ? '' : 'disabled'}>${claimable ? '领取' : '未达成'}</button>`;
        return `<div class="achievement-card ${cls}">
            <div class="achievement-main">
                <div class="achievement-name">${q.order}. ${q.title} <span style="font-size:11px;color:${statusCol};font-weight:normal;">${statusTxt}</span></div>
                <div class="achievement-desc">${q.desc}</div>
                <div class="achievement-progress">
                    <div class="achievement-progress-bar"><i style="width:${p.pct}%"></i></div>
                    <span>${questProgressText(q, p)}</span>
                </div>
                <div class="achievement-reward">奖励：${fmtQuestReward(q.reward)}　·　📍 ${q.unlockHint}</div>
            </div>
            <div class="achievement-op" style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                ${q.page ? `<button class="btn" style="padding:4px 10px;" data-act="switch-page" data-page="${q.page}">前往</button>` : ''}
                ${op}
            </div>
        </div>`;
    }).join('');

    box.innerHTML = html;
}

// ---------- 修行流派：当前流派 + 5 派卡片（定位/加成/代价/解锁/择道·改修）----------
// 数值与文案来自 config.CULTIVATION_PATHS；加成/代价由 bonuses/penalties 直接展示（与 mods 一一对应）。
export function renderPathPage() {
    const box = document.getElementById('path-content');
    if (!box) return;
    const player = state.player;
    const active = getActivePath(player);
    const switchInfo = pathSwitchCost(player); // null = 首次免费

    const chip = t => `<span style="display:inline-block;font-size:11px;color:var(--color-blue);border:1px solid #2c3a4a;border-radius:10px;padding:1px 8px;margin-right:4px;">${t}</span>`;

    const head = active
        ? `<div class="list-card" style="flex-direction:column;align-items:flex-start;gap:6px;border-color:rgba(46,204,113,0.35);background:rgba(46,204,113,0.06);">
               <div><span style="color:var(--color-success);font-weight:bold;">当前流派：</span><b style="color:var(--color-gold);font-size:15px;">${active.name}</b>　<span style="font-size:11px;color:var(--text-muted);">已改换 ${player.pathSwitchCount || 0} 次</span></div>
               <div style="font-size:12px;color:#aaa;font-style:italic;">「${active.flavorText}」</div>
           </div>`
        : `<div class="list-card" style="justify-content:center;color:var(--text-muted);">尚未择道——选择一门流派，确立你的成长方向（<b style="color:var(--color-gold)">首次免费</b>）。</div>`;

    // 适配评价（复用纯函数 getPathRecommendations；据当前装备/属性/卡点给建议，不替玩家选择）。
    const recById = Object.fromEntries(getPathRecommendations(player).map(r => [r.pathId, r]));
    const FIT = { high: ['强烈推荐', 'var(--color-success)'], medium: ['可以考虑', 'var(--color-gold)'], low: ['暂不急', 'var(--text-muted)'] };

    const cards = CULTIVATION_PATHS.map(p => {
        const isCurrent = player.cultivationPath === p.id;
        const unlocked = isPathUnlocked(player, p);
        const bonusHtml = (p.bonuses || []).map(b => `<li style="color:var(--color-success);">▲ ${b}</li>`).join('');
        const penaltyHtml = (p.penalties || []).map(b => `<li style="color:var(--color-accent);">▼ ${b}</li>`).join('');
        const tags = (p.tags || []).map(chip).join('');

        let btn;
        if (isCurrent) btn = `<button class="btn" disabled>✦ 当前流派</button>`;
        else if (!unlocked) btn = `<button class="btn" disabled>🔒 需${getRealmName(p.unlockRealmLevel)}</button>`;
        else if (!switchInfo) btn = `<button class="btn btn-success" data-act="select-path" data-path="${p.id}">免费择道</button>`;
        else {
            const afford = player.coin >= switchInfo.coin;
            btn = `<button class="btn ${afford ? 'btn-success' : ''}" data-act="select-path" data-path="${p.id}"${afford ? '' : ' disabled'}>改修 (${formatNumber(switchInfo.coin)}文)</button>`;
        }

        // 适配建议块
        const rec = recById[p.id];
        const [fitLabel, fitCol] = rec ? (FIT[rec.fit] || FIT.medium) : FIT.medium;
        const recBlock = rec ? `
            <div class="act-meta" style="margin-top:6px;border-top:1px dashed rgba(255,255,255,0.08);padding-top:6px;">💡 适配你的现状：<b style="color:${fitCol};">${fitLabel}</b> · ${rec.reason}</div>
            <div class="act-meta" style="color:#d9a06b;">🔧 需补短板：${rec.shortfall}</div>
            <div class="act-meta" style="color:#8fb8e0;">🧭 适配方向：${rec.direction}</div>` : '';

        return `<div class="act-card ${isCurrent ? 'running' : ''} ${unlocked ? '' : 'locked'}" style="margin-bottom:10px;">
            <div class="act-head"><span class="act-title">${isCurrent ? '✦ ' : ''}${p.name}</span>${btn}</div>
            <div style="margin:4px 0 6px;">${tags}</div>
            <div class="act-meta" style="font-size:12px;color:#bbb;">${p.desc}</div>
            <ul style="margin:8px 0 4px;padding-left:18px;line-height:1.8;font-size:12px;">${bonusHtml}${penaltyHtml}</ul>
            <div class="act-meta">📌 推荐养成：${p.recommendedStats}　·　解锁：${p.unlockRealmLevel <= 1 ? '开局即可' : getRealmName(p.unlockRealmLevel)}</div>${recBlock}
            <div class="act-meta" style="color:#777;font-style:italic;">「${p.flavorText}」</div>
        </div>`;
    }).join('');

    box.innerHTML = head +
        `<div style="font-size:11px;color:var(--text-muted);line-height:1.6;margin:12px 0 8px;">首次择道免费；之后改换门庭按已切换次数递增碎银（确认后扣费，属性即时更替）。流派加成与代价已计入面板战力。<br>下方「💡 适配你的现状」依据你当前的装备 / 属性 / 卡点给出参考，<b>仅供建议，不会替你选择</b>。</div>` +
        cards;
}

// ---------- 江湖秘典：游戏全机制说明（只读静态页）----------
// 数值一律从 config / BALANCE / domain 现算生成，与实战同源、永不漂移。
// 调平衡只改 config.js，本页自动跟随更新（不要在此手写魔法数字）。
export function renderGuide() {
    const box = document.getElementById('guide-content');
    if (!box) return;
    const B = BALANCE, bt = B.battle, rw = B.reward;

    // —— 品阶概率：由 qualityRoll 区间反推（自上而下命中，余数归 q0）——
    const qProbs = [];
    let prev = 100;
    B.qualityRoll.forEach(t => { qProbs.push({ q: t.q, pct: +(prev - t.min).toFixed(1) }); prev = t.min; });
    qProbs.push({ q: 0, pct: +prev.toFixed(1) });
    qProbs.sort((a, b) => a.q - b.q);
    const qualityRows = qProbs.map(p =>
        `<tr><td style="color:${QUALITY_COLORS[p.q]};font-weight:bold;">${p.q} · ${QUALITY_NAMES[p.q]}</td>` +
        `<td>${p.pct}%</td><td>${formatNumber(Math.floor(B.itemPrice.base * Math.pow(B.itemPrice.growth, p.q)))} 文</td></tr>`
    ).join('');

    // —— 角色属性总表 ——
    const attrs = [
        ['气血', '250', '生命上限，每场战斗满血开打；归零即战败。', '破境 +' + B.breakthrough.hpGain + '/重 · 装备 · 神功(+150/重) · 轮回乘区 · 洪荒乘区'],
        ['攻击', '35', '每次出手的基础伤害值。', '破境 +' + B.breakthrough.atkGain + '/重 · 装备 · 神功(+30)/真卷(+40) · 轮回乘区 · 洪荒乘区'],
        ['防御', '15', '减免每次受到的伤害（实伤 = 攻 − 防，至少 1）。', '破境 +' + B.breakthrough.defGain + '/重 · 装备 · 心法(+20/重) · 轮回乘区 · 洪荒乘区'],
        ['暴击率', '5%', '每回合触发暴击的概率；暴击伤害 ×' + bt.critMult + '。', '装备 · 真卷(+1.5%/重) · 洪荒乘区（<b>不</b>吃轮回乘区）'],
        ['闪避率', '5%', '敌人攻击时「完全免伤」的概率（全有或全无），<b>硬上限 ' + B.dodgeCap + '%</b>。', '装备 · 心法(+1.5%/重) · 洪荒乘区（<b>不</b>吃轮回乘区）'],
        ['洪荒之力', '0%', '洪荒功法的当前重数；每重令五维总量 ×(1+' + (B.honghuangMultPerLevel * 100) + '%)。', '修炼洪荒功法（黑市孤本 / 洪炉融合，最高 ' + B.skill.hhMaxLevel + ' 重）'],
        ['掉宝率', '100%', '最终掉落概率 = ' + (rw.baseDrop * 100) + '% × 掉宝率/100。', '寻龙诀(+15%/重)'],
        ['财运率', '100%', '碎银收益 = 基础值 × 财运率/100。', '招财秘录(+15%/重)'],
        ['境界', '后天1重', '决定可解锁的关卡上限。', '破境冲关（耗修为）；轮回时重置为 1'],
        ['修为', '0', '破境与研习秘籍的资源（战斗收益不受任何加成）。', '战斗胜利'],
        ['碎银', '50000', '通用货币：黑市购买、洪炉融合灵力。', '战斗胜利 · 熔炼装备 · 战败损失 5%'],
        ['轮回印记', '0', '渡劫轮回的次数，每次令 气血/攻击/防御 永久 ×(1+' + (B.rebornMultPerCount * 100) + '%)。', '渡劫轮回（境界 ≥ ' + B.reborn.minLevel + '）'],
    ];
    const attrRows = attrs.map(a =>
        `<tr><td style="color:var(--color-gold);font-weight:bold;white-space:nowrap;">${a[0]}</td><td style="white-space:nowrap;">${a[1]}</td><td>${a[2]}</td><td style="color:#999;">${a[3]}</td></tr>`
    ).join('');

    // —— 装备六部位（系数取自 domain.generateItemByMatrix）——
    const slotInfo = [
        ['兵刃 weapon', '攻击 ⌊22×倍率⌋', '品阶 ≥3 附带暴击'],
        ['暗器 subweapon', '攻击 ⌊12×倍率⌋', '品阶 ≥3 附带暴击'],
        ['防具 armor', '防御 ⌊10×倍率⌋ ＋ 气血 ⌊50×倍率⌋', '—'],
        ['头盔 helm', '防御 ⌊6×倍率⌋ ＋ 气血 ⌊40×倍率⌋', '—'],
        ['配饰 ring', '气血 ⌊80×倍率⌋', '品阶 ≥3 附带闪避（≤75%）'],
        ['法宝 artifact', '攻⌊10×⌋＋防⌊6×⌋＋血⌊60×⌋', '品阶 ≥4 附带暴击＋闪避'],
    ];
    const slotRows = slotInfo.map(s => `<tr><td style="white-space:nowrap;">${s[0]}</td><td>${s[1]}</td><td style="color:#999;">${s[2]}</td></tr>`).join('');

    // —— 秘籍：主动 / 被动（来自 SKILL_SUFFIXES）——
    const actives = SKILL_SUFFIXES.filter(s => s.type === 'active');
    const passives = SKILL_SUFFIXES.filter(s => s.type === 'passive');
    const activeRows = actives.map(s =>
        `<tr><td style="color:var(--color-orange);white-space:nowrap;">…${s.name}</td><td>${s.power} 倍</td><td style="color:#999;">${s.desc}${s.healRate ? `（吸血 ${Math.round(s.healRate * 100)}%）` : ''}</td></tr>`
    ).join('');
    const passiveRows = passives.map(s => {
        // 词条片段统一从合并表取（旧五维 + 新 affix），新增词条会自动出现在指南里。
        const parts = ALL_PASSIVE_ATTRS.filter(d => s[d.k]).map(d => `${d.n}+${s[d.k]}${d.s || ''}`);
        return `<tr><td style="color:var(--color-blue);white-space:nowrap;">…${s.name}</td><td style="white-space:nowrap;">${parts.join('　')}</td><td style="color:#999;">${s.desc || '每重永久叠加'}</td></tr>`;
    }).join('');

    // —— 关卡 / 敌人示例（难度 = 2^(关卡-1)）——
    const sampleMaps = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30];
    const mapRows = sampleMaps.map(id => {
        const diff = Math.pow(2, id - 1);
        const req = Math.floor((id - 1) * 1.1) + 1;
        return `<tr><td style="white-space:nowrap;">${id} · ${MAP_NAMES[id - 1]}</td><td>${formatNumber(Math.floor(B.enemy.baseHp * diff))}</td><td>${formatNumber(Math.floor(B.enemy.baseAtk * diff))}</td><td>${formatNumber(Math.floor(B.enemy.baseDef * diff))}</td><td style="white-space:nowrap;">${getRealmName(req)}</td></tr>`;
    }).join('');

    // —— 境界阶梯 ——
    const realmLadder = REALMS.map((r, i) => `${r}<span style="color:#666;">(${i * 10 + 1}~${i * 10 + 10}级)</span>`).join(' → ');

    const toc = [
        ['sec-loop', '核心循环'], ['sec-attr', '属性详解'], ['sec-battle', '战斗机制'],
        ['sec-formula', '属性公式'], ['sec-map', '关卡敌人'], ['sec-equip', '装备系统'],
        ['sec-skill', '秘籍系统'], ['sec-forge', '天地洪炉'], ['sec-shop', '珍宝黑市'],
        ['sec-grow', '破境轮回'], ['sec-tips', '进阶心法'],
    ];
    const tocHtml = toc.map(t => `<a data-act="guide-jump" data-target="${t[0]}">${t[1]}</a>`).join('');

    box.innerHTML = `
    <div class="guide-toc">${tocHtml}</div>

    <h3 id="sec-loop">① 核心循环</h3>
    <p>这是一款<b>放置(挂机)武侠养成</b>游戏。核心循环：</p>
    <p style="text-align:center;color:var(--color-gold);font-weight:bold;">挂机征战 → 掉装备·赚碎银修为 → 强化(装备/秘籍/洪炉/破境) → 解锁更高关卡 → 渡劫轮回质变 → 再战更深禁区</p>
    <p>在「百关征途」点【挑战】即开始<b>自动战斗</b>（每 ${bt.intervalMs / 1000} 秒一场）。胜利得碎银、修为、随机战利品；战败损失少量碎银并自动退回安全区。你的目标：让五维属性追上指数级增长的关卡难度，一路推进到第 100 关「虚空尽头」。</p>

    <h3 id="sec-attr">② 角色属性详解</h3>
    <table class="guide-table"><thead><tr><th>属性</th><th>初始</th><th>作用</th><th>来源</th></tr></thead><tbody>${attrRows}</tbody></table>
    <div class="guide-note">⚔️ <b>暴击率 / 闪避率</b>只受装备、秘籍、洪荒之力影响，<b>不</b>吃轮回乘区；而气血/攻击/防御三维则同时享受轮回乘区与洪荒乘区的双重放大。</div>

    <h3 id="sec-battle">③ 战斗机制（伤害·暴击·闪避）</h3>
    <p>战斗为<b>纯回合制自动演算</b>：<b>你方先手出招，敌方后手反击</b>，最多 ${bt.maxRounds} 回合。每回合流程：</p>
    <div class="guide-formula"><b>【你方出手】</b>
1. 暴击判定：随机数(0~100) &lt; 暴击率 → 暴击
2. 基础伤害 = 攻击力
3. 主动技判定：${bt.activeSkillChance * 100}% 概率施展（拥有多门主动技时固定取「有效倍率最高」的一招，不再稀释）
     施展 → 伤害 ×（招式倍率 ＋ 招式重数 × ${bt.activeLevelScale}）
4. 若暴击 → 伤害 ×${bt.critMult}
5. 对敌实伤 = max(1, 伤害 − 敌方防御)
6. 吸血(噬血类)：回血 = ⌊实伤 × 吸血率⌋（不超过气血上限）
   ▶ 敌方气血 ≤ 0 → 立即<span style="color:var(--color-success)">胜利</span>

<b>【敌方反击】</b>（敌方存活时）
7. 闪避判定：随机数(0~100) &lt; 闪避率 → 完全闪避（受 0 伤害）　※闪避率封顶 ${B.dodgeCap}%
8. 未闪避 → 受到伤害 = max(1, 敌方攻击 − 你方防御)
   ▶ 你方气血 ≤ 0 → 立即<span style="color:var(--color-accent)">战败</span></div>
    <div class="guide-tip">💡 关键规则：<br>• <b>伤害下限为 1</b>——再厚的防御也挡不到「完全免伤」，但能把伤害压到极低。<br>• <b>闪避是全有或全无</b>：触发即免疫该次<b>全部</b>伤害，否则全额承受。<br>• <b>闪避率封顶 ${B.dodgeCap}%</b>：再怎么堆叠，也至少有 ${100 - B.dodgeCap}% 的攻击必命中——堆满闪避<b>不会无敌</b>，仍需血量/防御兜底。<br>• <b>敌人不会暴击、也不会闪避</b>——暴击只属于你的进攻，闪避只属于你的防守。<br>• <b>撑满 ${bt.maxRounds} 回合不分胜负 → 只要你存活即判胜</b>。高血+高防+高闪可「磨」过一时打不动的强敌。</div>
    <div class="guide-note">⚙️ 上面是基础攻防骨架；被动秘籍的<b>词条</b>会嵌进同一回合结算——<b>你方出手</b>叠加增伤/暴伤/破甲/流血/吸血，<b>敌方反击</b>前先过定身→格挡→闪避、命中再吃减伤与荆棘反伤，<b>回合末</b>龟息回血；斩杀(敌残血)/背水(己残血)/先发(开场)/连击(久战)等条件词条按触发线生效。各词条数值见下方 <b>⑦ 秘籍系统</b> 的「被动功法」表。</div>

    <h3 id="sec-formula">④ 属性结算公式</h3>
    <p>面板上的最终属性，由「基础值 → 轮回放大 → 加被动/装备 → 洪荒放大」逐层结算：</p>
    <div class="guide-formula">轮回乘区 = 1 ＋ 轮回印记 × ${B.rebornMultPerCount}
洪荒乘区 = 1 ＋ 洪荒之力 × ${B.honghuangMultPerLevel}

气血 / 攻击 / 防御 = ⌊( ⌊基础值 × 轮回乘区⌋ ＋ Σ被动×重数 ＋ Σ装备 ) × 洪荒乘区⌋
暴击率           = ( 基础值 ＋ Σ被动×重数 ＋ Σ装备 ) × 洪荒乘区   ← 不乘轮回乘区
闪避率           = min(${B.dodgeCap}, 同上式)                       ← 硬上限 ${B.dodgeCap}%（堆再高也封顶）
掉宝率 / 财运率   = 100% ＋ Σ被动×重数                          ← 不受任何乘区</div>
    <p style="color:#999;">举例：洪荒功法满 ${B.skill.hhMaxLevel} 重时，洪荒乘区 = 1 + ${B.skill.hhMaxLevel}×${B.honghuangMultPerLevel} = <b style="color:var(--color-honghuang)">×${(1 + B.skill.hhMaxLevel * B.honghuangMultPerLevel).toFixed(0)}</b>（五维总量 +${(B.skill.hhMaxLevel * B.honghuangMultPerLevel * 100).toFixed(0)}%）；每渡劫一次，三维再永久 ×(1+${B.rebornMultPerCount}) 叠乘。</p>

    <h3 id="sec-map">⑤ 关卡与敌人</h3>
    <p>全程共 <b>100 关</b>，难度<b>每关翻倍</b>（难度 = 2^(关卡-1)）。敌人属性 = 基础(血 ${B.enemy.baseHp} / 攻 ${B.enemy.baseAtk} / 防 ${B.enemy.baseDef}) × 难度。解锁条件：境界 ≥ ⌊(关卡-1)×1.1⌋+1。</p>
    <table class="guide-table"><thead><tr><th>关卡</th><th>敌·气血</th><th>敌·攻击</th><th>敌·防御</th><th>准入境界</th></tr></thead><tbody>${mapRows}</tbody></table>
    <div class="guide-note">📈 难度呈指数膨胀：第 30 关已是第 1 关的 2²⁹ ≈ 5.4 亿倍，第 100 关更达 2⁹⁹ 倍（天文数字）。仅靠破境的线性成长远远不够——<b>洪荒之力与轮回印记的乘区</b>才是穿透深层禁区的关键。</p></div>
    <h4>战斗收益</h4>
    <ul>
      <li><b>胜利</b>：碎银 = ⌊(${rw.coinBase} + 关卡×${rw.coinPerMap}) × 财运率/100⌋；修为 = ${rw.expBase} + 关卡×${rw.expPerMap}（不受加成）。</li>
      <li><b>掉落</b>：概率 = ${rw.baseDrop * 100}% × 掉宝率/100，触发则按当前关卡掉落一件随机装备（关卡越深，品质倍率越高）。</li>
      <li><b>战败</b>：损失当前碎银的 ${rw.loseCoinRate * 100}%，并停止挂机退回安全区（碎银不会变负）。</li>
    </ul>

    <h3 id="sec-equip">⑥ 装备系统</h3>
    <p>共 6 个部位，6 档品阶。掉落/购买时随机决定品阶，品质倍率 = (品阶+1) × (1 + (来源等级 mod 3) × 0.4)。</p>
    <table class="guide-table"><thead><tr><th>品阶</th><th>出现概率</th><th>回收价</th></tr></thead><tbody>${qualityRows}</tbody></table>
    <table class="guide-table"><thead><tr><th>部位</th><th>主属性</th><th>高阶附加</th></tr></thead><tbody>${slotRows}</tbody></table>
    <p style="color:#999;">在「行囊」点击物品可<b>披挂上身 / 投入洪炉 / 熔炼换银</b>；也可拖拽入炉（手机长按拖动）。熔炼按品阶批量回收碎银。</p>

    <h3 id="sec-skill">⑦ 秘籍系统</h3>
    <p>秘籍分三类：<b style="color:var(--color-orange)">主动招式</b>（战斗中触发、按倍率打伤害）、<b style="color:var(--color-blue)">被动功法</b>（永久叠加属性）、<b style="color:var(--color-honghuang)">洪荒法则</b>（独一档的全属性乘区）。</p>
    <h4>主动招式（每回合 ${bt.activeSkillChance * 100}% 概率施展；多门时取最强一招，不再稀释）</h4>
    <table class="guide-table"><thead><tr><th>招式</th><th>基础倍率</th><th>功效（每重 +${bt.activeLevelScale} 倍）</th></tr></thead><tbody>${activeRows}</tbody></table>
    <h4>被动功法（每重永久叠加）</h4>
    <table class="guide-table"><thead><tr><th>功法</th><th>每重加成</th><th>说明</th></tr></thead><tbody>${passiveRows}</tbody></table>
    <h4>研习（升级）花费</h4>
    <ul>
      <li>普通秘籍：最高 <b>${B.skill.normalMaxLevel}</b> 重，升级耗修为 = 当前重数 × ${B.skill.normalUpgradeCostPerLevel}。</li>
      <li>洪荒功法：最高 <b>${B.skill.hhMaxLevel}</b> 重，升级耗修为 = 当前重数 × ${formatNumber(B.skill.hhUpgradeCostPerLevel)}；每重洪荒之力 +1%（五维总量 +2%）。</li>
      <li>在「百修秘籍」可点【一键参悟行囊秘籍】把背包里所有秘籍一次性学会（已会的保留）。</li>
    </ul>

    <h3 id="sec-forge">⑧ 天地洪炉（万物合成）</h3>
    <p>放入两件物品融合，启动花费 = ⌊(物品A售价 + 物品B售价) × ${B.forge.costRate}⌋ + ${B.forge.costBase} 文。三种配方：</p>
    <table class="guide-table"><thead><tr><th>配方</th><th>产物</th></tr></thead><tbody>
      <tr><td style="white-space:nowrap;">装备 ＋ 装备</td><td>进阶装备：取两者较高品阶为底，同阶 ${B.forge.upgradeSameQ * 100}% / 异阶 ${B.forge.upgradeDiffQ * 100}% 概率<b>品阶+1</b>（升阶冠「灵铸」）。洪炉装备属性高于野生掉落。</td></tr>
      <tr><td style="white-space:nowrap;">秘籍 ＋ 秘籍</td><td>「绝世」功法：倍率 ×1.5、属性翻倍。若任一为洪荒孤本，则 40% 概率融出<b style="color:var(--color-honghuang)">洪荒法则·混沌诀</b>。</td></tr>
      <tr><td style="white-space:nowrap;">装备 ＋ 秘籍</td><td>「附魔」神器：装备品阶+1，并把秘籍属性<b>放大 ${B.forge.enchantPayloadMult} 倍</b>灌注其上（主动技按倍率折算成攻击+暴击）。</td></tr>
    </tbody></table>

    <h3 id="sec-shop">⑨ 珍宝黑市</h3>
    <p>黑市共 6 件货（3 装备 ＋ 3 普通秘籍，秘籍定价 6000 文）：<b>买走一件就少一件、其余不变</b>，切换页签也不会换货；想要整批新货，点【刷新】重随机整架。<b>刷新费用连刷递增</b>（起步 ${B.shopRefresh.base} 文、每连刷一次 ×${B.shopRefresh.growth}），并随真实时间逐步回落——偶尔刷很便宜，连刷钓鱼则迅速变贵（杜绝低价无限刷新）。有 <b>${B.shopHHChance * 100}%</b> 概率出<b style="color:var(--color-honghuang)">洪荒孤本《老区长混沌诀》</b>（售价 ${formatNumber(B.hhSkillPrice)} 文，此时普通货位减为 5 件）——孤本是开启「洪荒之力」乘区的关键，遇到务必抢购。</p>

    <h3 id="sec-grow">⑩ 破境冲关 与 渡劫轮回</h3>
    <h4>破境冲关（线性成长）</h4>
    <p>消耗修为 = 当前境界 × ${B.breakthrough.costPerLevel}，境界 +1，基础 气血+${B.breakthrough.hpGain} / 攻击+${B.breakthrough.atkGain} / 防御+${B.breakthrough.defGain}。境界阶梯：</p>
    <p style="color:#999;font-size:12px;">${realmLadder} → 至高封神…</p>
    <h4>渡劫轮回（质变成长）</h4>
    <p>境界达到 <b>${B.reborn.minLevel}</b> 级后可渡劫：境界重置为 1、基础属性回到 ${B.reborn.baseHp}/${B.reborn.baseAtk}/${B.reborn.baseDef}，但<b>轮回印记 +1</b>，此后 气血/攻击/防御 永久 ×(1 + 印记 × ${B.rebornMultPerCount})。</p>
    <div class="guide-tip">💡 轮回会清空累积的破境加成，但<b>装备、秘籍、碎银、修为全部保留</b>。当一次 +${B.rebornMultPerCount * 100}% 的全局乘区收益 ＞ 你已堆出的破境收益时，渡劫就是净赚——这是后期战力翻倍的主引擎。</div>

    <h3 id="sec-tips">⑪ 进阶心法（攻略要点）</h3>
    <ul>
      <li><b>攻防双吃乘区</b>：气血/攻击/防御同时享受轮回×洪荒双乘，是性价比最高的成长，优先堆叠。</li>
      <li><b>破防优于堆攻</b>：实伤 = 攻 − 敌防，深层敌人防御极高，单纯堆攻收益递减；主动技倍率与暴击 ×${bt.critMult} 是放大输出的乘法手段。</li>
      <li><b>闪避封顶 ${B.dodgeCap}%</b>：触发即全免该次伤害，但<b>始终有 ${100 - B.dodgeCap}% 攻击会命中</b>——闪避是强力减伤而非无敌，仍要堆血/防兜底；配合高血量把「撑满 ${bt.maxRounds} 回合判胜」用作越级磨怪的稳健打法。</li>
      <li><b>洪荒之力是分水岭</b>：黑市孤本/洪炉融合获得洪荒功法后，每重都让五维总量再涨一截，是穿透指数级关卡的根本。</li>
      <li><b>该轮回就轮回</b>：到 ${B.reborn.minLevel} 级后别死磕境界，及时渡劫吃 +${B.rebornMultPerCount * 100}% 乘区，比线性破境快得多。</li>
      <li><b>资源分配</b>：修为同时用于破境与升级秘籍，碎银用于黑市与洪炉——前期多熔炼回血，攒钱抢孤本。</li>
    </ul>
    <p style="text-align:center;color:#666;font-size:12px;margin-top:18px;">— 本页数值均由游戏配置实时生成，与实战完全一致 —</p>
    `;
}
