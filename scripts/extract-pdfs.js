const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function extractPdfToText(pdfPath, outputDir) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const base = path.basename(pdfPath, path.extname(pdfPath));
  const outPath = path.join(outputDir, `${base}.txt`);
  fs.writeFileSync(outPath, data.text || '');
  return outPath;
}

async function main() {
  const docsDir = path.resolve(__dirname, '..', 'docs');
  const outDir = path.join(docsDir, 'extracted');
  await ensureDir(outDir);

  const entries = fs.readdirSync(docsDir);
  const pdfs = entries.filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) {
    console.log('No PDF files found in docs/.');
    return;
  }

  console.log(`Found ${pdfs.length} PDF(s). Extracting...`);
  for (const pdf of pdfs) {
    const pdfPath = path.join(docsDir, pdf);
    try {
      const out = await extractPdfToText(pdfPath, outDir);
      console.log(`Extracted: ${pdf} -> ${out}`);
    } catch (e) {
      console.error(`Failed to extract ${pdf}:`, e.message);
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

