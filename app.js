const rows = [
  "2 / 1","4 / 2","9 / 3","12 / 4","15 / 5","18 / 6",
  "1º TOTAL","BÔNUS (+30 se ≥ 60)","2º TOTAL",
  "20 Q","30 F","35 S-","40 S+","X MIN","X MAX","50 YAM",
  "3º TOTAL",
  "2º + 3º TOTAL"
];
const COLUNAS = 4;

// Classes de cada linha (cor da seção e linha grossa no fim de cada bloco).
const CLASSES_LINHA = {
  5: "numeros fim-secao",
  6: "total",
  7: "total",
  8: "total fim-secao",
  15: "combos fim-secao",
  16: "total",
  17: "total-forte"
};

function classesDaLinha(i) {
  if (CLASSES_LINHA[i]) return CLASSES_LINHA[i];
  return i < 6 ? "numeros" : "combos";
}

// Explicação de cada linha e coluna, mostrada ao tocar no nome.
const LEGENDA_LINHAS = [
  ["Uns (1)", "Some os dados que caíram 1. Referência: 2 pontos."],
  ["Dois (2)", "Some os dados que caíram 2. Referência: 4 pontos."],
  ["Três (3)", "Some os dados que caíram 3. Referência: 9 pontos."],
  ["Quatros (4)", "Some os dados que caíram 4. Referência: 12 pontos."],
  ["Cincos (5)", "Some os dados que caíram 5. Referência: 15 pontos."],
  ["Seis (6)", "Some os dados que caíram 6. Referência: 18 pontos."],
  ["1º total", "Soma das seis linhas de cima. As referências somam 60, o necessário para o bônus."],
  ["Bônus", "Ganha 30 pontos se o 1º total for 60 ou mais."],
  ["2º total", "1º total + bônus."],
  ["Q – Quadra", "Quatro dados iguais. Vale 20 + a soma dos quatro (ex.: quatro 5 = 40)."],
  ["F – Full", "Uma trinca e um par (ex.: 3-3-3-5-5). Vale 30 + a soma dos dados."],
  ["S- – Sequência menor", "1-2-3-4-5. Vale 35 + 15 = 50."],
  ["S+ – Sequência maior", "2-3-4-5-6. Vale 40 + 20 = 60."],
  ["X MIN – Mínimo", "Soma dos cinco dados, tentando fazer o menor valor. Precisa ser menor que o X MAX da coluna."],
  ["X MAX – Máximo", "Soma dos cinco dados, tentando fazer o maior valor. Precisa ser maior que o X MIN da coluna."],
  ["YAM", "Os cinco dados iguais. Vale 50 + a soma dos dados (ex.: cinco 6 = 80)."],
  ["3º total", "Soma das linhas de Quadra até YAM."],
  ["2º + 3º total", "Total da coluna."]
];

const LEGENDA_COLUNAS = {
  "MPB": ["MPB", "Nome de cada jogada. Toque em uma linha para ver o que ela significa."],
  "↓": ["↓ – Descida", "Preencha de cima para baixo, na ordem. A casa da vez fica destacada. Para riscar, digite 0 (aparece —): pode em qualquer casa."],
  "↑": ["↑ – Subida", "Começa depois de terminar a descida, de baixo para cima, na ordem. Para riscar, digite 0 (aparece —): pode em qualquer casa."],
  "D": ["D – Desordem", "Preencha em qualquer ordem."],
  "S": ["S – Seca", "Vale só o que sair na primeira jogada dos dados."]
};

let timerLegenda = null;
let ultimoAviso = 0;

// tipo: "" (legenda), "aviso" (casa fora da vez) ou "erro" (valor recusado).
function mostrarLegenda([titulo, texto], tipo = "") {
  const caixa = document.getElementById("legenda");
  caixa.querySelector("strong").textContent = titulo;
  caixa.querySelector("span").textContent = texto;
  caixa.classList.toggle("erro", tipo === "erro");
  caixa.classList.toggle("aviso", tipo === "aviso");
  caixa.hidden = false;
  clearTimeout(timerLegenda);
  timerLegenda = setTimeout(() => { caixa.hidden = true; }, tipo ? 7000 : 5000);
}

