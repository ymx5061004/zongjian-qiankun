// ============================================================
// 平衡模拟·Node CLI（方案 B，零依赖）。复用 dev/sim-core.mjs 的纯逻辑，控制台输出表格。
// 运行：  node scripts/balance-sim.mjs            （全部）
//        node scripts/balance-sim.mjs enemy      （仅敌人曲线）
//        node scripts/balance-sim.mjs path 20    （第20关流派对比）
//        node scripts/balance-sim.mjs offline mine_iron
// 不引入任何 npm 依赖；不被正式游戏(index.html)加载。
// ============================================================
import {
    enemyCurve, powerCurve, pathComparison, rewardCurve, offlineEstimate,
    incomeComparison, newbie30min, SAMPLE_STAGES
} from '../dev/sim-core.js';

const arg = process.argv.slice(2);
const cmd = arg[0] || 'all';
const p1 = arg[1];

function title(t) { console.log('\n' + '═'.repeat(64) + '\n  ' + t + '\n' + '═'.repeat(64)); }

function runEnemy() { title('① 关卡 → 敌人属性曲线（1~100 采样）'); console.table(enemyCurve()); }
function runPower() { title('② 推荐配置下玩家战力曲线'); console.table(powerCurve()); }
function runReward() { title('⑤ 每场胜利奖励（按 BALANCE.reward + 词缀再推导）'); console.table(rewardCurve()); }
function runPath(stage) {
    const s = Number(stage) || 20;
    const { reborn, rows } = pathComparison(s);
    title(`③④ 第 ${s} 关·5 流派胜率对比（自动调参基线~50% → 轮回×${reborn}；各 300 场·含地图词缀）`);
    console.table(rows);
}
function runOffline(actId) {
    title('⑥ 离线收益（生产·封顶 12h）');
    console.table(offlineEstimate(actId || 'mine_copper'));
    title('⑥ 离线 vs 在线 同轴(矿/时)对比');
    [5, 20, 50].forEach(s => console.log(JSON.stringify(incomeComparison(s), null, 0)));
}
function runNewbie() { title('新手前 30 分钟·粗略投影'); console.log(newbie30min()); }

switch (cmd) {
    case 'enemy': runEnemy(); break;
    case 'power': runPower(); break;
    case 'reward': runReward(); break;
    case 'path': runPath(p1); break;
    case 'offline': runOffline(p1); break;
    case 'newbie': runNewbie(); break;
    case 'all':
    default:
        runNewbie();
        runEnemy();
        runPower();
        runReward();
        runPath(20);
        runPath(50);
        runOffline('mine_copper');
        title('完毕');
        console.log('提示：node scripts/balance-sim.mjs path <关卡> 可单独看某关流派对比；也可用 dev/balance-sim.html 在浏览器跑。');
        break;
}
