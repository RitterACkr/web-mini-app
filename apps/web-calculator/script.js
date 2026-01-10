let tokens = ["0"];

const OPS = new Set(["+", "−", "×", "÷"]);

const formula = document.querySelector(".formula");
const predict = document.querySelector(".prediction");

// 数字かどうか
function isNumberToken(t) {
    return t != null && !isNaN(t);
}

// 演算子かどうか
function isOp(t) {
    return OPS.has(t);
}

// トークンの最後尾を取得
function lastToken() {
    return tokens[tokens.length - 1];
}

// トークンの最後尾を置き換え
function replaceLast(t) {
    tokens[tokens.length - 1] = t;
}

// トークンを数式(文字列)化
function exprString() {
    return tokens.join("");
}

// === Init ===
function init() {
    render();
    document.querySelector(".calc-btns").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        onButtonClick(btn.innerText.trim());
    });
}

// === Input ===
function inputDigit(d) {
    const last = lastToken();

    // 初期状態ならそのまま代入
    if (tokens.length === 1 && last === "0") {
        replaceLast(d);
        return;
    }

    if (isNumberToken(last)) {
        replaceLast(last + d);
    } else {
        tokens.push(d);
    }
}

function inputDot() {
    const last = lastToken();

    if (isNumberToken(last)) {
        if (last.includes(".")) return; // 最後が.なら変更なしで終了
        replaceLast(last + ".");
        return;
    }

    tokens.push("0.");
}

function inputOperator(op) {
    const last = lastToken();

    // −の場合のみ 先頭となる場合は 負を表現するとして特別に追加
    if (tokens.length === 1 && last === "0") {
        if (op === "−") tokens = ["−"];
        return;
    }

    // トークンの最後尾が演算子なら上書き
    if (isOp(last)) {
        replaceLast(op);
        return;
    }

    // -の場合のみ "(" の後であるなら 負を表す表現として特別に追加
    if (last === "(") {
        if (op === "−") tokens.push("−");
        return;
    }

    // 最後尾が数字 or ")" or "%" であるなら通常通りの追加
    if (isNumberToken(last) || last === ")" || last === "%") {
        tokens.push(op);
    }
}

// "(" の ペアになり損ねた場合 の数をカウントする inputParenToggle() 用ヘルパー
function countOpenParens() {
    let count = 0;
    for (const t of tokens) {
        if (t === "(") count++;
        else if (t === ")") count--;
    }
    return count;
}

function inputParenToggle() {
    const last = lastToken();
    const open = countOpenParens();

    // 最後尾が "(" or 演算子 or 初期状態 であれば"("を配置可能
    const canOpen =
        last === "(" || isOp(last) || (tokens.length === 1 && last === "0");

    // 最後尾が 数字 or ")" or "%" であり, "(" の未ペアが存在する場合")"を配置可能
    const canClose =
        open > 0 && (isNumberToken(last) || last === ")" || last === "%");

    if (canOpen) {
        // 初期状態ならそのまま代入
        if (tokens.length === 1 && last === "0") tokens = ["("];
        else tokens.push("(");
        return;
    }

    if (canClose) {
        tokens.push(")");
        return;
    }
}

function inputPercent() {
    const last = lastToken();
    if (isNumberToken(last) || last === ")") {
        if (lastToken() === "%") return;
        tokens.push("%");
    }
}

// === Handle ===
function allClear() {
    tokens = ["0"];
}

function backspace() {
    const last = lastToken();

    if (tokens.length === 1) {
        tokens = ["0"];
        return;
    }

    if (isNumberToken(last)) {
        const trim = last.slice(0, -1);
        if (trim === "" || trim === "−") {
            tokens.pop();
        } else {
            replaceLast(trim);
        }
    } else {
        tokens.pop();
    }

    if (tokens.length === 0) tokens = ["0"];
}

function commitEqual() {
    const expr = exprString();
    const predicted = tryEvaluate(expr);
    if (predicted != null) tokens = [String(predicted)];
}


// === Button Dispatcher ===
function onButtonClick(value) {
    if (!isNaN(value)) {
        inputDigit(value);
    } else {
        switch (value) {
            case "AC":
                allClear();
                break;
            case "C":
                backspace();
                break;
            case ".":
                inputDot();
                break;
            case "()":
                inputParenToggle();
                break;
            case "=":
                commitEqual();
                break;
            
            case "+":
            case "−":
            case "×":
            case "÷":
                inputOperator(value);
                break;

            case "%":
                inputPercent();
                break;

            default:
                // ここに到達することは想定では無し
                break;

        }
    }

    render();
}


