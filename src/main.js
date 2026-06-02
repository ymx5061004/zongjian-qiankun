// ============================================================
// 入口：启动流程 + 角色创建/开场 + 全局事件委托。
// HTML 里所有交互都标了 data-act="xxx"，这里一处统一分发，
// 取代了原来满天飞的 inline onclick 和全局 event。
// ============================================================
import { state } from './state.js';
import { epicStory, BALANCE } from './config.js';
import { loadGame, saveGame } from './storage.js';
import {
    initTooltipEvent, hideTooltip, switchPage,
    updatePlayerAttributes, renderForge, renderBag,
    renderMapList, renderPlayerSkills, rollShopGoods,
    renderProduction, renderWarehouse, selectCraftTier, selectCraftAffix,
    toggleMenu, closeMenu
} from './ui/render.js';
import { startHangup, stopHangup } from './ui/battle.js';
import { startActivity, stopActivity, resumeActivityAfterLoad, showOfflineReport, pauseActivity } from './ui/idle.js';
import { initDragDrop } from './ui/drag.js';
import { toast } from './ui/dialog.js';
import { checkAchievementsAndNotify, claimAchievementReward, renderAchievementPanel, setAchievementFilter } from './ui/achievement.js';
import {
    playerBreakthrough, triggerReborn, unequip,
    removeFromForge, executeForge, smeltByQuality, smeltAllItems,
    useBagItem, upgradePlayerSkill, buyShopItem, buyShopSkill, learnAllSkills, forgetSkill, refreshShop,
    enhanceEquip, craftGear, challengeBoss, upgradeGear, sellMaterial,
    exportSaveFile, importSaveFile, buyBagSlot, takePill,
    claimGuideQuestReward, recordShopVisit, selectCultivationPath, buyShopMaterial
} from './actions.js';
import { renderRunPage, beginRoguelite, enterNode, setTactic, manualRebirth, advanceRegionAction, ascendEnding, renderCodex } from './ui/run.js';

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
    saveGame();                                       // 立刻把"离线已结算"的新基准(lastTickTime=now)落盘，下次刷新不再重复误判离线
    updatePlayerAttributes();
    renderForge();
    renderBag();
    renderMapList();
    renderPlayerSkills();
    renderProduction();
    renderWarehouse();
    renderRunPage();   // 百世轮回主页（默认首页）
    rollShopGoods();
    checkAchievementsAndNotify('all');
    renderAchievementPanel();
    setInterval(saveGame, 5000);
    // 仅当离线确实够久(≥门槛)才弹「欢迎回来」；刷新/切后台的零碎时间产出照常结算但不打扰
    if (offlineReport && offlineReport.elapsedMs >= BALANCE.idle.offlineReportMinMs) showOfflineReport(offlineReport);
}

