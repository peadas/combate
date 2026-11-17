// Ligação com o fichazs. O fichazs publica nome/PV/PD nos metadados do jogador
// no Owlbear. Como a chave exata não é conhecida, a busca é tolerante: varre os
// metadados de outras extensões atrás de um objeto com pv/pd. Use o
// "Diagnóstico da ficha" (aba Settings) para ver o que o fichazs publica de fato.
import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

const MEU = "com.ordem.combate";
const n = (v) => (v !== "" && v !== null && v !== undefined && Number.isFinite(+v) ? +v : null);

function par(v) { // número | [atual, max] | {atual|cur|value, max|m}
  if (Array.isArray(v)) return { a: n(v[0]), m: n(v[1]) };
  if (v && typeof v === "object") {
    return { a: n(v.atual ?? v.cur ?? v.current ?? v.v ?? v.value ?? v.now),
             m: n(v.max ?? v.m ?? v.maximo ?? v.total) };
  }
  return { a: n(v), m: null };
}

function procurar(o, prof = 0) {
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== "object" || prof > 3) return null;
  if (!Array.isArray(o)) {
    const k = (re) => Object.keys(o).find((x) => re.test(x));
    const kpv = k(/^(pv|hp|vida)$/i), kpd = k(/^(pd|determina[cç][aã]o|sanidade|san)$/i);
    if (kpv !== undefined) {
      const pv = par(o[kpv]), pd = kpd !== undefined ? par(o[kpd]) : { a: null, m: null };
      const kpvm = k(/^(pv_?max|max_?pv|pvm|hp_?max)$/i), kpdm = k(/^(pd_?max|max_?pd|pdm)$/i);
      const kn = k(/^(nome|name)$/i);
      if (pv.a !== null) {
        return {
          nome: kn ? String(o[kn]) : undefined,
          pv: pv.a, pvMax: pv.m ?? (kpvm ? n(o[kpvm]) : null) ?? pv.a,
          pd: pd.a ?? 0, pdMax: pd.m ?? (kpdm ? n(o[kpdm]) : null) ?? pd.a ?? 0,
        };
      }
    }
  }
  for (const v of Object.values(o)) { const r = procurar(v, prof + 1); if (r) return r; }
  return null;
}

async function jogadores() {
  const eu = { id: OBR.player.id, role: await OBR.player.getRole(), metadata: await OBR.player.getMetadata(), name: await OBR.player.getName() };
  const outros = await OBR.party.getPlayers();
  return [eu, ...outros.map((p) => ({ id: p.id, role: p.role, metadata: p.metadata, name: p.name }))];
}

// Lê a ficha publicada por um jogador (não-mestre). Devolve null se não achar.
export async function lerFicha(userId) {
  const p = (await jogadores()).find((j) => j.id === (userId || OBR.player.id));
  if (!p || p.role === "GM" || !p.metadata) return null;
  for (const [chave, v] of Object.entries(p.metadata)) {
    if (chave.startsWith(MEU)) continue;
    const r = procurar(v);
    if (r) return r;
  }
  return null;
}

// Valores iniciais ao "Entrar na Ordem": usa a ficha do dono do token, se existir.
export async function dadosIniciais(item) {
  const f = await lerFicha(item?.createdUserId);
  return f || { pv: 10, pvMax: 10, pd: 10, pdMax: 10 };
}

// Texto para colar de volta numa conversa: o que cada jogador publica.
export async function diagnostico() {
  const linhas = [];
  for (const p of await jogadores()) {
    for (const [chave, v] of Object.entries(p.metadata || {})) {
      if (chave.startsWith(MEU)) continue;
      linhas.push(`[${p.name}${p.role === "GM" ? " (mestre)" : ""}] ${chave} = ${JSON.stringify(v).slice(0, 400)}`);
    }
  }
  return linhas.join("\n") || "Nenhum metadado de outras extensões encontrado.";
}
