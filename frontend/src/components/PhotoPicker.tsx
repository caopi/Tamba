import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { uploadPhoto } from "../api/uploads";
import { compressImage } from "../imageCompression";
import { Icone } from "./Icone";
import "./PhotoPicker.css";

/**
 * Seletor de fotos da captura (REQ-15): câmera ou galeria, várias fotos,
 * miniaturas, remover e escolher a capa (a primeira da lista é a foto de
 * posição 0).
 *
 * Cada foto é comprimida no aparelho (RNF-09) e enviada assim que escolhida,
 * uma por request: assim cada uma tem a sua barra de progresso, e a que
 * falhar pode ser reenviada sozinha. Quando o usuário salva a captura, as
 * fotos já estão no servidor.
 *
 * A lista mora no componente PAI (`fotos` / `setFotos`): se salvar a captura
 * falhar, nada do que foi escolhido se perde.
 */

export const MAX_FOTOS = 10;

export interface FotoItem {
  /** Chave local, só para o React. */
  chave: string;
  /**
   * Arquivo original, guardado para reenviar se falhar. Não existe nas fotos
   * que a captura já tinha (edição): essas já estão no servidor.
   */
  arquivo?: File;
  /** Miniatura: object URL do arquivo original, ou a URL da foto já enviada. */
  previa: string;
  status: "comprimindo" | "enviando" | "ok" | "erro";
  /** 0 a 1, durante o envio. */
  progresso: number;
  /** URL no servidor, depois do envio. */
  url?: string;
  erro?: string;
}

let contador = 0;

/** Solta a miniatura local (object URL); a URL de foto já enviada não precisa. */
function liberarPrevia(item: FotoItem) {
  if (item.previa.startsWith("blob:")) URL.revokeObjectURL(item.previa);
}

/** Fotos que a captura já tem, no formato da lista (edição). */
export function fotosExistentes(urls: string[]): FotoItem[] {
  return urls.map((url, i) => ({ chave: `existente-${i}`, previa: url, status: "ok", progresso: 1, url }));
}

export function PhotoPicker({
  fotos,
  setFotos,
  invalido,
}: {
  fotos: FotoItem[];
  setFotos: Dispatch<SetStateAction<FotoItem[]>>;
  invalido?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Libera as miniaturas da memória quando a tela é desmontada. O ref guarda
  // a lista mais recente para a limpeza do unmount enxergá-la.
  const atuais = useRef(fotos);
  useEffect(() => {
    atuais.current = fotos;
  }, [fotos]);
  useEffect(() => () => atuais.current.forEach(liberarPrevia), []);

  const atualizar = (chave: string, mudancas: Partial<FotoItem>) =>
    setFotos((lista) => lista.map((f) => (f.chave === chave ? { ...f, ...mudancas } : f)));

  /** Comprime e envia uma foto, atualizando o status dela na lista. */
  async function processar(item: FotoItem) {
    // Foto que já estava na captura (edição): nada a enviar.
    if (!item.arquivo) return;
    atualizar(item.chave, { status: "comprimindo", progresso: 0, erro: undefined });
    try {
      const comprimida = await compressImage(item.arquivo);
      atualizar(item.chave, { status: "enviando" });
      const { url } = await uploadPhoto(comprimida, (progresso) =>
        atualizar(item.chave, { progresso }),
      );
      atualizar(item.chave, { status: "ok", url, progresso: 1 });
    } catch (e) {
      atualizar(item.chave, {
        status: "erro",
        erro: e instanceof Error ? e.message : "Falha no envio",
      });
    }
  }

  function adicionar(lista: FileList | null) {
    setAviso(null);
    if (!lista || lista.length === 0) return;

    const vagas = MAX_FOTOS - fotos.length;
    const escolhidos = Array.from(lista).slice(0, Math.max(vagas, 0));
    if (lista.length > vagas) {
      setAviso(`Cada captura aceita até ${MAX_FOTOS} fotos; ${lista.length - escolhidos.length} ficaram de fora.`);
    }

    const novos: FotoItem[] = escolhidos.map((arquivo) => ({
      chave: `foto-${++contador}`,
      arquivo,
      previa: URL.createObjectURL(arquivo),
      status: "comprimindo",
      progresso: 0,
    }));
    setFotos((atual) => [...atual, ...novos]);
    novos.forEach(processar);
  }

  function remover(item: FotoItem) {
    liberarPrevia(item);
    setFotos((lista) => lista.filter((f) => f.chave !== item.chave));
    setAviso(null);
  }

  function tornarCapa(item: FotoItem) {
    setFotos((lista) => [item, ...lista.filter((f) => f.chave !== item.chave)]);
  }

  const cheio = fotos.length >= MAX_FOTOS;

  return (
    <div className={invalido ? "fotos invalido" : "fotos"}>
      <div className="fotos-botoes">
        {/* capture: no celular abre direto a câmera traseira. Num botão
            separado porque, com capture, o Android não oferece a galeria. */}
        <button type="button" className="secundario" onClick={() => camera.current?.click()} disabled={cheio}>
          <Icone nome="foto-camera" />
          Tirar foto
        </button>
        <button type="button" className="secundario" onClick={() => galeria.current?.click()} disabled={cheio}>
          <Icone nome="foto-galeria" />
          Galeria
        </button>
        <span className="campo-dica">
          {fotos.length}/{MAX_FOTOS}
        </span>
      </div>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          adicionar(e.target.files);
          // Limpa para o mesmo arquivo poder ser escolhido de novo.
          e.target.value = "";
        }}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        multiple
        hidden
        onChange={(e) => {
          adicionar(e.target.files);
          e.target.value = "";
        }}
      />

      {aviso && <p className="campo-dica">{aviso}</p>}

      {fotos.length > 0 && (
        <ul className="fotos-grade">
          {fotos.map((item, indice) => (
            <li key={item.chave} className={`foto foto-${item.status}`}>
              <img src={item.previa} alt={`Foto ${indice + 1}`} />

              {indice === 0 && <span className="foto-capa">Capa</span>}

              <button
                type="button"
                className="foto-remover"
                onClick={() => remover(item)}
                aria-label={`Remover foto ${indice + 1}`}
              >
                ✕
              </button>

              {(item.status === "comprimindo" || item.status === "enviando") && (
                <div className="foto-progresso" aria-label="Enviando">
                  <div style={{ width: `${Math.round(item.progresso * 100)}%` }} />
                  <span>{item.status === "comprimindo" ? "Preparando…" : `${Math.round(item.progresso * 100)}%`}</span>
                </div>
              )}

              {item.status === "erro" && (
                <div className="foto-falha" title={item.erro}>
                  <span>Falhou</span>
                  <button type="button" onClick={() => processar(item)}>
                    Tentar de novo
                  </button>
                </div>
              )}

              {indice > 0 && item.status === "ok" && (
                <button type="button" className="foto-tornar-capa" onClick={() => tornarCapa(item)}>
                  Tornar capa
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
