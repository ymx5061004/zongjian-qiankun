// ============================================================
// 存档层：localStorage 读写 + 版本号 + 迁移 + 容错。
// 结构变更时只需在 migrate() 里按版本逐步升级，旧档不再损坏。
// 另含「加密导入导出」（文件末尾）：AES-GCM(固定密钥) 把存档导出为离线备份，
// 仅作防篡改/防随手改档的混淆 —— 密钥就在前端源码里，非机密级保护。
// ============================================================
import { state, makeDefaultPlayer } from './state.js';
import { SKILL_SUFFIXES, GEAR_SLOTS, PROFESSIONS } from './config.js';
import { syncQuestProgress } from './domain.js';

const SAVE_KEY = "wuxia_v6_full_save"; // 沿用原 key，兼容老存档
const SAVE_VERSION = 6;                 // v4: quests(新手指引)；v5: cultivationPath(修行流派)；v6: 地图词缀计数。补全在 normalizePlayer，旧档不炸

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

// 把任意「解析出来的存档对象」规整成可用的完整 player：迁移 + 默认值兜底 + 字段补全。
// loadGame（读 localStorage）与 importSaveString（读外部文件）共用，保证导入的旧档同样不炸。
export function normalizePlayer(parsed) {
    const data = migrate(parsed);
    const hadQuests = !!(data && data.quests && typeof data.quests === 'object'); // 旧档(无 quests)需按既有进度回种计数器
    data.currentMapId = null; // 不自动恢复挂机
    // 以默认值为底，旧档缺的新字段自动补全 —— 加字段不再炸档
    const player = Object.assign(makeDefaultPlayer(), data);
    if (player.honghuangPower === undefined) player.honghuangPower = 0;
    // 生产体系字段防御性补全（v3 新增；data 整体覆盖了默认对象，故逐项兜底，将来加新技能也在此补键）
    const p = player;
    if (!p.professions || typeof p.professions !== 'object') p.professions = {};
    // 校验到 exp 必须是有限数：旧档/损坏档里 professions[k] 缺 exp 会让后续 exp+= 变 NaN（遍历 PROFESSIONS：将来加技能也自动补）
    Object.keys(PROFESSIONS).forEach(k => { if (!p.professions[k] || !Number.isFinite(p.professions[k].exp)) p.professions[k] = { exp: 0 }; });
    if (!p.materials || typeof p.materials !== 'object') p.materials = {};
    // 丹药永久增益：旧档无则补零（跨轮回保留，不被 reborn 重置）
    if (!p.pillBonus || typeof p.pillBonus !== 'object') p.pillBonus = { hp: 0, atk: 0, def: 0, crit: 0, dodge: 0 };
    ['hp', 'atk', 'def', 'crit', 'dodge'].forEach(k => { if (!Number.isFinite(p.pillBonus[k])) p.pillBonus[k] = 0; });
    // 装备槽防御性补全：旧档 equips 缺新部位键(amulet/gloves/boots…)时补 null，避免读取/渲染时的边界
    if (!p.equips || typeof p.equips !== 'object') p.equips = {};
    GEAR_SLOTS.forEach(s => { if (!(s.key in p.equips)) p.equips[s.key] = null; });
    if (p.activity === undefined) p.activity = null;
    // lastTickTime 缺失/非法时设为当前时刻：否则离线结算会因 last=0 被整段跳过（旧档升级尤甚）
    if (!Number.isFinite(p.lastTickTime) || p.lastTickTime <= 0) p.lastTickTime = Date.now();
    if (!p.achievements || typeof p.achievements !== 'object') p.achievements = {};
    if (!Array.isArray(p.achievements.unlocked)) p.achievements.unlocked = [];
    if (!Array.isArray(p.achievements.claimed)) p.achievements.claimed = [];
    if (!Number.isFinite(p.totalKills) || p.totalKills < 0) p.totalKills = 0;
    if (!Number.isFinite(p.totalCoinEarned) || p.totalCoinEarned < 0) p.totalCoinEarned = 0;
    if (!Number.isFinite(p.totalForgeCount) || p.totalForgeCount < 0) p.totalForgeCount = 0;
    if (!Number.isFinite(p.maxMapCleared) || p.maxMapCleared < 0) p.maxMapCleared = 0;
    // —— 新手指引任务链字段补全（v4 新增）：旧档无 quests 时整体由默认对象兜底，这里逐项防御 ——
    if (!p.quests || typeof p.quests !== 'object') p.quests = {};
    if (!Array.isArray(p.quests.completed)) p.quests.completed = [];
    if (!Array.isArray(p.quests.claimed)) p.quests.claimed = [];
    if (p.quests.activeId === undefined) p.quests.activeId = null;
    if (!p.quests.stats || typeof p.quests.stats !== 'object') p.quests.stats = {};
    const qs = p.quests.stats;
    if (!Number.isFinite(qs.battleCount) || qs.battleCount < 0) qs.battleCount = 0;
    if (!Number.isFinite(qs.breakthroughCount) || qs.breakthroughCount < 0) qs.breakthroughCount = 0;
    if (!Number.isFinite(qs.shopVisitCount) || qs.shopVisitCount < 0) qs.shopVisitCount = 0;
    if (!Number.isFinite(qs.affixStageWins) || qs.affixStageWins < 0) qs.affixStageWins = 0; // v6: 词缀关卡获胜计数（识地势指引）
    // 旧档首次引入 quests：用既有进度回种「无法从其他状态派生」的计数器，
    // 让早已满足条件的任务直接显示「可领取」而非从零开始（不让旧玩家卡死）。
    if (!hadQuests) {
        if (p.totalKills > 0) qs.battleCount = p.totalKills;
        if (p.realmLevel > 1) qs.breakthroughCount = p.realmLevel - 1;
    }
    // 静默基线同步：填好 completed[] 与 activeId（不弹提示），避免旧档首个动作触发「一次性补发」的提示风暴。
    syncQuestProgress(player);
    // —— 修行流派字段补全（v5 新增）：旧档无 path 字段 → 默认未择道(null)，保持原始数值、不强制选择 ——
    if (p.cultivationPath === undefined) p.cultivationPath = null;
    if (!Number.isFinite(p.pathSelectedAt) || p.pathSelectedAt < 0) p.pathSelectedAt = 0;
    if (!Number.isFinite(p.pathSwitchCount) || p.pathSwitchCount < 0) p.pathSwitchCount = 0;
    // —— 地图词缀成就计数补全（v6 新增）——
    if (!Number.isFinite(p.thunderWins) || p.thunderWins < 0) p.thunderWins = 0;
    if (!Number.isFinite(p.swordTombWeapons) || p.swordTombWeapons < 0) p.swordTombWeapons = 0;
    return player;
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
        state.player = normalizePlayer(JSON.parse(saved));
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

// ============================================================
// 加密导入导出 —— AES-GCM(固定密钥)
// 用途：把存档导出成一个离线备份文件，换设备/换浏览器时导入恢复。
// 性质：固定密钥写死在前端源码里，可被逆向，所以这是「防随手改档/防作弊」的
//      混淆，不是机密级保护。AES-GCM 自带认证标签：文件被改一个字节就会解密
//      失败、拒绝导入，正好满足防篡改诉求。
// 限制：crypto.subtle 仅在安全上下文可用（HTTPS 或 localhost）；裸 http 局域网
//      IP 打开会拿不到 crypto.subtle —— 此时导入导出按钮会明确报错而非静默坏掉。
// ============================================================
const EXPORT_TAG = 'ZJQK1';                                         // 文件头：本游戏存档标识 + 格式版本
const KEY_MATERIAL = '纵剑乾坤·百世轮回::save::固定混淆密钥::v1';   // 密钥派生口令（固定）
const KEY_SALT = 'zjqk-export-fixed-salt-v1';                       // PBKDF2 盐（固定）

// Uint8Array <-> base64（btoa/atob 只认二进制字符串，故逐字节转换）
function bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}
function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function cryptoAvailable() {
    return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.encrypt === 'function';
}

