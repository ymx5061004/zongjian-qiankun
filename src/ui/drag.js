// ============================================================
// 拖拽层：用 Pointer Events 实现「背包↔洪炉槽」「炉槽↔炉槽」的拖拽，鼠标 + 触摸通吃。
// 不走 HTML5 原生拖拽（手机不支持、且 main.js 已全局禁用 dragstart）。
// 触摸用「长按」触发，避免与 96 格背包的上下滚动冲突；轻点/快滑保持原有点按与滚动行为。
// 落地逻辑在 actions（dropBagToForge / swapForge / removeFromForge），这里只管手势与演出。
// ============================================================
import { state } from '../state.js';
import { hideTooltip, renderBag } from './render.js';
import { dropBagToForge, swapForge, removeFromForge } from '../actions.js';

const LONGPRESS_MS = 280; // 触摸：按住多久进入拖拽
const TOUCH_CANCEL = 10;  // 触摸：长按前移动超过此距离判定为"滚动"，放弃拖拽
const MOUSE_START = 5;    // 鼠标：移动超过此距离即开始拖拽（与点按区分）

let candidate = null;    // 按下后、尚未确定是点按还是拖拽的候选
let drag = null;         // 进行中的拖拽
let suppressClick = false;

// 命中可拖拽元素：填充的背包格 / 有物品的炉槽
function getDraggable(target) {
    if (!(target instanceof Element)) return null;
    const bagSlot = target.closest('#bag-grid .item-slot[data-act="use-bag"]');
    if (bagSlot) return { type: 'bag', idx: Number(bagSlot.dataset.idx), node: bagSlot };
    const forgeSlot = target.closest('#forge-slot-0, #forge-slot-1');
    if (forgeSlot && state.forgeItems[Number(forgeSlot.dataset.idx)]) {
        return { type: 'forge', idx: Number(forgeSlot.dataset.idx), node: forgeSlot };
    }
    return null;
}

// 当前指针下的合法落点
function resolveDropTarget(x, y) {
    const el = document.elementFromPoint(x, y); // ghost 设了 pointer-events:none，不会挡住命中
    if (!el) return null;
    const forge = el.closest('#forge-slot-0, #forge-slot-1');
    if (forge) {
        const idx = Number(forge.dataset.idx);
        if (drag.type === 'forge' && idx === drag.idx) return null; // 拖到自己身上不算
        return { kind: 'forge', idx, node: forge };
    }
    if (drag.type === 'forge' && el.closest('#bag-grid')) {
        return { kind: 'bag', node: document.getElementById('bag-grid') }; // 炉中物拖回背包 = 取出
    }
    return null;
}

function setHighlight(target) {
    const node = target ? target.node : null;
    if (drag.highlightNode === node) return;
    if (drag.highlightNode) drag.highlightNode.classList.remove('drop-target');
    if (node) node.classList.add('drop-target');
    drag.highlightNode = node;
}

function startDrag() {
    if (!candidate) return;
    const c = candidate;
    if (c.timer) clearTimeout(c.timer);
    candidate = null;

    drag = { type: c.type, idx: c.idx, node: c.node, pointerId: c.pointerId, target: null, highlightNode: null };
    hideTooltip();
    document.body.classList.add('dragging-active');
    c.node.classList.add('drag-source');

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    c.node.classList.forEach(cls => { if (cls.startsWith('q-')) ghost.classList.add(cls); }); // 沿用品阶配色
    ghost.innerHTML = c.node.innerHTML;
    document.body.appendChild(ghost);
    drag.ghost = ghost;

    try { c.node.setPointerCapture(drag.pointerId); } catch (e) { /* 个别环境不支持，忽略 */ }
    moveDrag(c.curX, c.curY);
}

function moveDrag(x, y) {
    drag.ghost.style.left = x + 'px';
    drag.ghost.style.top = y + 'px';
    drag.target = resolveDropTarget(x, y);
    setHighlight(drag.target);
}

function endDrag() {
    if (drag.ghost) drag.ghost.remove();
    if (drag.highlightNode) drag.highlightNode.classList.remove('drop-target');
    if (drag.node) drag.node.classList.remove('drag-source');
    try { drag.node.releasePointerCapture(drag.pointerId); } catch (e) { /* 忽略 */ }
    document.body.classList.remove('dragging-active');
    drag = null;
}

function clearCandidate() {
    if (candidate && candidate.timer) clearTimeout(candidate.timer);
    candidate = null;
}

function onPointerDown(e) {
    if (drag || candidate) return;
    suppressClick = false; // 新交互开始，清掉上一次拖拽可能残留的抑制标志，避免误吞这次的真实点击
    const d = getDraggable(e.target);
    if (!d) return;
    candidate = {
        type: d.type, idx: d.idx, node: d.node, pointerId: e.pointerId,
        isTouch: e.pointerType !== 'mouse',
        startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, timer: null
    };
    if (candidate.isTouch) candidate.timer = setTimeout(startDrag, LONGPRESS_MS); // 触摸：长按才拖
    // 鼠标：等移动超阈值再拖（见 onPointerMove）
}

function onPointerMove(e) {
    if (drag) {
        if (e.pointerId === drag.pointerId) moveDrag(e.clientX, e.clientY);
        return;
    }
    if (!candidate || e.pointerId !== candidate.pointerId) return;
    candidate.curX = e.clientX; candidate.curY = e.clientY;
    const dist = Math.hypot(e.clientX - candidate.startX, e.clientY - candidate.startY);
    if (candidate.isTouch) {
        if (dist > TOUCH_CANCEL) clearCandidate(); // 长按前就滑动 = 想滚列表，放弃拖拽
    } else if (dist > MOUSE_START) {
        startDrag();
    }
}

function onPointerUp(e) {
    if (candidate && e.pointerId === candidate.pointerId) { clearCandidate(); return; } // 没起拖拽 = 点按，放行 click
    if (!drag || e.pointerId !== drag.pointerId) return;

    const target = drag.target;
    const { type, idx } = drag;
    endDrag();
    suppressClick = true; // 抑制拖拽后浏览器补发的 click（否则会误触发点按弹窗）
    setTimeout(() => { suppressClick = false; }, 60);

    if (!target) { renderBag(); return; } // 落空：补刷一次背包，显示拖拽期间被延迟的挂机掉落
    if (type === 'bag' && target.kind === 'forge') dropBagToForge(idx, target.idx);
    else if (type === 'forge' && target.kind === 'forge') { swapForge(idx, target.idx); renderBag(); }
    else if (type === 'forge' && target.kind === 'bag') removeFromForge(idx);
    else renderBag();
}

function onPointerCancel(e) {
    if (candidate && e.pointerId === candidate.pointerId) { clearCandidate(); return; }
    if (drag && e.pointerId === drag.pointerId) { endDrag(); renderBag(); } // 取消也补刷被延迟的掉落
}

// 拖拽进行中（供 battle.js 在挂机掉落时跳过 renderBag，避免销毁拖拽源节点）
export function isDragging() { return drag !== null; }

export function initDragDrop() {
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    // 拖拽中阻止触摸滚动（长按起拖时手指本是静止的，此时 preventDefault 可有效拦下滚动）
    document.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
    // 抢在事件委托(冒泡阶段)之前吃掉拖拽尾随的 click
    document.addEventListener('click', e => {
        if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
    }, true);
}
