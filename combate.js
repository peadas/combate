import OBR from "./sdk.js";
import { dadosIniciais, diagnostico } from "./ficha.js";
import { TOK, CMD, FASES, ACOES_GERAIS, MANOBRAS, DADOS, getEstado, aplicar, avisar,
  rolar, passoDado, cfg, salvarCfg } from "./ordem.js";

const h = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => k != null && e.append(k));
  return e;
};
const btn = (txt, fn, cls = "op") => h("button", { className: cls, textContent: txt, onclick: fn });

let papel = "PLAYER", aba = "combate", estado, tokens = [], meu = null;
let pilha = ["raiz"], ctx = {}, diag = "";

// jogador -> mestre por broadcast; mestre aplica direto
const enviar = (c) => papel === "GM" ? aplicar(c) : OBR.broadcast.sendMessage(CMD, c);
const ir = (tela) => { pilha.push(tela); render(); };
const voltar = () => { if (pilha.length > 1) pilha.pop(); render(); };
const reset = () => { pilha = ["raiz"]; ctx = {}; render(); };

OBR.onReady(async () => {
  papel = await OBR.player.getRole();
  await carregar();
  OBR.scene.onMetadataChange(carregar);
  OBR.scene.items.onChange(carregar);
  OBR.player.onChange(carregar);
});

async function carregar() {
  estado = await getEstado();
  tokens = await OBR.scene.items.getItems((i) => !!i.metadata[TOK]);
  const sel = (await OBR.player.getSelection()) || [];
  const meus = tokens.filter((t) => papel === "GM" || t.createdUserId === OBR.player.id);
  meu = meus.find((t) => sel.includes(t.id)) || (papel === "GM" ? null : meus[0]) || null;
  render();
}

// ---------- peças de interface ----------
const barra = (rot, v, m, cls) => h("div", { className: `barra ${cls}` },
  h("span", { textContent: rot }), h("i", {}, h("b", { style: `width:${m ? 100 * v / m : 0}%` })),
  h("span", { textContent: `${v}/${m}` }));
const msg = (t) => h("p", { className: "msg", textContent: t });

function render() {
  const app = document.querySelector("#app");
  app.replaceChildren();
  const abas = [["combate", "Combate"], ...(papel === "GM" ? [["gm", "Iniciativa"]] : []), ["cfg", "Settings"]];
  app.append(
    h("div", { className: "topo" }, h("span", { textContent: estado.rodada ? `Rodada ${estado.rodada}` : "Fora de rodada" }),
      h("span", { textContent: estado.rodada ? FASES[estado.fase] : "" })),
    h("div", { className: "abas", role: "tablist" }, abas.map(([id, nome]) =>
      h("button", { textContent: nome, role: "tab", ariaSelected: String(aba === id),
        onclick: () => { aba = id; reset(); } }))),
    aba === "combate" ? viewCombate() : aba === "gm" ? viewGM() : viewCfg());
}

// ---------- aba Combate (menu estilo Pokémon) ----------
function menuAtual() {
  const f = estado.fase, topo = pilha.at(-1), nome = meu.metadata[TOK].nome;
  const anunciar = (a) => () => { avisar(`${nome} usa ${a}.`); enviar({ tipo: "agir", id: meu.id }); reset(); };
  const outra = ["Outra ação", anunciar("uma ação fora da lista")];
  if (topo === "raiz") {
    if (f === 0) return { t: `O que ${nome} vai fazer?`, i: [...ACOES_GERAIS.map((a) => [a, anunciar(a)]), outra] };
    const ag = ["Agredir", () => ir("tipo")];
    return { t: `O que ${nome} vai fazer?`, i: f === 1 ? [ag, outra] : [ag, ["Manobras", () => ir("manobras")], outra] };
  }
  if (topo === "tipo") return { t: "Tipo de dano", i: [
    ["Dano letal", () => { ctx.letal = true; ir("alvo"); }],
    ["Dano não letal", () => { ctx.letal = false; ir("alvo"); }]] };
  if (topo === "manobras") return { t: "Manobra", i: MANOBRAS.map((m) => [m, () => { ctx.manobra = m; ir("alvo"); }]) };
  const alvos = tokens.filter((t) => t.id !== meu.id && t.metadata[TOK].pv > 0);
  return { t: "Escolha o alvo", i: alvos.map((t) => [t.metadata[TOK].nome, () => atacar(t)]), alvo: true };
}

function viewCombate() {
  const box = h("section", { className: "box" });
  if (!meu) return h("section", { className: "box" }, msg("Selecione seu token. Clique direito nele > Entrar na Ordem."));
  const d = meu.metadata[TOK];
  box.append(h("h2", { textContent: d.nome }), barra("PV", d.pv, d.pvMax, "pv"), barra("PD", d.pd, d.pdMax, "pd"));
  const extra = estado.extra[meu.id] || 0;
  if (!estado.rodada) return box.append(msg("O mestre ainda não iniciou a rodada.")) || box;
  if (estado.agiram[meu.id] && extra <= 0) return box.append(msg("Você já agiu nesta rodada.")) || box;
  const m = menuAtual();
  box.append(h("h2", { textContent: m.t }));
  if (m.alvo) {
    const chk = (k, rot) => h("label", {}, h("input", { type: "checkbox", checked: !!ctx[k], onchange: (e) => (ctx[k] = e.target.checked) }), " " + rot);
    box.append(h("div", { className: "mods" }, chk("longo", "Alcance longo"), chk("cob", "Cobertura leve"), chk("caido", "Alvo caído")));
  }
  box.append(h("div", { className: "menu" }, m.i.map(([t, fn]) => btn(t, fn))));
  if (!m.i.length) box.append(msg("Nenhum alvo na Ordem."));
  if (pilha.length > 1) box.append(btn("Voltar", voltar, "op voltar"));
  return box;
}

