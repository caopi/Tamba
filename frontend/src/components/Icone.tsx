import type { ReactNode } from "react";

/**
 * Ícone com duas versões: a padrão (emoji ou SVG de traço, a de sempre) e a
 * pixel do tema retrô — um sprite colorido (npm run sprites) ou, onde não há
 * sprite, um ícone da Streamline "Pixel - Free" (CC BY 4.0).
 *
 * As duas vão para o HTML; quem escolhe qual aparece é o CSS. Sem o tema, o
 * span pixel fica vazio e sem tamanho — some sozinho, sem regra nenhuma —, e
 * a versão padrão aparece como antes. Com o tema, retro.css esconde a padrão
 * e desenha a pixel por máscara, na cor do texto (currentColor), em 21 px:
 * o desenho é uma grade de 21 × 21, e só em múltiplos inteiros dela (21,
 * 42...) cada pixel do desenho cai num pixel da tela.
 *
 * Os nomes são os de backend/database/pixel-icons.js (npm run pixel-icons).
 */
export type NomeIcone =
  // Streamline "Pixel - Free" (máscara, na cor do texto): os que não têm
  // equivalente nas folhas de sprites.
  | "denunciar"
  | "lapis"
  // Sprites coloridos (styles/retro/sprites, npm run sprites): imagem, não máscara.
  | "tambaqui"
  | "cadeado"
  | "barra-dex"
  | "barra-registrar"
  | "barra-feed"
  | "barra-notificacoes"
  | "feed-curtir"
  | "feed-curtido"
  | "feed-comentar"
  | "feed-compartilhar"
  | "feed-moderar"
  | "foto-camera"
  | "foto-galeria"
  | "local"
  | "config";

export function Icone({ nome, padrao }: { nome: NomeIcone; padrao?: ReactNode }) {
  return (
    <>
      {padrao !== undefined && <span className="icone-padrao">{padrao}</span>}
      <span className={`icone-pixel icone-${nome}`} aria-hidden="true" />
    </>
  );
}
