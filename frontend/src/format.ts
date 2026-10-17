// Formatação compartilhada entre telas (datas, faixas plausíveis).

export const formatarData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

const numero = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/**
 * Faixa plausível da espécie em texto: "0,2 – 50 kg". Lida com a faixa só
 * de um lado, e devolve null quando a espécie não tem faixa cadastrada.
 */
export function formatarFaixa(min: number | null, max: number | null, unidade: string) {
  if (min !== null && max !== null) return `${numero(min)} – ${numero(max)} ${unidade}`;
  if (min !== null) return `a partir de ${numero(min)} ${unidade}`;
  if (max !== null) return `até ${numero(max)} ${unidade}`;
  return null;
}
