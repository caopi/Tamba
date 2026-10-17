import { useState, type FormEvent } from "react";
import { postApi } from "../api/social";

/**
 * Denunciar uma captura com motivo (REQ-34). Opções prontas para o caso
 * comum e "Outro" com texto livre. Denúncias de usuários distintos ocultam a
 * captura automaticamente até um admin analisar (RGN-14) — isso é no backend.
 */
const MOTIVOS = [
  "A foto não é dessa pessoa ou não é dessa pescaria",
  "Peso ou tamanho impossível para o peixe",
  "Conteúdo impróprio ou ofensivo",
];

export function ReportDialog({ catchId, aoFechar }: { catchId: string; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [outro, setOutro] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const razao = motivo === "outro" ? outro.trim() : motivo;
    if (razao.length < 3) {
      setErro("Conte o motivo da denúncia");
      return;
    }
    setErro(null);
    setEstado("enviando");
    try {
      await postApi.report(catchId, razao);
      setEstado("enviado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a denúncia");
      setEstado("editando");
    }
  }

  return (
    <div className="dialogo-fundo" onClick={aoFechar}>
      <div
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-label="Denunciar captura"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Denunciar captura</h3>

        {estado === "enviado" ? (
          <>
            <p>Denúncia enviada. Obrigado por avisar — a moderação vai analisar.</p>
            <div className="dialogo-botoes">
              <button type="button" onClick={aoFechar}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={enviar} className="denuncia-form">
            {[...MOTIVOS, "outro"].map((m) => (
              <label key={m} className="denuncia-opcao">
                <input
                  type="radio"
                  name="motivo"
                  value={m}
                  checked={motivo === m}
                  onChange={() => setMotivo(m)}
                />
                {m === "outro" ? "Outro motivo" : m}
              </label>
            ))}
            {motivo === "outro" && (
              <textarea
                rows={3}
                maxLength={500}
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                placeholder="Conte o que há de errado"
                autoFocus
              />
            )}
            {erro && <p className="erro">{erro}</p>}
            <div className="dialogo-botoes">
              <button type="button" className="secundario" onClick={aoFechar}>
                Cancelar
              </button>
              <button type="submit" disabled={estado === "enviando"}>
                {estado === "enviando" ? "Enviando…" : "Denunciar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