// ---------- valores possíveis ----------

const intervalo = (de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);
const FACES = intervalo(1, 6);

// Full: trinca de um valor + par de outro, 30 + soma dos cinco dados.
const SOMAS_FULL = [...new Set(
  FACES.flatMap(a => FACES.filter(b => b !== a).map(b => 30 + 3 * a + 2 * b))
)].sort((x, y) => x - y);

// Lista de valores aceitos em cada linha (0 = riscado).
function valoresPossiveis(linha) {
  if (linha <= 5) {
    const face = linha + 1;
    return intervalo(0, 5).map(qtd => qtd * face);
  }
  switch (linha) {
    case 9:  return [0, ...FACES.map(f => 20 + 4 * f)];  // Quadra
    case 10: return [0, ...SOMAS_FULL];                  // Full
    case 11: return [0, 50];                             // Sequência menor
    case 12: return [0, 60];                             // Sequência maior
    case 13:                                             // X MIN
    case 14: return [0, ...intervalo(5, 30)];            // X MAX
    case 15: return [0, ...FACES.map(f => 50 + 5 * f)];  // YAM
  }
  return null;
}

function descreverValores(lista) {
  return lista.length > 12
    ? `${lista[0]}, ou de ${lista[1]} a ${lista[lista.length - 1]}`
    : lista.join(", ");
}

// ---------- ordem da descida (↓) e da subida (↑) ----------

// Linhas em que se marca ponto, de cima para baixo (sem os totais).
const LINHAS_JOGO = [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15];
const COL_DESCIDA = 0;
const COL_SUBIDA = 1;

const preenchida = (linha, col) => (state[`${linha}-${col}`] ?? "") !== "";

// Próxima casa a jogar numa coluna com ordem, ou null se a coluna acabou.
function proximaCasa(col) {
  if (col === COL_DESCIDA) {
    return LINHAS_JOGO.find(l => !preenchida(l, COL_DESCIDA)) ?? null;
  }
  if (col === COL_SUBIDA) {
    if (proximaCasa(COL_DESCIDA) !== null) return null; // descida ainda não acabou
    return [...LINHAS_JOGO].reverse().find(l => !preenchida(l, COL_SUBIDA)) ?? null;
  }
  return null;
}

// Se marcar ponto (diferente de 0) nesta casa quebra a ordem, diz o motivo e
// qual é a casa certa ({ motivo, certa: "linha-coluna" }); senão null.
// Riscar (0) pode em qualquer casa, a qualquer hora.
function problemaDeOrdem(linha, col) {
  if (col === COL_DESCIDA) {
    const anterior = LINHAS_JOGO.slice(0, LINHAS_JOGO.indexOf(linha)).find(l => !preenchida(l, col));
    if (anterior !== undefined) {
      return {
        motivo: `A descida (↓) é preenchida de cima para baixo, e ainda falta ${rows[anterior]}.`,
        certa: `${anterior}-${COL_DESCIDA}`
      };
    }
  }
  if (col === COL_SUBIDA) {
    const faltaDescida = proximaCasa(COL_DESCIDA);
    if (faltaDescida !== null) {
      return {
        motivo: `A subida (↑) só começa depois que a descida (↓) termina, e na descida ainda falta ${rows[faltaDescida]}.`,
        certa: `${faltaDescida}-${COL_DESCIDA}`
      };
    }
    const abaixo = LINHAS_JOGO.slice(LINHAS_JOGO.indexOf(linha) + 1).reverse().find(l => !preenchida(l, col));
    if (abaixo !== undefined) {
      return {
        motivo: `A subida (↑) é preenchida de baixo para cima, e ainda falta ${rows[abaixo]}.`,
        certa: `${abaixo}-${COL_SUBIDA}`
      };
    }
  }
  return null;
}

