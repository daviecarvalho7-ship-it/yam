const rows = [
  "2 / 1","4 / 2","9 / 3","12 / 4","15 / 5","18 / 6",
  "1º TOTAL","BÔNUS (+30 se ≥ 60)","2º TOTAL",
  "20 Q","30 F","35 S-","40 S+","X MIN","X MAX","50 YAM",
  "3º TOTAL",
  "2º + 3º TOTAL"
];
const COLUNAS = 4;

const CHAVE_JOGO = "yam";
const CHAVE_HISTORICO = "yam-historico";

let state = ler(CHAVE_JOGO, {});
let historico = ler(CHAVE_HISTORICO, []);
let partidaAberta = null;

// ---------- armazenamento ----------

function ler(chave, padrao) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || padrao;
  } catch {
    return padrao;
  }
}

function salvar() {
  localStorage.setItem(CHAVE_JOGO, JSON.stringify(state));
}

function salvarHistorico() {
  localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
}

// ---------- cálculo ----------

function ehLinhaCalculada(label) {
  return label.includes("TOTAL") || label.includes("BÔNUS");
}

function somaColuna(valores, col, inicio, fim) {
  let total = 0;
  for (let i = inicio; i <= fim; i++) {
    total += Number(valores[`${i}-${col}`]) || 0;
  }
  return total;
}

// Devolve os valores das linhas calculadas ({ "6-0": 45, ... }) e o total geral.
function calcularTotais(valores) {
  const calculados = {};
  let geral = 0;

  for (let col = 0; col < COLUNAS; col++) {
    const total1 = somaColuna(valores, col, 0, 5);
    const bonus = total1 >= 60 ? 30 : 0;
    const total2 = total1 + bonus;
    const total3 = somaColuna(valores, col, 9, 15);
    const total23 = total2 + total3;

    calculados[`6-${col}`] = total1;
    calculados[`7-${col}`] = bonus;
    calculados[`8-${col}`] = total2;
    calculados[`16-${col}`] = total3;
    calculados[`17-${col}`] = total23;
    geral += total23;
  }

  return { calculados, geral };
}

function partidaTemValores(valores) {
  return Object.values(valores).some(v => v !== "" && v != null);
}

// ---------- tabela ----------

// Monta a tabela dentro de `tbody`. Se `editavel`, as casas viram campos de digitação.
function montarTabela(tbody, valores, editavel) {
  tbody.innerHTML = "";

  rows.forEach((label, rowIndex) => {
    const tr = document.createElement("tr");
    const calculada = ehLinhaCalculada(label);
    if (calculada) tr.classList.add("block");

    const tdLabel = document.createElement("td");
    tdLabel.className = "mpb";
    tdLabel.textContent = label;
    tr.appendChild(tdLabel);

    for (let col = 0; col < COLUNAS; col++) {
      const key = `${rowIndex}-${col}`;
      const td = document.createElement("td");
      td.dataset.key = key;

      if (!calculada && editavel) {
        const input = document.createElement("input");
        input.type = "number";
        input.inputMode = "numeric";
        input.value = valores[key] ?? "";
        input.addEventListener("input", () => update(key, input.value));
        td.appendChild(input);
      } else if (!calculada) {
        td.textContent = valores[key] ?? "";
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });
}

function atualizarTotais(tbody, totalCell, valores) {
  const { calculados, geral } = calcularTotais(valores);
  for (const [key, valor] of Object.entries(calculados)) {
    tbody.querySelector(`[data-key="${key}"]`).textContent = valor;
  }
  totalCell.textContent = geral;
}

// ---------- jogo atual ----------

const body = document.getElementById("tableBody");
const totalGeral = document.getElementById("total-geral-final");

function buildTable() {
  montarTabela(body, state, true);
  calcular();
}

function calcular() {
  atualizarTotais(body, totalGeral, state);
}

function update(key, value) {
  state[key] = value;
  salvar();
  calcular();
}

function novoJogo() {
  const temValores = partidaTemValores(state);
  const mensagem = temValores
    ? "Salvar esta partida no histórico e começar um novo jogo?"
    : "Começar um novo jogo?";

  if (!confirm(mensagem)) return;

  if (temValores) {
    historico.unshift({
      id: Date.now(),
      data: new Date().toISOString(),
      total: calcularTotais(state).geral,
      valores: state
    });
    salvarHistorico();
  }

  state = {};
  salvar();
  buildTable();
}

// ---------- telas ----------

const telas = ["tela-jogo", "tela-historico", "tela-partida"];

function mostrarTela(id) {
  telas.forEach(t => { document.getElementById(t).hidden = t !== id; });
  window.scrollTo(0, 0);
}

function formatarData(iso) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ---------- histórico ----------

function abrirHistorico() {
  const lista = document.getElementById("lista-historico");
  const resumo = document.getElementById("resumo-historico");
  lista.innerHTML = "";

  if (historico.length === 0) {
    resumo.hidden = true;
    const vazio = document.createElement("li");
    vazio.className = "vazio";
    vazio.textContent = "Nenhuma partida salva ainda. Ao tocar em \"Novo Jogo\", a partida atual é guardada aqui.";
    lista.appendChild(vazio);
  } else {
    const totais = historico.map(p => p.total);
    const recorde = Math.max(...totais);
    const media = Math.round(totais.reduce((a, b) => a + b, 0) / totais.length);

    resumo.hidden = false;
    document.getElementById("qtd-partidas").textContent = historico.length;
    document.getElementById("recorde").textContent = recorde;
    document.getElementById("media").textContent = media;

    historico.forEach(partida => {
      const li = document.createElement("li");
      const botao = document.createElement("button");
      botao.className = "item-historico";

      const data = document.createElement("span");
      data.textContent = formatarData(partida.data);
      const total = document.createElement("strong");
      total.textContent = `${partida.total} pts`;
      if (partida.total === recorde) total.textContent += " 🏆";

      botao.append(data, total);
      botao.addEventListener("click", () => abrirPartida(partida.id));
      li.appendChild(botao);
      lista.appendChild(li);
    });
  }

  mostrarTela("tela-historico");
}

function abrirPartida(id) {
  partidaAberta = historico.find(p => p.id === id);
  if (!partidaAberta) return;

  document.getElementById("titulo-partida").textContent = formatarData(partidaAberta.data);
  const tbody = document.getElementById("tableBody-partida");
  montarTabela(tbody, partidaAberta.valores, false);
  atualizarTotais(tbody, document.getElementById("total-geral-partida"), partidaAberta.valores);

  mostrarTela("tela-partida");
}

function excluirPartida() {
  if (!partidaAberta) return;
  if (!confirm("Excluir esta partida do histórico? Não dá para desfazer.")) return;

  historico = historico.filter(p => p.id !== partidaAberta.id);
  salvarHistorico();
  partidaAberta = null;
  abrirHistorico();
}

buildTable();
