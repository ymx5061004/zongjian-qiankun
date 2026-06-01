// ============================================================
// 控制层：玩家动作。把 domain(纯逻辑) + state(数据) + render(界面) + storage(存档)
// 粘合起来。校验、扣费、改 state、刷新界面、存档都在这里发生。
// ============================================================
import { state } from './state.js';
import { BALANCE, MATERIALS, GEAR_TIERS, QUALITY_NAMES, BOSSES, GEAR_SLOTS } from './config.js';
import { computeForgeCost, computeForgeResult, partitionByQuality, partitionAllGear, enhanceCost, levelFromExp, makeGearPiece, gearCraftCost, rollQuality, computeStats, getRealmName, finalizeBossStats, simulateBattle, gearUpgradeCost, bagExpandCost } from './domain.js';
import {
    updatePlayerAttributes, renderMapList, renderBag, renderForge,
    renderShopGoods, renderPlayerSkills, hideTooltip, getShopGood,
    rollShopGoods, removeShopGood, skillBrief, skillDescText, renderEnhance, renderCraft, renderDungeon, renderWarehouse, renderBagExpand, renderPills
} from './ui/render.js';
import { saveGame, exportSaveString, importSaveString } from './storage.js';
import { toast, confirmDialog, chooseAction } from './ui/dialog.js';
import { formatNumber } from './util.js';
import { checkAchievementsAndNotify } from './ui/achievement.js';

function gainCoin(player, amount, triggerType = 'coin') {
    if (!Number.isFinite(amount) || amount <= 0) return;
    player.coin += amount;
    player.totalCoinEarned = (player.totalCoinEarned || 0) + amount;
    checkAchievementsAndNotify(triggerType);
}

// —— 破境冲关 ——
export function playerBreakthrough() {
    const player = state.player;
    const needExp = player.realmLevel * BALANCE.breakthrough.costPerLevel;
    if (player.exp < needExp) { toast(`元气未足！冲关需要消耗修为 ${needExp} 点。`, 'error'); return; }
    player.exp -= needExp;
    player.realmLevel++;
    player.baseHp += BALANCE.breakthrough.hpGain;
    player.baseAtk += BALANCE.breakthrough.atkGain;
    player.baseDef += BALANCE.breakthrough.defGain;
    const unlockedSlot = GEAR_SLOTS.find(s => s.realmReq === player.realmLevel); // 本次突破是否恰好解锁新部位
    updatePlayerAttributes();
    renderMapList();
    checkAchievementsAndNotify('realm');
    saveGame();
    if (unlockedSlot) toast(`🎉 突破${getRealmName(player.realmLevel)}，解锁新装备部位【${unlockedSlot.label}】！`, 'success');
}

// —— 渡劫轮回（异步确认）——
export async function triggerReborn() {
    const player = state.player;
    if (player.realmLevel < BALANCE.reborn.minLevel) { toast("天机未到！请至少修炼至级20级。", 'error'); return; }
    const ok = await confirmDialog("确定引动天劫转世？");
    if (!ok) return;
    player.rebornCount++;
    player.realmLevel = 1;
    player.baseHp = BALANCE.reborn.baseHp;
    player.baseAtk = BALANCE.reborn.baseAtk;
    player.baseDef = BALANCE.reborn.baseDef;
    toast("✨ 成功破碎虚空轮回转世！", 'success');
    updatePlayerAttributes();
    renderMapList();
    checkAchievementsAndNotify('reborn');
    saveGame();
}

// —— 黑市购买（按索引取当前商品）——
export function buyShopItem(idx) {
    const player = state.player;
    const good = getShopGood(idx);
    if (!good || good.kind !== 'item') return;
    const itemObj = good.obj;
    if (player.coin < itemObj.price) { toast("碎银不足！", 'error'); return; }
    if (player.bag.length >= player.bagMax) { toast("背包已满，可在本黑市「行囊扩容」加格。", 'error'); return; }
    player.coin -= itemObj.price;
    player.bag.push(itemObj);
    removeShopGood(idx);          // 只移除买走的这件，其余货保留（不再整架重随机）
    hideTooltip();
    renderShopGoods();
    renderBag();
    updatePlayerAttributes();
    saveGame();
}

