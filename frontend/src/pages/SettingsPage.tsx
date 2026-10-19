import { useRef, useState, type FormEvent } from "react";
import { authApi } from "../api/auth";
import { uploadPhoto } from "../api/uploads";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/Avatar";
import { compressImage } from "../imageCompression";
import type { FeedOrder, MeasurementUnit } from "../types";
import "./SettingsPage.css";

/**
 * Perfil e configurações (UC007, REQ-39/40): nome, apelido e foto; unidade de
 * medida; privacidade da localização (RGN-13); preferências de notificação.
 *
 * Um formulário só, salvo de uma vez. A foto sobe assim que é escolhida (como
 * nas capturas) e só vira avatar quando o usuário clica em Salvar.
 */
export function SettingsPage() {
  const { user, atualizarUsuario } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [unidade, setUnidade] = useState<MeasurementUnit>(user?.measurementUnit ?? "kg");
  const [ordemFeed, setOrdemFeed] = useState<FeedOrder>(user?.feedOrder ?? "engagement");
  const [compartilhar, setCompartilhar] = useState(user?.shareExactLocation ?? false);
  const [notifyLikes, setNotifyLikes] = useState(user?.notifyLikes ?? true);
  const [notifyComments, setNotifyComments] = useState(user?.notifyComments ?? true);
  const [notifyFollows, setNotifyFollows] = useState(user?.notifyFollows ?? true);

  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);

  if (!user) return null;

  async function escolherFoto(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;
    setErro(null);
    setEnviandoFoto(true);
    try {
      // Avatar aparece pequeno: 512 px bastam (e o EXIF/GPS sai junto).
      const comprimida = await compressImage(arquivo, 512);
      const { url } = await uploadPhoto(comprimida);
      setAvatarUrl(url);
      setSalvo(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto");
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvo(false);
    setSalvando(true);
    try {
      const atualizado = await authApi.updateMe({
        name: name.trim(),
        nickname: nickname.trim(),
        avatarUrl,
        measurementUnit: unidade,
        feedOrder: ordemFeed,
        shareExactLocation: compartilhar,
        notifyLikes,
        notifyComments,
        notifyFollows,
      });
      atualizarUsuario(atualizado);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="config">
      <h2>Configurações</h2>

      <form className="config-form" onSubmit={salvar} onChange={() => setSalvo(false)}>
        <fieldset>
          <legend>Perfil</legend>
          <div className="config-avatar">
            <Avatar id={user.id} name={name || user.name} avatarUrl={avatarUrl} tamanho={72} />
            <div className="config-avatar-botoes">
              <button type="button" className="secundario" onClick={() => seletor.current?.click()} disabled={enviandoFoto}>
                {enviandoFoto ? "Enviando…" : "Trocar foto"}
              </button>
              {avatarUrl && (
                <button type="button" className="link" onClick={() => setAvatarUrl(null)}>
                  remover foto
                </button>
              )}
            </div>
            <input
              ref={seletor}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                escolherFoto(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
          </label>
          <label>
            Apelido
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_.]+"
              title="Letras, números, ponto e sublinhado"
            />
            <span className="campo-dica">Único no Tamba (sem diferenciar maiúsculas).</span>
          </label>
        </fieldset>

        <fieldset>
          <legend>Unidades</legend>
          <label className="config-opcao">
            <input type="radio" name="unidade" checked={unidade === "kg"} onChange={() => setUnidade("kg")} />
            Métrico — quilos e centímetros
          </label>
          <label className="config-opcao">
            <input type="radio" name="unidade" checked={unidade === "lb"} onChange={() => setUnidade("lb")} />
            Imperial — libras e polegadas
          </label>
        </fieldset>

        <fieldset>
          <legend>Feed</legend>
          <label className="config-opcao">
            <input
              type="radio"
              name="ordem-feed"
              checked={ordemFeed === "engagement"}
              onChange={() => setOrdemFeed("engagement")}
            />
            Mais curtidas e comentários primeiro (padrão)
          </label>
          <label className="config-opcao">
            <input type="radio" name="ordem-feed" checked={ordemFeed === "recent"} onChange={() => setOrdemFeed("recent")} />
            Mais recentes primeiro
          </label>
        </fieldset>

        <fieldset>
          <legend>Privacidade</legend>
          <label className="config-opcao">
            <input type="checkbox" checked={compartilhar} onChange={(e) => setCompartilhar(e.target.checked)} />
            Compartilhar a localização exata das minhas capturas
          </label>
          <span className="campo-dica">
            Desligado, os outros veem só a cidade/região; a coordenada exata fica só para você.
          </span>
        </fieldset>

        <fieldset>
          <legend>Notificações</legend>
          <p className="campo-dica">Os avisos aparecem no sino 🔔 do topo. Escolha quais você quer receber:</p>
          <label className="config-opcao">
            <input type="checkbox" checked={notifyLikes} onChange={(e) => setNotifyLikes(e.target.checked)} />
            Quando curtirem uma captura minha
          </label>
          <label className="config-opcao">
            <input type="checkbox" checked={notifyComments} onChange={(e) => setNotifyComments(e.target.checked)} />
            Quando comentarem numa captura minha
          </label>
          <label className="config-opcao">
            <input type="checkbox" checked={notifyFollows} onChange={(e) => setNotifyFollows(e.target.checked)} />
            Quando alguém começar a me seguir
          </label>
        </fieldset>

        {erro && <p className="erro">{erro}</p>}
        {salvo && <p className="config-salvo">Alterações salvas.</p>}

        <button type="submit" disabled={salvando || enviandoFoto}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>
    </section>
  );
}
