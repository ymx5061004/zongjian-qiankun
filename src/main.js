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
    renderMapList, renderPlayerSkills, rollShopGoods,
    renderProduction, renderWarehouse,
    toggleMenu, closeMenu
} from './ui/render.js';
import { startHangup, stopHangup } from './ui/battle.js';
import { startActivity, stopActivity, resumeActivityAfterLoad, formatOfflineReport } from './ui/idle.js';
import { initDragDrop } from './ui/drag.js';
import { toast } from './ui/dialog.js';
import {
    playerBreakthrough, triggerReborn, unequip,
    removeFromForge, executeForge, smeltByQuality, smeltAllItems,
    useBagItem, upgradePlayerSkill, buyShopItem, buyShopSkill, learnAllSkills, forgetSkill, refreshShop,
    enhanceEquip
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
    const offlineReport = resumeActivityAfterLoad(); // 先结算离线产出(改 player)+续挂，再渲染
    updatePlayerAttributes();
    renderForge();
    renderBag();
    renderMapList();
    renderPlayerSkills();
    renderProduction();
    renderWarehouse();
    rollShopGoods();
    setInterval(saveGame, 5000);
    if (offlineReport) toast(formatOfflineReport(offlineReport), 'success');
}

// ---------- 统一事件委托：data-act -> 处理器 ----------
function onDelegatedClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.dataset.act) {
        case 'finalize-character': finalizeCharacter(); break;
        case 'enter-game': enterGame(); break;
        case 'switch-page': switchPage(el.dataset.page, el); break;
        case 'toggle-menu': toggleMenu(); break;
        case 'close-menu': closeMenu(); break;
        case 'toggle-group': el.closest('.menu-group')?.classList.toggle('collapsed'); break;
        case 'breakthrough': playerBreakthrough(); break;
        case 'reborn': triggerReborn(); break;
        case 'unequip': unequip(el.dataset.slot); break;
        case 'enhance-equip': enhanceEquip(el.dataset.slot); break;
        case 'stop-hangup': stopHangup(); break;
        case 'hangup': stopActivity(); startHangup(Number(el.dataset.map)); break;   // 开战前先停生产（二者互斥）
        case 'start-activity': stopHangup(); startActivity(el.dataset.id); break;     // 开工前先停战斗
        case 'stop-activity': stopActivity(); break;
        case 'remove-forge': removeFromForge(Number(el.dataset.idx)); break;
        case 'forge': executeForge(); break;
        case 'smelt': smeltByQuality(el.dataset.q.split(',').map(Number), el.dataset.label); break;
        case 'smelt-all': smeltAllItems(); break;
        case 'refresh-shop': refreshShop(); break;
        case 'upgrade-skill': upgradePlayerSkill(Number(el.dataset.idx)); break;
        case 'forget-skill': forgetSkill(Number(el.dataset.idx)); break;
        case 'learn-all': learnAllSkills(); break;
        case 'buy-item': buyShopItem(Number(el.dataset.idx)); break;
        case 'buy-skill': buyShopSkill(Number(el.dataset.idx)); break;
        case 'use-bag': hideTooltip(); useBagItem(Number(el.dataset.idx)); break;
        case 'guide-jump': { const t = document.getElementById(el.dataset.target); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    }
}

// ---------- 启动 ----------
function init() {
    loadGame();
    initTooltipEvent();
    initDragDrop();
    if (!state.player.name || state.player.name.trim() === "") {
        document.getElementById('create-role-overlay').style.display = 'flex';
    } else {
        document.getElementById('create-role-overlay').style.display = 'none';
        document.getElementById('story-overlay').style.display = 'none';
        initGameCore();
    }
}

document.addEventListener('click', onDelegatedClick);

// 客户端化：屏蔽右键菜单（桌面）与拖拽，配合 CSS 的 user-select:none / -webkit-touch-callout:none
// 共同实现"脱离浏览器"的手感。输入框豁免右键，保留起名时的粘贴能力。
document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
document.addEventListener('dragstart', e => e.preventDefault());

window.addEventListener('load', init);
