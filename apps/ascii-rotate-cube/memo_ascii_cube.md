# ASCII Rotate Cube

## 概要

- HTML + JS + CSS のみでASCII文字で3Dキューブを表現
- 回転 / ライティング (反射光 + 環境光) をシミュレート

## 全体構造
```
index.html
├ style.css
└ main.js
```
役割
|ファイル|役割|
|----|----|
|index.html|UI構造|
|style.css|色 / フォント / レイアウト|
|main.js|3D描画 / ライティング / ASCII変換|


## Rendering Flow
```
3D点生成
 ↓
回転 (Rotation)
 ↓
投影 (Perspective projection)
 ↓
Backface Culling
 ↓
Z-buffer
 ↓
Lighting (Lambert + Ambient)
 ↓
ASCII文字の選択
 ↓
<pre>に出力
```

### ASCII Shading
```js
const chars = " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
```
- 使用文字を 暗い → 明るい の順に並べて表面に使用

### 画面バッファ構造
```js
let W = 120, H = 60;

let Z = new Float32Array(W * H);
let S = new Array(W * H);
```
|変数|意味|
|----|----|
|Z|Z-buffer用|
|S|Surface用|

```js
// index
i = y * W + x
```

## 数学的側面

### 座標系
**`右手系`**
```
      Y+
      ↑
      |
      |
      +------→ X+
     /
    /
   Z+
```

---

### 回転
線形変換による3D回転を実装

ベクトル `v = (x, y, z)` を回転行列 _R_ によって変換
```
v' = R * v
```

#### X軸回転
```matlab
y' = y cosθ − z sinθ
z' = y sinθ + z cosθ
x' = x

|1   0      0|
|0 cosθ −sinθ|
|0 sinθ  cosθ|
```

#### Y軸回転
```matlab
x' = x cosθ + z sinθ
z' = -x sinθ + z cosθ
y' = y

| cosθ   0   sinθ |
|  0     1    0   |
|−sinθ   0   cosθ |
```

#### Z軸回転
```matlab
x' = x cosθ − y sinθ
y' = x sinθ + y cosθ
z' = z

| cosθ  −sinθ   0 |
| sinθ   cosθ   0 |
|  0       0    1 |
```

### 回転の合成
```
v' = Rz Ry Rx v
```

---

### 投影 (Perspective Projection)
3D → 2D への変換
```js
// カメラ
camera = (0, 0, -d)
screen = z = 0

// 点
P = (x, y, z)
```
投影点は相似三角形より
```js
const zz = z + camDist;
const invZ = 1.0 / zz;

sx = x * invZ
sy = y * invZ
// invZを使う理由は
// 除算削減による "高速化"
```

---

### Backface Culling
面の法線 `n` とカメラ方向 `v`
```
dot(n,v) > 0
→ cosθ > 0
→ 角度が90度より小さい
→ カメラを向いている
```

---

### Lighting
```
brightness = dot(normal, lightDir)
→ cosθ
→ Θ: 光と面との角度
```
`Lambert` : 反射光

`Ambient` : 環境光

