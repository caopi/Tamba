import "./Avatar.css";

/** Quantas cores de inicial existem (a paleta está no CSS: data-cor 0..7). */
const CORES = 8;

/**
 * Cor da inicial a partir do id da conta: um hash (FNV-1a de 32 bits) do id,
 * mapeado para uma das CORES. Determinístico — a mesma conta tem sempre a
 * mesma cor, em qualquer aparelho e a cada recarga —, e de uma paleta
 * escolhida a dedo, não de um matiz contínuo: um matiz qualquer acabaria
 * brigando com a moldura ou deixando a letra ilegível.
 */
function corDaConta(id: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % CORES;
}

/** Foto do usuário, ou a inicial do nome num quadro colorido quando não há foto. */
export function Avatar({
  id,
  name,
  avatarUrl,
  tamanho = 36,
}: {
  /** Id da conta: decide a cor da inicial. */
  id: string;
  name: string;
  avatarUrl: string | null;
  tamanho?: number;
}) {
  const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.42 };
  if (avatarUrl) {
    return <img className="avatar" src={avatarUrl} alt="" style={estilo} />;
  }
  return (
    <span className="avatar avatar-inicial" data-cor={corDaConta(id)} aria-hidden="true" style={estilo}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
