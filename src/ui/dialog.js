// ============================================================
// UI 弹窗：toast 提示 + 异步 confirm + 多选 choose。
// 替代原生 alert / confirm / prompt（原生会冻结整个事件循环，
// 这里用 Promise，挂机等定时器不再被阻塞）。自带样式，无需改 HTML。
// ============================================================

function ensureLayer(id, styles) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        Object.assign(el.style, styles);
        document.body.appendChild(el);
    }
    return el;
}

// —— 轻提示（非阻塞，2.2 秒后淡出）——
export function toast(msg, type = 'info') {
    const layer = ensureLayer('toast-layer', {
        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
        zIndex: '10000', display: 'flex', flexDirection: 'column', gap: '8px',
        alignItems: 'center', pointerEvents: 'none'
    });
    const colors = { info: 'var(--color-gold)', success: 'var(--color-success)', error: 'var(--color-accent)' };
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
        background: 'rgba(12,12,12,0.97)', color: '#fff',
        border: `1px solid ${colors[type] || colors.info}`, borderRadius: '6px',
        padding: '10px 18px', fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
        maxWidth: '480px', textAlign: 'center', opacity: '0', transition: 'opacity 0.2s'
    });
    layer.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 250);
    }, 2200);
}

// —— 通用模态：返回所点按钮的 value（遮罩/Esc = null）——
function openModal(title, message, buttons) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            zIndex: '10001', background: 'rgba(5,5,5,0.7)',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const box = document.createElement('div');
        Object.assign(box.style, {
            background: '#161616', border: '1px solid var(--color-gold)', borderRadius: '8px',
            padding: '24px 28px', maxWidth: '420px', textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
        });

        if (title) {
            const h = document.createElement('div');
            h.textContent = title;
            Object.assign(h.style, { color: 'var(--color-gold)', fontSize: '17px', fontWeight: 'bold', marginBottom: '12px' });
            box.appendChild(h);
        }
        if (message) {
            const m = document.createElement('div');
            m.innerHTML = message;
            Object.assign(m.style, { color: '#ccc', fontSize: '14px', lineHeight: '1.7', marginBottom: '20px' });
            box.appendChild(m);
        }

        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' });

        const onKey = (e) => { if (e.key === 'Escape') close(null); };
        function close(val) {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            resolve(val);
        }

        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'btn ' + (b.cls || '');
            btn.textContent = b.label;
            btn.onclick = () => close(b.value);
            row.appendChild(btn);
        });
        box.appendChild(row);
        overlay.appendChild(box);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
    });
}

// —— 异步确认框：返回 true/false ——
export function confirmDialog(message, title = '请确认') {
    return openModal(title, message, [
        { label: '确定', value: true, cls: 'btn-success' },
        { label: '取消', value: false }
    ]).then(v => v === true);
}

// —— 多选操作框：options=[{label,value,cls}]，返回所选 value 或 null ——
export function chooseAction(title, message, options) {
    return openModal(title, message, [...options, { label: '取消', value: null }]);
}

// —— 信息弹窗：富文本 message（innerHTML）+ 单个确认按钮（如离线收益「欢迎回来」）——
export function infoDialog(message, title = '', btnLabel = '好') {
    return openModal(title, message, [{ label: btnLabel, value: true, cls: 'btn-success' }]);
}

// —— 卡片式多选（百世轮回：命格 / 轮回遗产 / 奇遇事件 三选一/多选）——
// cards: [{ title, desc, value, cls?, disabled?, tag?, locked? }]；intro 为顶部富文本说明（innerHTML）。
// opts.cancelLabel：给出则附一个取消按钮(返回 null)；不给则为「必须抉择」(无法点遮罩/Esc 取消)。
// 返回所选 value；取消(若允许) 返回 null。样式自带，复用既有 .btn 配色变量，无需改 CSS。
export function chooseCard(title, intro, cards, opts = {}) {
    const cancelable = typeof opts.cancelLabel === 'string';
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', zIndex: '10001', background: 'rgba(5,5,5,0.78)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxSizing: 'border-box'
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            background: '#161616', border: '1px solid var(--color-gold)', borderRadius: '10px',
            padding: '22px 22px 18px', maxWidth: '560px', width: '100%', maxHeight: '88vh', overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9)', boxSizing: 'border-box'
        });
        if (title) {
            const h = document.createElement('div');
            h.textContent = title;
            Object.assign(h.style, { color: 'var(--color-gold)', fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px', textAlign: 'center', marginBottom: '10px' });
            box.appendChild(h);
        }
        if (intro) {
            const p = document.createElement('div');
            p.innerHTML = intro;
            Object.assign(p.style, { color: '#bbb', fontSize: '13px', lineHeight: '1.7', textAlign: 'center', marginBottom: '16px' });
            box.appendChild(p);
        }

        const onKey = (e) => { if (cancelable && e.key === 'Escape') close(null); };
        function close(val) { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(val); }

        cards.forEach(c => {
            const card = document.createElement('button');
            card.className = 'choice-card ' + (c.cls || '');
            card.disabled = !!c.disabled;
            Object.assign(card.style, {
                display: 'block', width: '100%', textAlign: 'left', cursor: c.disabled ? 'not-allowed' : 'pointer',
                background: c.disabled ? '#101010' : '#101820', color: '#ddd',
                border: '1px solid ' + (c.disabled ? '#2a2a2a' : 'var(--border-color)'),
                borderRadius: '8px', padding: '12px 14px', marginBottom: '10px', transition: 'all 0.12s',
                opacity: c.disabled ? '0.5' : '1'
            });
            const tag = c.tag ? `<span style="float:right;font-size:11px;color:var(--color-gold);font-weight:bold;">${c.tag}</span>` : '';
            const lock = c.locked ? `<span style="float:right;font-size:11px;color:var(--color-accent);">🔒 ${c.locked}</span>` : '';
            card.innerHTML =
                `<div style="font-weight:bold;font-size:15px;color:var(--color-gold);margin-bottom:4px;">${c.title}${tag}${lock}</div>` +
                `<div style="font-size:12px;color:#aaa;line-height:1.6;">${c.desc || ''}</div>`;
            if (!c.disabled) {
                card.onmouseenter = () => { card.style.borderColor = 'var(--color-gold)'; card.style.background = '#16222c'; };
                card.onmouseleave = () => { card.style.borderColor = 'var(--border-color)'; card.style.background = '#101820'; };
                card.onclick = () => close(c.value);
            }
            box.appendChild(card);
        });

        if (cancelable) {
            const row = document.createElement('div');
            Object.assign(row.style, { textAlign: 'center', marginTop: '6px' });
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = opts.cancelLabel;
            btn.onclick = () => close(null);
            row.appendChild(btn);
            box.appendChild(row);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        }
        document.addEventListener('keydown', onKey);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}
