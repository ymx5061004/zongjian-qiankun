// ============================================================
// 渲染层：读 state 把界面画出来。只写 DOM、不改游戏数据。
// 含：属性面板 / 各列表 / 洪炉 / 背包 / 技能 / 切页 / 浮动提示(tooltip)。
// 交互一律走 data-act 属性 + main.js 的事件委托，HTML 里不再有 onclick。
// ============================================================
import { QUALITY_NAMES, QUALITY_COLORS, MAP_NAMES, BALANCE, SKILL_SUFFIXES, REALMS } from '../config.js';
import { state } from '../state.js';
import { computeStats, getRealmName, generateItemByMatrix, generateSkillByMatrix } from '../domain.js';
import { formatNumber } from '../util.js';

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
        html += `<div class="tooltip-title" style="color:${qColor}">${titlePrefix}${info.name}</div>`;
        html += `<div class="tooltip-attr"><span>品阶质量:</span><span style="color:${qColor}">${QUALITY_NAMES[info.quality || 0] || '未知'}</span></div>`;
        html += `<div class="tooltip-attr"><span>回收碎银:</span><span style="color:var(--color-gold)">${info.price} 文</span></div>`;
        html += `<hr style="border:0; border-top:1px dashed #222; margin:6px 0;">`;

        const fields = [
            { k: 'atk', n: '攻击力', c: 'var(--color-accent)' },
            { k: 'def', n: '防御力', c: 'var(--color-blue)' },
            { k: 'hp', n: '气血总量', c: 'var(--color-success)' },
            { k: 'crit', n: '暴击率', c: 'var(--color-orange)', s: '%' },
            { k: 'dodge', n: '闪避率', c: 'var(--color-success)', s: '%' }
        ];
        fields.forEach(f => {
            const val = info[f.k] || 0;
            if (val > 0) html += `<div class="tooltip-attr"><span>${f.n}:</span><span style="color:${f.c}">+${val}${f.s || ''}</span></div>`;
        });
    }
    html += `</div>`;
    return html;
}

