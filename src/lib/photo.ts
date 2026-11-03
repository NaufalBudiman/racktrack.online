// Reading a photo of labels in the browser. Both engines load on demand (WASM + language data come from a CDN).

/** Every barcode / QR in the photo (a box label has several: SN, BOM code, MAC…; a stack of boxes has many). */
export async function readCodes(file: Blob): Promise<string[]> {
  const { readBarcodes } = await import("zxing-wasm/reader");
  const results = await readBarcodes(file, { tryHarder: true, tryInvert: true, maxNumberOfSymbols: 64 });
  return [...new Set(results.filter((r) => r.isValid && r.text.trim()).map((r) => r.text.trim()))];
}

/** Printed text on the label (for the model name when no barcode carries it). Slow the first time: ~10 MB download. */
export async function readText(file: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