// ---------- 统一事件委托：data-act -> 处理器 ----------
function onDelegatedClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.dataset.act) {
        case 'finalize-character': finalizeCharacter(); break;
        case 'enter-game': enterGame(); break;
        case 'switch-page': switchPage(el.dataset.page, el); if (el.dataset.page === 'shop') recordShopVisit(); if (el.dataset.page === 'run') renderRunPage(); if (el.dataset.page === 'codex') renderCodex(); break;
        // —— 百世轮回 ——
        case 'roguelite-begin': beginRoguelite(); break;
        case 'roguelite-node': enterNode(el.dataset.node); break;
        case 'set-tactic': setTactic(el.dataset.tactic); break;
        case 'roguelite-rebirth': manualRebirth(); break;
        case 'roguelite-advance': advanceRegionAction(); break;
        case 'roguelite-ascend': ascendEnding(); break;
        case 'toggle-menu': toggleMenu(); break;
        case 'close-menu': closeMenu(); break;
        case 'toggle-group': el.closest('.menu-group')?.classList.toggle('collapsed'); break;
        case 'breakthrough': playerBreakthrough(); break;
        case 'reborn': triggerReborn(); break;
        case 'unequip': unequip(el.dataset.slot); break;
        case 'enhance-equip': enhanceEquip(el.dataset.slot); break;
        case 'craft-gear': craftGear(Number(el.dataset.tier), el.dataset.slot, el.dataset.affix); break;
        case 'select-craft-tier': selectCraftTier(Number(el.dataset.tier)); break;
        case 'select-craft-affix': selectCraftAffix(el.dataset.affix); break;
        case 'challenge-boss': challengeBoss(el.dataset.boss); break;
        case 'upgrade-gear': upgradeGear(el.dataset.slot); break;
        case 'sell-material': sellMaterial(el.dataset.key); break;
        case 'take-pill': takePill(el.dataset.key); break;
        case 'stop-hangup': stopHangup(); break;
        case 'hangup': stopActivity(); startHangup(Number(el.dataset.map)); break;   // 开战前先停生产（二者互斥）
        case 'start-activity': stopHangup(); startActivity(el.dataset.id); break;     // 开工前先停战斗
        case 'stop-activity': stopActivity(); break;
        case 'remove-forge': removeFromForge(Number(el.dataset.idx)); break;
        case 'forge': executeForge(); break;
        case 'smelt': smeltByQuality(el.dataset.q.split(',').map(Number), el.dataset.label); break;
        case 'smelt-all': smeltAllItems(); break;
        case 'refresh-shop': refreshShop(); break;
        case 'buy-bag-slot': buyBagSlot(); break;
        case 'upgrade-skill': upgradePlayerSkill(Number(el.dataset.idx)); break;
        case 'forget-skill': forgetSkill(Number(el.dataset.idx)); break;
        case 'learn-all': learnAllSkills(); break;
        case 'buy-item': buyShopItem(Number(el.dataset.idx)); break;
        case 'buy-skill': buyShopSkill(Number(el.dataset.idx)); break;
        case 'buy-material': buyShopMaterial(Number(el.dataset.idx)); break;
        case 'claim-achievement': if (claimAchievementReward(el.dataset.id)) { updatePlayerAttributes(); checkAchievementsAndNotify('coin'); saveGame(); } break;
        case 'filter-achievement': setAchievementFilter(el.dataset.cat); break;
        case 'claim-quest': claimGuideQuestReward(el.dataset.id); break;
        case 'select-path': selectCultivationPath(el.dataset.path); break;
        case 'use-bag': hideTooltip(); useBagItem(Number(el.dataset.idx)); break;
        case 'guide-jump': { const t = document.getElementById(el.dataset.target); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
        case 'export-save': exportSaveFile(); break;
        case 'import-save': document.getElementById('import-file-input')?.click(); break; // 触发隐藏的文件选择框
    }
}

// ---------- 启动 ----------
function init() {
    loadGame();
    initTooltipEvent();
    initDragDrop();
    // 存档导入：file input 的 change 不走 click 委托，单独绑。选完即清空 value，便于重选同一文件再次触发。
    const importInput = document.getElementById('import-file-input');
    if (importInput) importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (file) importSaveFile(file);
    });
    if (!state.player.name || state.player.name.trim() === "") {
        document.getElementById('create-role-overlay').style.display = 'flex';
    } else {
        document.getElementById('create-role-overlay').style.display = 'none';
        document.getElementById('story-overlay').style.display = 'none';
        initGameCore();
    }
}

document.addEventListener('click', onDelegatedClick);

// 关闭/刷新/切后台时立刻存档：让 lastTickTime 精确停在离开那一刻。
// 否则在线时"还没轮到 5 秒定时存档的那几秒~几十秒"(尤其后台标签页定时器被浏览器节流到约 1 次/分)
// 会在重开时被 now-lastTickTime 误算成离线 —— 表现为"每次刷新/上线都跳离线 N 分"。
// pagehide 覆盖关闭/刷新/移动端切走，visibilitychange(hidden) 覆盖切后台标签。
window.addEventListener('pagehide', saveGame);
// 切后台/切回前台：手机切 App 通常不重载页面，故在这里也做离线结算——
// 切走时存时间戳并暂停生产挂机(避免后台节流空转+重复计数)；切回时按离开时长补算离线、续挂、弹「欢迎回来」。
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveGame(); pauseActivity(); return; }
    const rep = resumeActivityAfterLoad();
    if (rep) { updatePlayerAttributes(); renderProduction(); renderWarehouse(); renderBag(); }
    if (rep && rep.elapsedMs >= BALANCE.idle.offlineReportMinMs) showOfflineReport(rep);
});

// 客户端化：屏蔽右键菜单（桌面）与拖拽，配合 CSS 的 user-select:none / -webkit-touch-callout:none
// 共同实现"脱离浏览器"的手感。输入框豁免右键，保留起名时的粘贴能力。
document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
document.addEventListener('dragstart', e => e.preventDefault());

window.addEventListener('load', init);
