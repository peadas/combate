# Ordem – Combate (extensão Owlbear Rodeo)

Extensão estática (sem build, sem servidor). Funciona no GitHub Pages, como o fichazs.

## Publicar
1. Crie um repositório novo e envie todos estes arquivos na raiz.
2. Settings > Pages > Deploy from a branch > `main` / root.
3. URL do manifest: `https://SEU-USUARIO.github.io/NOME-DO-REPO/manifest.json`
   Se o repositório não for `SEU-USUARIO.github.io`, troque os caminhos do `manifest.json`
   para `/NOME-DO-REPO/icon.svg`, `/NOME-DO-REPO/combate.html`, `/NOME-DO-REPO/background.html`.
4. Owlbear: Avatar > Profile > Extensions > Add Extension > cole a URL.

## Usar
- Clique direito no token > **Entrar na Ordem** (aparecem as barras PV/PD embaixo dele).
- Ícone da espada na barra de ferramentas abre o painel.
- Mestre: aba **Iniciativa** (Nova rodada, Próxima fase, PV/PD, ação extra).
- Jogador: seleciona o token e age na fase atual; quem já agiu espera a próxima rodada.

## Arquivos
- `ordem.js` regras, estado, rolagem · `background.js` botão, menu de contexto, barras
- `combate.js/html/css` painel · `ficha.js` ligação com o fichazs

## Ligação com a ficha (fichazs)
- Instale as duas extensões na mesma sala. Ao **Entrar na Ordem**, o token pega PV/PD da ficha do dono.
- Se o jogador mudar PV/PD na ficha, o token dele atualiza sozinho. O botão **↻ ficha** (aba Iniciativa) puxa na hora.
- O dano do combate NÃO volta para a ficha (ela guarda os dados no navegador do jogador): ajuste na ficha também.
- Se não puxar, abra Settings > **Diagnóstico da ficha** e mande o texto para ajustar a leitura.
