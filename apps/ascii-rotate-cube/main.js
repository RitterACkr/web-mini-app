const out = document.getElementById("out");
const elScale = document.getElementById("scale");
const scaleVal = document.getElementById("scaleVal");

const chars = " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

// 固定解像度
let W = 120, H = 60;


let Z = new Float32Array(W * H);
let S = new Array(W * H);

const CELL_W_PX = 8;
const CELL_H_PX = 12;

let paused = false;

// ==========================
// 基本処理
// ==========================
function clearBuffers() {
    Z.fill(-1e9);
    S.fill(" ");
}

function putPixel(x, y, z, lum) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    if (z > Z[i]) {
        Z[i] = z;
        const idx = Math.max(0, Math.min(chars.length - 1, (lum * (chars.length - 1)) | 0));
        S[i] = chars[idx];
    }
}

// 回転
function rotX([x, y, z], a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [x, y * c - z * s, y * s + z * c];
}
function rotY([x, y, z], a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [x * c + z * s, y, -x * s + z * c];
}
function rotZ([x, y, z], a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c, z];
}

function normalize([x, y, z]) {
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
}

function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function project([x, y, z]) {
    // カメラからの距離
    const camDist = 5.0;

    const scale = parseFloat(elScale.value);

    const zz = z + camDist;
    if (zz <= 0.1) return null;

    const invZ = 1.0 / zz;
    const f = scale * invZ;

    const sx = (x * f * W * 0.5 + W * 0.5) | 0;
    const sy = (-y * f * W * 0.5 + H * 0.5) | 0;

    return [sx, sy, invZ, camDist];
}

function render(t)  {
    clearBuffers();

    const size = 1.0;
    const step = 0.10;

    // 光方向
    const L = normalize([0.3, 0.6, -1.0]);

    const ax = t * 0.6;
    const ay = t * 1.0;
    const az = t * 0.3;

    for (let u = -size; u <= size; u += step) {
        for (let v = -size; v <= size; v += step) {
            // 6面 (点, 法線)
            const faces = [
                [[ size, u, v], [ 1, 0, 0]],
                [[-size, u, v], [-1, 0, 0]],
                [[ u, size, v], [ 0, 1, 0]],
                [[ u,-size, v], [ 0,-1, 0]],
                [[ u, v, size], [ 0, 0, 1]],
                [[ u, v,-size], [ 0, 0,-1]],
            ];

            for (const [p0, n0] of faces) {
                // 回転
                let p = rotZ(rotY(rotX(p0, ax), ay), az);
                let n = rotZ(rotY(rotX(n0, ax), ay), az);

                const nN = normalize(n);

                // 投影
                const pr = project(p);
                if (!pr) continue;
                const [sx, sy, invZ, camDist] = pr;

                // バックフェイスカリング
                const viewDir = normalize([0 - p[0], 0 - p[1], (-camDist) - p[2]]);
                if (dot(nN, viewDir) <= 0) continue;

                // Lambert (0~1) + Ambient
                const lum = Math.max(0, dot(nN, viewDir)) * 0.85 + 0.15;

                putPixel(sx, sy, invZ, lum);
            }
        }
    }

    // <pre> に流し込み
    let text = "";
    for (let y = 0; y < H; y++) {
        text += S.slice(y * W, (y + 1) * W).join("") + "\n";
    }
    out.textContent = text;
}


let t = 0;
let last = performance.now();
let fps = 0;
function loop() {
    const now = performance.now();
    fps = 1000 / (now - last);
    last = now;

    if (!paused) {
        t += 0.02;
        render(t);
        out.textContent += `\nFPS: ${fps.toFixed(1)}`
    }
    requestAnimationFrame(loop);
}
loop();


// ==========================
// キー操作
// ==========================

window.addEventListener("keydown", (e) => {
    if (e.code === "Space") paused = !paused;
});