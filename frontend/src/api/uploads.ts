import { ApiError, BASE_URL, tokenStorage } from "./client";

export interface UploadedPhoto {
  id: string;
  url: string;
}

/**
 * Envia uma foto para POST /uploads e devolve `{ id, url }`.
 *
 * É a única chamada que não passa pelo `api()` do client.ts: o `fetch` não
 * informa o progresso do envio, e a tela mostra uma barra por foto. Por isso
 * XMLHttpRequest, com o mesmo token e o mesmo `ApiError` do resto.
 */
export function uploadPhoto(
  foto: Blob,
  aoProgredir?: (fracao: number) => void,
): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/uploads`);

    const token = tokenStorage.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) aoProgredir?.(evento.loaded / evento.total);
    };

    xhr.onload = () => {
      let corpo: { id?: string; url?: string; error?: string; code?: string } | null = null;
      try {
        corpo = JSON.parse(xhr.responseText);
      } catch {
        // resposta sem JSON: cai na mensagem genérica abaixo
      }

      if (xhr.status >= 200 && xhr.status < 300 && corpo?.url) {
        resolve(corpo as UploadedPhoto);
      } else {
        reject(new ApiError(corpo?.error ?? "Falha no envio da foto", xhr.status, corpo?.code));
      }
    };
    xhr.onerror = () => reject(new ApiError("Sem conexão com o servidor", 0));

    const form = new FormData();
    // O nome aqui é ignorado pelo servidor, que gera o próprio.
    form.append("photo", foto, "foto.jpg");
    xhr.send(form);
  });
}
