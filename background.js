import OBR, { buildShape } from "./sdk.js";
import { ID, TOK, BAR, CMD, LOG, url, aplicar } from "./ordem.js";
import { dadosIniciais, lerFicha } from "./ficha.js";

OBR.onReady(async () => {
 try {
  const papel = await OBR.player.getRole();

  // Botão da espada na barra de ferramentas
  await OBR.tool.createAction({
    id: `${ID}/espada`,
    icons: [{ icon: url("icon.svg"), label: "Combate (Ordem)" }],
    onClick: (_ctx, anchor) => OBR.popover.open({
      id: `${ID}/popover`, url: url("combate.html"),
      width: 420, height: 620, anchorElementId: anchor,
    }),
  });

  // Clique direito no token: Entrar/Sair da Ordem
  await OBR.contextMenu.create({
    id: `${ID}/ordem`,
    icons: [{ icon: url("icon.svg"), label: "Entrar/Sair da Ordem",
      filter: { every: [{ key: "layer", value: "CHARACTER" }] } }],
    onClick: async (ctx) => {
      const meu = OBR.player.id;
      const ids = ctx.items.filter((i) => papel === "GM" || i.createdUserId === meu).map((i) => i.id);
      if (!ids.length) return;
      const ini = {};
      for (const i of ctx.items) if (ids.includes(i.id)) ini[i.id] = await dadosIniciais(i);
      await OBR.scene.items.updateItems(ids, (its) => {
        for (const it of its) {
          if (it.metadata[TOK]) delete it.metadata[TOK];
          else {
            const f = ini[it.id];
            it.metadata[TOK] = { ...f, nome: f.nome || it.text?.plainText || it.name || "Token", nl: 0 };
          }
        }
      });
    },
  });

  // Comandos dos jogadores (só o mestre executa) e avisos
  OBR.broadcast.onMessage(CMD, (ev) => { if (papel === "GM") aplicar(ev.data); });
  OBR.broadcast.onMessage(LOG, (ev) => OBR.notification.show(ev.data.texto));

  // Ficha -> token: quando PV/PD da ficha do jogador mudam, atualiza os tokens dele
  // (a ficha é a fonte da verdade; o dano do combate não volta para ela).
  let ultima = "";
  async function sincronizar() {
    const f = await lerFicha(OBR.player.id).catch(() => null);
    if (!f) return;
    const chave = JSON.stringify([f.pv, f.pvMax, f.pd, f.pdMax]);
    if (chave === ultima) return;
    ultima = chave;
    if (!(await OBR.scene.isReady())) return;
    const meus = await OBR.scene.items.getItems((i) => i.createdUserId === OBR.player.id && !!i.metadata[TOK]);
    if (!meus.length) return;
    await OBR.scene.items.updateItems(meus.map((i) => i.id), (its) => {
      for (const it of its) Object.assign(it.metadata[TOK], { pv: f.pv, pvMax: f.pvMax, pd: f.pd, pdMax: f.pdMax });
    });
  }
  OBR.player.onChange(() => sincronizar());
  sincronizar();

  // Barras de vida embaixo dos tokens (itens locais, não sincronizam)
  let ocupado = false, pendente = false;
  async function desenhar() {
    if (ocupado) { pendente = true; return; }
    ocupado = true;
    try {
      const [items, dpi, velhos] = await Promise.all([
        OBR.scene.items.getItems((i) => !!i.metadata[TOK]),
        OBR.scene.grid.getDpi(),
        OBR.scene.local.getItems((i) => !!i.metadata[BAR]),
      ]);
      const novos = [];
      for (const t of items) {
        const d = t.metadata[TOK];
        const w = (t.image ? t.image.width / t.image.grid.dpi * dpi : dpi) * Math.abs(t.scale.x);
        const h = (t.image ? t.image.height / t.image.grid.dpi * dpi : dpi) * Math.abs(t.scale.y);
        const x = t.position.x - w / 2, y = t.position.y + h / 2 + 2;
        const rect = (py, larg, cor, op) => buildShape().shapeType("RECTANGLE")
          .width(larg).height(7).position({ x, y: py }).fillColor(cor).fillOpacity(op)
          .strokeWidth(0).layer("ATTACHMENT").locked(true).disableHit(true)
          .metadata({ [BAR]: true }).build();
        const frac = (v, m) => Math.max(0, Math.min(1, m ? v / m : 0));
        novos.push(rect(y, w, "#000000", 0.7));
        if (d.pv > 0) novos.push(rect(y, w * frac(d.pv, d.pvMax), "#d94141", 1));
        novos.push(rect(y + 8, w, "#000000", 0.7));
        if (d.pd > 0) novos.push(rect(y + 8, w * frac(d.pd, d.pdMax), "#3a7bd5", 1));
      }
      if (velhos.length) await OBR.scene.local.deleteItems(velhos.map((i) => i.id));
      if (novos.length) await OBR.scene.local.addItems(novos);
    } catch (e) { console.warn("barras", e); }
    finally { ocupado = false; if (pendente) { pendente = false; desenhar(); } }
  }
  OBR.scene.onReadyChange((r) => r && desenhar());
  OBR.scene.items.onChange(desenhar);
  if (await OBR.scene.isReady()) desenhar();
} catch (e) { console.error(e); OBR.notification.show('Ordem – Combate: erro ao iniciar: ' + (e?.message || e), 'ERROR'); }
});
