// ============================================================
// 入口：启动流程 + 角色创建/开场 + 全局事件委托。
// HTML 里所有交互都标了 data-act="xxx"，这里一处统一分发，
// 取代了原来满天飞的 inline onclick 和全局 event。
// ============================================================
import { state } from './state.js';
import { epicStory } from './config.js';
import { loadGame, saveGame } from './storage.js';
import {
    initTooltipEvent, hideTooltip, switchPage,
    updatePlayerAttributes, renderForge, renderBag,
    renderMapList, renderPlayerSkills, renderShopGoods
} from './ui/render.js';
import { startHangup, stopHangup } from './ui/battle.js';
import { toast } from './ui/dialog.js';
import {
    playerBreakthrough, triggerReborn, unequip,
    removeFromForge, executeForge, smeltByQuality, smeltAllItems,
    useBagItem, upgradePlayerSkill, buyShopItem, buyShopSkill
} from './actions.js';

// ---------- 角色创建 / 开场动画 / 进入游戏 ----------
function finalizeCharacter() {
    const player = state.player;
    const nameInput = document.getElementById('input-player-name').value.trim();
    if (!nameInput) { toast("名号不可为空！", 'error'); return; }
    player.name = nameInput;
    document.getElementById('create-role-overlay').style.display = 'none';

    if (player.skills.length === 0) {
        player.skills.push({ id: "s_init", name: "太祖长拳", type: "active", level: 1, baseRate: 0.35, power: 1.3, desc: "入门拳法，造成[伤害]倍输出。" });
    }
    if (player.honghuangPower === undefined) player.honghuangPower = 0;
    showStory();
}

function showStory() {
    document.getElementById('story-overlay').style.display = 'flex';
    const textContainer = document.getElementById('story-text');
    const btn = document.getElementById('btn-enter-game');
    textContainer.innerHTML = "";

    let lineIndex = 0, charIndex = 0, currentHTML = "";
    function typeWriter() {
        if (lineIndex < epicStory.length) {
            if (charIndex < epicStory[lineIndex].length) {
                currentHTML += epicStory[lineIndex].charAt(charIndex);
                textContainer.innerHTML = currentHTML + (lineIndex < epicStory.length - 1 ? "<span style='opacity:0.5'>_</span>" : "");
                charIndex++;
                setTimeout(typeWriter, 50);
            } else {
                currentHTML += "<br><br>";
                lineIndex++;
                charIndex = 0;
                setTimeout(typeWriter, 500);
            }
        } else {
            textContainer.innerHTML = currentHTML;
            btn.style.display = 'block';
        }
    }
    typeWriter();
}

function enterGame() {
    document.getElementById('story-overlay').style.display = 'none';
    saveGame();
    initGameCore();
}

function initGameCore() {
    updatePlayerAttributes();
    renderForge();
    renderBag();
    renderMapList();
    renderPlayerSkills();
    renderShopGoods();
    setInterval(saveGame, 5000);
}

// ---------- 统一事件委托：data-act -> 处理器 ----------
function onDelegatedClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.dataset.act) {
        case 'finalize-character': finalizeCharacter(); break;
        case 'enter-game': enterGame(); break;
        case 'switch-page': switchPage(el.dataset.page, el); break;
        case 'breakthrough': playerBreakthrough(); break;
        case 'reborn': triggerReborn(); break;
        case 'unequip': unequip(el.dataset.slot); break;
        case 'stop-hangup': stopHangup(); break;
        case 'hangup': startHangup(Number(el.dataset.map)); break;
        case 'remove-forge': removeFromForge(Number(el.dataset.idx)); break;
        case 'forge': executeForge(); break;
        case 'smelt': smeltByQuality(el.dataset.q.split(',').map(Number), el.dataset.label); break;
        case 'smelt-all': smeltAllItems(); break;
        case 'refresh-shop': renderShopGoods(); break;
        case 'upgrade-skill': upgradePlayerSkill(Number(el.dataset.idx)); break;
        case 'buy-item': buyShopItem(Number(el.dataset.idx)); break;
        case 'buy-skill': buyShopSkill(Number(el.dataset.idx)); break;
        case 'use-bag': hideTooltip(); useBagItem(Number(el.dataset.idx)); break;
    }
}

// ---------- 启动 ----------
function init() {
    loadGame();
    initTooltipEvent();
    if (!state.player.name || state.player.name.trim() === "") {
        document.getElementById('create-role-overlay').style.display = 'flex';
    } else {
        document.getElementById('create-role-overlay').style.display = 'none';
        document.getElementById('story-overlay').style.display = 'none';
        initGameCore();
    }
}

document.addEventListener('click', onDelegatedClick);
window.addEventListener('load', init);
