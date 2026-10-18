import type { FishSpecies } from "../types";
import { licencaUrl } from "../format";
import "./PhotoCredit.css";

/**
 * "Foto: autor · licença · origem", e embaixo a legenda quando houver ("Na
 * foto: ..."). CC BY exige atribuição com autor, licença e link; a ficha da
 * espécie mostra sempre, e a tela /creditos usa este mesmo componente.
 *
 * Licença sem página (domínio público, "Todos os direitos reservados" das
 * fotos da equipe) sai como texto; sem link de origem, a parte "origem" some.
 */
export function PhotoCredit({
  especie,
}: {
  especie: Pick<FishSpecies, "imageUrl" | "imageCredit" | "imageLicense" | "imageSourceUrl" | "imageCaption">;
}) {
  if (!especie.imageUrl || !especie.imageCredit) return null;
  const urlLicenca = licencaUrl(especie.imageLicense);

  return (
    <div className="credito-foto">
      <p>
        Foto: {especie.imageCredit}
        {especie.imageLicense && (
          <>
            {" · "}
            {urlLicenca ? (
              <a href={urlLicenca} target="_blank" rel="noreferrer">
                {especie.imageLicense}
              </a>
            ) : (
              especie.imageLicense
            )}
          </>
        )}
        {especie.imageSourceUrl && (
          <>
            {" · "}
            <a href={especie.imageSourceUrl} target="_blank" rel="noreferrer">
              origem
            </a>
          </>
        )}
      </p>
      {especie.imageCaption && <p className="credito-legenda">{especie.imageCaption}</p>}
    </div>
  );
}
