// ============================================================
// 逻辑层：纯游戏规则，不碰 DOM、不读写 state（除随机数外无副作用）。
// 可单独测试。输入参数、输出结果，由控制层(actions)负责落地到 state/界面。
// ============================================================
import {
    ITEM_PREFIXES, MATRIX_ITEMS, SKILL_SECTS, SKILL_SUFFIXES, REALMS, MAP_NAMES, BALANCE, GEAR_TIERS
} from './config.js';

// —— 境界名 ——
export function getRealmName(lv) {
    const idx = Math.floor((lv - 1) / 10);
    const sub = ((lv - 1) % 10) + 1;
    if (idx >= REALMS.length) return `至高封神第${lv}重`;
    return `${REALMS[idx]}${sub}重`;
}

// —— 生产技能经验曲线（纯函数）——
// 到达 level 级所需的「累计」经验（level=1 时为 0）。曲线参数集中在 BALANCE.idle。
export function expForLevel(level) {
    const { expC, expP } = BALANCE.idle;
    return Math.floor(expC * Math.pow(Math.max(0, level - 1), expP));
}
// 给定累计经验，反推当前等级（封顶 BALANCE.idle.maxLevel）。
export function levelFromExp(exp) {
    const max = BALANCE.idle.maxLevel;
    let lv = 1;
    while (lv < max && exp >= expForLevel(lv + 1)) lv++;
    return lv;
}

// —— 生产效率（随技能等级提升）：练级本身=提效途径，不只是解锁高档 ——
// 提速：等级越高单次读条越短(封顶)；增产：等级越高越大概率「本次产出翻倍」。
export function idleSpeedFactor(level) {
    return 1 - Math.min(BALANCE.idle.speedCap, BALANCE.idle.speedPerLevel * (level - 1));
}
export function effDurationMs(durationMs, level) {
    return Math.max(500, Math.round(durationMs * idleSpeedFactor(level))); // 不低于 0.5s
}
export function bonusYieldChance(level) {
    return Math.min(BALANCE.idle.yieldCap, BALANCE.idle.yieldPerLevel * (level - 1));
}

// —— 神兵强化下一级花费（纯函数）。返回 {targetLevel, ingotKey, ingotQty, coin}；已满级返回 null。——
// 目标级越高 → 跨到越高级的锭(levelsPerTier 一档)，逼着玩家往深矿挖；碎银随目标级与品阶上扬。
export function enhanceCost(item) {
    const E = BALANCE.enhance;
    const target = (item.enhance || 0) + 1;
    if (target > E.maxLevel) return null;
    const tierIdx = Math.min(E.ingotTiers.length - 1, Math.floor((target - 1) / E.levelsPerTier));
    return {
        targetLevel: target,
        ingotKey: E.ingotTiers[tierIdx],
        ingotQty: target,
        coin: target * E.coinPerLevel * (1 + (item.quality || 0))
    };
}

