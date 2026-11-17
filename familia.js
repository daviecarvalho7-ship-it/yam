// Partida em família: cada um joga no próprio celular e os placares só
// aparecem para todos quando o último jogador termina (pódio).
// Usa Firebase (login anônimo + Realtime Database).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, get, update, remove, onValue, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Configuração do projeto "yam-familia". Não é segredo: o que protege o banco
// são as regras de segurança configuradas no console do Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyAG_-doO1gG3E_y6eKmAf51ez1luLLTLOM",
  authDomain: "yam-familia.firebaseapp.com",
  databaseURL: "https://yam-familia-default-rtdb.firebaseio.com",
  projectId: "yam-familia",
  storageBucket: "yam-familia.firebasestorage.app",
  messagingSenderId: "71560505019",
  appId: "1:71560505019:web:bc0e4f91bc25638ebeeb9e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const CHAVE_SESSAO = "yam-familia";   // { codigo, chave } da partida em família atual
let sessao = lerSessao();
let partida = null;                    // último estado recebido do banco
let pararEscuta = null;
let ultimoEnvio = "";
let podioMostrado = false;

// ---------- utilidades ----------

function lerSessao() {
  try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO)); } catch { return null; }
}

function guardarSessao(s) {
  sessao = s;
  if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
  else localStorage.removeItem(CHAVE_SESSAO);
}

// "Daví  Carvalho" e "davi carvalho" viram a mesma chave: nomes não podem repetir.
function chaveDoNome(nome) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ").replace(/[.#$[\]/]/g, "_");
}

async function usuario() {
  if (auth.currentUser) return auth.currentUser;
  await new Promise(pronto => { const parar = onAuthStateChanged(auth, () => { parar(); pronto(); }); });
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}

function mensagemDeErro(erro) {
  const texto = String((erro && (erro.code || erro.message)) || erro);
  if (/permission/i.test(texto)) return "O banco recusou o acesso. Confira se as regras do Firebase foram publicadas.";
  if (/network|offline|unavailable/i.test(texto)) return "Sem conexão. A sala precisa de internet.";
  return (erro && erro.message) || "Algo deu errado. Tente de novo.";
}

const jogadoresDe = p => Object.entries((p && p.jogadores) || {}).map(([uid, j]) => ({ uid, ...j }));
const $ = id => document.getElementById(id);

// ---------- criar / entrar / sair ----------

async function entrar(codigo, nome) {
  const user = await usuario();
  const raiz = `partidas/${codigo}`;
  const snap = await get(ref(db, raiz));
  if (!snap.exists() || !snap.child("criador").exists()) throw new Error("Não existe sala com esse código.");
  if (snap.child("revelada").val()) throw new Error("A partida dessa sala já terminou.");

  const chave = chaveDoNome(nome);
  const resultado = await runTransaction(ref(db, `${raiz}/nomes/${chave}`),
    atual => (atual === null || atual === user.uid) ? user.uid : undefined);
  if (!resultado.committed) {
    throw new Error(`Já tem alguém chamado "${nome}" nesta sala. Use outro nome (pode ser com sobrenome ou apelido).`);
  }

  // se esse celular já estava na partida com outro nome, libera o nome antigo
  const chaveAntiga = snap.child(`jogadores/${user.uid}/chave`).val();
  if (chaveAntiga && chaveAntiga !== chave) await remove(ref(db, `${raiz}/nomes/${chaveAntiga}`));

  await update(ref(db, `${raiz}/jogadores/${user.uid}`), {
    nome, chave, entrouEm: serverTimestamp(), terminou: false, total: null, colunas: null
  });
  guardarSessao({ codigo, chave });
  ultimoEnvio = "";
  podioMostrado = false;
  escutar();
}

async function criar(nome) {
  const user = await usuario();
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = String(Math.floor(10000 + Math.random() * 90000));
    const r = await runTransaction(ref(db, `partidas/${codigo}/criador`),
      atual => atual === null ? user.uid : undefined);
    if (r.committed) {
      await update(ref(db, `partidas/${codigo}`), { criadaEm: serverTimestamp() });
      await entrar(codigo, nome);
      return codigo;
    }
  }
  throw new Error("Não foi possível criar a sala. Tente de novo.");
}

function pararDeEscutar() {
  if (pararEscuta) pararEscuta();
  pararEscuta = null;
}

