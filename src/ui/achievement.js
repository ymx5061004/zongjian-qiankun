import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../config.js';
import { state } from '../state.js';
import { checkAchievements, claimAchievementReward as claimAchievementRewardDomain, getAchievementById, getAchievementProgress, achievementBonuses } from '../domain.js';
import { formatNumber } from '../util.js';
import { toast } from './dialog.js';

// 永久奖励(perm)中文标签 + 汇总文案，成就卡奖励预览与「永久加成汇总」共用。
const PERM_LABEL = { allPct: '全属性', atkPct: '攻击', hpPct: '气血', defPct: '防御', critPct: '暴击', dodgePct: '闪避', dropRatePct: '掉宝', coinRatePct: '财运' };
function fmtReward(reward = {}) {
    const parts = [];
    if (reward.coin) parts.push(`碎银+${formatNumber(reward.coin)}`);
    if (reward.exp) parts.push(`修为+${formatNumber(reward.exp)}`);
    if (reward.honghuangPower) parts.push(`洪荒+${reward.honghuangPower}%`);
    if (reward.perm) for (const [k, v] of Object.entries(reward.perm)) parts.push(`永久${PERM_LABEL[k] || k}+${v}%`);
    return parts.length ? parts.join(' · ') : '无';
}
function fmtPermSummary(player) {
    const ab = achievementBonuses(player);
    const order = { all: '全属性', atk: '攻击', hp: '气血', def: '防御', crit: '暴击', dodge: '闪避', dropRate: '掉宝', coinRate: '财运' };
    const parts = Object.keys(order).filter(k => ab[k]).map(k => `${order[k]}+${ab[k]}%`);
    return parts.length ? parts.join('　') : '尚无（领取带永久加成的成就后累计）';
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

// 分类筛选状态（模块级，不入存档）。'all' = 全部。
let activeFilter = 'all';
export function setAchievementFilter(cat) { activeFilter = cat || 'all'; renderAchievementPanel(); }

export function renderAchievementPanel() {
    const box = document.getElementById('achievement-list-box');
    const summary = document.getElementById('achievement-summary');
    if (!box || !summary) return;
    const player = state.player;

    const total = ACHIEVEMENTS.length;
    const unlockedCount = player.achievements?.unlocked?.length || 0;
    const claimedCount = player.achievements?.claimed?.length || 0;
    const pct = total > 0 ? Math.floor((unlockedCount / total) * 100) : 0;

    // 仅含有成就的类别才出筛选按钮；筛选项失效(无此类)时回落「全部」
    const cats = Object.keys(ACHIEVEMENT_CATEGORIES).filter(c => ACHIEVEMENTS.some(a => a.category === c));
    if (activeFilter !== 'all' && !cats.includes(activeFilter)) activeFilter = 'all';
    const filterBtns = [['all', '全部']].concat(cats.map(c => [c, ACHIEVEMENT_CATEGORIES[c]])).map(([c, label]) => {
        const n = c === 'all' ? total : ACHIEVEMENTS.filter(a => a.category === c).length;
        return `<button class="btn ${activeFilter === c ? 'btn-success' : ''}" style="padding:3px 10px;font-size:12px;margin:2px;" data-act="filter-achievement" data-cat="${c}">${label} ${n}</button>`;
    }).join('');

    summary.innerHTML = `
        <div class="achievement-summary-bar"><i style="width:${pct}%"></i></div>
        <div class="achievement-summary-text">已解锁 ${unlockedCount}/${total}（${pct}%） · 已领取 ${claimedCount}/${total}</div>
        <div class="achievement-summary-text" style="color:var(--color-gold);">🌟 永久成就加成：${fmtPermSummary(player)}</div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;">${filterBtns}</div>
    `;

    box.innerHTML = '';
    const catsToRender = activeFilter === 'all' ? cats : [activeFilter];
    catsToRender.forEach(cateKey => {
        const list = ACHIEVEMENTS.filter(a => a.category === cateKey);
        if (!list.length) return;
        const section = document.createElement('div');
        section.className = 'achievement-category';
        section.innerHTML = `<div class="achievement-category-title">${ACHIEVEMENT_CATEGORIES[cateKey]}</div>`;

        list.forEach(ac => {
            const unlocked = player.achievements.unlocked.includes(ac.id);
            const claimed = player.achievements.claimed.includes(ac.id);
            const progress = getAchievementProgress(player, ac);
            const hiddenLocked = ac.hidden && !unlocked;   // 隐藏且未解锁 → 显示「？？？」
            const card = document.createElement('div');
            card.className = `achievement-card ${claimed ? 'claimed' : (unlocked ? 'unlocked' : 'locked')}`;
            const nameDisp = hiddenLocked ? '？？？' : `${unlocked ? '🏆' : '🔒'} ${ac.name}`;
            const descDisp = hiddenLocked ? (ac.hint || '隐藏成就，达成后揭晓。') : ac.desc;
            const progressHtml = hiddenLocked ? '' :
                `<div class="achievement-progress"><div class="achievement-progress-bar"><i style="width:${progress.pct}%"></i></div><span>${fmtProgressText(ac, progress)}</span></div>`;
            const hintHtml = (!unlocked && !ac.hidden && ac.hint) ? `<div class="achievement-desc" style="color:#777;">💡 ${ac.hint}</div>` : '';
            const flavorHtml = (unlocked && ac.flavorText) ? `<div class="achievement-desc" style="color:#8a7a4a;font-style:italic;">「${ac.flavorText}」</div>` : '';
            card.innerHTML = `
                <div class="achievement-main">
                    <div class="achievement-name">${nameDisp}</div>
                    <div class="achievement-desc">${descDisp}</div>
                    ${progressHtml}
                    <div class="achievement-reward">奖励：${hiddenLocked ? '？？？' : fmtReward(ac.reward)}</div>
                    ${hintHtml}${flavorHtml}
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
