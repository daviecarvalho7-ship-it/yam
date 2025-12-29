const rows = [
  "2 / 1","4 / 2","9 / 3","12 / 4","15 / 5","18 / 6",
  "1º TOTAL","BÔNUS (+30 se ≥ 60)","2º TOTAL",
  "20 Q","30 F","35 S-","40 S+","X MIN","X MAX","50 YAM",
  "3º TOTAL",
  "2º + 3º TOTAL"
];

let state = JSON.parse(localStorage.getItem("yam")) || {};
const body = document.getElementById("tableBody");

function buildTable() {
  body.innerHTML = "";

  rows.forEach((label, rowIndex) => {
    const tr = document.createElement("tr");

    if (label.includes("TOTAL") || label.includes("BÔNUS")) {
      tr.classList.add("block");
    }

    tr.innerHTML = `<td class="mpb">${label}</td>`;

    for (let col = 0; col < 4; col++) {
      const key = `${rowIndex}-${col}`;

      if (label.includes("TOTAL") || label.includes("BÔNUS")) {
        tr.innerHTML += `<td id="${key}">0</td>`;
      } else {
        tr.innerHTML += `
          <td>
            <input type="number"
              value="${state[key] || ''}"
              oninput="update('${key}', this.value)">
          </td>`;
      }
    }

    body.appendChild(tr);
  });

  calcular();
}

function update(key, value) {
  state[key] = value;
  salvar();
  calcular();
}

function somaColuna(col, inicio, fim) {
  let total = 0;
  for (let i = inicio; i <= fim; i++) {
    total += Number(state[`${i}-${col}`]) || 0;
  }
  return total;
}

function calcular() {
  let totalGeral = 0;

  for (let col = 0; col < 4; col++) {
    const total1 = somaColuna(col, 0, 5);
    const bonus = total1 >= 60 ? 30 : 0;
    const total2 = total1 + bonus;
    const total3 = somaColuna(col, 9, 15);
    const total23 = total2 + total3;

    document.getElementById(`6-${col}`).innerText = total1;
    document.getElementById(`7-${col}`).innerText = bonus;
    document.getElementById(`8-${col}`).innerText = total2;
    document.getElementById(`16-${col}`).innerText = total3;
    document.getElementById(`17-${col}`).innerText = total23;

    totalGeral += total23;
  }

  document.getElementById("total-geral-final").innerText = totalGeral;
}

function salvar() {
  localStorage.setItem("yam", JSON.stringify(state));
}

function novoJogo() {
  if (confirm("Deseja zerar a pontuação?")) {
    state = {};
    salvar();
    buildTable();
  }
}

buildTable();
