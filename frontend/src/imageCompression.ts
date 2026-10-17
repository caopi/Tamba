// Compressão de foto no próprio aparelho, antes do envio (RNF-09).
//
// Foto de celular sai com 3–8 MB e 4000 px de lado; para mostrar no app,
// 1600 px em JPEG de qualidade 0,82 fica em torno de 200–500 KB sem diferença
// visível. É o navegador que faz o trabalho, com <canvas> — sem biblioteca.
// Formatos que o navegador não decodifica (ex.: HEIC no Chrome de desktop)
// dão erro aqui, e a miniatura mostra "Falhou".
//
// Efeito colateral bom: redesenhar no canvas descarta os metadados EXIF da
// foto original, inclusive a coordenada de GPS que o celular grava. A
// localização exata só vai para o servidor se o usuário informar (RGN-13).

const LADO_MAXIMO = 1600;
const QUALIDADE = 0.82;

/** Carrega o arquivo numa <img>. O navegador já aplica a rotação do EXIF. */
function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler essa imagem. Use uma foto JPEG, PNG ou WebP."));
    };
    img.src = url;
  });
}

/**
 * Redimensiona para no máximo 1600 px de lado e reencoda em JPEG.
 *
 * Se o JPEG sair MAIOR que o original — acontece com imagem de cores chapadas,
 * como print de tela em PNG —, manda o original. Exceto quando o original é
 * JPEG: esse é o formato em que a câmera grava o EXIF com GPS, então sempre
 * passa pelo canvas, mesmo que não fique menor.
 */
export async function compressImage(arquivo: File): Promise<Blob> {
  const comprimida = await reencodar(arquivo);
  const ehJpeg = arquivo.type === "image/jpeg";
  return !ehJpeg && comprimida.size >= arquivo.size ? arquivo : comprimida;
}

async function reencodar(arquivo: File): Promise<Blob> {
  const img = await carregarImagem(arquivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
  const largura = Math.round(img.naturalWidth * escala);
  const altura = Math.round(img.naturalHeight * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("O navegador não conseguiu processar a imagem");

  // JPEG não tem transparência: sem um fundo, o transparente de um PNG vira preto.
  contexto.fillStyle = "#fff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(img, 0, 0, largura, altura);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir a imagem"))),
      "image/jpeg",
      QUALIDADE,
    );
  });
}
