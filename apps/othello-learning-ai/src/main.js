// src/main.js
import {
  BLACK, WHITE,
  createInitialBoard,
  getGameStatus,
  applyMove,
  countPieces,
} from "./othello.js";

let board = createInitialBoard();
let player = BLACK;

const $board = document.getElementById("board");
const $status = document.getElementById("status");
document.getElementById("reset").addEventListener("click", () => {
  board = createInitialBoard();
  player = BLACK;
  render();
});

function render() {
  $board.innerHTML = "";

  const st = getGameStatus(board, player);

  // status text
  const { black, white, empty } = countPieces(board);
  const turn = player === BLACK ? "Black" : "White";
  if (st.type === "PLAY") {
    $status.textContent = `Turn: ${turn} | Black ${black} - White ${white} | Empty ${empty}`;
  } else if (st.type === "PASS") {
    $status.textContent = `Pass: ${turn} cannot move. Next: ${st.nextPlayer === BLACK ? "Black" : "White"}`;
    // 自動パス
    player = st.nextPlayer;
    // パス後に即再描画
    setTimeout(render, 0);
    return;
  } else {
    const w =
      st.winner === BLACK ? "Black wins" :
      st.winner === WHITE ? "White wins" :
      "Draw";
    $status.textContent = `Game Over | ${w} | Black ${st.black} - White ${st.white}`;
  }

  // draw board
  // 合法手ヒント
  const legalSet = new Set();
  if (st.type === "PLAY") {
    for (const m of st.legalMoves) legalSet.add(`${m.x},${m.y}`);
  }

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      const v = board[y][x];
      if (v === BLACK || v === WHITE) {
        const d = document.createElement("div");
        d.className = `disc ${v === BLACK ? "black" : "white"}`;
        cell.appendChild(d);
      } else if (legalSet.has(`${x},${y}`) && st.type === "PLAY") {
        const hint = document.createElement("div");
        hint.className = "hint";
        cell.appendChild(hint);
      }

      cell.addEventListener("click", () => {
        if (st.type !== "PLAY") return;
        const nx = Number(cell.dataset.x);
        const ny = Number(cell.dataset.y);
        const nb = applyMove(board, nx, ny, player);
        if (!nb) return; // illegal
        board = nb;
        player = -player;
        render();
      });

      $board.appendChild(cell);
    }
  }
}

render();