export function buyShopSkill(idx) {
    const player = state.player;
    const good = getShopGood(idx);
    if (!good || good.kind !== 'skill') return;
    const skObj = good.obj;
    if (player.coin < skObj.price) { toast("银两不足。", 'error'); return; }
    if (player.bag.length >= player.bagMax) { toast("行囊已满，可在本黑市「行囊扩容」加格。", 'error'); return; }
    player.coin -= skObj.price;
    player.bag.push({
        id: "bk_" + Date.now(),
        name: skObj.isHongHuang ? `禁忌秘籍·《${skObj.name}》` : `秘籍·《${skObj.name}》`,
        type: "book", payload: skObj, price: Math.floor(skObj.price / 5)
    });
    removeShopGood(idx);          // 只移除买走的这件，其余货保留（不再整架重随机）
    hideTooltip();
    renderShopGoods();
    renderBag();
    updatePlayerAttributes();
    saveGame();
}

// —— 黑市付费刷新：扣 shopRefreshCost 文，重随机整架货 ——
export function refreshShop() {
    const player = state.player;
    const cost = BALANCE.shopRefreshCost;
    if (player.coin < cost) { toast(`刷新黑市需 ${cost} 文碎银，碎银不足。`, 'error'); return; }
    player.coin -= cost;
    rollShopGoods();
    hideTooltip();
    updatePlayerAttributes();
    saveGame();
    toast(`已消耗 ${cost} 文，黑市新进了一批货。`, 'success');
}

// —— 黑市常驻：花碎银买 1 格背包扩容（梅尔沃 Bank Slot 式，价随已扩次数几何递增）——
export function buyBagSlot() {
    const player = state.player;
    const info = bagExpandCost(player.bagMax);
    if (!info) { toast("行囊已扩至上限。", 'error'); return; }
    if (player.coin < info.cost) { toast(`碎银不足：扩容此格需 ${formatNumber(info.cost)} 文。`, 'error'); return; }
    player.coin -= info.cost;
    player.bagMax += info.addSlots;
    renderBagExpand();         // 刷新扩容卡（新容量 + 下一格新价）
    renderBag();               // 背包多出空格子
    updatePlayerAttributes();  // 顶栏碎银
    saveGame();
    toast(`🎒 行囊扩容 +${info.addSlots}！当前 ${player.bagMax} 格。`, 'success');
}

// —— 洪炉：取出 / 合成 ——
export function removeFromForge(idx) {
    const player = state.player;
    if (state.forgeItems[idx]) {
        if (player.bag.length >= player.bagMax) { toast("行囊已满，无法取出！", 'error'); return; }
        player.bag.push(state.forgeItems[idx]);
        state.forgeItems[idx] = null;
        hideTooltip();
        renderForge();
        renderBag();
        saveGame();
    }
}

// —— 拖拽：把背包物品放入指定洪炉槽（该槽已占用则与背包原格交换）——
export function dropBagToForge(bagIdx, slotIdx) {
    const player = state.player;
    const item = player.bag[bagIdx];
    if (!item) return;
    const existing = state.forgeItems[slotIdx];
    state.forgeItems[slotIdx] = item;
    if (existing) player.bag[bagIdx] = existing; // 交换：旧炉中物回到这一背包格
    else player.bag.splice(bagIdx, 1);
    hideTooltip();
    renderForge();
    renderBag();
    saveGame();
}

// —— 拖拽：交换两个洪炉槽（含一空一满时的"移动"）——
export function swapForge(a, b) {
    if (a === b) return;
    const t = state.forgeItems[a];
    state.forgeItems[a] = state.forgeItems[b];
    state.forgeItems[b] = t;
    hideTooltip();
    renderForge();
    saveGame();
}

export function executeForge() {
    const player = state.player;
    const i1 = state.forgeItems[0];
    const i2 = state.forgeItems[1];
    if (!i1 || !i2) { toast("必须放入两件物品才能启动洪炉！", 'error'); return; }
    const cost = computeForgeCost(i1, i2);
    if (player.coin < cost) { toast(`启动洪炉需要注入 ${cost} 文碎银作为灵力，你的碎银不足！`, 'error'); return; }
    player.coin -= cost;

    const resultItem = computeForgeResult(i1, i2, player.realmLevel, cost);
    player.totalForgeCount = (player.totalForgeCount || 0) + 1;
    state.forgeItems = [null, null];
    player.bag.push(resultItem);
    hideTooltip();
    renderForge();
    renderBag();
    updatePlayerAttributes();
    checkAchievementsAndNotify('forge');
    saveGame();
    toast(`⚡ 洪炉轰鸣！消耗 ${cost} 文碎银，成功炼制出：【${resultItem.name}】！`, 'success');
}

