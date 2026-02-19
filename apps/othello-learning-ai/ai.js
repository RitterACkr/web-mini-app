// 入力: 8x8x3 (自分の石・相手の石・合法手) = 192 dimensions
// 出力: 64マス分のQ値

function createModel() {
    const model = tf.sequential();

    // 入力層 -> 隠れ層1
    model.add(tf.layers.dense({
        inputShape: [192],
        units: 128,
        activation: "relu"
    }));

    // 隠れ層2
    model.add(tf.layers.dense({
        units: 64,
        activation: "relu"
    }));

    // 出力層
    model.add(tf.layers.dense({
        units: 64,
        activation: "linear"
    }));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: "meanSquaredError"
    });

    return model;
}

// 動作確認
const model = createModel();
model.summary();
console.log("NNモデル作成");