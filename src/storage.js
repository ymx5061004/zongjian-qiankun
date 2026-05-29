// ============================================================
// 存档层：localStorage 读写 + 版本号 + 迁移 + 容错。
// 结构变更时只需在 migrate() 里按版本逐步升级，旧档不再损坏。
// ============================================================
import { state, makeDefaultPlayer } from './state.js';

const SAVE_KEY = "wuxia_v6_full_save"; // 沿用原 key，兼容老存档
const SAVE_VERSION = 1;

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

// 按 saveVersion 把旧结构升级到当前结构。目前仅占位。
function migrate(data) {
    if (!data || typeof data !== 'object') return makeDefaultPlayer();
    // 例：if ((data.saveVersion || 0) < 1) { ...字段重命名/补默认... }
    return data;
}