// —— 熔炼 ——
export function smeltByQuality(qualities, label) {
    const player = state.player;
    if (player.bag.length === 0) return;
    const { remain, gold } = partitionByQuality(player.bag, qualities);
    if (player.bag.length === remain.length) { toast("没有符合条件的装备可熔炼。", 'error'); return; }
    player.bag = remain;
    gainCoin(player, gold, 'coin');
    renderBag();
    updatePlayerAttributes();
    saveGame();
    toast(`成功熔炼 ${label}，获得碎银 ${gold} 文。`, 'success');
}

export async function smeltAllItems() {
    const player = state.player;
    const gearCount = player.bag.filter(it => it.type !== "book").length;
    if (gearCount === 0) { toast("行囊中没有可熔炼的装备。", 'error'); return; }
    const ok = await confirmDialog(`确定熔炼行囊中全部 ${gearCount} 件装备吗？秘籍会自动保留。`);
    if (!ok) return;
    const { remain, gold } = partitionAllGear(player.bag);
    player.bag = remain;
    gainCoin(player, gold, 'coin');
    renderBag();
    updatePlayerAttributes();
    saveGame();
    toast(`破釜沉舟完毕，共获得碎银 ${gold} 文。`, 'success');
}

// —— 使用背包物品（异步三选）——
export async function useBagItem(idx) {
    const player = state.player;
    const item = player.bag[idx];
    if (!item) return;

    // 弹窗内附带属性 + 变更对比：移动端点背包格子直接进此弹窗（没有 hover 提示），
    // 需在此看清自身属性，并补回桌面端 hover 才有的"与当前装备的 ▲▼ 对比"。
    let message;
    if (item.type === 'book') {
        // 移动端点背包格直接进此弹窗（无 hover 详情卡），故在此补「类型(主动/被动/洪荒)+关键加成」摘要，与详情卡同源。
        const p = item.payload || {};
        const briefColor = p.isHongHuang ? 'var(--color-honghuang)' : (p.type === 'active' ? 'var(--color-orange)' : 'var(--color-blue)');
        message =
            `<div style="color:${briefColor};font-weight:bold;font-size:13px;margin-bottom:6px;">${skillBrief(p)}</div>` +
            `<div style="color:#bbb;font-size:13px;line-height:1.6;margin-bottom:10px;">${skillDescText(p)}</div>请选择操作：`;
    } else {
        const fields = [
            { k: 'atk', n: '攻击' }, { k: 'def', n: '防御' }, { k: 'hp', n: '气血' },
            { k: 'crit', n: '暴击', s: '%' }, { k: 'dodge', n: '闪避', s: '%' }
        ];
        const eq = player.equips[item.type];
        // 攻/防/血按各自强化等级放大后再算/再比（与 tooltip、computeStats 同源），避免强化装备被低估、误导换装
        const per = BALANCE.enhance.perLevel;
        const enhScaled = { atk: 1, def: 1, hp: 1 };
        const itEm = 1 + (item.enhance || 0) * per;
        const eqEm = 1 + (eq ? (eq.enhance || 0) : 0) * per;
        const statParts = [];
        const diffParts = [];
        fields.forEach(f => {
            const cur = enhScaled[f.k] ? Math.floor((item[f.k] || 0) * itEm) : (item[f.k] || 0);
            if (cur) statParts.push(`${f.n} +${cur}${f.s || ''}`);
            const eqVal = !eq ? 0 : (enhScaled[f.k] ? Math.floor((eq[f.k] || 0) * eqEm) : (eq[f.k] || 0));
            const diff = cur - eqVal;
            if (diff > 0) diffParts.push(`<span style="color:var(--color-success)">${f.n} ▲+${diff}${f.s || ''}</span>`);
            else if (diff < 0) diffParts.push(`<span style="color:var(--color-accent)">${f.n} ▼${diff}${f.s || ''}</span>`);
        });
        const statLine = statParts.length ? statParts.join('　') : '无属性加成';
        const cmpLabel = eq ? `🔀 对比当前【${eq.name}】` : '🔀 该部位当前空缺，装备后净增';
        const cmpLine = diffParts.length ? diffParts.join('　') : '与当前装备属性相同';
        message =
            `<div style="color:#bbb;font-size:13px;line-height:1.6;margin-bottom:8px;">${statLine}</div>` +
            `<div style="font-size:12px;color:#888;margin-bottom:3px;">${cmpLabel}</div>` +
            `<div style="font-size:13px;line-height:1.7;margin-bottom:10px;">${cmpLine}</div>` +
            `请选择操作：`;
    }

    const action = await chooseAction(`【${item.name}】`, message, [
        { label: item.type === 'book' ? '参悟绝学' : '披挂上身', value: '1', cls: 'btn-success' },
        { label: '投入天地洪炉', value: '2' },
        { label: `熔炼换取 ${item.price} 碎银`, value: '3', cls: 'btn-danger' }
    ]);
    if (!action) return; // 取消

    // 异步期间挂机仍在跑、背包可能变动，按引用重新定位（比原版 prompt 更稳）
    const curIdx = player.bag.indexOf(item);
    if (curIdx === -1) { toast("该物品已不在行囊中。", 'error'); return; }

    if (action === "2") {
        if (state.forgeItems[0] === null) { state.forgeItems[0] = item; player.bag.splice(curIdx, 1); }
        else if (state.forgeItems[1] === null) { state.forgeItems[1] = item; player.bag.splice(curIdx, 1); }
        else { toast("天地洪炉已满，请先取出炉中物品或开始融合！", 'error'); return; }
        renderForge();
        renderBag();
        saveGame();
    } else if (action === "3") {
        gainCoin(player, item.price, 'coin');
        player.bag.splice(curIdx, 1);
        renderBag();
        updatePlayerAttributes();
        saveGame();
        toast(`成功熔炼，获得碎银 ${item.price} 文。`, 'success');
    } else if (action === "1") {
        if (item.type !== "book") {
            const slotDef = GEAR_SLOTS.find(s => s.key === item.type);
            if (slotDef && player.realmLevel < slotDef.realmReq) { toast(`需突破至${getRealmName(slotDef.realmReq)}才能装备【${slotDef.label}】。`, 'error'); return; }
            const old = player.equips[item.type];
            player.equips[item.type] = item;
            if (old) player.bag[curIdx] = old; else player.bag.splice(curIdx, 1);
            checkAchievementsAndNotify('equip');
        } else {
            if (player.skills.find(s => s.name === item.payload.name)) { toast("你早已对此门武学烂熟于心。", 'error'); return; }
            player.skills.push(item.payload);
            player.bag.splice(curIdx, 1);
            toast(`✨ 成功参悟绝学：《${item.payload.name}》！`, 'success');
            checkAchievementsAndNotify('skill');
            renderPlayerSkills();
        }
        renderBag();
        updatePlayerAttributes();
        saveGame();
    }
}