function nomeDaCasa(key) {
  const [linha, col] = key.split("-").map(Number);
  return `${rows[linha]} na ${col === COL_DESCIDA ? "descida (↓)" : "subida (↑)"}`;
}

// Mensagem de casa fora da vez. `aoTocar`: a pessoa só tocou na casa (ainda
// pode riscar); senão, tentou marcar ponto e o valor foi recusado.
function mensagemDeOrdem(problema, aoTocar) {
  const fim = aoTocar
    ? "Aqui você só pode riscar (digite 0)."
    : "Para pular uma casa, risque com 0.";
  return ["Não é a vez desta casa", `${problema.motivo} Preencha em ${nomeDaCasa(problema.certa)}. ${fim}`, problema.certa];
}

// Faz a casa certa piscar e, se estiver fora da tela, rola até ela.
function piscarCasa(key) {
  const td = body.querySelector(`[data-key="${key}"]`);
  if (!td) return;
  td.classList.remove("piscar");
  void td.offsetWidth; // reinicia a animação
  td.classList.add("piscar");
  td.scrollIntoView({ block: "nearest", behavior: "smooth" });
  setTimeout(() => td.classList.remove("piscar"), 1600);
}

// Destaca a próxima casa da descida e da subida, e põe ✓ na coluna terminada.
function marcarProximas() {
  body.querySelectorAll("td.proxima").forEach(td => td.classList.remove("proxima"));
  const cabecalhos = document.querySelectorAll("#tela-jogo thead th");
  const descidaAcabou = proximaCasa(COL_DESCIDA) === null;

  for (const col of [COL_DESCIDA, COL_SUBIDA]) {
    const linha = proximaCasa(col);
    if (linha !== null) body.querySelector(`[data-key="${linha}-${col}"]`).classList.add("proxima");
    const completa = linha === null && (col === COL_DESCIDA || descidaAcabou);
    cabecalhos[col + 1].classList.toggle("completa", completa);
  }
}

const RISCO = "—";

// Texto mostrado na casa: vazio, o número, ou "—" quando riscada (valor 0).
function exibir(valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  return Number(valor) === 0 ? RISCO : String(Number(valor));
}

// Marca as casas riscadas (valor 0) para ficarem com visual próprio.
function marcarRiscados(tbody, valores) {
  tbody.querySelectorAll("td[data-key]").forEach(td => {
    const v = valores[td.dataset.key];
    td.classList.toggle("riscado", v !== undefined && v !== "" && Number(v) === 0);
  });
}

// Devolve a mensagem de erro, ou null se o valor pode ficar.
function validar(key, texto) {
  if (texto === "") return null;

  const [linha, col] = key.split("-").map(Number);
  const nome = rows[linha];
  const valor = Number(texto);
  const possiveis = valoresPossiveis(linha);

  if (!Number.isInteger(valor) || !possiveis.includes(valor)) {
    let msg = `Valores possíveis: ${descreverValores(possiveis)}.`;
    if (linha === 10) msg = `Valores possíveis: 0 ou um destes: ${SOMAS_FULL.join(", ")}.`;
    return [`${valor} não vale em ${nome}`, msg];
  }

  if (valor !== 0) {
    const problema = problemaDeOrdem(linha, col);
    if (problema) return mensagemDeOrdem(problema, false);
  }

  if ((linha === 13 || linha === 14) && valor !== 0) {
    const outraLinha = linha === 13 ? 14 : 13;
    const outro = Number(state[`${outraLinha}-${col}`]) || 0;
    if (outro !== 0) {
      const min = linha === 13 ? valor : outro;
      const max = linha === 14 ? valor : outro;
      if (max <= min) {
        return [`${valor} não vale em ${nome}`, `Nesta coluna o X MAX precisa ser maior que o X MIN (MIN = ${min}, MAX = ${max}).`];
      }
    }
  }

  return null;
}

