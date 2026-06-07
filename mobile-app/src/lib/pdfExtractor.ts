/**
 * Extract raw text from a PDF file using pdfjs-dist (bundled via npm, works offline).
 *
 * This replaces the old CDN-based approach. The library is loaded as an ES module
 * and configured with a local worker so no network access is required at runtime.
 */

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.js',
  import.meta.url,
).toString();

/**
 * Extract all text content from every page of a PDF file.
 *
 * @param file  A browser File/Blob containing the PDF data.
 * @returns     The concatenated text of all pages, separated by newlines.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Reconstruct lines by tracking vertical position (Y-coordinate) and EOL flags
    let lastY = -1;
    let pageText = '';
    
    for (const item of textContent.items as any[]) {
      const str = item.str || '';
      // transform represents the matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
      // translateY (index 5) is the vertical position on the page
      const currentY = item.transform ? item.transform[5] : -1;
      
      if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
        // Significant difference in vertical Y position indicates a new line
        pageText += '\n';
      } else if (item.hasEOL) {
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
        pageText += ' ';
      }
      
      pageText += str;
      lastY = currentY;
    }

    fullText += pageText + '\n';
  }

  return fullText;
}