// —— 出售物料：把整堆某物料按单价换成碎银（前期富余的低档矿石的去处；碎银喂打造/突破/强化/进阶）。
//    卖前二次确认，避免误点把一大堆值钱的矿/锭瞬间清空。——
export async function sellMaterial(key) {
    const player = state.player;
    const mat = MATERIALS[key];
    const shownQty = player.materials[key] || 0;
    if (!mat || shownQty <= 0) return;
    if (!mat.price) { toast(`${mat.name}无法出售。`, 'error'); return; }
    const ok = await confirmDialog(`确定出售全部【${mat.name}】×${formatNumber(shownQty)}，换取碎银 ${formatNumber(shownQty * mat.price)} 文吗？`);
    if (!ok) return;
    const qty = player.materials[key] || 0; // 异步确认期间挂机可能又采了几个，按当前实际数结算
    if (qty <= 0) return;
    const gain = qty * mat.price;
    delete player.materials[key];
    gainCoin(player, gain, 'coin');
    renderWarehouse();
    updatePlayerAttributes();
    saveGame();
    toast(`出售【${mat.name}】×${formatNumber(qty)}，得碎银 ${formatNumber(gain)} 文。`, 'success');
}

// —— 秘境：挑战 Boss（即时结算一场战斗，真打死才算胜）。胜则掉神魂结晶+碎银，可反复刷。——
export function challengeBoss(bossId) {
    const player = state.player;
    const boss = BOSSES.find(b => b.id === bossId);
    if (!boss) return;
    if (player.realmLevel < boss.realmReq) { toast(`境界不足，挑战【${boss.name}】需 ${getRealmName(boss.realmReq)}。`, 'error'); return; }
    const stats = computeStats(player).stats;
    const { enemyDead } = simulateBattle(stats, finalizeBossStats(boss), player.skills);
    if (!enemyDead) { toast(`不敌【${boss.name}】！再砥砺战力(强化/进阶/轮回)后来战。`, 'error'); return; }
    const crystal = boss.crystalMin + Math.floor(Math.random() * (boss.crystalMax - boss.crystalMin + 1));
    player.materials.soul_crystal = (player.materials.soul_crystal || 0) + crystal;
    gainCoin(player, boss.coin, 'coin');
    renderDungeon();
    updatePlayerAttributes();
    saveGame();
    toast(`⚔️ 击败【${boss.name}】！获得 神魂结晶×${crystal}、碎银+${formatNumber(boss.coin)}。`, 'success');
}

