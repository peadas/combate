// Carrega o SDK do Owlbear tentando várias fontes (se uma cair/der 404, usa a próxima).
const FONTES = [
  "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm",
  "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.0.0/+esm",
  "https://esm.sh/@owlbear-rodeo/sdk@3",
  "https://cdn.skypack.dev/@owlbear-rodeo/sdk@3",
];
let mod = null;
export const fonteUsada = { url: null, erros: [] };
for (const url of FONTES) {
  try { mod = await import(url); fonteUsada.url = url; break; }
  catch (e) { fonteUsada.erros.push(`${url} -> ${e.message}`); console.warn("SDK falhou:", url, e); }
}
if (!mod) throw new Error("SDK do Owlbear não carregou:\n" + fonteUsada.erros.join("\n"));

const OBR = mod.default ?? mod.OBR;
export default OBR;
export const buildShape = mod.buildShape;
