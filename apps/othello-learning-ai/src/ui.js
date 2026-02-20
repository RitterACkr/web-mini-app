// NN 可視化
const nnCanvas = document.getElementById("nn-canvas");

// レイヤー構成 (ノード数)
// 入力は192次元だと多すぎるので代表として16個を表示
const NN_LAYERS = [16, 128, 64, 64];
const LAYER_LABELS = ["Input", "Hidden 1", "Hidden 2", "Output"];

function drawNetwork(canvas, activations = null) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = "0e1520";
    ctx.fillRect(0, 0, W, H);

    const layerCount = NN_LAYERS.length;
    const padX = 60;
    const padY = 40;

    // 各レイヤーのx座標
    const xs = NN_LAYERS.map((_, i) => padX + (i / (layerCount - 1)) * (W - padX * 2));

    // 各レイヤーのノードy座標を計算
    // 表示ノード数の上限を決定
    const MAX_NODES = 12;
    const nodeYs = NN_LAYERS.map((n, i) => {
        const display = Math.min(n, MAX_NODES);
        return Array.from({ length: display }, (_, j) => {
            return padY + (j / (display - 1 || 1)) * (H - padY * 2);
        });
    });

    // エッジを描画
    for (let l = 0; l < layerCount - 1; l++) {
        for (const y1 of nodeYs[l]) {
            for (const y2 of nodeYs[l + 1]) {
                ctx.beginPath();
                ctx.moveTo(xs[l], y1);
                ctx.lineTo(xs[l + 1], y2);
                ctx.strokeStyle = "rgba(42, 122, 140, 0.15)";
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    // ノードを描画
    NN_LAYERS.forEach((n, l) => {
        const display = Math.min(n, MAX_NODES);
        nodeYs[l].forEach((y, j) => {
            ctx.beginPath();
            ctx.arc(xs[l], y, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#2a7a8c";
            ctx.fill();
            ctx.strokeStyle = "#5bb8c9";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // 省略記号
        if (n > MAX_NODES) {
            ctx.fillStyle = "#7a79aaa";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("...", xs[l], H / 2);
        }

        // レイヤーラベル
        ctx.fillStyle = "#7a9aaa";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(LAYER_LABELS[l], xs[l], H - 8);
        ctx.fillText(`(${n})`, xs[l], H - 20);
    });
}

// 初期描画
drawNetwork(nnCanvas);