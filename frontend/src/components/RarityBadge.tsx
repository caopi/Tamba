import type { Rarity } from "../types";
import "./RarityBadge.css";

const ROTULOS: Record<Rarity, string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  muito_raro: "Muito raro",
};

/** Selo de raridade da espécie (definida pelo admin no catálogo — RGN-11). */
export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <span className={`raridade raridade-${rarity}`}>{ROTULOS[rarity]}</span>;
}