async function sair() {
  if (!sessao) return;
  const { codigo, chave } = sessao;
  const uid = auth.currentUser && auth.currentUser.uid;
  pararDeEscutar();
  guardarSessao(null);
  partida = null;
  atualizarBarra();
  fecharEspera();
  if (uid) {
    try {
      await remove(ref(db, `partidas/${codigo}/jogadores/${uid}`));
      await remove(ref(db, `partidas/${codigo}/nomes/${chave}`));
    } catch { /* sem conexão: tudo bem, a partida segue sem este jogador */ }
  }
}

// ---------- acompanhar a partida ----------

function escutar() {
  pararDeEscutar();
  if (!sessao) return;
  pararEscuta = onValue(ref(db, `partidas/${sessao.codigo}`), snap => {
    partida = snap.val();
    const uid = auth.currentUser && auth.currentUser.uid;
    if (!partida || !partida.jogadores || !partida.jogadores[uid]) {
      // a partida sumiu ou este jogador saiu em outro lugar
      pararDeEscutar();
      guardarSessao(null);
      partida = null;
      atualizarBarra();
      return;
    }
    sincronizar();
    atualizarBarra();
    atualizarEspera();
    verificarRevelacao();
  }, erro => {
    console.warn("familia:", erro);
    atualizarBarra(mensagemDeErro(erro));
  });
}

// Envia só "terminou / total" quando a tabela fica completa (nunca os pontos no meio do jogo).
function sincronizar() {
  if (!sessao || !partida || partida.revelada || !auth.currentUser) return;
  // só conta como terminada se todas as casas têm valores possíveis
  const completa = partidaCompleta() && tabelaValida(state);
  const { calculados, geral } = calcularTotais(state);
  const dados = completa
    ? { terminou: true, total: geral, colunas: [0, 1, 2, 3].map(c => calculados[`17-${c}`]) }
    : { terminou: false, total: null, colunas: null };
  const assinatura = JSON.stringify(dados);
  if (assinatura === ultimoEnvio) return;
  ultimoEnvio = assinatura;
  update(ref(db, `partidas/${sessao.codigo}/jogadores/${auth.currentUser.uid}`),
    { ...dados, atualizadoEm: serverTimestamp() })
    .catch(() => { ultimoEnvio = ""; });
}

function verificarRevelacao() {
  const jogadores = jogadoresDe(partida);
  const todosTerminaram = jogadores.length > 0 && jogadores.every(j => j.terminou);
  const revelar = partida.revelada || partida.encerrada || todosTerminaram;
  if (!revelar) return;
  if (!partida.revelada) update(ref(db, `partidas/${sessao.codigo}`), { revelada: true }).catch(() => {});
  if (!podioMostrado) mostrarPodio();
}

// ---------- barra da partida em família (acima da tabela) ----------

function atualizarBarra(erro) {
  const barra = $("familia-barra");
  if (!barra) return;
  barra.innerHTML = "";

  if (!sessao) {
    for (const [modo, texto] of [["criar", "👥 Criar sala"], ["entrar", "🔑 Entrar em sala"]]) {
      const botao = document.createElement("button");
      botao.className = "familia-entrar";
      botao.textContent = texto;
      botao.onclick = () => abrir(modo);
      barra.appendChild(botao);
    }
    return;
  }

  const info = document.createElement("div");
  info.className = "familia-info";
  const titulo = document.createElement("strong");
  titulo.textContent = `Sala ${sessao.codigo}`;
  const status = document.createElement("small");
  if (erro) {
    status.textContent = erro;
  } else if (partida) {
    const jogadores = jogadoresDe(partida);
    const terminaram = jogadores.filter(j => j.terminou).length;
    status.textContent = `${jogadores.length} jogador${jogadores.length === 1 ? "" : "es"} · ${terminaram} ${terminaram === 1 ? "terminou" : "terminaram"}`;
  } else {
    status.textContent = "Conectando…";
  }
  info.append(titulo, status);
  barra.appendChild(info);

  const codigo = document.createElement("button");
  codigo.textContent = "📲 Código";
  codigo.onclick = compartilharCodigo;
  barra.appendChild(codigo);

  const uid = auth.currentUser && auth.currentUser.uid;
  if (partida && partida.criador === uid && !partida.revelada &&
      jogadoresDe(partida).some(j => j.terminou)) {
    const encerrar = document.createElement("button");
    encerrar.textContent = "Encerrar";
    encerrar.onclick = encerrarPartida;
    barra.appendChild(encerrar);
  }

  const botaoSair = document.createElement("button");
  botaoSair.textContent = "Sair";
  botaoSair.onclick = confirmarSair;
  barra.appendChild(botaoSair);
}