// 派生 AES-GCM 密钥（固定口令+固定盐 → 每次结果相同；缓存避免重复派生）
let _keyPromise = null;
function getCryptoKey() {
    if (!_keyPromise) {
        const enc = new TextEncoder();
        _keyPromise = crypto.subtle
            .importKey('raw', enc.encode(KEY_MATERIAL), 'PBKDF2', false, ['deriveKey'])
            .then(base => crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: enc.encode(KEY_SALT), iterations: 100000, hash: 'SHA-256' },
                base,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            ))
            .catch(e => { _keyPromise = null; throw e; }); // 失败不缓存，下次可重试
    }
    return _keyPromise;
}

// 导出：把当前存档加密成一段文本（写进 .save 文件）。失败抛错，由调用方提示。
export async function exportSaveString() {
    if (!cryptoAvailable()) throw new Error('当前环境不支持加密（需经 HTTPS 或 localhost 打开）');
    saveGame(); // 先落盘，确保导出的就是最新进度
    const plain = new TextEncoder().encode(JSON.stringify(state.player));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM 推荐 96-bit IV，每次随机
    const key = await getCryptoKey();
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
    // 格式：TAG.base64(iv).base64(cipher)  （cipher 末尾已含 GCM 认证标签）
    return `${EXPORT_TAG}.${bytesToB64(iv)}.${bytesToB64(cipher)}`;
}

// 导入：解密 + 校验 + 迁移，返回规整后的 player（不直接写 state，交调用方确认后覆盖）。
// 任一步失败都抛带中文原因的 Error。
export async function importSaveString(text) {
    if (!cryptoAvailable()) throw new Error('当前环境不支持解密（需经 HTTPS 或 localhost 打开）');
    const parts = String(text || '').trim().split('.');
    if (parts.length !== 3 || parts[0] !== EXPORT_TAG) throw new Error('这不是《纵剑乾坤》的存档文件');
    let iv, cipher;
    try { iv = b64ToBytes(parts[1]); cipher = b64ToBytes(parts[2]); }
    catch (e) { throw new Error('存档文件格式已损坏'); }
    const key = await getCryptoKey();
    let plainBuf;
    try {
        plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    } catch (e) {
        // 解密/认证失败：文件被改过、或不是本游戏导出的
        throw new Error('存档文件已损坏或被篡改，无法读取');
    }
    let parsed;
    try { parsed = JSON.parse(new TextDecoder().decode(plainBuf)); }
    catch (e) { throw new Error('存档内容解析失败'); }
    if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string' || !parsed.name) {
        throw new Error('存档内容无效（缺少角色名）');
    }
    return normalizePlayer(parsed);
}