// —— 神兵进阶：用神魂结晶+碎银把「已装备」的玄晶档(或神话档)装备突破到下一档(打造造不出的档)。保留成色与强化等级。——
export function upgradeGear(slot) {
    const player = state.player;
    const item = player.equips[slot];
    if (!item) { toast("该部位未装备，无法进阶。", 'error'); return; }
    const cost = gearUpgradeCost(item);
    if (!cost) { toast("该装备无法进阶（需先打造/合成到玄晶档，且未达顶档）。", 'error'); return; }
    const haveCry = player.materials.soul_crystal || 0;
    if (haveCry < cost.crystal) { toast(`神魂结晶不足：需 ${cost.crystal}，现有 ${haveCry}。去秘境击败 Boss 获取。`, 'error'); return; }
    if (player.coin < cost.coin) { toast(`碎银不足：进阶需 ${cost.coin} 文。`, 'error'); return; }

    player.materials.soul_crystal -= cost.crystal;
    if (player.materials.soul_crystal <= 0) delete player.materials.soul_crystal;
    player.coin -= cost.coin;
    const upgraded = makeGearPiece(cost.nextTier, slot, item.quality || 0);
    upgraded.enhance = item.enhance || 0;   // 保留强化投入，跨档不打水漂
    const oldName = item.name;
    player.equips[slot] = upgraded;

    hideTooltip();
    renderDungeon();
    updatePlayerAttributes();
    saveGame();
    toast(`✨ 神兵进阶！【${oldName}】→【${upgraded.name}】（${GEAR_TIERS[cost.nextTier - 1].name}档）。`, 'success');
}

// —— 打造图谱：按「档(tier)+部位」确定性打造一件命名套装件进背包（梅尔沃式爬阶梯的核心）。
//    门控=锻造等级；耗对应档位的锭+碎银；成色(品阶)随机微调。装备主来源之一(前/中期)。——
export function craftGear(tier, slot) {
    const player = state.player;
    const T = GEAR_TIERS[tier - 1];
    if (!T) return;
    const smLv = levelFromExp(player.professions.smithing.exp);
    if (smLv < T.smithingReq) { toast(`需【锻造】${T.smithingReq} 级才能打造 ${T.name} 装备。`, 'error'); return; }
    if (player.bag.length >= player.bagMax) { toast("行囊已满，先腾空间或去黑市扩容。", 'error'); return; }
    const cost = gearCraftCost(tier);
    const have = player.materials[cost.ingotKey] || 0;
    const matName = MATERIALS[cost.ingotKey] ? MATERIALS[cost.ingotKey].name : cost.ingotKey;
    if (have < cost.ingotQty) { toast(`${matName}不足：需 ${cost.ingotQty}，现有 ${have}。`, 'error'); return; }
    if (player.coin < cost.coin) { toast(`碎银不足：打造需 ${cost.coin} 文。`, 'error'); return; }

    player.materials[cost.ingotKey] -= cost.ingotQty;
    if (player.materials[cost.ingotKey] <= 0) delete player.materials[cost.ingotKey];
    player.coin -= cost.coin;
    const q = rollQuality();
    const piece = makeGearPiece(tier, slot, q);
    player.bag.push(piece);

    hideTooltip();
    renderCraft();
    renderBag();
    updatePlayerAttributes();
    saveGame();
    toast(`🛡️ 打造成功：【${piece.name}】（${QUALITY_NAMES[q]}成色）！`, 'success');
}