// —— 由 player 派生当前战斗属性。纯函数：返回 {stats, honghuangPower} ——
export function computeStats(player) {
    const rebornMult = 1 + player.rebornCount * BALANCE.rebornMultPerCount;

    let calcHp = Math.floor(player.baseHp * rebornMult);
    let calcAtk = Math.floor(player.baseAtk * rebornMult);
    let calcDef = Math.floor(player.baseDef * rebornMult);
    let calcCrit = player.baseCrit;
    let calcDodge = player.baseDodge;

    player.skills.forEach(sk => {
        if (sk.type === 'passive') {
            if (sk.hp) calcHp += (sk.hp * sk.level);
            if (sk.atk) calcAtk += (sk.atk * sk.level);
            if (sk.def) calcDef += (sk.def * sk.level);
            if (sk.dodge) calcDodge += (sk.dodge * sk.level);
            if (sk.crit) calcCrit += (sk.crit * sk.level);
        }
    });

    for (const slot in player.equips) {
        const eq = player.equips[slot];
        if (eq) {
            // 强化(enhance)只放大攻/防/血等主属性，不碰暴击/闪避(%)，避免闪避被堆爆
            const em = 1 + (eq.enhance || 0) * BALANCE.enhance.perLevel;
            if (eq.atk) calcAtk += Math.floor(eq.atk * em);
            if (eq.def) calcDef += Math.floor(eq.def * em);
            if (eq.hp) calcHp += Math.floor(eq.hp * em);
            if (eq.crit) calcCrit += eq.crit;
            if (eq.dodge) calcDodge += eq.dodge;
        }
    }

    // 属性计算顺序（勿随意调换）：
    //   1) 基础值 + 被动技能 + 装备(已逐件按强化 em 放大攻/防/血) 求和 → calcHp/Atk/Def
    //   2) 整体再乘洪荒倍率 hhMultiplier
    // 即：强化是「装备层」的放大，洪荒是「全身」的乘区——强化溢价也会被洪荒进一步放大，系有意设计。
    // 洪荒之力 = 洪荒功法的当前等级
    let honghuangPower = 0;
    player.skills.forEach(sk => { if (sk.isHongHuang) honghuangPower = sk.level; });
    const hhMultiplier = 1 + (honghuangPower * BALANCE.honghuangMultPerLevel);

    const stats = {
        hp: Math.floor(calcHp * hhMultiplier),
        atk: Math.floor(calcAtk * hhMultiplier),
        def: Math.floor(calcDef * hhMultiplier),
        crit: parseFloat((calcCrit * hhMultiplier).toFixed(1)),
        dodge: parseFloat(Math.min(BALANCE.dodgeCap, calcDodge * hhMultiplier).toFixed(1)),
        dropRate: 100,
        coinRate: 100
    };
    player.skills.forEach(sk => {
        if (sk.type === 'passive') {
            if (sk.dropRate) stats.dropRate += (sk.dropRate * sk.level);
            if (sk.coinRate) stats.coinRate += (sk.coinRate * sk.level);
        }
    });

    return { stats, honghuangPower };
}

// —— 关卡难度 / 敌人属性 ——
export function getMapDifficulty(mapId) {
    return Math.pow(BALANCE.enemy.diffBase, mapId - 1); // 难度逐关 ×diffBase（调缓后堆装备/强化能明显多推关卡）
}

// 关卡所属装备档(1~6)：100 关分 6 段(每段约 17 关)。用于"推荐装备档"里程碑与战斗掉落档位。
// 封顶在「可锻造最高档」——区域只掉可锻造档的矿(T7/T8 神话/仙器无对应矿，仅秘境进阶产出)。
export function mapTier(mapId) {
    return Math.min(MAX_CRAFTABLE_TIER, Math.max(1, Math.ceil(mapId / 17)));
}

export function finalizeEnemyStats(mapId) {
    const diffMult = getMapDifficulty(mapId);
    const { baseHp, baseAtk, baseDef } = BALANCE.enemy;
    return {
        name: `${MAP_NAMES[mapId - 1]}守卫`,
        maxHp: Math.floor(baseHp * diffMult),
        atk: Math.floor(baseAtk * diffMult),
        def: Math.floor(baseDef * diffMult)
    };
}

// —— 秘境 Boss 属性：难度 = getMapDifficulty(mapEquiv) * toughness ——
export function finalizeBossStats(boss) {
    const diff = getMapDifficulty(boss.mapEquiv) * boss.toughness;
    const { baseHp, baseAtk, baseDef } = BALANCE.enemy;
    return {
        name: boss.name,
        maxHp: Math.floor(baseHp * diff),
        atk: Math.floor(baseAtk * diff),
        def: Math.floor(baseDef * diff)
    };
}

