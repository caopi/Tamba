/**
 * Camada animada da cena de fundo do tema retrô ("Parallax Backgrounds:
 * Dock", de Admurin). Só cria os elementos; posição, tamanho e animação
 * estão todos em styles/retro/retro.css (e nada aparece com o tema
 * desligado).
 *
 * - As nove camadas da cena, uma por elemento, para cada uma andar na sua
 *   velocidade (parallax). Só aparecem com a classe `cena-movel` no <html>;
 *   sem ela, fica a cena parada que o body desenha.
 * - Os efeitos: raios de luz, bolhas e os tambaquis nadando (a tira de 8
 *   quadros de styles/retro/sprites/tambaqui.png, npm run sprites). A classe
 *   `cena-efeitos-parados` no <html> os congela.
 * - `animada`: no Dex, Feed, Registrar Captura e Notificações; nas outras
 *   telas a cena fica parada. Com prefers-reduced-motion, o CSS esconde a
 *   camada inteira: sobra só a cena parada.
 * - Poucos elementos de propósito (9 camadas, 3 raios, 6 bolhas, 5 peixes):
 *   a camada está em toda tela. As animações mexem só em transform e
 *   opacity, que o navegador anima sem refazer layout nem pintura.
 *
 * Cada peixe é uma janela do tamanho de um quadro com a tira dentro: a tira
 * anda um quadro por vez (a cauda), e a janela atravessa a água (o nado).
 */
const CAMADAS = 9;
const RAIOS = 3;
const BOLHAS = 6;
const PEIXES = 5;

export function CenaAnimada({ animada }: { animada: boolean }) {
  return (
    <div className="cena" data-animada={animada} aria-hidden="true">
      {Array.from({ length: CAMADAS }, (_, i) => (
        <span key={`c${i}`} className={`cena-camada cena-camada-${i}`} />
      ))}
      {Array.from({ length: RAIOS }, (_, i) => (
        <span key={`r${i}`} className={`cena-efeito cena-raio cena-raio-${i + 1}`} />
      ))}
      {Array.from({ length: BOLHAS }, (_, i) => (
        <span key={`b${i}`} className={`cena-efeito cena-bolha cena-bolha-${i + 1}`} />
      ))}
      {Array.from({ length: PEIXES }, (_, i) => (
        <span key={`p${i}`} className={`cena-efeito cena-peixe cena-peixe-${i + 1}`}>
          <span className="cena-efeito cena-peixe-quadros" />
        </span>
      ))}
    </div>
  );
}
