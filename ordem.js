// Núcleo compartilhado: constantes, estado do combate, regras e rolagem.
import OBR from "./sdk.js";

export const ID = "com.ordem.combate";
export const TOK = `${ID}/tok`;       // metadados do token: {nome,pv,pvMax,pd,pdMax,nl}
export const EST = `${ID}/estado`;    // metadados da cena: {rodada,fase,agiram,extra}
export const BAR = `${ID}/bar`;       // marca dos itens locais (barras de vida)
export const CMD = `${ID}/cmd`;       // jogador -> mestre (broadcast)
export const LOG = `${ID}/log`;       // aviso para todos (broadcast)

export const FASES = ["Geral", "Distância", "Corpo a corpo"];
export const ACOES_GERAIS = ["Atrapalhar", "Defender-se", "Erguer-se", "Fintar", "Mirar",
  "Preparar", "Sacar/Guardar item", "Esconder-se", "Pegar item", "Usar habilidade"];
export const MANOBRAS = ["Agarrar", "Derrubar", "Desarmar", "Empurrar", "Quebrar"];
export const DADOS = [4, 6, 8, 10, 12, 20];

export const url = (p) => new URL(p, import.meta.url).href;

// ---------- configurações do jogador (equipamento) ----------
const CK = `${ID}/cfg`;
export function cfg() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(CK) || "{}"); } catch {}
  return { dado: 6, bonusAtk: 0, bonusDano: 0, passos: 0, ...s };
}
export function salvarCfg(c) { try { localStorage.setItem(CK, JSON.stringify(c)); } catch {} }

// ---------- rolagem (SUBSTITUA depois pelos dados da ficha) ----------
export function passoDado(lado, delta) {
  const i = Math.min(DADOS.length - 1, Math.max(0, DADOS.indexOf(lado) + delta));
  return DADOS[i];
}
export function rolar(lado, bonus = 0) {
  const d = [1, 2].map(() => 1 + Math.floor(Math.random() * lado));
  return { d, baixo: Math.min(...d), alto: Math.max(...d), total: d[0] + d[1] + bonus };
}

// ---------- estado do combate ----------
const base = { rodada: 0, fase: 0, agiram: {}, extra: {} };
export async function getEstado() {
  const m = await OBR.scene.getMetadata();
  return { ...base, ...(m[EST] || {}) };
}
const setEstado = (e) => OBR.scene.setMetadata({ [EST]: e });

export function avisar(texto) {
  OBR.notification.show(texto);
  OBR.broadcast.sendMessage(LOG, { texto });
}

// Executado SEMPRE pelo mestre (jogadores mandam o comando por broadcast).
export async function aplicar(c) {
  const e = await getEstado();
  switch (c.tipo) {
    case "nova": e.rodada++; e.fase = 0; e.agiram = {}; return setEstado(e);
    case "fase": e.fase = c.fase; return setEstado(e);
    case "agir":
      if (e.agiram[c.id] && (e.extra[c.id] || 0) > 0) e.extra[c.id]--;
      else e.agiram[c.id] = true;
      return setEstado(e);
    case "extra": e.extra[c.id] = Math.max(0, (e.extra[c.id] || 0) + c.delta); return setEstado(e);
    case "campo": // ajuste manual de pv/pd pelo mestre
      return OBR.scene.items.updateItems([c.id], (its) => {
        for (const it of its) {
          const d = it.metadata[TOK]; if (!d) continue;
          const max = d[c.campo + "Max"];
          d[c.campo] = Math.min(max, Math.max(0, d[c.campo] + c.delta));
        }
      });
    case "dano": {
      let zerou = null;
      await OBR.scene.items.updateItems([c.id], (its) => {
        for (const it of its) {
          const d = it.metadata[TOK]; if (!d) continue;
          const antes = d.pv;
          d.pv = Math.max(0, d.pv - c.dano);
          if (!c.letal) d.nl = (d.nl || 0) + Math.min(c.dano, antes);
          if (antes > 0 && d.pv === 0) zerou = d.nome;
        }
      });
      if (zerou) avisar(`${zerou} chegou a 0 PV: teste de lesão (Físico + Vigor, DT 7).`);
    }
  }
}
