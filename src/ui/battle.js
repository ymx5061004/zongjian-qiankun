// ============================================================
// 战斗视图层：把 domain.simulateBattle 算出的回合事件演出成动画/日志，
// 并处理挂机循环。逻辑（伤害/胜负）在 domain，这里只负责"演"和落地奖励。
// ============================================================
import { state } from '../state.js';
import { BALANCE, MAP_NAMES, GEAR_TIERS, MATERIALS } from '../config.js';
import { formatNumber } from '../util.js';
import { finalizeEnemyStats, simulateBattle, getCombatSkills, makeGearPiece, mapTier, rollQuality, unlockedGearSlots, getMapModifier, resolveMapEnv, getMapRewardMods, generateSkillByMatrix } from '../domain.js';
import { renderBag, renderMapList, updatePlayerAttributes } from './render.js';
import { isDragging } from './drag.js';
import { checkAchievementsAndNotify } from './achievement.js';
import { maybeUpdateQuestProgress } from '../actions.js';

// 敌人火柴人 SVG（与原版一致）
const ENEMY_SVG = `
            <svg viewBox="0 0 100 120" width="100%" height="100%" filter="drop-shadow(0 4px 6px rgba(255,0,0,0.5))">
                 <ellipse cx="50" cy="100" rx="20" ry="4" fill="rgba(0,0,0,0.5)"/>
                <circle cx="50" cy="30" r="10" stroke="var(--color-accent)" stroke-width="3" fill="none"/>
                <line x1="44" y1="28" x2="48" y2="32" stroke="var(--color-accent)" stroke-width="2"/>
                <line x1="56" y1="28" x2="52" y2="32" stroke="var(--color-accent)" stroke-width="2"/>
                <line x1="50" y1="40" x2="50" y2="70" stroke="#bbb" stroke-width="3"/>
                <line x1="50" y1="70" x2="35" y2="95" stroke="#bbb" stroke-width="3"/>
                <line x1="50" y1="70" x2="65" y2="95" stroke="#bbb" stroke-width="3"/>
                <line x1="50" y1="45" x2="25" y2="50" stroke="#bbb" stroke-width="3"/>
                <line x1="50" y1="45" x2="75" y2="50" stroke="#bbb" stroke-width="3"/>
            </svg>
        `;

// 战斗日志：appendChild + 裁剪，修原版 innerHTML += 永不清理的内存泄漏
function logBattle(html) {
    const box = document.getElementById('battle-log');
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = html;
    box.appendChild(div);
    while (box.children.length > BALANCE.battle.logMax) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
}

function spawnPopupEffect(isToPlayer, text, isCrit = false, isHeal = false) {
    const wrapper = document.getElementById('battle-canvas-wrapper');
    const popup = document.createElement('div');
    popup.className = "combat-effect-text";
    popup.innerText = text;
    if (isHeal) { popup.style.color = "var(--color-success)"; }
    else if (isCrit) { popup.style.color = "var(--color-orange)"; popup.style.fontSize = "24px"; }
    else { popup.style.color = isToPlayer ? "var(--color-accent)" : "#ffffff"; }
    // 手机端画布更矮更窄(160px)：起点下移、靠近各自立绘，避免数字冲出画布顶部或在中央叠显
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    popup.style.bottom = isMobile ? "55px" : "90px";
    const side = isMobile ? "28px" : "90px";
    if (isToPlayer) popup.style.left = side; else popup.style.right = side;
    wrapper.appendChild(popup);
    setTimeout(() => { popup.remove(); }, 600);
}

export function startHangup(mapId) {
    const player = state.player;
    if (state.hangupTimer) clearInterval(state.hangupTimer);
    player.currentMapId = mapId;
    state.battleProgress = 0;
    const enemyData = finalizeEnemyStats(mapId);

    document.getElementById('hangup-status').innerText = `横扫：${MAP_NAMES[mapId - 1]}`;
    document.getElementById('hangup-status').style.color = "var(--color-accent)";
    document.getElementById('sprite-enemy').style.display = "flex";
    document.getElementById('sprite-enemy').querySelector('.sprite-vector').innerHTML = ENEMY_SVG;
    document.getElementById('sprite-e-name').innerText = enemyData.name;

    logBattle(`【历练】踏入【${MAP_NAMES[mapId - 1]}】...`);
    // 地势词缀提示（荒原不提示）：名称 + 描述 + 精英标识，让玩家进场即知战斗环境。
    const { mod, isElite } = getMapModifier(mapId);
    if (mod.id !== 'wildland') logBattle(`【地势·${mod.icon}${mod.name}${isElite ? '·精英' : ''}】${mod.desc}`);
    state.hangupTimer = setInterval(() => { executeLoopBattle(mapId); }, BALANCE.battle.intervalMs);
    renderMapList();
}

