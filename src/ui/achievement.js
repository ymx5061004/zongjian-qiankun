import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../config.js';
import { state } from '../state.js';
import { checkAchievements, claimAchievementReward as claimAchievementRewardDomain, getAchievementById, getAchievementProgress } from '../domain.js';
import { formatNumber } from '../util.js';
import { toast } from './dialog.js';

function fmtReward(reward = {}) {
    const parts = [];
    if (reward.coin) parts.push(`碎银+${formatNumber(reward.coin)}`);
    if (reward.exp) parts.push(`修为+${formatNumber(reward.exp)}`);
    if (reward.honghuangPower) parts.push(`洪荒+${reward.honghuangPower}%`);
    return parts.length ? parts.join(' · ') : '无';
}

function fmtProgressText(achievement, progress) {
    const { current, target } = progress;
    if (achievement.metric === 'totalCoinEarned') return `${formatNumber(current)} / ${formatNumber(target)} 文`;
    return `${current} / ${target}`;
}

export function showAchievementUnlock(id) {
    const ac = getAchievementById(id);
    if (!ac) return;
    const node = document.createElement('div');
    node.className = 'achievement-unlock-toast';
    node.innerHTML = `🏆 解锁成就：<b>${ac.name}</b><div class="achievement-unlock-desc">${ac.desc}</div>`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2600);
}

export function checkAchievementsAndNotify(triggerType = 'all') {
    const newlyUnlocked = checkAchievements(state.player, triggerType);
    newlyUnlocked.forEach(showAchievementUnlock);
    if (newlyUnlocked.length && document.getElementById('page-achievement')?.classList.contains('active')) renderAchievementPanel();
    return newlyUnlocked;
}

export function claimAchievementReward(id) {
    const r = claimAchievementRewardDomain(state.player, id);
    if (!r.ok) {
        if (r.reason === 'claimed') toast("该成就奖励已领取。", 'error');
        else if (r.reason === 'locked') toast("该成就尚未解锁。", 'error');
        else toast("领取失败。", 'error');
        return false;
    }
    toast(`🎁 领取成功：${fmtReward(r.reward)}`, 'success');
    renderAchievementPanel();
    return true;
}

export function renderAchievementPanel() {
    const box = document.getElementById('achievement-list-box');
    const summary = document.getElementById('achievement-summary');
    if (!box || !summary) return;

    const total = ACHIEVEMENTS.length;
    const unlockedCount = state.player.achievements?.unlocked?.length || 0;
    const claimedCount = state.player.achievements?.claimed?.length || 0;
    const pct = total > 0 ? Math.floor((unlockedCount / total) * 100) : 0;
    summary.innerHTML = `
        <div class="achievement-summary-bar"><i style="width:${pct}%"></i></div>
        <div class="achievement-summary-text">已解锁 ${unlockedCount}/${total}（${pct}%） · 已领取 ${claimedCount}/${total}</div>
    `;

    box.innerHTML = '';
    Object.entries(ACHIEVEMENT_CATEGORIES).forEach(([cateKey, cateName]) => {
        const list = ACHIEVEMENTS.filter(a => a.category === cateKey);
        if (!list.length) return;

        const section = document.createElement('div');
        section.className = 'achievement-category';
        section.innerHTML = `<div class="achievement-category-title">${cateName}</div>`;

        list.forEach(ac => {
            const unlocked = state.player.achievements.unlocked.includes(ac.id);
            const claimed = state.player.achievements.claimed.includes(ac.id);
            const progress = getAchievementProgress(state.player, ac);
            const card = document.createElement('div');
            card.className = `achievement-card ${unlocked ? 'unlocked' : 'locked'} ${claimed ? 'claimed' : ''}`;
            card.innerHTML = `
                <div class="achievement-main">
                    <div class="achievement-name">${unlocked ? '🏆' : '🔒'} ${ac.name}</div>
                    <div class="achievement-desc">${ac.desc}</div>
                    <div class="achievement-progress">
                        <div class="achievement-progress-bar"><i style="width:${progress.pct}%"></i></div>
                        <span>${fmtProgressText(ac, progress)}</span>
                    </div>
                    <div class="achievement-reward">奖励：${fmtReward(ac.reward)}</div>
                </div>
                <div class="achievement-op">
                    <button class="btn ${unlocked && !claimed ? 'btn-success' : ''}" data-act="claim-achievement" data-id="${ac.id}" ${unlocked && !claimed ? '' : 'disabled'}>
                        ${claimed ? '已领取' : (unlocked ? '领取' : '未解锁')}
                    </button>
                </div>
            `;
            section.appendChild(card);
        });

        box.appendChild(section);
    });
}