// —— 神兵强化：用锭+碎银把「已装备」的装备 +1（永久放大攻/防/血）。
//    采矿/锻造的核心产出口——黑市买不到、战斗爆不出，只能靠挖矿熔锭来堆。——
export function enhanceEquip(slot) {
    const player = state.player;
    const item = player.equips[slot];
    if (!item) { toast("该部位尚未装备，无法强化。", 'error'); return; }
    const cost = enhanceCost(item);
    if (!cost) { toast(`【${item.name}】已达强化上限 +${BALANCE.enhance.maxLevel}。`, 'error'); return; }
    const have = player.materials[cost.ingotKey] || 0;
    const matName = MATERIALS[cost.ingotKey].name;
    if (have < cost.ingotQty) { toast(`${matName}不足：需 ${cost.ingotQty}，现有 ${have}。去采矿→熔炼备料。`, 'error'); return; }
    if (player.coin < cost.coin) { toast(`碎银不足：强化需 ${cost.coin} 文。`, 'error'); return; }

    player.materials[cost.ingotKey] -= cost.ingotQty;
    if (player.materials[cost.ingotKey] <= 0) delete player.materials[cost.ingotKey];
    player.coin -= cost.coin;
    item.enhance = (item.enhance || 0) + 1;

    hideTooltip();
    renderEnhance();
    updatePlayerAttributes();   // 重算战力(强化已反映到 computeStats)+刷新顶栏碎银/装备名+N
    saveGame();
    toast(`⚒️ 强化成功！【${item.name}】精炼至 +${item.enhance}。`, 'success');
}

// —— 卸下装备 ——
export function unequip(slot) {
    const player = state.player;
    if (!player.equips[slot]) return;
    if (player.bag.length >= player.bagMax) return;
    player.bag.push(player.equips[slot]);
    player.equips[slot] = null;
    renderBag();
    updatePlayerAttributes();
}

// —— 升级秘籍 ——
export function upgradePlayerSkill(idx) {
    const player = state.player;
    const sk = player.skills[idx];
    if (!sk) return;
    const isHH = sk.isHongHuang;
    const maxLevel = isHH ? BALANCE.skill.hhMaxLevel : BALANCE.skill.normalMaxLevel;
    const cost = isHH ? (sk.level * BALANCE.skill.hhUpgradeCostPerLevel) : (sk.level * BALANCE.skill.normalUpgradeCostPerLevel);
    if (sk.level >= maxLevel) return;
    if (player.exp < cost) { toast("研习所需修为不足！", 'error'); return; }
    player.exp -= cost;
    sk.level++;
    toast(`【突破】《${sk.name}》精进至第【${sk.level}】重！`, 'success');
    checkAchievementsAndNotify('skill');
    renderPlayerSkills();
    updatePlayerAttributes();
    saveGame();
}

// —— 遗忘功法：仅限「主动招式」。触发概率恒为 activeSkillChance、固定施展「有效倍率最高」的一招(见 domain.pickActive)，
//    多学弱主动技不再稀释触发，但会永久占位且永远不会被选中——故仍提供精简手段；
//    被动功法是永久增益、洪荒功法乃立身根本，均不提供遗忘（按钮层也不显示，这里再做一层防御）。——
export async function forgetSkill(idx) {
    const player = state.player;
    const sk = player.skills[idx];
    if (!sk) return;
    if (sk.isHongHuang) { toast("洪荒功法乃立身根本，不可遗忘！", 'error'); return; }
    if (sk.type !== 'active') { toast("被动功法是永久根基，无需遗忘。", 'error'); return; }
    const ok = await confirmDialog(`确定遗忘主动招式《${sk.name}》吗？遗忘后永久消失、不返还秘籍。`);
    if (!ok) return;
    const curIdx = player.skills.indexOf(sk); // 异步确认期间数组可能变动，按引用重新定位
    if (curIdx === -1) { toast("该功法已不在身上。", 'error'); return; }
    player.skills.splice(curIdx, 1);
    toast(`已遗忘《${sk.name}》，神识清明。`, 'success');
    renderPlayerSkills();
    updatePlayerAttributes();
    saveGame();
}

