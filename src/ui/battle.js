// ============================================================
// 战斗视图层：把 domain.simulateBattle 算出的回合事件演出成动画/日志，
// 并处理挂机循环。逻辑（伤害/胜负）在 domain，这里只负责"演"和落地奖励。
// ============================================================
import { state } from '../state.js';
import { BALANCE, MAP_NAMES } from '../config.js';
import { formatNumber } from '../util.js';
import { finalizeEnemyStats, simulateBattle, generateItemByMatrix } from '../domain.js';
import { renderBag, renderMapList, updatePlayerAttributes } from './render.js';
import { isDragging } from './drag.js';

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

    state.battleProgress++;
    const enemy = finalizeEnemyStats(mapId);

    logBattle(`⚔️ 遭遇战 -> [${enemy.name}] (生命:${formatNumber(enemy.maxHp)} 攻击:${formatNumber(enemy.atk)})`);

    const pSprite = document.getElementById('sprite-player');
    const eSprite = document.getElementById('sprite-enemy');

    // 纯逻辑算出整场战斗，再按节奏演出
    const { win, events } = simulateBattle(stats, enemy, player.skills);

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
                document.getElementById('sprite-e-hp').style.width = ev.eHpPct + "%";
            }, base);
        } else if (ev.side === 'enemy') {
            setTimeout(() => {
                eSprite.classList.add('strike-dash-left');
                setTimeout(() => eSprite.classList.remove('strike-dash-left'), 100);
                pSprite.classList.add('hurt-shake');
                setTimeout(() => pSprite.classList.remove('hurt-shake'), 150);
                spawnPopupEffect(true, `-${formatNumber(ev.dmg)}`, false);
                document.getElementById('sprite-p-hp').style.width = ev.pHpPct + "%";
            }, base + B.playerActionDelayMs);
        } else { // dodge
            setTimeout(() => { spawnPopupEffect(true, "闪避", false); }, base + B.playerActionDelayMs);
        }
    });

    if (win) {
        const baseCoin = BALANCE.reward.coinBase + mapId * BALANCE.reward.coinPerMap;
        const baseExp = BALANCE.reward.expBase + mapId * BALANCE.reward.expPerMap;
        const coinG = Math.floor(baseCoin * (stats.coinRate / 100));
        const expG = Math.floor(baseExp);
        player.coin += coinG;
        player.exp += expG;

        let bonus = "";
        const finalDrop = BALANCE.reward.baseDrop * (stats.dropRate / 100);
        if (Math.random() < finalDrop && player.bag.length < player.bagMax) {
            const newItem = generateItemByMatrix(mapId);
            player.bag.push(newItem);
            bonus = ` 夺得战利品: [${newItem.name}]`;
            // 拖拽进行中不重渲背包：否则会销毁正被拖动的源节点、触发 pointercancel 中止拖拽。
            // 掉落物 push 在数组末尾不影响正在拖的索引；拖拽结束(落子或取消)会补刷背包。
            if (!isDragging()) renderBag();
        }
        logBattle(`✨ 胜利！碎银+${formatNumber(coinG)}，修为+${formatNumber(expG)}。${bonus}`);
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
}