export function stopHangup() {
    if (state.hangupTimer) {
        clearInterval(state.hangupTimer);
        state.hangupTimer = null;
        state.player.currentMapId = null;
        document.getElementById('hangup-status').innerText = "调息中";
        document.getElementById('hangup-status').style.color = "var(--color-success)";
        logBattle("【平息】回城纳凉调息。");
        document.getElementById('sprite-enemy').style.display = "none";
        renderMapList();
    }
}

function executeLoopBattle(mapId) {
    const player = state.player;
    const stats = state.finalStats;
    const B = BALANCE.battle;
    const { mod: mapMod } = getMapModifier(mapId);   // 当前关卡词缀（确定性）
    const env = resolveMapEnv(mapId, player);        // 战斗环境（荒原/无效果 → null）

    state.battleProgress++;
    const enemy = finalizeEnemyStats(mapId);

    logBattle(`⚔️ 遭遇战 -> [${enemy.name}] (生命:${formatNumber(enemy.maxHp)} 攻击:${formatNumber(enemy.atk)})`);

    const pSprite = document.getElementById('sprite-player');
    const eSprite = document.getElementById('sprite-enemy');

    // 纯逻辑算出整场战斗，再按节奏演出（env=地图词缀战斗环境）
    const { win, events, poisonDealt, dodges, maxHit, dmgTaken, finalPHpPct, buildSummary } = simulateBattle(stats, enemy, getCombatSkills(player), env);

    // —— 第四阶段·策略向成就统计累计（按战斗触发，非每帧扫描）——胜负皆累计的项目 ——
    if (!player.achievements) player.achievements = { unlocked: [], claimed: [], stats: {} };
    if (!player.achievements.stats) player.achievements.stats = {};
    const as = player.achievements.stats;
    const curPath = player.cultivationPath;
    if (dodges) as.dodgeCount = (as.dodgeCount || 0) + dodges;                       // 踏雪无痕
    if (maxHit > (as.maxSingleHit || 0)) as.maxSingleHit = maxHit;                   // 孤注一掷
    if (curPath === 'body' && dmgTaken) as.bodyDamageTaken = (as.bodyDamageTaken || 0) + dmgTaken; // 铁骨横江
    // —— 第五阶段·构筑机制触发计数（跨世累积；百关亦可触发剑势/毒蚀/守势/影步）——
    if (buildSummary) {
        if (!player.buildStats || typeof player.buildStats !== 'object') player.buildStats = { swordBreaks: 0, poisonBursts: 0, guardCounters: 0, afterimageHits: 0, overcharges: 0, bossBreaks: 0 };
        for (const k of Object.keys(player.buildStats)) player.buildStats[k] += (buildSummary[k] || 0);
    }

    events.forEach(ev => {
        const base = (ev.round - 1) * B.animStaggerMs;
        if (ev.side === 'player') {
            setTimeout(() => {
                pSprite.classList.add('strike-dash-right');
                setTimeout(() => pSprite.classList.remove('strike-dash-right'), 100);
                eSprite.classList.add('hurt-shake');
                setTimeout(() => eSprite.classList.remove('hurt-shake'), 150);
                spawnPopupEffect(false, ev.isCrit ? `暴击 -${formatNumber(ev.dmg)}` : `-${formatNumber(ev.dmg)}`, ev.isCrit);
                if (ev.heal > 0) spawnPopupEffect(true, `+${ev.heal}`, false, true);
                // 流血：错峰再弹一个红字，避免和主伤害数字完全重叠
                if (ev.bleed > 0) setTimeout(() => spawnPopupEffect(false, `🩸-${formatNumber(ev.bleed)}`, false), 120);
                document.getElementById('sprite-e-hp').style.width = ev.eHpPct + "%";
            }, base);
        } else if (ev.side === 'enemy') {
            setTimeout(() => {
                eSprite.classList.add('strike-dash-left');
                setTimeout(() => eSprite.classList.remove('strike-dash-left'), 100);
                pSprite.classList.add('hurt-shake');
                setTimeout(() => pSprite.classList.remove('hurt-shake'), 150);
                // 剑冢：敌方暴击用橙色加大字号呈现（ev.crit）
                spawnPopupEffect(true, ev.crit ? `暴击 -${formatNumber(ev.dmg)}` : `-${formatNumber(ev.dmg)}`, ev.crit);
                // 荆棘反伤：受击同时崩对手一下
                if (ev.reflect > 0) setTimeout(() => spawnPopupEffect(false, `🌵-${formatNumber(ev.reflect)}`, false), 120);
                document.getElementById('sprite-p-hp').style.width = ev.pHpPct + "%";
            }, base + B.playerActionDelayMs);
        } else if (ev.side === 'env') {
            // 地图词缀环境伤害（毒瘴/雷泽）：玩家逐回合掉血，飘伤害数字；仅首回合记一条日志，避免刷屏。
            setTimeout(() => {
                spawnPopupEffect(true, `⚠ -${formatNumber(ev.dmg)}`, false);
                document.getElementById('sprite-p-hp').style.width = ev.pHpPct + "%";
            }, base + B.playerActionDelayMs + 30);
            if (ev.round === 1) logBattle(`⚠️ ${ev.text}，每回合损失约 ${formatNumber(ev.dmg)} 气血。`);
        } else if (ev.side === 'regen') {
            setTimeout(() => {
                spawnPopupEffect(true, `+${formatNumber(ev.heal)}`, false, true);
                document.getElementById('sprite-p-hp').style.width = ev.pHpPct + "%";
            }, base + B.playerActionDelayMs);
        } else if (ev.side === 'poison') {
            // 毒修中毒：敌方逐回合掉血，飘绿色 ☠ 真伤数字（错峰于主伤害之后，避免与主数字重叠）
            setTimeout(() => {
                spawnPopupEffect(false, `☠ -${formatNumber(ev.dmg)}`, false, true);
                document.getElementById('sprite-e-hp').style.width = ev.eHpPct + "%";
            }, base + B.playerActionDelayMs + 60);
        } else if (ev.side === 'sword') {
            // 第五阶段·剑势破绽斩：橙色额外一击
            setTimeout(() => {
                spawnPopupEffect(false, `⚔️破绽 -${formatNumber(ev.dmg)}`, true);
                document.getElementById('sprite-e-hp').style.width = ev.eHpPct + "%";
            }, base + 40);
        } else if (ev.side === 'poisonburst') {
            // 第五阶段·毒蚀爆发：绿色真伤
            setTimeout(() => {
                spawnPopupEffect(false, `☠爆发 -${formatNumber(ev.dmg)}`, false, true);
                document.getElementById('sprite-e-hp').style.width = ev.eHpPct + "%";
            }, base + B.playerActionDelayMs + 80);
            if (ev.round === 1 || ev.stacks) logBattle(`☠️ 毒蚀爆发，敌气血骤损 ${formatNumber(ev.dmg)}！`);
        } else if (ev.side === 'afterimage') {
            // 第五阶段·影步补刀：追加一击
            setTimeout(() => {
                spawnPopupEffect(false, `🪶残影 -${formatNumber(ev.dmg)}`, false);
                document.getElementById('sprite-e-hp').style.width = ev.eHpPct + "%";
            }, base + 60);
        } else if (ev.side === 'guard') {
            // 第五阶段·守势硬接：蓝色减伤提示 + 反震
            setTimeout(() => {
                spawnPopupEffect(true, `🛡️守势`, false);
                if (ev.counter > 0) setTimeout(() => spawnPopupEffect(false, `反震 -${formatNumber(ev.counter)}`, false), 120);
            }, base + B.playerActionDelayMs);
        } else if (ev.side === 'overcharge') {
            logBattle(`🔥 ${ev.text || '炉心过载'}`);
        } else { // evade：闪避 / 格挡 / 定身（text 决定文案）
            setTimeout(() => { spawnPopupEffect(true, ev.text || "闪避", false); }, base + B.playerActionDelayMs);
        }
    });

    if (win) {
        const rmod = getMapRewardMods(mapId);   // 词缀掉落/收益倾向（全部已封顶）
        const baseCoin = BALANCE.reward.coinBase + mapId * BALANCE.reward.coinPerMap;
        const baseExp = BALANCE.reward.expBase + mapId * BALANCE.reward.expPerMap;
        const coinG = Math.floor(baseCoin * (stats.coinRate / 100));
        const expG = Math.floor(baseExp * rmod.expMult);   // 灵脉：修为加成（已封顶）
        player.coin += coinG;
        player.exp += expG;
        player.totalCoinEarned = (player.totalCoinEarned || 0) + coinG;
        player.totalKills = (player.totalKills || 0) + 1;
        player.maxMapCleared = Math.max(player.maxMapCleared || 0, mapId);

        // —— 材料导向掉落 —— 每场胜利必掉「该区域档位」的矿石(喂打造/熔炼)，把战斗接进生产经济
        const regionTier = mapTier(mapId);
        const oreKey = GEAR_TIERS[regionTier - 1].ore;
        const oreQty = 1 + Math.floor(Math.random() * BALANCE.reward.oreDropMax);
        player.materials[oreKey] = (player.materials[oreKey] || 0) + oreQty;
        let bonus = ` 拾得 ${MATERIALS[oreKey].name}×${oreQty}`;

        // 装备掉落（灵脉降低掉率 gearDropMult / 剑冢偏向兵刃 weaponBias）——锦上添花，顶配仍需自己打造/后期副本
        const gearChance = BALANCE.reward.baseDrop * (stats.dropRate / 100) * rmod.gearDropMult;
        if (Math.random() < gearChance && player.bag.length < player.bagMax) {
            let slotPool = unlockedGearSlots(player.realmLevel); // 只掉已解锁部位
            if (rmod.weaponBias && Math.random() < rmod.weaponBias) {
                const wp = slotPool.filter(s => s.key === 'weapon' || s.key === 'subweapon');
                if (wp.length) slotPool = wp;                   // 剑冢：偏向兵刃/暗器
            }
            const newItem = makeGearPiece(regionTier, slotPool[Math.floor(Math.random() * slotPool.length)].key, rollQuality());
            player.bag.push(newItem);
            bonus += `，夺得 [${newItem.name}]`;
            if (mapMod.id === 'sword_tomb' && newItem.type === 'weapon') player.swordTombWeapons = (player.swordTombWeapons || 0) + 1; // 成就：剑冢寻锋
            if (newItem.quality >= 4) as.gotHighQuality = (as.gotHighQuality || 0) + 1; // 成就：今天手气不错（史诗+品质）
            // 拖拽进行中不重渲背包：否则会销毁正被拖动的源节点、触发 pointercancel 中止拖拽。
            if (!isDragging()) renderBag();
        }
        // 毒瘴：药材掉落（喂炼丹），按关卡深度给对应档草药
        if (rmod.herbDropChance && Math.random() < rmod.herbDropChance) {
            const herbKey = mapId >= 45 ? 'herb_3' : (mapId >= 20 ? 'herb_2' : 'herb_1');
            const hq = 1 + Math.floor(Math.random() * 2);
            player.materials[herbKey] = (player.materials[herbKey] || 0) + hq;
            bonus += `，采得 ${MATERIALS[herbKey].name}×${hq}`;
        }
        // 魔窟：秘籍掉落（背包有空位时）
        if (rmod.skillDropChance && Math.random() < rmod.skillDropChance && player.bag.length < player.bagMax) {
            const sk = generateSkillByMatrix(player.realmLevel);
            player.bag.push({ id: 'bk_' + Date.now(), name: `秘籍·《${sk.name}》`, type: 'book', payload: sk, price: Math.floor(sk.price / 5) });
            bonus += `，魔头遗落 [秘籍·《${sk.name}》]`;
            if (!isDragging()) renderBag();
        }
        // 成就：雷泽获胜计数（逆雷而行）
        if (mapMod.id === 'thunder_marsh') player.thunderWins = (player.thunderWins || 0) + 1;
        // —— 第四阶段·胜利向成就统计 ——
        if (curPath) { as.winByPath = as.winByPath || {}; as.winByPath[curPath] = (as.winByPath[curPath] || 0) + 1; } // 初心初现(剑修胜场)
        as.winByMod = as.winByMod || {}; as.winByMod[mapMod.id] = (as.winByMod[mapMod.id] || 0) + 1;                  // 毒瘴不侵(词缀胜场)
        if (finalPHpPct < 20) as.lowHpWins = (as.lowHpWins || 0) + 1;                                                 // 残血反杀
        if (poisonDealt > 0 && curPath === 'poison') as.poisonKills = (as.poisonKills || 0) + 1;                      // 毒入骨髓
        if (player.equips && player.equips.armor) as.armorWins = (as.armorWins || 0) + 1;                             // 披衣初成
        if (!(player.equips && player.equips.weapon)) as.nakedWins = (as.nakedWins || 0) + 1;                         // 赤手空拳(隐藏)
        if (mapMod.id === 'spirit_vein') as.spiritVeinExp = (as.spiritVeinExp || 0) + expG;                           // 灵脉钟秀

        checkAchievementsAndNotify('battle');
        const poisonNote = poisonDealt > 0 ? `（淬毒灼烧 ${formatNumber(poisonDealt)}）` : '';
        logBattle(`✨ 胜利！碎银+${formatNumber(coinG)}，修为+${formatNumber(expG)}。${bonus}${poisonNote}`);
    } else {
        const loseCoin = Math.floor(player.coin * BALANCE.reward.loseCoinRate);
        player.coin -= loseCoin;
        if (player.coin < 0) player.coin = 0;
        logBattle(`❌ 战败！阵亡遗失 ${formatNumber(loseCoin)} 碎银，自动退回安全区。`);
        stopHangup();
    }

    setTimeout(() => {
        document.getElementById('sprite-p-hp').style.width = "100%";
        document.getElementById('sprite-e-hp').style.width = "100%";
    }, B.hpResetDelayMs);

    updatePlayerAttributes();
    const questDelta = { battleCount: 1 };                                  // 指引「初入江湖」（每场战斗 +1，胜负皆计）
    if (win && mapMod.id !== 'wildland') questDelta.affixStageWins = 1;     // 指引「识地势」（通关词缀关卡）
    maybeUpdateQuestProgress(questDelta);
}