// —— 一键参悟：把行囊中所有秘籍逐一学会。已会的武学（与单本参悟一致）保留在行囊，不丢弃。——
export function learnAllSkills() {
    const player = state.player;
    if (!player.bag.some(it => it.type === 'book')) { toast("行囊中没有可参悟的秘籍。", 'error'); return; }
    let learned = 0, dup = 0;
    const remain = [];
    player.bag.forEach(it => {
        if (it.type !== 'book') { remain.push(it); return; }
        const name = it.payload && it.payload.name;
        if (!name) { remain.push(it); return; }                                  // 异常书，原样保留
        if (player.skills.find(s => s.name === name)) { dup++; remain.push(it); return; } // 已会：保留书
        player.skills.push(it.payload);
        learned++;
    });
    player.bag = remain;
    if (learned > 0) checkAchievementsAndNotify('skill');
    renderPlayerSkills();
    renderBag();
    updatePlayerAttributes();
    saveGame();
    const tail = dup ? `，另有 ${dup} 本为已会武学（已留在行囊）。` : '。';
    toast(learned ? `✨ 参悟完毕：习得 ${learned} 门绝学${tail}` : `行囊中的秘籍均已学会。`, learned ? 'success' : 'error');
}

// —— 存档：导出为加密备份文件 ——
function tsForFilename() {
    // 文件名时间戳 yyyyMMdd-HHmm（本地时区）
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export async function exportSaveFile() {
    let data;
    try {
        data = await exportSaveString();
    } catch (e) {
        toast('导出失败：' + (e && e.message || e), 'error');
        return;
    }
    try {
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `纵剑乾坤存档_${state.player.name || '无名'}_${tsForFilename()}.save`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('✅ 存档已导出，请妥善保管备份文件。', 'success');
    } catch (e) {
        toast('导出失败：' + (e && e.message || e), 'error');
    }
}

// —— 存档：从用户选择的文件导入（解密→确认覆盖→落盘→重载）——
export async function importSaveFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('文件过大，不像是本游戏的存档。', 'error'); return; }
    let player;
    try {
        const text = await file.text();
        player = await importSaveString(text);
    } catch (e) {
        toast('导入失败：' + (e && e.message || e), 'error');
        return;
    }
    const ok = await confirmDialog(
        `将用存档「<b style="color:var(--color-gold)">${escapeHtml(player.name)}</b>」<b style="color:var(--color-accent)">覆盖当前进度</b>，此操作不可撤销。确定导入？`,
        '导入存档'
    );
    if (!ok) return;
    state.player = player;   // 替换引用（与 loadGame 同套路）
    saveGame();              // 落盘新存档（顺带刷新 lastTickTime，重载后不会误判离线）
    toast('✅ 存档已导入，正在重载…', 'success');
    setTimeout(() => location.reload(), 600); // 重载让 init 全量重渲，零残留旧状态
}

// —— 服用丹药：扣 1 颗，永久累加 pillBonus(跨轮回保留)，刷新属性与丹房 ——
const PILL_LABEL = { hp: '气血', atk: '攻击', def: '防御', crit: '暴击', dodge: '闪避' };
export function takePill(key) {
    const player = state.player;
    const m = MATERIALS[key];
    if (!m || !m.pill) return;
    if ((player.materials[key] || 0) <= 0) { toast("没有这种丹药。", 'error'); return; }
    player.materials[key]--;
    if (player.materials[key] <= 0) delete player.materials[key];
    if (!player.pillBonus) player.pillBonus = { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0 };
    for (const [k, v] of Object.entries(m.pill)) player.pillBonus[k] = (player.pillBonus[k] || 0) + v;
    renderPills();
    updatePlayerAttributes();
    saveGame();
    const eff = Object.entries(m.pill).map(([k, v]) => `${PILL_LABEL[k]}+${v}${(k === 'crit' || k === 'dodge') ? '%' : ''}`).join('、');
    toast(`服下【${m.name}】，永久 ${eff}！`, 'success');
}