async function compartilharCodigo() {
  const texto = `Entre na minha sala de YAM com o código ${sessao.codigo}`;
  try {
    if (navigator.share) { await navigator.share({ text: `${texto}: ${ENDERECO_APP}` }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  alert(`Código da partida: ${sessao.codigo}`);
}

async function encerrarPartida() {
  const faltam = jogadoresDe(partida).filter(j => !j.terminou).map(j => j.nome);
  if (!confirm(`Encerrar agora e mostrar o resultado? Quem ainda não terminou (${faltam.join(", ")}) fica fora do pódio.`)) return;
  try { await update(ref(db, `partidas/${sessao.codigo}`), { encerrada: true }); }
  catch (e) { alert(mensagemDeErro(e)); }
}

async function confirmarSair() {
  if (!confirm("Sair da sala? Sua tabela continua aqui, mas você sai do resultado da sala.")) return;
  await sair();
}

// ---------- janela de criar / entrar ----------

let modoJanela = "criar";

// modo "criar": só o nome. modo "entrar": nome + código.
function abrir(modo = "criar") {
  modoJanela = modo;
  const entrar = modo === "entrar";
  $("familia-titulo").textContent = entrar ? "Entrar em sala" : "Criar sala";
  $("familia-explica").textContent = entrar
    ? "Digite o código que quem criou a sala te passou."
    : "Cada um joga no próprio celular. Os pontos de todos aparecem juntos, num pódio, quando o último terminar.";
  $("familia-campo-codigo").hidden = !entrar;
  $("familia-confirmar").textContent = entrar ? "Entrar na sala" : "Criar sala";
  $("familia-nome").value = nomeJogador;
  $("familia-codigo").value = "";
  $("familia-erro").textContent = "";
  $("janela-familia").hidden = false;
  (entrar && nomeJogador ? $("familia-codigo") : $("familia-nome")).focus();
}

function fecharJanela() {
  $("janela-familia").hidden = true;
}

// A partida em família começa com a tabela zerada.
function prepararTabela() {
  if (!partidaTemValores(state)) return true;
  if (!confirm("Para jogar em sala, sua tabela começa zerada. A partida atual vai para o histórico. Continuar?")) return false;
  salvarPartidaAtual();
  comecarNovaPartida();
  return true;
}

async function acaoJanela(tipo = modoJanela) {
  const erro = $("familia-erro");
  const nome = $("familia-nome").value.trim().replace(/\s+/g, " ").slice(0, 20);
  const codigo = $("familia-codigo").value.replace(/\D/g, "");
  if (!nome) { erro.textContent = "Digite seu nome para entrar na sala."; $("familia-nome").focus(); return; }
  if (tipo === "entrar" && codigo.length !== 5) { erro.textContent = "O código tem 5 números."; $("familia-codigo").focus(); return; }
  if (!prepararTabela()) return;

  erro.textContent = tipo === "criar" ? "Criando a sala…" : "Entrando na sala…";
  document.querySelectorAll("#janela-familia button").forEach(b => { b.disabled = true; });
  try {
    if (tipo === "criar") await criar(nome);
    else await entrar(codigo, nome);
    definirNome(nome); // só depois de entrar (nome aceito na sala)
    fecharJanela();
    atualizarBarra();
    if (tipo === "criar") {
      ultimoAviso = Date.now();
      mostrarLegenda(["Sala criada!", `Passe o código ${sessao.codigo} para os outros jogadores (botão 📲 Código).`]);
    }
  } catch (e) {
    erro.textContent = mensagemDeErro(e);
  } finally {
    document.querySelectorAll("#janela-familia button").forEach(b => { b.disabled = false; });
  }
}

// ---------- esperando os outros ----------

function aoTerminar() {
  sincronizar();
  $("familia-espera").hidden = false;
  atualizarEspera();
}

function atualizarEspera() {
  const caixa = $("familia-espera");
  if (!caixa || caixa.hidden || !partida) return;
  const { geral } = calcularTotais(state);
  $("espera-total").textContent = geral;
  const faltam = jogadoresDe(partida).filter(j => !j.terminou).map(j => j.nome);
  $("espera-faltam").textContent = faltam.length
    ? `Esperando: ${faltam.join(", ")}`
    : "Todos terminaram!";
}

function fecharEspera() {
  const caixa = $("familia-espera");
  if (caixa) caixa.hidden = true;
}

// ---------- pódio ----------

function mostrarPodio() {
  podioMostrado = true;
  fecharEspera();
  document.getElementById("fim-de-jogo").hidden = true;

  const uid = auth.currentUser && auth.currentUser.uid;
  const jogadores = jogadoresDe(partida);
  const terminaram = jogadores.filter(j => j.terminou && typeof j.total === "number")
    .sort((a, b) => b.total - a.total);
  const naoTerminaram = jogadores.filter(j => !(j.terminou && typeof j.total === "number"));

  // empate fica na mesma posição (1º, 1º, 3º...)
  const posicao = j => 1 + terminaram.filter(o => o.total > j.total).length;
  const nomeCom = j => j.uid === uid ? `${j.nome} (você)` : j.nome;

  const vencedores = terminaram.filter(j => posicao(j) === 1);
  $("podio-titulo").textContent = vencedores.length === 0 ? "Partida encerrada"
    : vencedores.length === 1 ? `🏆 ${vencedores[0].nome} venceu!`
    : `🏆 Empate: ${vencedores.map(v => v.nome).join(" e ")}!`;

  // degraus: 2º à esquerda, 1º no meio, 3º à direita
  const degraus = $("podio-degraus");
  degraus.innerHTML = "";
  const medalhas = { 1: "🥇", 2: "🥈", 3: "🥉" };
  [1, 0, 2].forEach(i => {
    const j = terminaram[i];
    const coluna = document.createElement("div");
    coluna.className = `degrau degrau-${i + 1}`;
    if (j) {
      const p = posicao(j);
      const medalha = document.createElement("div");
      medalha.className = "medalha";
      medalha.textContent = medalhas[p] || `${p}º`;
      const nome = document.createElement("div");
      nome.className = "podio-nome";
      nome.textContent = nomeCom(j);
      const pontos = document.createElement("div");
      pontos.className = "podio-pontos";
      pontos.textContent = `${j.total} pts`;
      const bloco = document.createElement("div");
      bloco.className = "bloco-degrau";
      bloco.textContent = `${p}º`;
      coluna.append(medalha, nome, pontos, bloco);
      coluna.classList.add(`pos-${Math.min(p, 3)}`); // altura do degrau segue a colocação (empate = mesma altura)
      if (j.uid === uid) coluna.classList.add("eu");
    } else {
      coluna.classList.add("vazio");
    }
    degraus.appendChild(coluna);
  });

  // do 4º em diante, e quem não terminou
  const lista = $("podio-lista");
  lista.innerHTML = "";
  terminaram.slice(3).forEach(j => {
    const li = document.createElement("li");
    if (j.uid === uid) li.classList.add("eu");
    const pos = document.createElement("span");
    pos.className = "pos";
    pos.textContent = `${posicao(j)}º`;
    const nome = document.createElement("span");
    nome.className = "nome";
    nome.textContent = nomeCom(j);
    const pontos = document.createElement("span");
    pontos.className = "pts";
    pontos.textContent = `${j.total} pts`;
    li.append(pos, nome, pontos);
    lista.appendChild(li);
  });
  naoTerminaram.forEach(j => {
    const li = document.createElement("li");
    li.className = "nao-terminou";
    const pos = document.createElement("span");
    pos.className = "pos";
    pos.textContent = "–";
    const nome = document.createElement("span");
    nome.className = "nome";
    nome.textContent = nomeCom(j);
    const pontos = document.createElement("span");
    pontos.className = "pts";
    pontos.textContent = "não terminou";
    li.append(pos, nome, pontos);
    lista.appendChild(li);
  });
  lista.hidden = lista.children.length === 0;

  $("podio").hidden = false;
  confetePodio();
}

function confetePodio() {
  const cores = ["#f2b134", "#3d6ea8", "#ffffff", "#e8604c", "#5cb85c"];
  const area = $("confete-podio");
  area.innerHTML = "";
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "%";
    p.style.background = cores[i % cores.length];
    p.style.animationDelay = Math.random() * 0.8 + "s";
    p.style.animationDuration = 2 + Math.random() * 1.5 + "s";
    area.appendChild(p);
  }
  setTimeout(() => { area.innerHTML = ""; }, 4500);
}

// Fechar o pódio encerra a partida em família neste celular.
function fecharPodio() {
  $("podio").hidden = true;
  pararDeEscutar();
  guardarSessao(null);
  partida = null;
  atualizarBarra();
}

// ---------- ligação com o resto do app ----------

window.familia = {
  abrir, fecharJanela, acaoJanela, sair, confirmarSair, compartilharCodigo,
  aoTerminar, fecharEspera, fecharPodio, sincronizar,
  ativa: () => !!sessao,
  revelada: () => !!(partida && (partida.revelada || partida.encerrada))
};

atualizarBarra();
if (sessao) usuario().then(escutar).catch(e => atualizarBarra(mensagemDeErro(e)));
