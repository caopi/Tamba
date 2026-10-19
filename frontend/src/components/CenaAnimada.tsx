/**
 * Camada animada da cena de fundo do tema retrô ("Parallax Backgrounds:
 * Dock", de Admurin). Só cria os elementos; posição, tamanho e animação
 * estão todos em styles/retro/retro.css (e nada aparece com o tema
 * desligado).
 *
 * - As nove camadas da cena, uma por elemento, para cada uma andar na sua
 *   velocidade (parallax). Só aparecem com a classe `cena-movel` no <html>;
 *   sem ela, fica a cena parada que o body desenha.
 * - Os efeitos: raios de luz, bolhas e peixes. A classe
 *   `cena-efeitos-parados` no <html> os congela.
 * - `animada`: só no Dex e no Feed. Atrás de formulário (Registrar Captura,
 *   Configurações) o movimento distrai, então ali a cena fica parada. Com
 *   prefers-reduced-motion, o CSS esconde a camada inteira: sobra só a cena
 *   parada.
 * - Poucos elementos de propósito (9 camadas, 3 raios, 6 bolhas, até 5
 *   peixes): a camada está em toda tela. As animações mexem só em transform e
 *   opacity, que o navegador anima sem refazer layout nem pintura.
 *
 * Peixes: qualquer PNG transparente em styles/retro/peixes/ vira um peixe,
 * virado para a direita (o CSS espelha os que nadam para a esquerda). Os
 * cinco primeiros, em ordem alfabética, ganham cada um uma profundidade,
 * tamanho, velocidade e sentido diferentes.
 */
const SPRITES = Object.values(
  import.meta.glob<string>("../styles/retro/peixes/*.png", { eager: true, query: "?url", import: "default" }),
).slice(0, 5);

const CAMADAS = 9;
const RAIOS = 3;
const BOLHAS = 6;

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
      {SPRITES.map((src, i) => (
        <img key={src} src={src} alt="" className={`cena-efeito cena-peixe cena-peixe-${i + 1}`} decoding="async" />
      ))}
    </div>
  );
}
