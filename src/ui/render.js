// ============================================================
// 渲染层：读 state 把界面画出来。只写 DOM、不改游戏数据。
// 含：属性面板 / 各列表 / 洪炉 / 背包 / 技能 / 切页 / 浮动提示(tooltip)。
// 交互一律走 data-act 属性 + main.js 的事件委托，HTML 里不再有 onclick。
// ============================================================
import { QUALITY_NAMES, QUALITY_COLORS, MAP_NAMES, BALANCE } from '../config.js';
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

function buildTooltipHtml(target) {
    const info = JSON.parse(target.getAttribute('data-tip'));
    const isEquippedSlot = target.id && target.id.startsWith("slot-container-");
    const isForgeSlot = target.id && target.id.startsWith("forge-slot-");
    let finalHtml = `<div class="tooltip-container">`;

    if (isEquippedSlot || isForgeSlot) {
        finalHtml += generateHtmlColumn(info, "", isEquippedSlot);
    } else if (info.type === "book") {
        finalHtml += generateHtmlColumn(info);
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

export function renderShopGoods() {
    const player = state.player;
    const box = document.getElementById('shop-goods-box');
    box.innerHTML = "";
    shopGoods = [];
    const hasHHBook = Math.random() < BALANCE.shopHHChance;
    let goodsCount = 6;

    if (hasHHBook) {
        const hhSkill = {
            id: "sk_honghuang_unique",
            name: "老区长混沌诀",
            type: "passive",
            level: 1,
            isHongHuang: true,
            desc: "远古老区长遗留的法则具现。<br><br><span style='color:var(--color-honghuang)'>【洪荒法则】</span>：本功法最高可修炼至 100 重！每研习精进一重，【老区长的洪荒之力】永久 +1%（即全身各项基础属性暴增 2%）。研习此神功需要极其庞大的天地造化修为！",
            price: BALANCE.hhSkillPrice
        };
        const bookItem = { name: `禁忌秘籍·《${hhSkill.name}》`, type: "book", payload: hhSkill, price: hhSkill.price };
        const idx = shopGoods.push({ kind: 'skill', obj: hhSkill }) - 1;
        const card = document.createElement('div');
        card.className = "list-card";
        card.style.border = "1px solid var(--color-honghuang)";
        card.style.background = "linear-gradient(90deg, #1a050c 0%, #111 100%)";
        card.innerHTML = `<span data-tip='${JSON.stringify(bookItem)}' style="cursor:help;"><strong class="q-hh">🔥 绝世孤本《${hhSkill.name}》 🔍</strong></span><button class="btn btn-danger" data-act="buy-skill" data-idx="${idx}">购买 (380000文)</button>`;
        box.appendChild(card);
        goodsCount = 5;
    }

    for (let i = 1; i <= goodsCount; i++) {
        const card = document.createElement('div');
        card.className = "list-card";
        if (i <= 3) {
            const mockItem = generateItemByMatrix(player.realmLevel);
            const idx = shopGoods.push({ kind: 'item', obj: mockItem }) - 1;
            card.innerHTML = `<span data-tip='${JSON.stringify(mockItem)}' style="cursor:help;"><b class="q-${mockItem.quality}">[装备] ${mockItem.name} 🔍</b></span><button class="btn btn-success" data-act="buy-item" data-idx="${idx}">购买 (${mockItem.price}文)</button>`;
        } else {
            // 复用 domain.generateSkillByMatrix 生成「完整」技能对象（含 power/healRate/dropRate/coinRate），
            // 仅覆盖售价为固定 6000。原先此处手搓的对象漏了 power，主动技触发时伤害会算成 NaN。
            const mockSkill = generateSkillByMatrix(player.realmLevel);
            mockSkill.price = 6000;
            const bookItem = { name: `秘籍·《${mockSkill.name}》`, type: "book", payload: mockSkill, price: mockSkill.price };
            const idx = shopGoods.push({ kind: 'skill', obj: mockSkill }) - 1;
            card.innerHTML = `<span data-tip='${JSON.stringify(bookItem)}' style="cursor:help;"><strong style="color:var(--color-gold);">📜 绝学《${mockSkill.name}》 🔍</strong></span><button class="btn btn-success" data-act="buy-skill" data-idx="${idx}">购买 (${mockSkill.price}文)</button>`;
        }
        box.appendChild(card);
    }
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
            slot.innerHTML = `<b>${item.name.split('·')[1]?.substring(0, 5) || item.name.substring(0, 5)}</b><br><span style="color:#555;font-size:9px;">${item.type === 'book' ? '书' : '装'}</span>`;
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
            eff = `<span style="color:var(--color-honghuang)">当前引发老区长的洪荒之力 +${sk.level}% （五维核心属性总量增幅 +${sk.level * 2}%）</span>`;
        } else if (sk.type === "active") {
            // 注意：此处显示倍率用 0.15/级，与战斗实际 0.18/级(BALANCE.battle.activeLevelScale)不同——沿用原版，未擅改。
            eff = `主战招式：造成 ${(sk.power + (sk.level * 0.15)).toFixed(1)} 倍爆发伤害。`;
        } else {
            eff = `功法被动：气血+${sk.hp * sk.level} 攻击+${sk.atk * sk.level} 防御+${sk.def * sk.level}`;
        }

        card.innerHTML = `<div><strong class="${isHH ? 'q-hh' : ''}">《${sk.name}》 <span style="color:var(--color-gold);">[第${sk.level}/${maxLevel}重]</span></strong><br><small style="color:var(--text-muted)">${eff}</small></div><button class="btn" ${sk.level >= maxLevel ? 'disabled' : ''} data-act="upgrade-skill" data-idx="${index}">${sk.level >= maxLevel ? '已至化境' : `潜心研习(耗${formatNumber(cost)}修为)`}</button>`;
        box.appendChild(card);
    });
}

// ---------- 切换页签（tabEl 由委托传入，取代原全局 event.currentTarget）----------
export function switchPage(pageId, tabEl) {
    hideTooltip();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    if (tabEl) tabEl.classList.add('active');
    if (pageId === 'role' || pageId === 'bag') updatePlayerAttributes();
    if (pageId === 'kungfu') renderPlayerSkills();
    if (pageId === 'shop') renderShopGoods();
    if (pageId === 'adventure') renderMapList();
    if (pageId === 'bag') renderForge();
}
