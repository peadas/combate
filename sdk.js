// Carrega o SDK do Owlbear tentando várias fontes e normaliza o formato do módulo
// (alguns CDNs entregam o objeto dentro de "default" ou de "default.default").
const FONTES = [
  "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm",
  "https://esm.sh/@owlbear-rodeo/sdk@3",
  "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.0.0/+esm",
  "https://cdn.skypack.dev/@owlbear-rodeo/sdk@3",
];
let mod = null, OBR = null;
export const fonteUsada = { url: null, erros: [] };

for (const url of FONTES) {
  try {
    const m = await import(url);
    const achado = [m.default, m.default?.default, m.OBR, m].find((c) => c && typeof c.onReady === "function");
    if (!achado) throw new Error("módulo sem onReady (chaves: " + Object.keys(m).join(",") + ")");
    mod = m; OBR = achado; fonteUsada.url = url; break;
  } catch (e) { fonteUsada.erros.push(`${url} -> ${e.message}`); console.warn("SDK falhou:", url, e); }
}
if (!OBR) throw new Error("SDK do Owlbear não carregou:\n" + fonteUsada.erros.join("\n"));

const pega = (n) => mod[n] ?? mod.default?.[n] ?? mod.default?.default?.[n];
export default OBR;
export const buildShape = pega("buildShape");
