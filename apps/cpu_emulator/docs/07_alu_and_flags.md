# ALU and Flags (演算とフラグ)

## ALU

`ALU (Arithmetic Logic Unit)` は CPU の計算を担当する部分である

このプロジェクトで実装予定の演算
- ADD (加算)
- DEC (デクリメント)

---

## Flags

`Flags` は演算結果に関する状態を記録するビット

- Z (Zero flag) 結果が0なら1, それ以外は0
  - 条件分岐などの判断に使用

---

## 実行例

### カウントダウンループ

```
A = 5 から始める

loop:
PRINTA
DEC_A
JZ end
JMP loop
end:
HALT

5 -> 4 -> 3 -> 2 -> 1 -> 0 と出力して停止する
```