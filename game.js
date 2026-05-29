    const ITEM_PREFIXES = ["破旧的", "青铜", "百炼精铁", "沉香木", "寒霜", "流光", "紫电", "赤焰", "龙骨", "诛仙", "太虚", "造化", "乾坤", "鸿蒙", "荒古始源", "无上天道掌控者"];
    const MATRIX_ITEMS = {
        weapon: ["长剑", "唐刀", "重剑", "长枪", "利刃", "折扇", "长鞭", "战斧", "拂尘", "拳套", "方天画戟", "屠龙宝刀"],
        subweapon: ["飞刀", "袖箭", "毒针", "判官笔", "金刚杵", "乾坤圈", "爆裂火弹", "暴雨梨花针"],
        armor: ["布衣", "皮甲", "链甲", "玄武重铠", "金丝软甲", "流光战袍", "太极道衣", "九天神魔仙衣"],
        helm: ["头巾", "皮帽", "精铁盔", "紫金冠", "凤翅玲珑盔", "大罗天御冕", "混元无极发冠"],
        ring: ["铜指环", "骨质项链", "青玉佩", "龙纹扳指", "乾坤避毒符", "大罗天魂坠", "混沌鸿蒙神印"],
        artifact: ["炼妖壶", "东皇钟", "昆仑镜", "神农鼎", "山河社稷图", "七宝妙树", "太极图", "诛仙剑阵图"]
    };
    const QUALITY_NAMES = ["凡品", "良品", "上品", "精品", "史诗", "神话"];
    const SKILL_SECTS = ["少林", "武当", "峨眉", "华山", "丐帮", "魔教", "逍遥", "昆仑", "桃花岛", "大理段氏"];
    const SKILL_TYPES = ["降魔", "纯阳", "凌波", "太极", "夺命", "无极", "浩然", "逆天", "九幽", "混元"];
    
    const SKILL_SUFFIXES = [
        { name: "掌", type: "active", power: 1.5, desc: "气吞山河，造成[伤害]倍输出。" },
        { name: "剑诀", type: "active", power: 1.9, desc: "万剑归宗，造成[伤害]倍输出。" },
        { name: "噬血术", type: "active", power: 1.8, healRate: 0.3, desc: "造成[伤害]倍输出并吸血 30%。" },
        { name: "神功", type: "passive", hp: 150, atk: 30, desc: "每重永久叠加[气血]气血和[攻击]攻击。" },
        { name: "心法", type: "passive", def: 20, dodge: 1.5, desc: "每重永久叠加[防御]防御与[闪避]%闪避。" },
        { name: "真卷", type: "passive", atk: 40, crit: 1.5, desc: "每重永久叠加[攻击]攻击与[暴击]%暴击率。" },
        { name: "寻龙诀", type: "passive", dropRate: 15, desc: "每重永久提升【掉宝率】 15%。" },
        { name: "招财秘录", type: "passive", coinRate: 15, desc: "每重增加 15% 碎银获取率。" }
    ];

    const REALMS = ["后天", "先天", "宗师", "大宗师", "渡劫", "天仙", "金仙", "仙帝", "神话", "至高天尊"];
    
    const MAP_NAMES = [
        "青竹林", "恶狼谷", "黑风寨", "断魂坡", "清风观", "野猪林", "饮马驿", "飞鹰帮", "鸣沙湾", "连环坞",
        "狂狮堂", "神剑山庄", "铁剑门", "聚贤庄", "恶人谷", "快活林", "缥缈峰", "光明顶", "桃花岛", "侠客岛",
        "昆仑巅", "极寒雪域", "烈焰焚城", "幽冥鬼道", "万剑冢", "锁妖塔", "伏魔殿", "归墟之地", "幻灭深渊", "九天玄界",
        "天门关", "落星峡", "荒古禁地", "寂灭荒原", "天心湖", "浮空岛", "九幽冥府", "紫薇圣境", "无量海", "虚空断层",
        "太初矿场", "灵木森林", "赤焰峡谷", "落雷沼泽", "寒冰洞穴", "暗影迷踪", "血色祭坛", "圣殿遗迹", "众神花园", "枯骨荒原",
        "极乐净土", "无间地狱", "天机阁", "星辰之海", "轮回道", "彼岸花海", "幽梦古境", "苍穹之顶", "云梦泽", "古战场",
        "碎星域", "龙脉山", "天道台", "封魔地", "归元宗", "剑圣谷", "战神府", "万妖林", "死寂之海", "永恒森林",
        "雷劫洞", "火云窟", "冰封谷", "灵台山", "紫云峰", "望月阁", "沉星湖", "葬剑崖", "乱魔岗", "炼心路",
        "断天涯", "洗髓池", "铸兵台", "悟道峰", "登仙路", "问天台", "飞仙谷", "镇魔关", "斩仙境", "凌云顶",
        "九重天", "圣皇都", "神隐界", "造化府", "混沌海", "极境之渊", "至尊殿", "永恒领域", "终焉神座", "虚空尽头"
    ];

    const epicStory = [
        "混沌初开，大道崩坏。",
        "你曾是上古时期傲视万界的无上天尊，却在纪元劫难中身陨，真灵遁入轮回。",
        "历经九十九世的沉沦与蒙昧，今生的你，终于苏醒。",
        "这是一个灵气枯竭、妖魔横行、传承断绝的末法时代。",
        "但你的灵魂深处，正激荡着一股古老而禁忌的本源——",
        "那正是传说中，足以颠覆天道、逆转乾坤的【老区长的洪荒之力】。",
        "百关征途，前路死局；天地洪炉，万物皆可炼造！",
        "握紧手中的凡铁，去重铸昔日的荣光，斩破这无尽的虚空吧！"
    ];

    let player = {
        name: "", realmLevel: 1, exp: 0, coin: 50000, rebornCount: 0,
        baseHp: 250, baseAtk: 35, baseDef: 15, baseCrit: 5, baseDodge: 5,
        honghuangPower: 0, 
        equips: { weapon: null, subweapon: null, armor: null, helm: null, ring: null, artifact: null },
        bag: [], bagMax: 96,
        skills: [],
        currentMapId: null,
        lastTickTime: 0
    };

    let hangupTimer = null;
    let battleProgress = 0;
    let finalStats = {};
    let forgeItems = [null, null]; // 洪炉槽位

    window.onload = function() {
        loadGame();
        initTooltipEvent();
        if (!player.name || player.name.trim() === "") {
            document.getElementById('create-role-overlay').style.display = 'flex';
        } else {
            document.getElementById('create-role-overlay').style.display = 'none';
            document.getElementById('story-overlay').style.display = 'none';
            initGameCore();
        }
    }

    function generateHtmlColumn(info, titlePrefix = "", isCurrentlyEquipped = false) {
        if (!info) return `<div class="tooltip-column" style="color:#444; text-align:center; padding-top:40px;">[未装备对应部位]</div>`;
        let html = `<div class="tooltip-column">`;
        if (isCurrentlyEquipped) html += `<div class="equipped-badge">已装备</div>`;

        if (info.type === "book") {
            let isSpecial = info.payload && info.payload.isHongHuang;
            html += `<div class="tooltip-title" style="color:${isSpecial?'var(--color-honghuang)':'var(--color-gold)'}">${titlePrefix}${info.name}</div>`;
            html += `<div class="tooltip-attr"><span>分类:</span><span style="color:var(--color-blue)">${isSpecial?'禁忌至高绝学':'江湖武学秘籍'}</span></div>`;
            html += `<div class="tooltip-attr"><span>回收价值:</span><span style="color:var(--color-gold)">${info.price} 文</span></div>`;
            
            let pld = info.payload || {};
            let dynamicDesc = (pld.desc || "").replace("[伤害]", pld.power);
            if(pld.hp) dynamicDesc = dynamicDesc.replace("[气血]", pld.hp);
            if(pld.atk) dynamicDesc = dynamicDesc.replace("[攻击]", pld.atk);
            if(pld.def) dynamicDesc = dynamicDesc.replace("[防御]", pld.def);
            if(pld.dodge) dynamicDesc = dynamicDesc.replace("[闪避]", pld.dodge);
            if(pld.crit) dynamicDesc = dynamicDesc.replace("[暴击]", pld.crit);

            html += `<div class="tooltip-desc">【功效】:<br>${dynamicDesc}</div>`;
        } else {
            let qColor = ["#7f8c8d", "#2ecc71", "#3498db", "#9b59b6", "#e67e22", "#e74c3c"][info.quality || 0] || "#7f8c8d";
            html += `<div class="tooltip-title" style="color:${qColor}">${titlePrefix}${info.name}</div>`;
            html += `<div class="tooltip-attr"><span>品阶质量:</span><span style="color:${qColor}">${QUALITY_NAMES[info.quality || 0] || '未知'}</span></div>`;
            html += `<div class="tooltip-attr"><span>回收碎银:</span><span style="color:var(--color-gold)">${info.price} 文</span></div>`;
            html += `<hr style="border:0; border-top:1px dashed #222; margin:6px 0;">`;
            
            const fields = [
                { k: 'atk', n: '攻击力', c: 'var(--color-accent)' },
                { k: 'def', n: '防御力', c: 'var(--color-blue)' },
                { k: 'hp',  n: '气血总量', c: 'var(--color-success)' },
                { k: 'crit',n: '暴击率', c: 'var(--color-orange)', s: '%' },
                { k: 'dodge',n:'闪避率', c: 'var(--color-success)', s: '%' }
            ];
            fields.forEach(f => {
                let val = info[f.k] || 0;
                if(val > 0) html += `<div class="tooltip-attr"><span>${f.n}:</span><span style="color:${f.c}">+${val}${f.s||''}</span></div>`;
            });
        }
        html += `</div>`;
        return html;
    }

    function generateDiffColumn(curItem, eqItem) {
        let html = `<div class="tooltip-column" style="border-left: 1px dashed #333; padding-left: 15px; width: 140px;">`;
        html += `<div class="tooltip-title" style="color:#aaa;">🔀 变更对比</div>`;
        const fields = [{ k: 'atk', n: '攻击' }, { k: 'def', n: '防御' }, { k: 'hp',  n: '气血' }, { k: 'crit',n: '暴击' }, { k: 'dodge',n:'闪避' }];
        fields.forEach(f => {
            let curVal = curItem[f.k] || 0;
            let eqVal = eqItem ? (eqItem[f.k] || 0) : 0;
            let diff = curVal - eqVal;
            if (diff > 0) html += `<div class="tooltip-attr"><span>${f.n}:</span><span class="compare-tag comp-up">▲ +${diff}</span></div>`;
            else if (diff < 0) html += `<div class="tooltip-attr"><span>${f.n}:</span><span class="compare-tag comp-down">▼ ${diff}</span></div>`;
            else html += `<div class="tooltip-attr"><span>${f.n}:</span><span class="compare-tag comp-equal">--</span></div>`;
        });
        html += `</div>`;
        return html;
    }

    function initTooltipEvent() {
        const tipNode = document.getElementById('global-tooltip');
        document.body.addEventListener('mouseover', function(e) {
            let target = e.target.closest('[data-tip]');
            if (!target) return;
            try {
                let info = JSON.parse(target.getAttribute('data-tip'));
                let isEquippedSlot = target.id && target.id.startsWith("slot-container-");
                let isForgeSlot = target.id && target.id.startsWith("forge-slot-");
                let finalHtml = `<div class="tooltip-container">`;
                
                if (isEquippedSlot || isForgeSlot) {
                    finalHtml += generateHtmlColumn(info, "", isEquippedSlot);
                } else if (info.type === "book") {
                    finalHtml += generateHtmlColumn(info);
                } else {
                    let matchedEquip = player.equips[info.type];
                    finalHtml += generateHtmlColumn(info, "👉 ", false); 
                    finalHtml += generateHtmlColumn(matchedEquip, "临·", true); 
                    finalHtml += generateDiffColumn(info, matchedEquip);
                }
                finalHtml += `</div>`;
                tipNode.innerHTML = finalHtml;
                tipNode.style.display = 'block';
            } catch(err){}
        });
        document.body.addEventListener('mousemove', function(e) {
            if(tipNode.style.display === 'block') {
                let x = e.clientX + 15; let y = e.clientY + 15;
                if (x + tipNode.offsetWidth > window.innerWidth) x = e.clientX - tipNode.offsetWidth - 15;
                if (y + tipNode.offsetHeight > window.innerHeight) y = e.clientY - tipNode.offsetHeight - 5;
                tipNode.style.left = x + 'px'; tipNode.style.top = y + 'px';
            }
        });
        document.body.addEventListener('mouseout', function(e) { if (e.target.closest('[data-tip]')) tipNode.style.display = 'none'; });
    }

    function finalizeCharacter() {
        let nameInput = document.getElementById('input-player-name').value.trim();
        if(!nameInput) { alert("名号不可为空！"); return; }
        player.name = nameInput;
        document.getElementById('create-role-overlay').style.display = 'none';
        
        if(player.skills.length === 0) {
            player.skills.push({ id: "s_init", name: "太祖长拳", type: "active", level: 1, baseRate: 0.35, power: 1.3, desc: "入门拳法，造成[伤害]倍输出。" });
        }
        if(player.honghuangPower === undefined) player.honghuangPower = 0;
        
        showStory();
    }

    function showStory() {
        document.getElementById('story-overlay').style.display = 'flex';
        let textContainer = document.getElementById('story-text');
        let btn = document.getElementById('btn-enter-game');
        textContainer.innerHTML = "";
        
        let lineIndex = 0;
        let charIndex = 0;
        let currentHTML = "";

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
        finalizeEnemyStats(1);
        saveGame(); 
        initGameCore();
    }

    function initGameCore() {
        updatePlayerAttributes(); renderForge(); renderBag(); renderMapList(); renderPlayerSkills(); renderShopGoods(); setInterval(saveGame, 5000);
    }

    function saveGame() { if(!player.name) return; player.lastTickTime = Date.now(); localStorage.setItem("wuxia_v6_full_save", JSON.stringify(player)); }
    function loadGame() {
        let saved = localStorage.getItem("wuxia_v6_full_save");
        if (saved) { try { let parsed = JSON.parse(saved); parsed.currentMapId = null; player = Object.assign(player, parsed); if(player.honghuangPower===undefined) player.honghuangPower=0; } catch(e) {} }
    }

    function getRealmName(lv) {
        let idx = Math.floor((lv - 1) / 10); let sub = ((lv - 1) % 10) + 1;
        if (idx >= REALMS.length) return `至高封神第${lv}重`;
        return `${REALMS[idx]}${sub}重`;
    }

    function updatePlayerAttributes() {
        if(!player.name) return;
        let rebornMult = 1 + player.rebornCount * 0.6;
        
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

        for (let slot in player.equips) {
            let eq = player.equips[slot];
            if (eq) {
                if (eq.atk) calcAtk += eq.atk; if (eq.def) calcDef += eq.def; if (eq.hp) calcHp += eq.hp; if (eq.crit) calcCrit += eq.crit; if (eq.dodge) calcDodge += eq.dodge;
            }
        }

        player.honghuangPower = 0;
        player.skills.forEach(sk => {
            if(sk.isHongHuang) player.honghuangPower = sk.level; 
        });

        let hhMultiplier = 1 + (player.honghuangPower * 0.02);
        
        finalStats = {
            hp: Math.floor(calcHp * hhMultiplier),
            atk: Math.floor(calcAtk * hhMultiplier),
            def: Math.floor(calcDef * hhMultiplier),
            crit: parseFloat((calcCrit * hhMultiplier).toFixed(1)),
            dodge: parseFloat((calcDodge * hhMultiplier).toFixed(1)),
            dropRate: 100,
            coinRate: 100
        };

        player.skills.forEach(sk => {
            if (sk.type === 'passive') {
                if (sk.dropRate) finalStats.dropRate += (sk.dropRate * sk.level);
                if (sk.coinRate) finalStats.coinRate += (sk.coinRate * sk.level);
            }
        });

        document.getElementById('p-name').innerText = player.name;
        document.getElementById('p-realm').innerText = getRealmName(player.realmLevel);
        document.getElementById('p-honghuang').innerText = player.honghuangPower + " %";
        document.getElementById('p-hp').innerText = `${finalStats.hp}/${finalStats.hp}`;
        document.getElementById('p-atk').innerText = finalStats.atk;
        document.getElementById('p-def').innerText = finalStats.def;
        document.getElementById('p-crit').innerText = finalStats.crit + "%";
        document.getElementById('p-dodge').innerText = finalStats.dodge + "%";
        document.getElementById('p-droprate').innerText = finalStats.dropRate + "%";
        document.getElementById('p-coinrate').innerText = finalStats.coinRate + "%";
        
        document.getElementById('global-coin').innerText = player.coin;
        document.getElementById('global-exp').innerText = player.exp;
        document.getElementById('global-reborn').innerText = player.rebornCount;
        document.getElementById('sprite-p-name').innerText = player.name;

        ['weapon', 'subweapon', 'armor', 'helm', 'ring', 'artifact'].forEach(s => {
            let eq = player.equips[s]; let el = document.getElementById(`eq-${s}`); let container = document.getElementById(`slot-container-${s}`);
            if(eq) { el.innerText = eq.name; el.className = `q-${eq.quality}`; container.setAttribute('data-tip', JSON.stringify(eq)); } 
            else { el.innerText = `空`; el.className = "q-0"; container.removeAttribute('data-tip'); }
        });
        document.getElementById('bag-count').innerText = player.bag.length;
    }

    function playerBreakthrough() {
        let needExp = player.realmLevel * 400; if (player.exp < needExp) { alert(`元气未足！冲关需要消耗修为 ${needExp} 点。`); return; }
        player.exp -= needExp; player.realmLevel++;
        player.baseHp += 80; player.baseAtk += 18; player.baseDef += 8;  
        updatePlayerAttributes(); renderMapList(); saveGame();
    }

    function triggerReborn() {
        if (player.realmLevel < 20) { alert("天机未到！请至少修炼至级20级。"); return; }
        if (confirm("确定引动天劫转世？")) {
            player.rebornCount++; player.realmLevel = 1; player.baseHp = 250; player.baseAtk = 35; player.baseDef = 15;
            alert("✨ 成功破碎虚空轮回转世！"); updatePlayerAttributes(); renderMapList(); saveGame();
        }
    }

    function generateItemByMatrix(levelFact) {
        let slotKeys = Object.keys(MATRIX_ITEMS); let rType = slotKeys[Math.floor(Math.random() * slotKeys.length)];
        let rollQ = Math.random() * 100; let quality = 0;
        if (rollQ > 98.0) quality = 5; else if (rollQ > 93) quality = 4; else if (rollQ > 82) quality = 3; else if (rollQ > 55) quality = 2; else if (rollQ > 20) quality = 1;                  

        let preIdx = Math.min(ITEM_PREFIXES.length - 1, Math.floor(Math.random() * (quality + 2 + levelFact/8)));
        let fullName = ITEM_PREFIXES[preIdx] + "·" + MATRIX_ITEMS[rType][Math.floor(Math.random() * MATRIX_ITEMS[rType].length)];
        let mult = (quality + 1) * (1 + (levelFact % 3) * 0.4); 

        let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;
        switch(rType) {
            case "weapon": atk = Math.floor(22 * mult); if(quality >= 3) crit = quality * 2; break;
            case "subweapon": atk = Math.floor(12 * mult); if(quality >= 3) crit = Math.floor(quality * 2.5); break;
            case "armor": def = Math.floor(10 * mult); hp = Math.floor(50 * mult); break;
            case "helm": def = Math.floor(6 * mult); hp = Math.floor(40 * mult); break;
            case "ring": hp = Math.floor(80 * mult); if(quality >= 3) dodge = Math.min(75, Math.floor(quality * 1.5)); break;
            case "artifact": atk = Math.floor(10 * mult); def = Math.floor(6 * mult); hp = Math.floor(60 * mult); if(quality >= 4) { crit = quality; dodge = quality; } break;
        }
        return { id: "it_" + Date.now() + Math.random(), name: fullName, type: rType, quality: quality, atk: atk, def: def, hp: hp, crit: crit, dodge: dodge, price: Math.floor(200 * Math.pow(2.5, quality)) };
    }

    function generateSkillByMatrix() {
        let suff = SKILL_SUFFIXES[Math.floor(Math.random() * SKILL_SUFFIXES.length)];
        return { id: "sk_" + Math.floor(Math.random() * 1000000), name: SKILL_SECTS[Math.floor(Math.random() * SKILL_SECTS.length)] + suff.name, type: suff.type, level: 1, baseRate: 0.35, power: suff.power || 0, hp: suff.hp || 0, atk: suff.atk || 0, def: suff.def || 0, dodge: suff.dodge || 0, crit: suff.crit || 0, dropRate: suff.dropRate || 0, coinRate: suff.coinRate || 0, healRate: suff.healRate || 0, desc: suff.desc, price: Math.floor(Math.random() * 15000) + 4000 + (player.realmLevel * 400) };
    }

    // 难度逻辑：难度翻倍 (2的幂次)
    function getMapDifficulty(mapId) {
        return Math.pow(2, mapId - 1);
    }

    function finalizeEnemyStats(mapId) {
        let diffMult = getMapDifficulty(mapId);
        let baseHp = 280;
        let baseAtk = 35;
        let baseDef = 5;
        return {
            name: `${MAP_NAMES[mapId - 1]}守卫`,
            maxHp: Math.floor(baseHp * diffMult),
            atk: Math.floor(baseAtk * diffMult),
            def: Math.floor(baseDef * diffMult)
        };
    }

    function formatNumber(num) {
        if (num >= 1e12) return (num / 1e12).toFixed(2) + '万亿';
        if (num >= 1e8) return (num / 1e8).toFixed(2) + '亿';
        if (num >= 1e4) return (num / 1e4).toFixed(1) + '万';
        return num;
    }

    function renderMapList() {
        let box = document.getElementById('map-list-box'); box.innerHTML = "";
        for (let i = 1; i <= 100; i++) {
            let reqLevel = Math.floor((i - 1) * 1.1) + 1; let isUnlocked = player.realmLevel >= reqLevel;
            let card = document.createElement('div'); card.className = `list-card`; if(!isUnlocked) card.style.opacity = "0.3";
            card.innerHTML = `<div><strong>关卡 ${i}：${MAP_NAMES[i - 1] || `神秘禁区`}</strong> ${!isUnlocked ? '🔒' : ''}<br><small style="color:var(--text-muted)">准入: ${getRealmName(reqLevel)}</small></div><button class="btn" ${isUnlocked ? '' : 'disabled'} onclick="startHangup(${i})">${player.currentMapId === i ? '历练中' : '挑战'}</button>`;
            box.appendChild(card);
        }
    }

    function startHangup(mapId) {
        if (hangupTimer) clearInterval(hangupTimer); player.currentMapId = mapId; battleProgress = 0;
        let enemyData = finalizeEnemyStats(mapId);
        document.getElementById('hangup-status').innerText = `横扫：${MAP_NAMES[mapId - 1]}`;
        document.getElementById('hangup-status').style.color = "var(--color-accent)";
        document.getElementById('sprite-enemy').style.display = "flex";
        
        // 敌人火柴人SVG (angry style)
        document.getElementById('sprite-enemy').querySelector('.sprite-vector').innerHTML = `
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
        document.getElementById('sprite-e-name').innerText = enemyData.name;
        
        logBattle(`【历练】踏入【${MAP_NAMES[mapId - 1]}】...`);
        hangupTimer = setInterval(() => { executeLoopBattle(mapId); }, 2200); renderMapList();
    }

    function stopHangup() {
        if (hangupTimer) {
            clearInterval(hangupTimer); hangupTimer = null; player.currentMapId = null;
            document.getElementById('hangup-status').innerText = "调息中"; document.getElementById('hangup-status').style.color = "var(--color-success)";
            logBattle("【平息】回城纳凉调息。"); document.getElementById('sprite-enemy').style.display = "none"; renderMapList();
        }
    }

    function logBattle(html) { let box = document.getElementById('battle-log'); box.innerHTML += `<div class="log-item">${html}</div>`; box.scrollTop = box.scrollHeight; }

    function spawnPopupEffect(isToPlayer, text, isCrit=false, isHeal=false) {
        let wrapper = document.getElementById('battle-canvas-wrapper'); let popup = document.createElement('div'); popup.className = "combat-effect-text"; popup.innerText = text;
        if (isHeal) { popup.style.color = "var(--color-success)"; }
        else if (isCrit) { popup.style.color = "var(--color-orange)"; popup.style.fontSize = "24px"; } 
        else { popup.style.color = isToPlayer ? "var(--color-accent)" : "#ffffff"; }
        popup.style.bottom = "90px"; if (isToPlayer) popup.style.left = "90px"; else popup.style.right = "90px";
        wrapper.appendChild(popup); setTimeout(() => { popup.remove(); }, 600);
    }

    function executeLoopBattle(mapId) {
        battleProgress++;
        let enemy = finalizeEnemyStats(mapId);
        let eHp = enemy.maxHp; let maxPHp = finalStats.hp; let pHp = maxPHp;

        logBattle(`⚔️ 遭遇战 -> [${enemy.name}] (生命:${formatNumber(enemy.maxHp)} 攻击:${formatNumber(enemy.atk)})`);
        let pSprite = document.getElementById('sprite-player'); let eSprite = document.getElementById('sprite-enemy');
        let round = 1;
        
        while(eHp > 0 && pHp > 0 && round <= 20) {
            let isCrit = Math.random() * 100 < finalStats.crit; let dmg = finalStats.atk;
            let actPool = player.skills.filter(s => s.type === 'active');
            let currentActiveSkill = actPool.length > 0 && Math.random() < 0.4 ? actPool[Math.floor(Math.random() * actPool.length)] : null;
            
            if (currentActiveSkill) dmg = Math.floor(dmg * (currentActiveSkill.power + (currentActiveSkill.level * 0.18)));
            if (isCrit) dmg = Math.floor(dmg * 1.8);
            
            let finalDmgToE = Math.max(1, dmg - enemy.def); eHp -= finalDmgToE;

            let healAmount = currentActiveSkill && currentActiveSkill.healRate ? Math.floor(finalDmgToE * currentActiveSkill.healRate) : 0;
            if(healAmount > 0) pHp = Math.min(maxPHp, pHp + healAmount);

            setTimeout(() => {
                pSprite.classList.add('strike-dash-right'); setTimeout(() => { pSprite.classList.remove('strike-dash-right'); }, 100);
                eSprite.classList.add('hurt-shake'); setTimeout(() => { eSprite.classList.remove('hurt-shake'); }, 150);
                spawnPopupEffect(false, isCrit ? `暴击 -${formatNumber(finalDmgToE)}` : `-${formatNumber(finalDmgToE)}`, isCrit);
                if(healAmount > 0) spawnPopupEffect(true, `+${healAmount}`, false, true);
                
                let pct = Math.max(0, (eHp / enemy.maxHp) * 100);
                document.getElementById('sprite-e-hp').style.width = pct + "%";
            }, (round - 1) * 60);

            if(eHp <= 0) break;

            if (!(Math.random() * 100 < finalStats.dodge)) {
                let finalDmgToP = Math.max(1, enemy.atk - finalStats.def); pHp -= finalDmgToP;
                setTimeout(() => {
                    eSprite.classList.add('strike-dash-left'); setTimeout(() => { eSprite.classList.remove('strike-dash-left'); }, 100);
                    pSprite.classList.add('hurt-shake'); setTimeout(() => { pSprite.classList.remove('hurt-shake'); }, 150);
                    spawnPopupEffect(true, `-${formatNumber(finalDmgToP)}`, false);
                    
                    let pct = Math.max(0, (pHp / maxPHp) * 100);
                    document.getElementById('sprite-p-hp').style.width = pct + "%";
                }, (round - 1) * 60 + 30);
            } else {
                setTimeout(() => { spawnPopupEffect(true, "闪避", false); }, (round - 1) * 60 + 30);
            }
            if(pHp <= 0) break;
            round++;
        }

        if(pHp > 0) {
            let baseCoin = 50 + mapId * 30;
            let baseExp = 40 + mapId * 40;
            let coinG = Math.floor(baseCoin * (finalStats.coinRate / 100));
            let expG = Math.floor(baseExp);
            
            player.coin += coinG; player.exp += expG;
            let bonus = "";
            let baseDrop = 0.20;
            let finalDrop = baseDrop * (finalStats.dropRate / 100);

            if (Math.random() < finalDrop && player.bag.length < player.bagMax) {
                let newItem = generateItemByMatrix(mapId); player.bag.push(newItem);
                bonus = ` 夺得战利品: [${newItem.name}]`; renderBag();
            }
            logBattle(`✨ 胜利！碎银+${formatNumber(coinG)}，修为+${formatNumber(expG)}。${bonus}`);
        } else {
            let loseCoin = Math.floor(player.coin * 0.05); player.coin -= loseCoin; if(player.coin<0) player.coin=0;
            logBattle(`❌ 战败！阵亡遗失 ${formatNumber(loseCoin)} 碎银，自动退回安全区。`); stopHangup();
        }
        
        setTimeout(() => {
            document.getElementById('sprite-p-hp').style.width = "100%";
            document.getElementById('sprite-e-hp').style.width = "100%";
        }, 1200);

        updatePlayerAttributes();
    }

    function renderShopGoods() {
        let box = document.getElementById('shop-goods-box'); box.innerHTML = "";
        let hasHHBook = Math.random() < 0.4;
        let goodsCount = 6;
        
        if(hasHHBook) {
            let hhSkill = { 
                id: "sk_honghuang_unique", 
                name: "老区长混沌诀", 
                type: "passive", 
                level: 1, 
                isHongHuang: true, 
                desc: "远古老区长遗留的法则具现。<br><br><span style='color:var(--color-honghuang)'>【洪荒法则】</span>：本功法最高可修炼至 100 重！每研习精进一重，【老区长的洪荒之力】永久 +1%（即全身各项基础属性暴增 2%）。研习此神功需要极其庞大的天地造化修为！",
                price: 380000 
            };
            let bookItem = { name: `禁忌秘籍·《${hhSkill.name}》`, type: "book", payload: hhSkill, price: hhSkill.price };
            let card = document.createElement('div'); card.className = "list-card";
            card.style.border = "1px solid var(--color-honghuang)";
            card.style.background = "linear-gradient(90deg, #1a050c 0%, #111 100%)";
            card.innerHTML = `<span data-tip='${JSON.stringify(bookItem)}' style="cursor:help;"><strong class="q-hh">🔥 绝世孤本《${hhSkill.name}》 🔍</strong></span><button class="btn btn-danger" onclick="buyShopSkill(${JSON.stringify(hhSkill).replace(/"/g, '&quot;')})">购买 (380000文)</button>`;
            box.appendChild(card);
            goodsCount = 5;
        }

        for(let i=1; i<=goodsCount; i++) {
            let card = document.createElement('div'); card.className = "list-card";
            if (i <= 3) {
                let mockItem = generateItemByMatrix(player.realmLevel);
                card.innerHTML = `<span data-tip='${JSON.stringify(mockItem)}' style="cursor:help;"><b class="q-${mockItem.quality}">[装备] ${mockItem.name} 🔍</b></span><button class="btn btn-success" onclick="buyShopItem(${JSON.stringify(mockItem).replace(/"/g, '&quot;')})">购买 (${mockItem.price}文)</button>`;
            } else {
                let suff = SKILL_SUFFIXES[Math.floor(Math.random() * SKILL_SUFFIXES.length)];
                let mockSkill = { id: "sk_" + Math.floor(Math.random()*10000), name: SKILL_SECTS[Math.floor(Math.random()*SKILL_SECTS.length)]+suff.name, type: suff.type, level:1, hp:suff.hp||0, atk:suff.atk||0, def:suff.def||0, dodge:suff.dodge||0, crit:suff.crit||0, desc:suff.desc, price: 6000 };
                let bookItem = { name: `秘籍·《${mockSkill.name}》`, type: "book", payload: mockSkill, price: mockSkill.price };
                card.innerHTML = `<span data-tip='${JSON.stringify(bookItem)}' style="cursor:help;"><strong style="color:var(--color-gold);">📜 绝学《${mockSkill.name}》 🔍</strong></span><button class="btn btn-success" onclick="buyShopSkill(${JSON.stringify(mockSkill).replace(/"/g, '&quot;')})">购买 (${mockSkill.price}文)</button>`;
            }
            box.appendChild(card);
        }
    }

    function buyShopItem(itemObj) {
        if(player.coin < itemObj.price) { alert("碎银不足！"); return; }
        if(player.bag.length >= player.bagMax) { alert("背包空间已满。"); return; }
        player.coin -= itemObj.price; player.bag.push(itemObj);
        document.getElementById('global-tooltip').style.display = 'none'; 
        renderShopGoods(); renderBag(); updatePlayerAttributes();
    }

    function buyShopSkill(skObj) {
        if(player.coin < skObj.price) { alert("银两不足。"); return; }
        if(player.bag.length >= player.bagMax) { alert("行囊空间已满。"); return; }
        player.coin -= skObj.price;
        player.bag.push({ id: "bk_"+Date.now(), name: skObj.isHongHuang ? `禁忌秘籍·《${skObj.name}》` : `秘籍·《${skObj.name}》`, type: "book", payload: skObj, price: Math.floor(skObj.price/5) });
        document.getElementById('global-tooltip').style.display = 'none';
        renderShopGoods(); renderBag(); updatePlayerAttributes();
    }

    /* ======================= 万物合成 / 洪炉系统 ======================= */
    function renderForge() {
        for(let i=0; i<2; i++) {
            let slot = document.getElementById('forge-slot-' + i);
            let item = forgeItems[i];
            if (item) {
                let qClass = (item.payload && item.payload.isHongHuang) ? 'q-hh' : (item.quality !== undefined ? `q-${item.quality}` : '');
                slot.className = "item-slot forge-glow " + qClass;
                slot.innerHTML = `<b>${item.name.substring(0,5)}</b>`;
                slot.setAttribute('data-tip', JSON.stringify(item));
            } else {
                slot.className = "item-slot";
                slot.innerHTML = "空";
                slot.removeAttribute('data-tip');
            }
        }
    }

    function removeFromForge(idx) {
        if (forgeItems[idx]) {
            if (player.bag.length >= player.bagMax) { alert("行囊已满，无法取出！"); return; }
            player.bag.push(forgeItems[idx]);
            forgeItems[idx] = null;
            document.getElementById('global-tooltip').style.display = 'none';
            renderForge(); renderBag(); saveGame();
        }
    }

    function executeForge() {
        let i1 = forgeItems[0];
        let i2 = forgeItems[1];
        if (!i1 || !i2) { alert("必须放入两件物品才能启动洪炉！"); return; }
        
        let cost = Math.floor((i1.price + i2.price) * 0.3) + 100;
        if (player.coin < cost) { alert(`启动洪炉需要注入 ${cost} 文碎银作为灵力，你的碎银不足！`); return; }
        player.coin -= cost;

        let resultItem = null;
        
        // 1. 装备 + 装备
        if (i1.type !== 'book' && i2.type !== 'book') {
            let baseQ = Math.max(i1.quality, i2.quality);
            let upgradeChance = (i1.quality === i2.quality) ? 0.35 : 0.10;
            let finalQ = (Math.random() < upgradeChance) ? Math.min(5, baseQ + 1) : baseQ;
            
            let targetType = Math.random() < 0.5 ? i1.type : i2.type;
            let targetNameBase = Math.random() < 0.5 ? (i1.name.split('·')[1] || i1.name) : (i2.name.split('·')[1] || i2.name);
            
            let prefix = ITEM_PREFIXES[Math.min(ITEM_PREFIXES.length - 1, Math.floor(Math.random() * (finalQ + 2)))];
            let fullName = (finalQ > baseQ ? "灵铸·" : "") + prefix + "·" + targetNameBase;

            let mult = (finalQ + 1) * (1 + player.realmLevel * 0.1) * 1.5; 
            let atk = 0, def = 0, hp = 0, crit = 0, dodge = 0;

            switch(targetType) {
                case "weapon": atk = Math.floor(22 * mult); if(finalQ >= 3) crit = finalQ * 2 + 2; break;
                case "subweapon": atk = Math.floor(12 * mult); if(finalQ >= 3) crit = Math.floor(finalQ * 2.5 + 2); break;
                case "armor": def = Math.floor(10 * mult); if(finalQ >= 3) hp = Math.floor(50 * mult); break;
                case "helm": def = Math.floor(6 * mult); hp = Math.floor(40 * mult); break;
                case "ring": hp = Math.floor(80 * mult); if(finalQ >= 3) dodge = Math.min(75, Math.floor(finalQ * 1.5 + 1)); break;
                case "artifact": atk = Math.floor(10 * mult); def = Math.floor(6 * mult); hp = Math.floor(60 * mult); if(finalQ >= 4) { crit = finalQ; dodge = finalQ; } break;
            }
            
            resultItem = {
                id: "it_" + Date.now(), name: fullName, type: targetType, quality: finalQ,
                atk: atk, def: def, hp: hp, crit: crit, dodge: dodge,
                price: Math.floor(cost * 2.5)
            };
        } 
        // 2. 秘籍 + 秘籍
        else if (i1.type === 'book' && i2.type === 'book') {
            let isHH = (i1.payload.isHongHuang || i2.payload.isHongHuang) ? (Math.random() < 0.4) : false; 
            
            if (isHH) {
                let hhSkill = { 
                    id: "sk_hh_" + Date.now(), name: "融合·混沌诀", type: "passive", level: 1, isHongHuang: true, 
                    desc: "【洪荒法则】最高修炼至 100 重。每重洪荒之力+1%，五维暴增2%。", price: 380000 
                };
                resultItem = { name: `禁忌秘籍·《${hhSkill.name}》`, type: "book", payload: hhSkill, price: hhSkill.price };
            } else {
                let generated = generateSkillByMatrix();
                generated.name = "绝世·" + generated.name;
                generated.power = generated.power ? parseFloat((generated.power * 1.5).toFixed(1)) : 0;
                if(generated.hp) generated.hp *= 2; if(generated.atk) generated.atk *= 2;
                resultItem = { name: `秘籍·《${generated.name}》`, type: "book", payload: generated, price: Math.floor(generated.price * 1.5) };
            }
        }
        // 3. 装备 + 秘籍 (附魔)
        else {
            let gear = i1.type !== 'book' ? i1 : i2;
            let book = i1.type === 'book' ? i1 : i2;
            
            resultItem = JSON.parse(JSON.stringify(gear));
            resultItem.id = "it_" + Date.now();
            resultItem.name = "附魔·" + resultItem.name;
            resultItem.quality = Math.min(5, resultItem.quality + 1); 
            
            let p = book.payload;
            if(p.hp) resultItem.hp = (resultItem.hp || 0) + p.hp * 5;
            if(p.atk) resultItem.atk = (resultItem.atk || 0) + p.atk * 5;
            if(p.def) resultItem.def = (resultItem.def || 0) + p.def * 5;
            if(p.dodge) resultItem.dodge = (resultItem.dodge || 0) + p.dodge;
            if(p.crit) resultItem.crit = (resultItem.crit || 0) + p.crit;
            if(p.type === 'active' && p.power) {
                resultItem.atk = (resultItem.atk || 0) + Math.floor(p.power * 100);
                resultItem.crit = (resultItem.crit || 0) + 2;
            }
            resultItem.price += book.price;
        }

        forgeItems = [null, null];
        player.bag.push(resultItem);
        document.getElementById('global-tooltip').style.display = 'none';
        renderForge(); renderBag(); updatePlayerAttributes(); saveGame();

        alert(`⚡ 洪炉轰鸣！消耗 ${cost} 文碎银，成功炼制出：【${resultItem.name}】！`);
    }

    function renderBag() {
        let grid = document.getElementById('bag-grid'); grid.innerHTML = "";
        for (let i = 0; i < player.bagMax; i++) {
            let item = player.bag[i]; let slot = document.createElement('div'); slot.className = "item-slot";
            if (item) {
                if (item.payload && item.payload.isHongHuang) slot.classList.add(`q-hh`);
                else if (item.quality !== undefined) slot.classList.add(`q-${item.quality}`);
                slot.innerHTML = `<b>${item.name.split('·')[1]?.substring(0,5) || item.name.substring(0,5)}</b><br><span style="color:#555;font-size:9px;">${item.type==='book'?'书':'装'}</span>`;
                slot.setAttribute('data-tip', JSON.stringify(item));
                slot.onclick = () => { document.getElementById('global-tooltip').style.display = 'none'; useBagItem(i); };
            } else {
                slot.innerHTML = "<span style='color:#1a1a1a'>.</span>";
            }
            grid.appendChild(slot);
        }
        document.getElementById('bag-count').innerText = player.bag.length;
    }

    function smeltByQuality(qualitiesList, nameLabel) {
        let beforeCount = player.bag.length; if(beforeCount === 0) return;
        let remain = []; let goldGained = 0;
        player.bag.forEach(it => {
            if (it.quality !== undefined && qualitiesList.includes(it.quality) && it.type !== "book") { goldGained += it.price; } 
            else { remain.push(it); }
        });
        if(player.bag.length === remain.length) { alert("没有符合条件的装备可熔炼。"); return; }
        player.bag = remain; player.coin += goldGained;
        renderBag(); updatePlayerAttributes(); saveGame();
        alert(`成功熔炼 ${nameLabel}，获得碎银 ${goldGained} 文。`);
    }

    function smeltAllItems() {
        let gearCount = player.bag.filter(it => it.type !== "book").length; if (gearCount === 0) { alert("行囊中没有可熔炼的装备。"); return; }
        if (confirm(`确定熔炼行囊中全部 ${gearCount} 件装备吗？秘籍会自动保留。`)) {
            let remain = []; let goldGained = 0;
            player.bag.forEach(it => { if (it.type !== "book") goldGained += it.price; else remain.push(it); });
            player.bag = remain; player.coin += goldGained;
            renderBag(); updatePlayerAttributes(); saveGame();
            alert(`破釜沉舟完毕，共获得碎银 ${goldGained} 文。`);
        }
    }

    function useBagItem(idx) {
        let item = player.bag[idx]; if (!item) return;

        let action = prompt(`【${item.name}】\n请输入操作数字：\n1. 披挂上身 / 参悟绝学\n2. 投入天地洪炉 (参与合成)\n3. 熔炼换取 ${item.price} 碎银`, "1");
        
        if (action === "2") {
            if (forgeItems[0] === null) { forgeItems[0] = item; player.bag.splice(idx, 1); } 
            else if (forgeItems[1] === null) { forgeItems[1] = item; player.bag.splice(idx, 1); } 
            else { alert("天地洪炉已满，请先取出炉中物品或开始融合！"); return; }
            renderForge(); renderBag(); saveGame();
        } else if (action === "3") {
            player.coin += item.price; player.bag.splice(idx, 1);
            renderBag(); updatePlayerAttributes(); saveGame();
            alert(`成功熔炼，获得碎银 ${item.price} 文。`);
        } else if (action === "1") {
            if (item.type !== "book") {
                let old = player.equips[item.type]; player.equips[item.type] = item;
                if(old) player.bag[idx] = old; else player.bag.splice(idx, 1);
            } else {
                if(player.skills.find(s => s.name === item.payload.name)) { alert("你早已对此门武学烂熟于心。"); return; }
                player.skills.push(item.payload); player.bag.splice(idx, 1);
                alert(`✨ 成功参悟绝学：《${item.payload.name}》！`); renderPlayerSkills();
            }
            renderBag(); updatePlayerAttributes(); saveGame();
        }
    }

    function unequip(slot) {
        if (!player.equips[slot]) return;
        if (player.bag.length >= player.bagMax) return;
        player.bag.push(player.equips[slot]); player.equips[slot] = null;
        renderBag(); updatePlayerAttributes();
    }

    function renderPlayerSkills() {
        let box = document.getElementById('player-skills-box'); box.innerHTML = "";
        player.skills.forEach((sk, index) => {
            let card = document.createElement('div'); card.className = "list-card";
            let isHH = sk.isHongHuang;
            
            let maxLevel = isHH ? 100 : 10;
            let cost = isHH ? (sk.level * 12000) : (sk.level * 800); 
            
            let eff = "";
            if (isHH) {
                card.style.border = "1px solid rgba(255,51,102,0.3)";
                eff = `<span style="color:var(--color-honghuang)">当前引发老区长的洪荒之力 +${sk.level}% （五维核心属性总量增幅 +${sk.level * 2}%）</span>`;
            } else if (sk.type === "active") {
                eff = `主战招式：造成 ${(sk.power + (sk.level * 0.15)).toFixed(1)} 倍爆发伤害。`;
            } else {
                eff = `功法被动：气血+${sk.hp*sk.level} 攻击+${sk.atk*sk.level} 防御+${sk.def*sk.level}`;
            }
            
            card.innerHTML = `<div><strong class="${isHH?'q-hh':''}">《${sk.name}》 <span style="color:var(--color-gold);">[第${sk.level}/${maxLevel}重]</span></strong><br><small style="color:var(--text-muted)">${eff}</small></div><button class="btn" ${sk.level >= maxLevel ? 'disabled' : ''} onclick="upgradePlayerSkill(${index})">${sk.level >= maxLevel ? '已至化境' : `潜心研习(耗${formatNumber(cost)}修为)`}</button>`;
            box.appendChild(card);
        });
    }

    function upgradePlayerSkill(idx) {
        let sk = player.skills[idx]; 
        let isHH = sk.isHongHuang;
        let maxLevel = isHH ? 100 : 10;
        let cost = isHH ? (sk.level * 12000) : (sk.level * 800);

        if(sk.level >= maxLevel) return;
        if(player.exp < cost) { alert("研习所需修为不足！"); return; }
        
        player.exp -= cost; sk.level++; 
        alert(`【突破】《${sk.name}》精进至第【${sk.level}】重！`);
        renderPlayerSkills(); updatePlayerAttributes(); saveGame();
    }

    function switchPage(pageId) {
        document.getElementById('global-tooltip').style.display = 'none'; 
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`page-${pageId}`).classList.add('active');
        event.currentTarget.classList.add('active');
        if (pageId === 'role' || pageId === 'bag') updatePlayerAttributes();
        if (pageId === 'kungfu') renderPlayerSkills();
        if (pageId === 'shop') renderShopGoods(); 
        if (pageId === 'adventure') renderMapList();
        if (pageId === 'bag') renderForge();
    }