function generateDiffColumn(curItem, eqItem) {
    let html = `<div class="tooltip-column diff-column">`;
    html += `<div class="tooltip-title" style="color:#aaa;">🔀 变更对比</div>`;
    const fields = [{ k: 'atk', n: '攻击' }, { k: 'def', n: '防御' }, { k: 'hp', n: '气血' }, { k: 'crit', n: '暴击' }, { k: 'dodge', n: '闪避' }];
    fields.forEach(f => {
        const curVal = curItem[f.k] || 0;
        const eqVal = eqItem ? (eqItem[f.k] || 0) : 0;
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

// 一行技能摘要（类型 + 关键加成）：背包操作弹窗 / 移动端点按用，与详情卡同源 BALANCE。
export function skillBrief(sk) {
    if (!sk) return '江湖武学秘籍';
    if (sk.isHongHuang) return `洪荒法则 · 每重五维总量 +${BALANCE.honghuangMultPerLevel * 100}%`;
    if (sk.type === 'active') {
        const heal = sk.healRate ? ` · 吸血 ${Math.round(sk.healRate * 100)}%` : '';
        return `主动招式 · ${sk.power || 0} 倍伤害（每重 +${BALANCE.battle.activeLevelScale}）${heal}`;
    }
    const parts = PASSIVE_ATTRS.filter(d => sk[d.k]).map(d => `${d.n}+${sk[d.k]}${d.s || ''}`);
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
        // 实战：每回合 activeSkillChance 触发后，从所有主动技中等概率随机择一；故单招真实概率 = 0.4 / 主动技数
        const activeCount = state.player.skills.filter(s => s.type === 'active').length || 1;
        const perSkillPct = Math.round(B.activeSkillChance / activeCount * 100);
        html += `<div style="font-size:11px;color:#777;margin-top:5px;">战斗中每回合约 ${perSkillPct}% 概率施展${activeCount > 1 ? `（共 ${activeCount} 门主动技随机择一）` : ''}</div>`;
    } else {
        const rows = PASSIVE_ATTRS.filter(d => sk[d.k]);
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

    ['weapon', 'subweapon', 'armor', 'helm', 'ring', 'artifact'].forEach(s => {
        const eq = player.equips[s];
        const el = document.getElementById(`eq-${s}`);
        const container = document.getElementById(`slot-container-${s}`);
        if (eq) {
            el.innerText = eq.name; el.className = `q-${eq.quality}`;
            container.setAttribute('data-tip', JSON.stringify(eq));
        } else {
            el.innerText = `空`; el.className = "q-0";
            container.removeAttribute('data-tip');
        }
    });
    document.getElementById('bag-count').innerText = player.bag.length;
}

// ---------- 百关征途列表 ----------
export function renderMapList() {
    const player = state.player;
    const box = document.getElementById('map-list-box');
    box.innerHTML = "";
    for (let i = 1; i <= 100; i++) {
        const reqLevel = Math.floor((i - 1) * 1.1) + 1;
        const isUnlocked = player.realmLevel >= reqLevel;
        const card = document.createElement('div');
        card.className = `list-card`;
        if (!isUnlocked) card.style.opacity = "0.3";
        card.innerHTML = `<div><strong>关卡 ${i}：${MAP_NAMES[i - 1] || `神秘禁区`}</strong> ${!isUnlocked ? '🔒' : ''}<br><small style="color:var(--text-muted)">准入: ${getRealmName(reqLevel)}</small></div><button class="btn" ${isUnlocked ? '' : 'disabled'} data-act="hangup" data-map="${i}">${player.currentMapId === i ? '历练中' : '挑战'}</button>`;
        box.appendChild(card);
    }
}

// ---------- 珍宝黑市（商品存数组，按索引购买，不再把 JSON 塞进 HTML）----------
let shopGoods = []; // [{kind:'item'|'skill', obj}]
export function getShopGood(idx) { return shopGoods[idx]; }

// 把对象序列化成可安全嵌入「单引号」HTML 属性(data-tip)的串。
// 否则 desc 里的 style='...' 单引号会提前闭合属性，把 JSON 泄漏成可见文本（洪荒孤本即此症）。
// 仅需转义 & 与 '：getAttribute 读取时浏览器自动解码回原 JSON，tooltip 的 JSON.parse 照常工作。
function tipAttr(obj) {
    return JSON.stringify(obj).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
}

// 进货：重随机生成整架商品。只在「启动」「付费手动刷新」时调用——切页/购买都不该换货。
// 数据存模块级 shopGoods（不入存档），关游戏重开即一批新货。
export function rollShopGoods() {
    const player = state.player;
    shopGoods = [];
    if (Math.random() < BALANCE.shopHHChance) {
        shopGoods.push({ kind: 'skill', obj: {
            id: "sk_honghuang_unique", name: "老区长混沌诀", type: "passive", level: 1, isHongHuang: true,
            desc: "远古老区长遗留的法则具现。<br><br><span style='color:var(--color-honghuang)'>【洪荒法则】</span>：本功法最高可修炼至 100 重！每研习精进一重，【老区长的洪荒之力】永久 +1%（即全身各项基础属性暴增 2%）。研习此神功需要极其庞大的天地造化修为！",
            price: BALANCE.hhSkillPrice
        } });
    }
    const skillCount = shopGoods.length ? 2 : 3; // 出了孤本则普通货位 6→5（孤本占掉一个秘籍位）
    for (let i = 0; i < 3; i++) shopGoods.push({ kind: 'item', obj: generateItemByMatrix(player.realmLevel) });
    for (let i = 0; i < skillCount; i++) {
        // 复用 domain.generateSkillByMatrix 生成「完整」技能对象（含 power/healRate/...），仅覆盖售价为固定 6000。
        const sk = generateSkillByMatrix(player.realmLevel);
        sk.price = 6000;
        shopGoods.push({ kind: 'skill', obj: sk });
    }
    renderShopGoods();
}

// 买走一件后从货架移除（不重随机，保留其余）。控制层购买成功后调用，再 renderShopGoods。
export function removeShopGood(idx) {
    if (idx >= 0 && idx < shopGoods.length) shopGoods.splice(idx, 1);
}

// 纯渲染当前货架（切页 / 购买后调用，不重随机）。货架为空时提示去刷新。
export function renderShopGoods() {
    const box = document.getElementById('shop-goods-box');
    box.innerHTML = "";
    if (shopGoods.length === 0) {
        box.innerHTML = `<div class="list-card" style="justify-content:center; color:var(--text-muted);">— 黑市货已售罄，点上方「刷新」可重新进货 —</div>`;
        return;
    }
    shopGoods.forEach((g, idx) => {
        const card = document.createElement('div');
        card.className = "list-card";
        if (g.kind === 'item') {
            const it = g.obj;
            card.innerHTML = `<span data-tip='${tipAttr(it)}' style="cursor:help;"><b class="q-${it.quality}">[装备] ${it.name} 🔍</b></span><button class="btn btn-success" data-act="buy-item" data-idx="${idx}">购买 (${it.price}文)</button>`;
        } else if (g.obj.isHongHuang) {
            const hhSkill = g.obj;
            const bookItem = { name: `禁忌秘籍·《${hhSkill.name}》`, type: "book", payload: hhSkill, price: hhSkill.price };
            card.style.border = "1px solid var(--color-honghuang)";
            card.style.background = "linear-gradient(90deg, #1a050c 0%, #111 100%)";
            card.innerHTML = `<span data-tip='${tipAttr(bookItem)}' style="cursor:help;"><strong class="q-hh">🔥 绝世孤本《${hhSkill.name}》 🔍</strong></span><button class="btn btn-danger" data-act="buy-skill" data-idx="${idx}">购买 (${hhSkill.price}文)</button>`;
        } else {
            const sk = g.obj;
            const bookItem = { name: `秘籍·《${sk.name}》`, type: "book", payload: sk, price: sk.price };
            card.innerHTML = `<span data-tip='${tipAttr(bookItem)}' style="cursor:help;"><strong style="color:var(--color-gold);">📜 绝学《${sk.name}》 🔍</strong></span><button class="btn btn-success" data-act="buy-skill" data-idx="${idx}">购买 (${sk.price}文)</button>`;
        }
        box.appendChild(card);
    });
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
            const parts = PASSIVE_ATTRS.filter(d => sk[d.k]).map(d => `${d.n}+${sk[d.k] * sk.level}${d.s || ''}`);
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
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    if (tabEl) tabEl.classList.add('active');
    closeMenu();   // 移动端：点菜单项后收起抽屉
    if (pageId === 'role' || pageId === 'bag') updatePlayerAttributes();
    if (pageId === 'kungfu') renderPlayerSkills();
    if (pageId === 'shop') renderShopGoods();
    if (pageId === 'adventure') renderMapList();
    if (pageId === 'bag') renderForge();
    if (pageId === 'guide') renderGuide();
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
        const parts = [];
        if (s.hp) parts.push(`气血+${s.hp}`);
        if (s.atk) parts.push(`攻击+${s.atk}`);
        if (s.def) parts.push(`防御+${s.def}`);
        if (s.crit) parts.push(`暴击+${s.crit}%`);
        if (s.dodge) parts.push(`闪避+${s.dodge}%`);
        if (s.dropRate) parts.push(`掉宝+${s.dropRate}%`);
        if (s.coinRate) parts.push(`财运+${s.coinRate}%`);
        return `<tr><td style="color:var(--color-blue);white-space:nowrap;">…${s.name}</td><td style="white-space:nowrap;">${parts.join('　')}</td><td style="color:#999;">每重永久叠加</td></tr>`;
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
3. 主动技判定：${bt.activeSkillChance * 100}% 概率施展（拥有多门主动技时随机择一）
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
    <h4>主动招式（每回合 ${bt.activeSkillChance * 100}% 概率施展其一）</h4>
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
    <p>黑市共 6 件货（3 装备 ＋ 3 普通秘籍，秘籍定价 6000 文）：<b>买走一件就少一件、其余不变</b>，切换页签也不会换货；想要整批新货，点【刷新】花 <b>${B.shopRefreshCost}</b> 文。有 <b>${B.shopHHChance * 100}%</b> 概率出<b style="color:var(--color-honghuang)">洪荒孤本《老区长混沌诀》</b>（售价 ${formatNumber(B.hhSkillPrice)} 文，此时普通货位减为 5 件）——孤本是开启「洪荒之力」乘区的关键，遇到务必抢购。</p>

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
