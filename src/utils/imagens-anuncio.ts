const MAX_IMAGE_DIMENSION = 1600;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
    image.src = src;
  });
}

export async function processarImagemAnuncio(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem valido.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("A imagem deve ter no maximo 10 MB.");
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height, 1);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestSide);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  const compressedDataUrl = canvas.toDataURL("image/webp", 0.86);

  return compressedDataUrl.length < originalDataUrl.length ? compressedDataUrl : originalDataUrl;
}