document.addEventListener("click", evento => {
  const alvo = evento.target;
  const linha = alvo.closest("tbody td.mpb");
  const coluna = alvo.closest("thead th");

  if (linha) {
    mostrarLegenda(LEGENDA_LINHAS[Number(linha.dataset.linha)]);
  } else if (coluna) {
    const legenda = LEGENDA_COLUNAS[coluna.textContent.trim()];
    if (legenda) mostrarLegenda(legenda);
  } else if (!alvo.closest("#legenda") && Date.now() - ultimoAviso > 600) {
    // (um toque fora da casa dispara o aviso de erro; não fecha esse mesmo aviso)
    document.getElementById("legenda").hidden = true;
  }
});

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
    tr.className = classesDaLinha(rowIndex);

    const tdLabel = document.createElement("td");
    tdLabel.className = "mpb";
    tdLabel.dataset.linha = rowIndex;
    tdLabel.textContent = label;
    tr.appendChild(tdLabel);

    for (let col = 0; col < COLUNAS; col++) {
      const key = `${rowIndex}-${col}`;
      const td = document.createElement("td");
      td.dataset.key = key;

      if (!calculada && editavel) {
        // Campo de texto com teclado numérico: permite mostrar o risco como "—"
        // e limitar a 2 dígitos (o maior valor possível é 80).
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 2;
        input.autocomplete = "off";
        input.value = exibir(valores[key]);

        // Ao tocar, seleciona o conteúdo: digitar já substitui o valor ou o risco.
        // Se não é a vez desta casa (↓ ou ↑), já avisa o motivo e mostra a certa.
        input.addEventListener("focus", () => {
          input.select();
          const [linha, col] = key.split("-").map(Number);
          const problema = input.value === "" ? problemaDeOrdem(linha, col) : null;
          if (!problema) {
            // tocou numa casa permitida: tira o aviso de ordem que estiver aberto
            const caixa = document.getElementById("legenda");
            if (caixa.classList.contains("aviso")) caixa.hidden = true;
            return;
          }
          ultimoAviso = Date.now();
          mostrarLegenda(mensagemDeOrdem(problema, true), "aviso");
          piscarCasa(problema.certa);
        });

        input.addEventListener("input", () => {
          const limpo = input.value.replace(/\D/g, "");
          if (limpo !== input.value) input.value = limpo;
          update(key, limpo);
        });

        // Ao terminar de digitar (sair da casa): apaga se for impossível;
        // senão guarda o número sem zeros à esquerda e mostra 0 como "—".
        input.addEventListener("change", () => {
          const erro = validar(key, input.value);
          if (erro) {
            input.value = "";
            update(key, "");
            ultimoAviso = Date.now();
            mostrarLegenda(erro, "erro");
            if (erro[2]) piscarCasa(erro[2]);
            return;
          }
          if (input.value === "") return;
          const numero = String(Number(input.value));
          input.value = exibir(numero);
          update(key, numero);
        });
        td.appendChild(input);
      } else if (!calculada) {
        td.textContent = exibir(valores[key]);
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
  marcarRiscados(tbody, valores);
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
  marcarProximas();
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

// ---------- tema claro / escuro ----------

const sistemaEscuro = window.matchMedia("(prefers-color-scheme: dark)");

function temaAtual() {
  const escolhido = document.documentElement.dataset.theme;
  if (escolhido === "light" || escolhido === "dark") return escolhido;
  return sistemaEscuro.matches ? "dark" : "light";
}

function atualizarBotaoTema() {
  const escuro = temaAtual() === "dark";
  document.getElementById("botao-tema").setAttribute("aria-checked", escuro);
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.content = escuro ? "#121212" : "#1f3a5f";
  });
}

function alternarTema() {
  const novo = temaAtual() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem("yam-tema", novo); } catch {}
  atualizarBotaoTema();
}

sistemaEscuro.addEventListener("change", atualizarBotaoTema);
atualizarBotaoTema();

buildTable();
