// Geocodificação reversa: coordenada -> "Cidade, UF", pelo Nominatim
// (OpenStreetMap). Só preenche a região de uma captura quando o usuário usou o
// GPS e não deu nenhum outro lugar (regra no catch.service). Ver ARQUITETURA.md,
// "Região pelo GPS".
//
// - Coordenada arredondada para 2 casas (~1 km) ANTES de sair daqui: não
//   muda o nome da cidade, e o Nominatim nunca recebe o ponto exato — o
//   mesmo dado que o RGN-13 esconde dos outros usuários.
// - zoom=10 pede o nível de cidade: a resposta nem traz rua nem bairro.
// - Política de uso do Nominatim: User-Agent que identifica o app, no máximo
//   1 requisição por segundo, e cache. A fila e o cache ficam na memória do
//   processo — vale porque a API roda numa instância só (o volume de uploads
//   já obriga a isso).
// - Falha calada: erro de rede, timeout, resposta estranha ou ponto fora do
//   Brasil devolvem null, e a região fica vazia, como se não houvesse GPS.

const URL_BASE = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
const USER_AGENT = "Tamba/1.0 (diario de pesca, projeto academico IFSP; https://github.com/caopi/Tamba)";
const TIMEOUT_MS = 2500;
const INTERVALO_MS = 1100; // um pouco acima de 1 s, para não encostar no limite
const MAX_CACHE = 500;

const cache = new Map();
// Cada consulta espera a anterior e o intervalo: no máximo 1 por segundo.
let fila = Promise.resolve();
let ultima = 0;

const arredondar = (valor) => Math.round(valor * 100) / 100;

/** Resposta do Nominatim -> "Cidade, UF", ou null fora do Brasil ou sem cidade. */
function cidadeUf(resposta) {
  const endereco = resposta?.address;
  if (endereco?.country_code !== "br") return null;
  const cidade = endereco.city ?? endereco.town ?? endereco.village ?? endereco.municipality;
  const uf = /^BR-([A-Z]{2})$/.exec(endereco["ISO3166-2-lvl4"] ?? "")?.[1];
  return cidade && uf ? `${cidade}, ${uf}`.slice(0, 120) : null;
}

async function consultar(lat, lon) {
  const espera = ultima + INTERVALO_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();

  const url = `${URL_BASE}/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=pt-BR&lat=${lat}&lon=${lon}`;
  const resposta = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return cidadeUf(await resposta.json());
}

/** "Cidade, UF" da coordenada, ou null. Nunca lança. */
export async function regiaoDaCoordenada(latitude, longitude) {
  const lat = arredondar(latitude);
  const lon = arredondar(longitude);
  const chave = `${lat},${lon}`;
  if (cache.has(chave)) return cache.get(chave);

  const tentativa = fila.then(() => consultar(lat, lon));
  fila = tentativa.catch(() => {});
  try {
    const regiao = await tentativa;
    // Só guarda resposta de verdade (inclusive "fora do Brasil" = null); erro
    // de rede não, para tentar de novo na próxima.
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(chave, regiao);
    return regiao;
  } catch (err) {
    console.warn(`Geocodificação reversa falhou (${chave}): ${err.message}`);
    return null;
  }
}
