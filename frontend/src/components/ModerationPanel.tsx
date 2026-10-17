import { useEffect, useState } from "react";
import { adminApi } from "../api/admin";
import { formatarData } from "../format";
import type { Catch, CatchReports } from "../types";
import "./ModerationPanel.css";

/**
 * Moderação de uma captura, dentro do próprio post (UC011). Só aparece para
 * admin; a API recusa (403) para os demais de qualquer jeito.
 *
 * Mostra se a captura está visível ou oculta, as denúncias com o motivo e
 * quem denunciou, e as decisões. Toda decisão marca as denúncias pendentes
 * como analisadas (POST /admin/catches/:id/review).
 */
export function ModerationPanel({
  captura,
  aoMudar,
}: {
  captura: Catch;
  aoMudar?: (nova: Catch) => void;
}) {
  const [dados, setDados] = useState<CatchReports | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    adminApi
      .catchReports(captura.id)
      .then(setDados)
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar as denúncias"));
  }, [captura.id]);

  async function decidir(ocultar: boolean) {
    setEnviando(true);
    setErro(null);
    try {
      await adminApi.review(captura.id, ocultar);
      setDados(await adminApi.catchReports(captura.id));
      aoMudar?.({ ...captura, isHidden: ocultar });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aplicar a decisão");
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !dados) return <div className="moderacao"><p className="erro">{erro}</p></div>;
  if (!dados) return <div className="moderacao"><p className="campo-dica">Carregando denúncias…</p></div>;

  const oculta = dados.isHidden;
  const pendentes = dados.pendingCount;

  return (
    <div className="moderacao">
      <p className="moderacao-status">
        🛡 <strong>{oculta ? "Oculta" : "Visível"}</strong> ·{" "}
        {pendentes === 0
          ? "nenhuma denúncia pendente"
          : `${pendentes} ${pendentes === 1 ? "denúncia pendente" : "denúncias pendentes"}`}
      </p>

      {dados.reports.length > 0 && (
        <ul className="moderacao-denuncias">
          {dados.reports.map((r) => (
            <li key={r.id} className={r.status === "analisado" ? "analisada" : undefined}>
              “{r.reason}” — @{r.reporter.nickname}, {formatarData(r.createdAt)}
              {r.status === "analisado" && <span className="campo-dica"> (analisada)</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="moderacao-botoes">
        {oculta ? (
          <>
            <button type="button" onClick={() => decidir(false)} disabled={enviando}>
              Reexibir captura
            </button>
            {pendentes > 0 && (
              <button type="button" className="secundario" onClick={() => decidir(true)} disabled={enviando}>
                Manter oculta e encerrar denúncias
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="perigo" onClick={() => decidir(true)} disabled={enviando}>
              Ocultar captura
            </button>
            {pendentes > 0 && (
              <button type="button" className="secundario" onClick={() => decidir(false)} disabled={enviando}>
                Denúncias improcedentes (manter visível)
              </button>
            )}
          </>
        )}
      </div>
      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}
