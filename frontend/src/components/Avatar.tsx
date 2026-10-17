import "./Avatar.css";

/** Foto do usuário, ou a inicial do nome num círculo quando não há foto. */
export function Avatar({
  name,
  avatarUrl,
  tamanho = 36,
}: {
  name: string;
  avatarUrl: string | null;
  tamanho?: number;
}) {
  const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.42 };
  if (avatarUrl) {
    return <img className="avatar" src={avatarUrl} alt="" style={estilo} />;
  }
  return (
    <span className="avatar avatar-inicial" aria-hidden="true" style={estilo}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