// —— 随机装备生成 ——
export function generateItemByMatrix(levelFact) {
    const slotKeys = Object.keys(MATRIX_ITEMS);
    const rType = slotKeys[Math.floor(Math.random() * slotKeys.length)];

    const rollQ = Math.random() * 100;
    let quality = 0;
    for (const t of BALANCE.qualityRoll) { if (rollQ > t.min) { quality = t.q; break; } }

    const preIdx = Math.min(ITEM_PREFIXES.length - 1, Math.floor(Math.random() * (quality + 2 + levelFact / 8)));
    const fullName = ITEM_PREFIXES[preIdx] + "·" + MATRIX_ITEMS[rType][Math.floor(Math.random() * MATRIX_ITEMS[rType].length)];
    const mult = (quality + 1) * (1 + (levelFact % 3) * 0.4);

    let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;
    switch (rType) {
        case "weapon": atk = Math.floor(22 * mult); if (quality >= 3) crit = quality * 2; break;
        case "subweapon": atk = Math.floor(12 * mult); if (quality >= 3) crit = Math.floor(quality * 2.5); break;
        case "armor": def = Math.floor(10 * mult); hp = Math.floor(50 * mult); break;
        case "helm": def = Math.floor(6 * mult); hp = Math.floor(40 * mult); break;
        case "ring": hp = Math.floor(80 * mult); if (quality >= 3) dodge = Math.min(75, Math.floor(quality * 1.5)); break;
        case "artifact": atk = Math.floor(10 * mult); def = Math.floor(6 * mult); hp = Math.floor(60 * mult); if (quality >= 4) { crit = quality; dodge = quality; } break;
    }
    return {
        id: "it_" + Date.now() + Math.random(),
        name: fullName, type: rType, quality,
        atk, def, hp, crit, dodge,
        price: Math.floor(BALANCE.itemPrice.base * Math.pow(BALANCE.itemPrice.growth, quality))
    };
}

// —— 品阶(成色)掷骰：按 BALANCE.qualityRoll 从高到低命中，余数为 0(凡品)。打造/黑市进货共用。——
export function rollQuality() {
    const r = Math.random() * 100;
    for (const t of BALANCE.qualityRoll) if (r > t.min) return t.q;
    return 0;
}

// —— 命名套装阶梯：按「档(tier)+部位(slot)」确定属性打造一件装备（梅尔沃式循序渐进的核心）。——
// 属性 = 部位基础 × 档倍率(GEAR_TIERS.power) × 成色(quality 微调)。产出结构与随机装备完全一致(多带 tier 字段)，
// 故背包/穿戴/洪炉/熔炼/tooltip 全部沿用、无需改。强化(item.enhance)再在档内放大攻防血。
export function makeGearPiece(tier, slot, quality = 0) {
    const T = GEAR_TIERS[tier - 1];
    const names = MATRIX_ITEMS[slot];
    if (!T || !names) return null;
    const p = T.power * (1 + quality * BALANCE.gear.qualityStep);
    let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;
    switch (slot) {
        case "weapon":    atk = Math.floor(22 * p); if (tier >= 3) crit = tier * 2; break;
        case "subweapon": atk = Math.floor(12 * p); if (tier >= 3) crit = Math.floor(tier * 2.5); break;
        case "armor":     def = Math.floor(10 * p); hp = Math.floor(50 * p); break;
        case "helm":      def = Math.floor(6 * p);  hp = Math.floor(40 * p); break;
        case "ring":      hp = Math.floor(80 * p);  if (tier >= 3) dodge = Math.min(75, Math.floor(tier * 1.2)); break;
        case "artifact":  atk = Math.floor(10 * p); def = Math.floor(6 * p); hp = Math.floor(60 * p); if (tier >= 4) { crit = tier; dodge = tier; } break;
        default: return null;
    }
    return {
        id: "it_" + Date.now() + Math.random(),
        name: `${T.name}·${names[Math.floor(Math.random() * names.length)]}`,
        type: slot, tier, quality, atk, def, hp, crit, dodge,
        price: Math.floor(BALANCE.itemPrice.base * Math.pow(BALANCE.itemPrice.growth, quality))
    };
}

