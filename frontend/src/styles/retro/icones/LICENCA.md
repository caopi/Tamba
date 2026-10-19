# Ícones pixel — licença

- **Conjunto:** Pixel - Free
- **Autor:** Streamline (Streamline Icons, Illustrations and Elements) —
  a página não nomeia uma pessoa
- **Página:** <https://www.streamlinehq.com/icons/pixel>
- **Licença:** Creative Commons Atribuição 4.0 Internacional (CC BY 4.0) —
  <https://creativecommons.org/licenses/by/4.0/deed.pt-br>
  (a página do conjunto registra: "Recorded license: CC BY 4.0.")
- **Consultado em:** 19/10/2026

O zip não traz arquivo de licença. O texto da licença não é reproduzido
aqui: vale o do link acima.

## Alterações (a CC BY pede que sejam indicadas)

Os SVGs desta pasta são os originais, como baixados — só os usados pelo app
entram no git (ver `.gitignore`). O app não usa estes arquivos direto: usa
versões **redesenhadas** em `px/`, geradas por
`backend/database/pixel-icons.js` (`npm run pixel-icons`):

- o desenho, uma grade de 21 × 21 pixels dentro de um viewBox de 32, foi
  passado para coordenadas inteiras numa grade de 21;
- nos ícones desenhados meio pixel fora da grade num dos eixos, esse meio
  pixel foi alinhado à grade;
- a cor original (preto) saiu: o ícone vira máscara, pintada pelo CSS na cor
  do texto do tema.
