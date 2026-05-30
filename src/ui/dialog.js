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