// 打造「一件」装备的花费（按档）。返回 {ingotKey, ingotQty, coin} 或 null。
export function gearCraftCost(tier) {
    const T = GEAR_TIERS[tier - 1];
    return T ? { ingotKey: T.ingot, ingotQty: T.ingotQty, coin: T.coin } : null;
}

// 可锻造的最高档(craftable!==false 的数量)。打造/洪炉升档以此封顶，再往上只能靠神兵进阶。
export const MAX_CRAFTABLE_TIER = GEAR_TIERS.filter(t => t.craftable !== false).length;

// —— 神兵进阶花费：仅 T6/T7 档可进阶(T6→T7神话、T7→T8仙器；T8 已满顶，低于 T6 走打造)。吃神魂结晶+碎银。返回 {nextTier,crystal,coin} 或 null。——
export function gearUpgradeCost(item) {
    if (!item || !item.tier) return null;
    if (item.tier < MAX_CRAFTABLE_TIER || item.tier >= GEAR_TIERS.length) return null;
    const next = item.tier + 1;
    const crystal = BALANCE.upgrade.crystalCost[next];
    const coin = BALANCE.upgrade.coinCost[next];
    if (crystal === undefined || coin === undefined) return null; // 配置缺该档花费 → 视为不可进阶，避免算出 NaN
    return { nextTier: next, crystal, coin };
}

// —— 随机秘籍生成（价格随境界）——
export function generateSkillByMatrix(realmLevel) {
    const suff = SKILL_SUFFIXES[Math.floor(Math.random() * SKILL_SUFFIXES.length)];
    return {
        id: "sk_" + Math.floor(Math.random() * 1000000),
        name: SKILL_SECTS[Math.floor(Math.random() * SKILL_SECTS.length)] + suff.name,
        type: suff.type, level: 1, baseRate: BALANCE.skill.baseRate,
        power: suff.power || 0, hp: suff.hp || 0, atk: suff.atk || 0, def: suff.def || 0,
        dodge: suff.dodge || 0, crit: suff.crit || 0, dropRate: suff.dropRate || 0,
        coinRate: suff.coinRate || 0, healRate: suff.healRate || 0,
        desc: suff.desc,
        price: Math.floor(Math.random() * 15000) + 4000 + (realmLevel * 400)
    };
}

// —— 战斗纯模拟：把整场战斗算完，返回胜负 + 逐回合事件，供视图层播放动画 ——
// stats: computeStats 的 stats；enemy: finalizeEnemyStats 结果；skills: player.skills
export function simulateBattle(stats, enemy, skills) {
    const B = BALANCE.battle;
    const maxPHp = stats.hp;
    let eHp = enemy.maxHp;
    let pHp = maxPHp;
    const events = [];
    const activePool = skills.filter(s => s.type === 'active');
    let round = 1;

    while (eHp > 0 && pHp > 0 && round <= B.maxRounds) {
        const isCrit = Math.random() * 100 < stats.crit;
        let dmg = stats.atk;
        const active = activePool.length > 0 && Math.random() < B.activeSkillChance
            ? activePool[Math.floor(Math.random() * activePool.length)]
            : null;
        // 兜底：power 缺失/非有限数时按 1 倍处理，绝不让伤害退化成 NaN（旧档里可能存在缺 power 的主动技）
        if (active) {
            const power = Number.isFinite(active.power) ? active.power : 1;
            dmg = Math.floor(dmg * (power + active.level * B.activeLevelScale));
        }
        if (isCrit) dmg = Math.floor(dmg * B.critMult);

        const dmgToE = Math.max(1, dmg - enemy.def);
        eHp -= dmgToE;
        const heal = (active && active.healRate) ? Math.floor(dmgToE * active.healRate) : 0;
        if (heal > 0) pHp = Math.min(maxPHp, pHp + heal);

        events.push({ side: 'player', round, dmg: dmgToE, isCrit, heal, eHpPct: Math.max(0, (eHp / enemy.maxHp) * 100) });
        if (eHp <= 0) break;

        if (!(Math.random() * 100 < stats.dodge)) {
            const dmgToP = Math.max(1, enemy.atk - stats.def);
            pHp -= dmgToP;
            events.push({ side: 'enemy', round, dmg: dmgToP, pHpPct: Math.max(0, (pHp / maxPHp) * 100) });
        } else {
            events.push({ side: 'dodge', round });
        }
        if (pHp <= 0) break;
        round++;
    }

    // enemyDead：敌人是否真被打死(用于 Boss——撑满回合"存活"不算击杀)。win 沿用旧义(玩家存活)，地图挂机不变。
    return { win: pHp > 0, enemyDead: eHp <= 0, events };
}

