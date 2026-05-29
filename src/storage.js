// ============================================================
// 存档层：localStorage 读写 + 版本号 + 迁移 + 容错。
// 结构变更时只需在 migrate() 里按版本逐步升级，旧档不再损坏。
// ============================================================
import { state, makeDefaultPlayer } from './state.js';
import { SKILL_SUFFIXES } from './config.js';

const SAVE_KEY = "wuxia_v6_full_save"; // 沿用原 key，兼容老存档
const SAVE_VERSION = 2;

export function saveGame() {
    if (!state.player.name) return;
    state.player.lastTickTime = Date.now();
    state.player.saveVersion = SAVE_VERSION;
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state.player));
    } catch (e) {
        // 隐私模式 / 配额超限时静默，不打断游戏
        console.warn('存档写入失败：', e);
    }
}

export function loadGame() {
    let saved = null;
    try {
        saved = localStorage.getItem(SAVE_KEY);
    } catch (e) {
        return; // localStorage 不可用
    }
    if (!saved) return;
    try {
        const parsed = JSON.parse(saved);
        const data = migrate(parsed);
        data.currentMapId = null; // 读档不自动恢复挂机
        // 以默认值为底，旧档缺的新字段自动补全 —— 加字段不再炸档
        state.player = Object.assign(makeDefaultPlayer(), data);
        if (state.player.honghuangPower === undefined) state.player.honghuangPower = 0;
    } catch (e) {
        console.warn('存档损坏，已忽略：', e);
    }
}

// 旧版黑市买来的主动技漏了 power 字段，战斗触发时伤害会算成 NaN（敌人不掉血）。
// 按技能名后缀从 SKILL_SUFFIXES 回填正确倍率（掌1.5 / 剑诀1.9 / 噬血术1.8…），顺带补回 healRate。
const ACTIVE_SUFFIXES = SKILL_SUFFIXES.filter(s => s.type === 'active');
function fixOneSkill(sk) {
    if (!sk || sk.type !== 'active' || Number.isFinite(sk.power)) return; // 非主动技 / 已正常则不动
    const matched = ACTIVE_SUFFIXES.find(s => typeof sk.name === 'string' && sk.name.endsWith(s.name));
    sk.power = matched ? matched.power : 1.5; // 兜底 1.5，避免再次 NaN
    if (matched && matched.healRate && !Number.isFinite(sk.healRate)) sk.healRate = matched.healRate;
}
function repairActiveSkillPower(data) {
    if (!data) return;
    // 已学进技能栏的
    if (Array.isArray(data.skills)) data.skills.forEach(fixOneSkill);
    // 以及背包里「买了但还没参悟」的秘籍（payload 才是技能本体），否则参悟后仍是破损的
    if (Array.isArray(data.bag)) data.bag.forEach(it => { if (it && it.type === 'book' && it.payload) fixOneSkill(it.payload); });
}

// 按 saveVersion 把旧结构升级到当前结构。
function migrate(data) {
    if (!data || typeof data !== 'object') return makeDefaultPlayer();
    if ((data.saveVersion || 0) < 2) repairActiveSkillPower(data);
    return data;
}
