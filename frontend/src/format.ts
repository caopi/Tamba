// Formatação compartilhada entre telas (datas, faixas plausíveis).

export const formatarData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

const relativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/**
 * "agora", "há 5 minutos", "há 3 horas", "ontem", "há 4 dias"; passou de uma
 * semana, a data. `agora` é parâmetro só para teste.
 */
export function tempoRelativo(iso: string, agora = Date.now()) {
  const segundos = Math.round((new Date(iso).getTime() - agora) / 1000);
  const passado = -segundos;
  if (passado < 60) return "agora";
  if (passado < 3600) return relativo.format(Math.round(segundos / 60), "minute");
  if (passado < 86400) return relativo.format(Math.round(segundos / 3600), "hour");
  if (passado < 7 * 86400) return relativo.format(Math.round(segundos / 86400), "day");
  return formatarData(iso);
}

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
