// ============================================================
// 控制层：玩家动作。把 domain(纯逻辑) + state(数据) + render(界面) + storage(存档)
// 粘合起来。校验、扣费、改 state、刷新界面、存档都在这里发生。
// ============================================================
import { state } from './state.js';
import { BALANCE } from './config.js';
import { computeForgeCost, computeForgeResult, partitionByQuality, partitionAllGear } from './domain.js';
import {
    updatePlayerAttributes, renderMapList, renderBag, renderForge,
    renderShopGoods, renderPlayerSkills, hideTooltip, getShopGood
} from './ui/render.js';
import { saveGame } from './storage.js';
import { toast, confirmDialog, chooseAction } from './ui/dialog.js';

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
    updatePlayerAttributes();
    renderMapList();
    saveGame();
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
    saveGame();
}

// —— 黑市购买（按索引取当前商品）——
export function buyShopItem(idx) {
    const player = state.player;
    const good = getShopGood(idx);
    if (!good || good.kind !== 'item') return;
    const itemObj = good.obj;
    if (player.coin < itemObj.price) { toast("碎银不足！", 'error'); return; }
    if (player.bag.length >= player.bagMax) { toast("背包空间已满。", 'error'); return; }
    player.coin -= itemObj.price;
    player.bag.push(itemObj);
    hideTooltip();
    renderShopGoods();
    renderBag();
    updatePlayerAttributes();
}

export function buyShopSkill(idx) {
    const player = state.player;
    const good = getShopGood(idx);
    if (!good || good.kind !== 'skill') return;
    const skObj = good.obj;
    if (player.coin < skObj.price) { toast("银两不足。", 'error'); return; }
    if (player.bag.length >= player.bagMax) { toast("行囊空间已满。", 'error'); return; }
    player.coin -= skObj.price;
    player.bag.push({
        id: "bk_" + Date.now(),
        name: skObj.isHongHuang ? `禁忌秘籍·《${skObj.name}》` : `秘籍·《${skObj.name}》`,
        type: "book", payload: skObj, price: Math.floor(skObj.price / 5)
    });
    hideTooltip();
    renderShopGoods();
    renderBag();
    updatePlayerAttributes();
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

export function executeForge() {
    const player = state.player;
    const i1 = state.forgeItems[0];
    const i2 = state.forgeItems[1];
    if (!i1 || !i2) { toast("必须放入两件物品才能启动洪炉！", 'error'); return; }
    const cost = computeForgeCost(i1, i2);
    if (player.coin < cost) { toast(`启动洪炉需要注入 ${cost} 文碎银作为灵力，你的碎银不足！`, 'error'); return; }
    player.coin -= cost;

    const resultItem = computeForgeResult(i1, i2, player.realmLevel, cost);
    state.forgeItems = [null, null];
    player.bag.push(resultItem);
    hideTooltip();
    renderForge();
    renderBag();
    updatePlayerAttributes();
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
    player.coin += gold;
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
    player.coin += gold;
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

    const action = await chooseAction(`【${item.name}】`, "请选择操作：", [
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
        player.coin += item.price;
        player.bag.splice(curIdx, 1);
        renderBag();
        updatePlayerAttributes();
        saveGame();
        toast(`成功熔炼，获得碎银 ${item.price} 文。`, 'success');
    } else if (action === "1") {
        if (item.type !== "book") {
            const old = player.equips[item.type];
            player.equips[item.type] = item;
            if (old) player.bag[curIdx] = old; else player.bag.splice(curIdx, 1);
        } else {
            if (player.skills.find(s => s.name === item.payload.name)) { toast("你早已对此门武学烂熟于心。", 'error'); return; }
            player.skills.push(item.payload);
            player.bag.splice(curIdx, 1);
            toast(`✨ 成功参悟绝学：《${item.payload.name}》！`, 'success');
            renderPlayerSkills();
        }
        renderBag();
        updatePlayerAttributes();
        saveGame();
    }
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
    renderPlayerSkills();
    updatePlayerAttributes();
    saveGame();
}
