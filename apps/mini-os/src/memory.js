// =============================================================
// memory.js - メモリ管理・First Fitアロケーション
//
// メモリを100単位の1次元配列として管理する
// 各ブロックは { start, size, pid }
// pid === null なら空きブロック
// =============================================================

const MEMORY_SIZE = 100; // 全体のサイズ (単位)

// メモリブロック配列
let memoryBlocks = [{ start: 0, size: MEMORY_SIZE, pid: null }];

// アロケーション
// returns: { start, size}
// error: null
function allocate(pid, size) {
    for (let i = 0; i < memoryBlocks.length; i++) {
        const block = memoryBlocks[i];

        // 空きブロックかつサイズが足りるか判定
        if (block.pid === null && block.size >= size) {
            const remaining = block.size - size;

            if (remaining === 0) {
                // ちょうど同じサイズなら差し替え
                memoryBlocks[i] = { start: block.start, size, pid };
            } else {
                // 割り当てブロック + 残り空きブロックに分割
                memoryBlocks.splice(i, 1, 
                    { start: block.start       , size           , pid },
                    { start: block.start + size, size: remaining, pid: null}
                );
            }
            return { start: block.start, size };
        }
    }
    return null; // メモリ不足
}

// メモリの解放
function free(pid) {
    const block = memoryBlocks.find(b => b.pid === pid);
    if (!block) return false;

    block.pid = null;
    mergeAdjacentFreeBlocks();
    return true;
}

// 隣接する空きブロックを結合する
function mergeAdjacentFreeBlocks() {
    let i = 0;
    while (i < memoryBlocks.length - 1) {
        const cur  = memoryBlocks[i];
        const next = memoryBlocks[i + 1];
        if (cur.pid === null && next.pid === null) {
            memoryBlocks.splice(i, 2, {
                start: cur.start,
                size: cur.size + next.size,
                pid: null,
            });
        } else {
            i++;
        }
    }
}

// コンパクション
function compact() {
    const used = memoryBlocks.filter(b => b.pid != null);
    const totalFree = memoryBlocks
        .filter(b => b.pid === null)
        .reduce((sum, b) => sum + b.size, 0);

    // プロセスを先頭から詰めなおす
    let cursor = 0;
    const newBlocks = used.map(b => {
        const block = { start: cursor, size: b.size, pid: b.pid };
        cursor += b.size;
        return block;
    });

    // 末尾に空き領域を追加
    if (totalFree > 0) {
        newBlocks.push({ start: cursor, size: totalFree, pid: null });
    }

    memoryBlocks = newBlocks;
    return memoryBlocks;
}

// ユーティリティ
function getFreeSize() {
    return memoryBlocks
        .filter(b => b.pid === null)
        .reduce((sum, b) => sum + b.size, 0);
}

function getUsedSize() {
    return MEMORY_SIZE - getFreeSize();
}

function getBlocks() {
    return memoryBlocks.map(b => ({ ...b }));
}

function resetMemory() {
    memoryBlocks = [{ start: 0, size: MEMORY_SIZE, pid: null }];
}