// —— 洪炉：花费 + 合成结果（纯计算，不扣钱、不动背包，交给控制层）——
export function computeForgeCost(i1, i2) {
    return Math.floor((i1.price + i2.price) * BALANCE.forge.costRate) + BALANCE.forge.costBase;
}

export function computeForgeResult(i1, i2, realmLevel, cost) {
    const F = BALANCE.forge;

    // 1) 装备 + 装备
    if (i1.type !== 'book' && i2.type !== 'book') {
        // 打造套装件(带 tier)走「升级合成」：同档有概率升一档、否则取较高档；属性按 tier 重算，绝不退化成随机装。
        // 任一为旧随机装/掉落装(无 tier)则落到下方原「品阶升阶」逻辑，保持向下兼容。
        if (i1.tier && i2.tier) {
            const targetType = Math.random() < 0.5 ? i1.type : i2.type;
            const sameTier = i1.tier === i2.tier;
            // 洪炉升档封顶在「可锻造最高档(T6)」——突破到神话/仙器只能走神兵进阶(吃神魂结晶)
            const upTier = sameTier && i1.tier < MAX_CRAFTABLE_TIER && Math.random() < F.upgradeSameQ;
            const newTier = upTier ? i1.tier + 1 : Math.max(i1.tier, i2.tier);
            const baseQ = Math.max(i1.quality || 0, i2.quality || 0);
            const newQ = (Math.random() < (sameTier ? F.upgradeSameQ : F.upgradeDiffQ)) ? Math.min(5, baseQ + 1) : baseQ;
            const piece = makeGearPiece(newTier, targetType, newQ);
            if (upTier) piece.name = "灵铸·" + piece.name;          // 升档标记
            piece.price = Math.floor(cost * F.resultPriceMult);
            return piece;
        }

        const baseQ = Math.max(i1.quality, i2.quality);
        const upgradeChance = (i1.quality === i2.quality) ? F.upgradeSameQ : F.upgradeDiffQ;
        const finalQ = (Math.random() < upgradeChance) ? Math.min(5, baseQ + 1) : baseQ;

        const targetType = Math.random() < 0.5 ? i1.type : i2.type;
        const targetNameBase = Math.random() < 0.5 ? (i1.name.split('·')[1] || i1.name) : (i2.name.split('·')[1] || i2.name);

        const prefix = ITEM_PREFIXES[Math.min(ITEM_PREFIXES.length - 1, Math.floor(Math.random() * (finalQ + 2)))];
        const fullName = (finalQ > baseQ ? "灵铸·" : "") + prefix + "·" + targetNameBase;

        const mult = (finalQ + 1) * (1 + realmLevel * F.multRealmScale) * F.multBonus;
        let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;
        // 注意：洪炉的属性比随机生成更高（多 +2 暴击 / +1 闪避，护甲 hp 触发条件不同），系有意设计，勿与 generateItemByMatrix 合并。
        switch (targetType) {
            case "weapon": atk = Math.floor(22 * mult); if (finalQ >= 3) crit = finalQ * 2 + 2; break;
            case "subweapon": atk = Math.floor(12 * mult); if (finalQ >= 3) crit = Math.floor(finalQ * 2.5 + 2); break;
            case "armor": def = Math.floor(10 * mult); if (finalQ >= 3) hp = Math.floor(50 * mult); break;
            case "helm": def = Math.floor(6 * mult); hp = Math.floor(40 * mult); break;
            case "ring": hp = Math.floor(80 * mult); if (finalQ >= 3) dodge = Math.min(75, Math.floor(finalQ * 1.5 + 1)); break;
            case "artifact": atk = Math.floor(10 * mult); def = Math.floor(6 * mult); hp = Math.floor(60 * mult); if (finalQ >= 4) { crit = finalQ; dodge = finalQ; } break;
        }
        return {
            id: "it_" + Date.now(), name: fullName, type: targetType, quality: finalQ,
            atk, def, hp, crit, dodge, price: Math.floor(cost * F.resultPriceMult)
        };
    }

    // 2) 秘籍 + 秘籍
    if (i1.type === 'book' && i2.type === 'book') {
        const isHH = (i1.payload.isHongHuang || i2.payload.isHongHuang) ? (Math.random() < 0.4) : false;
        if (isHH) {
            const hhSkill = {
                id: "sk_hh_" + Date.now(), name: "融合·混沌诀", type: "passive", level: 1, isHongHuang: true,
                desc: "【洪荒法则】最高修炼至 100 重。每重洪荒之力+1%，五维暴增2%。", price: BALANCE.hhSkillPrice
            };
            return { name: `禁忌秘籍·《${hhSkill.name}》`, type: "book", payload: hhSkill, price: hhSkill.price };
        }
        const generated = generateSkillByMatrix(realmLevel);
        generated.name = "绝世·" + generated.name;
        generated.power = generated.power ? parseFloat((generated.power * 1.5).toFixed(1)) : 0;
        if (generated.hp) generated.hp *= 2;
        if (generated.atk) generated.atk *= 2;
        return { name: `秘籍·《${generated.name}》`, type: "book", payload: generated, price: Math.floor(generated.price * 1.5) };
    }

    // 3) 装备 + 秘籍（附魔）
    const gear = i1.type !== 'book' ? i1 : i2;
    const book = i1.type === 'book' ? i1 : i2;
    const result = JSON.parse(JSON.stringify(gear));
    result.id = "it_" + Date.now();
    result.name = "附魔·" + result.name;
    result.quality = Math.min(5, result.quality + 1);
    const p = book.payload;
    if (p.hp) result.hp = (result.hp || 0) + p.hp * F.enchantPayloadMult;
    if (p.atk) result.atk = (result.atk || 0) + p.atk * F.enchantPayloadMult;
    if (p.def) result.def = (result.def || 0) + p.def * F.enchantPayloadMult;
    if (p.dodge) result.dodge = (result.dodge || 0) + p.dodge;
    if (p.crit) result.crit = (result.crit || 0) + p.crit;
    if (p.type === 'active' && p.power) {
        result.atk = (result.atk || 0) + Math.floor(p.power * 100);
        result.crit = (result.crit || 0) + 2;
    }
    result.price += book.price;
    return result;
}

// —— 熔炼：把背包按品阶/全部装备拆分为 {保留, 所得碎银}（纯函数）——
export function partitionByQuality(bag, qualities) {
    const remain = [];
    let gold = 0;
    bag.forEach(it => {
        if (it.quality !== undefined && qualities.includes(it.quality) && it.type !== "book") gold += it.price;
        else remain.push(it);
    });
    return { remain, gold };
}

export function partitionAllGear(bag) {
    const remain = [];
    let gold = 0;
    bag.forEach(it => {
        if (it.type !== "book") gold += it.price;
        else remain.push(it);
    });
    return { remain, gold };
}