// === Render ===
function render() {
    const expr = exprString();
    formula.innerText = expr;
    console.log(tokens);

    // 予測表示 (今は未使用)
    const predicted = tryEvaluate(expr);
    if (predicted != null) {
        predict.innerText = String(predicted);
        predict.style.visibility = "visible";
        predict.setAttribute("aria-hidden", "false");
    } else {
        predict.innerText = "";
        predict.style.visibility = "hidden";
        predict.setAttribute("aria-hidden", "true");
    }
}


// === Safely predict ===
// tryEvaluate() のヘルパー
function canPredict(tokens) {
    if (tokens.length === 0) return false;

    const ops = new Set(["+", "−", "×", "÷"]);

    // 最後が演算子 or "(" なら未完成
    const last = tokens[tokens.length - 1];
    if (ops.has(last) || last === "(") return false;

    // 括弧のバランス
    let balance = 0;
    for (const t of tokens) {
        if (t === "(") balance++;
        if (t === ")") balance--;
        if (balance < 0) return false;
    }
    if (balance !== 0) return false;

    return true;
}

// === prediction / evaluation wrapper ===
function tryEvaluate(expr) {
    try {
        const tokens = tokenize(expr);

        if (!canPredict(tokens)) return null;

        const value = evaluateTokens(tokens);
        const rounded = Math.round(value * 1e12) / 1e12;
        return rounded;
    } catch {
        return null;
    }
}

// === Calculate ===

/**
 * 式をトークンに分割する. =を押したときに確認
 * @param {string} expr 数式の文字列
 * @returns {string[]} トークンの配列
 */
function tokenize(expr) {
    const out = [];
    let num = "";

    // 数字をoutに追加するヘルパー関数
    const pushNum = () => {
        if (num !== "") {
            out.push(num);
            num = "";
        }
    };

    // 式の文字を1文字ずつ処理して適切なタイミングでoutに追加
    for (const ch of expr) {
        // 数(または.)が続く場合はまとめる
        if ((ch >= "0" && ch <= "9") || ch === ".") {
            num += ch;
            continue;
        }
        if (ch === " ") continue;

        // 演算子・括弧
        if (ch === "+" || ch === "−" || ch === "×" || ch === "÷" || ch === "%" || ch === "(" || ch === ")") {
            pushNum();
            out.push(ch);
            continue;
        }

        if (ch === "%") {
            pushNum();
            out.push("%");
            continue;
        }

        throw new Error(`Invalid char: ${ch}`);
    }

    pushNum();
    return tokens;
}

/**
 * トークン配列を再帰下降法で評価する
 * expression -> term -> factor
 * expression = term + term
 * term = factor × factor
 * factor = number | (expression)
 * @param {string[]} tok トークンの配列
 * @returns {number} 評価結果
 */
function evaluateTokens(tok) {
    let i = 0;

    const peek = () => tok[i];
    const next = () => tok[i++];

    const expect = (t) => {
        if (peek() !== (t)) throw new Error(`Expected ${t}, got ${peek()}`);
        next();
    };

    // expression := term (("+" | "-") term)*
    function parseExpression() {
        let value = parseTerm();
        while (peek() === "+" || peek() === "−") {
            const op = next();
            const rhs = parseTerm();
            value = op === "+" ? value + rhs : value - rhs;
        }
        return value;
    }

    // term := factor (("×" | "÷") factor)*
    function parseTerm() {
        let value = parseFactor();
        while (peek() === "×" || peek() === "÷") {
            const op = next();
            const rhs = parseFactor();
            if (op === "×") value *= rhs;
            else {
                if (rhs === 0) throw new Error("Division by zero");
                value /= rhs;
            }
        }
        return value;
    }

    // factor := number | "(" expression ")" | ("+" | "-") factor
    function parseFactor() {
        const t = peek();

        // 単項
        if (t === "+" || t === "−") {
            const op = next();
            const v = parseFactor();
            return op === "−" ? -v : v;
        }

        // 括弧
        if (t === "(") {
            next();
            const v = parseExpression();
            expect(")");
            return v;
        }

        // 数値
        if (t == null) throw new Error("Unexpected end");
        if (!isNaN(t)) {
            next();
            const num = Number(t);
            if (!Number.isFinite(num)) throw new Error(`Invalid number: ${t}`);
            value = num;
        } else {
            throw new Error(`Unexpected token: ${t}`);
        }

        // %
        while (peek() === "%") {
            next();
            value = value / 100;
        }

        return value;
    }

    const result = parseExpression();

    // 余りのトークンがある場合はエラー
    if (i !== tok.length) {
        throw new Error(`Unexpected token: ${tok[i]}`);
    }

    return result;
}


init();