async function atacar(alvo) {
  const c = cfg(), f = estado.fase, ad = alvo.metadata[TOK], nome = meu.metadata[TOK].nome;
  const dt = 7 + (ctx.longo && f === 1 ? 3 : 0) + (ctx.cob ? 3 : 0) + (ctx.caido && f === 1 ? 3 : 0);
  const passos = c.passos + (ctx.caido && f === 2 ? 1 : 0); // corpo a corpo vs caído: +1 passo
  const r = rolar(passoDado(c.dado, passos), c.bonusAtk);
  const conta = `${r.d.join("+")}${c.bonusAtk ? `+${c.bonusAtk}` : ""} = ${r.total}`;
  let txt;
  if (ctx.manobra) txt = `${nome} tenta ${ctx.manobra} em ${ad.nome} (${conta}). Mestre resolve o teste oposto.`;
  else if (r.total >= dt) {
    const dano = r.alto + c.bonusDano;
    txt = `${nome} acerta ${ad.nome} (${conta} vs DT ${dt}): ${dano} de dano ${ctx.letal ? "letal" : "não letal"}.`;
    await enviar({ tipo: "dano", id: alvo.id, dano, letal: ctx.letal });
  } else txt = `${nome} erra ${ad.nome} (${conta} vs DT ${dt}).`;
  await enviar({ tipo: "agir", id: meu.id });
  avisar(txt);
  reset();
}

// ---------- aba Iniciativa (mestre) ----------
function viewGM() {
  const root = h("section", { className: "box" });
  root.append(
    h("div", { className: "fases" }, FASES.map((n, i) => h("div", { className: "fase" + (estado.fase === i && estado.rodada ? " ativa" : ""), textContent: n }))),
    h("div", { className: "acoes" },
      btn("Nova rodada", () => aplicar({ tipo: "nova" }), "grande"),
      btn("Próxima fase", () => aplicar({ tipo: "fase", fase: Math.min(2, estado.fase + 1) }), "grande"),
      btn("Fase anterior", () => aplicar({ tipo: "fase", fase: Math.max(0, estado.fase - 1) }), "grande")));
  if (!tokens.length) root.append(msg("Ninguém na Ordem. Clique direito nos tokens > Entrar na Ordem."));
  for (const t of tokens) {
    const d = t.metadata[TOK], extra = estado.extra[t.id] || 0, agiu = !!estado.agiram[t.id];
    const ajuste = (campo) => h("span", {}, btn("−", () => aplicar({ tipo: "campo", id: t.id, campo, delta: -1 }), "mini"),
      btn("+", () => aplicar({ tipo: "campo", id: t.id, campo, delta: 1 }), "mini"));
    root.append(h("div", { className: "linha" },
      h("div", {}, h("b", { textContent: `${agiu ? "✓ " : "○ "}${d.nome}${d.nl ? ` (não letal ${d.nl})` : ""}` }),
        barra("PV", d.pv, d.pvMax, "pv"), barra("PD", d.pd, d.pdMax, "pd")),
      h("div", {}, h("div", {}, btn("↻ ficha", () => puxarFicha(t), "mini"), " "), h("div", {}, "PV ", ajuste("pv")), h("div", {}, "PD ", ajuste("pd")),
        h("div", {}, `Extra ${extra} `, btn("−", () => aplicar({ tipo: "extra", id: t.id, delta: -1 }), "mini"),
          btn("+", () => aplicar({ tipo: "extra", id: t.id, delta: 1 }), "mini")))));
  }
  return root;
}

async function puxarFicha(t) {
  const f = await dadosIniciais(t);
  await OBR.scene.items.updateItems([t.id], (its) => {
    for (const it of its) Object.assign(it.metadata[TOK], { pv: f.pv, pvMax: f.pvMax, pd: f.pd, pdMax: f.pdMax });
  });
  OBR.notification.show(`Ficha puxada para ${t.metadata[TOK].nome}.`);
}

// ---------- aba Settings (equipamento) ----------
function viewCfg() {
  const c = cfg();
  const salvar = () => salvarCfg(c);
  const num = (k, rot) => h("label", { className: "campo" }, rot,
    h("input", { type: "number", value: c[k], onchange: (e) => { c[k] = +e.target.value || 0; salvar(); } }));
  return h("section", { className: "box" },
    h("h2", { textContent: "Equipamento" }),
    h("label", { className: "campo" }, "Dado do teste (2 dados)",
      h("select", { onchange: (e) => { c.dado = +e.target.value; salvar(); } },
        DADOS.map((n) => h("option", { value: n, textContent: `d${n}`, selected: n === c.dado })))),
    num("passos", "Passos de dado (+/−)"), num("bonusAtk", "Bônus no ataque"), num("bonusDano", "Bônus no dano"),
    h("h2", { textContent: "Ficha (fichazs)" }),
    btn("Diagnóstico da ficha", async () => { diag = await diagnostico(); render(); }, "grande"),
    diag ? h("pre", { textContent: diag, style: "white-space:pre-wrap;word-break:break-all;font-size:12px;margin:0" }) : null,
    msg("Dano = dado alto + bônus. Ataque acerta se a soma ≥ DT. Isto é provisório até ligar à ficha."));
}
