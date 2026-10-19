// Escala da cena de fundo do tema retrô (Admurin, "Parallax Backgrounds:
// Dock", 384 × 216 px). Pixel art só fica nítida ampliada por um número
// inteiro, e o CSS não tem arredondamento confiável para isso: aqui sai o
// menor fator inteiro que cobre a tela (k), e o deslocamento, em pixel
// inteiro, que centraliza a cena. retro.css usa as três variáveis.
//
// Altura: a da tela com a barra do navegador recolhida (100lvh). Com
// innerHeight, a cena pularia ao rolar no celular, quando a barra some.

const LARGURA = 384;
const ALTURA = 216;

const sonda = document.createElement("div");
sonda.style.cssText = "position:fixed;top:0;height:100lvh;width:0;visibility:hidden;pointer-events:none";

function medir() {
  if (!sonda.isConnected) document.documentElement.append(sonda);
  const largura = document.documentElement.clientWidth;
  const altura = sonda.offsetHeight || innerHeight;
  const k = Math.max(1, Math.ceil(largura / LARGURA), Math.ceil(altura / ALTURA));
  const estilo = document.documentElement.style;
  estilo.setProperty("--cena-k", String(k));
  estilo.setProperty("--cena-x", `${Math.round((largura - LARGURA * k) / 2)}px`);
  estilo.setProperty("--cena-y", `${Math.round((altura - ALTURA * k) / 2)}px`);
}

medir();
addEventListener("resize", medir);
