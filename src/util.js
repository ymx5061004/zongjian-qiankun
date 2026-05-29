// ============================================================
// 通用纯工具函数（无副作用、不碰 DOM）。
// ============================================================

// 大数字中文缩写：万 / 亿 / 万亿
export function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + '万亿';
    if (num >= 1e8) return (num / 1e8).toFixed(2) + '亿';
    if (num >= 1e4) return (num / 1e4).toFixed(1) + '万';
    return num;
}
