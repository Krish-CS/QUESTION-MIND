/**
 * Syllabus Parser — Full JavaScript port of backend syllabus_parser.py
 *
 * Extracts units and topics from PDF, DOCX, and Excel files using:
 *   - pdfjs-dist  (PDF text extraction)
 *   - mammoth     (DOCX text extraction)
 *   - xlsx        (Excel parsing)
 *
 * All processing is local — no network calls, no backend dependency.
 */

import * as XLSX from 'xlsx';
import { extractTextFromPDF } from '../pdfExtractor';

// We dynamically import mammoth only when needed (DOCX files)
let mammothModule: any = null;
async function getMammoth() {
  if (!mammothModule) {
    mammothModule = await import('mammoth');
  }
  return mammothModule;
}

export interface SyllabusUnit {
  unitNumber: number;
  title: string;
  topics: string[];
}

export class SyllabusParser {
  // ======================== Public Entry Point ========================

  /**
   * Parse syllabus from any supported file format.
   */
  static async parseFile(file: File): Promise<SyllabusUnit[]> {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'pdf') {
      return this.parsePDF(file);
    } else if (['docx', 'doc'].includes(ext)) {
      return this.parseDOCX(file);
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return this.parseExcel(file);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  // ======================== Format-Specific Parsers ========================

  /**
   * Parse PDF syllabus: extract text with pdfjs-dist, then run regex logic.
   */
  static async parsePDF(file: File): Promise<SyllabusUnit[]> {
    try {
      console.log('[SyllabusParser] Extracting PDF text via pdfjs-dist...');
      const text = await extractTextFromPDF(file);
      console.log(`[SyllabusParser] Extracted ${text.length} chars from PDF`);
      return this.extractModulesRegex(text);
    } catch (error) {
      console.error('[SyllabusParser] PDF parse error:', error);
      return [];
    }
  }

  /**
   * Parse DOCX syllabus: extract text with mammoth, then run regex logic.
   */
  static async parseDOCX(file: File): Promise<SyllabusUnit[]> {
    try {
      console.log('[SyllabusParser] Extracting DOCX text via mammoth...');
      const mammoth = await getMammoth();
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || '';
      console.log(`[SyllabusParser] Extracted ${text.length} chars from DOCX`);
      return this.extractModulesRegex(text);
    } catch (error) {
      console.error('[SyllabusParser] DOCX parse error:', error);
      return [];
    }
  }

  /**
   * Parse Excel/CSV syllabus: read with XLSX, then parse table rows.
   */
  static async parseExcel(file: File): Promise<SyllabusUnit[]> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      return this.parseTableRows(data);
    } catch (error) {
      console.error('[SyllabusParser] Excel parse error:', error);
      return [];
    }
  }

  // ======================== Core Regex Parser (ported from Python) ========================

  /**
   * Extract modules using regex — handles table-based and text-based syllabi.
   * Skips 'Guided Self-Study Topics' sections.
   *
   * Ported from syllabus_parser.py → _extract_modules_regex()
   */
  static extractModulesRegex(text: string): SyllabusUnit[] {
    const units: SyllabusUnit[] = [];

    // Normalize whitespace
    text = this.normalizeText(text);

    // Regex: matches "Module I", "UNIT 1", "Module - 1", "UNIT-III", etc.
    // Allow leading pipes/whitespace for table rows.
    const moduleHeaderPattern =
      /^[|:\s]*(?:Module|Unit|UNIT|MODULE)\s*[-]?\s*([IVX]+|\d+)\s*[:|.\-]?\s*(.*?)(?:\s*(?:\d+\+\d+|\d+)\s*(?:hours?|hrs?))?$/i;

    const lines = text.split('\n');

    let currentUnit: { number: number; title: string } | null = null;
    let currentContentLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Skip known non-content headers
      const upper = line.toUpperCase();
      if (upper.includes('TEXT BOOK') || upper.includes('REFERENCE')) {
        continue;
      }

      const match = line.match(moduleHeaderPattern);
      const isHeader = match && line.length < 120;

      if (isHeader && match) {
        // Save previous unit
        if (currentUnit) {
          const contentText = currentContentLines.join('\n');
          const topics = this.extractTopicsFromContent(contentText);
          if (topics.length > 0) {
            units.push({
              unitNumber: currentUnit.number,
              title: currentUnit.title,
              topics,
            });
          }
        }

        // Start new unit
        const unitNumStr = match[1];
        let title = (match[2] || '').trim();

        // Clean title (ported from Python)
        title = title.replace(/^[:|.\-]+|[:|.\-]+$/g, '').trim();
        title = title.replace(/\d+\s*(?:Hours|Hrs).*$/i, '').trim();
        title = title.replace(/\|/g, '').trim();
        title = title.replace(/\s+\d+$/, '').trim();

        if (!title) {
          title = `Unit ${unitNumStr}`;
        }

        currentUnit = {
          number: this.romanToInt(unitNumStr),
          title,
        };
        currentContentLines = [];
      } else {
        if (currentUnit !== null) {
          currentContentLines.push(line);
        }
      }
    }

    // Save last unit
    if (currentUnit) {
      const contentText = currentContentLines.join('\n');
      const topics = this.extractTopicsFromContent(contentText);
      if (topics.length > 0) {
        units.push({
          unitNumber: currentUnit.number,
          title: currentUnit.title,
          topics,
        });
      }
    }

    return units;
  }

  // ======================== Content Processing ========================

  /**
   * Normalize text — collapse whitespace, trim lines.
   */
  private static normalizeText(text: string): string {
    text = text.replace(/[ \t]+/g, ' ');
    const lines = text.split('\n');
    return lines.map(l => l.trim()).filter(l => l).join('\n');
  }

  /**
   * Extract individual topics from module content block.
   * Skips guided self-study, textbook, and reference sections.
   *
   * Ported from syllabus_parser.py → _extract_topics_from_content()
   */
  private static extractTopicsFromContent(content: string): string[] {
    // 1. Filter out self-study / reference sections
    const cleanLines: string[] = [];
    let skip = false;

    for (const line of content.split('\n')) {
      const lower = line.toLowerCase();
      if (
        ['guided self', 'self-study', 'self study', 'text book', 'reference book', 'course outcome']
          .some(phrase => lower.includes(phrase))
      ) {
        skip = true;
        continue;
      }
      if (skip) continue;
      cleanLines.push(line);
    }

    const cleaned = cleanLines.join('\n');

    // 2. Split by newlines and pipes
    const rawLines = cleaned.split(/[\n|]/);
    const topics: string[] = [];

    for (let line of rawLines) {
      line = line.trim();
      if (!line) continue;

      // Remove leading bullets
      line = line.replace(/^[•\-*►▪]\s*/, '');
      // Remove leading numbered list prefix
      line = line.replace(/^\d+\.\s+/, '');

      if (line.includes('; ')) {
        // Split by semicolons
        const subParts = line.split('; ');
        for (const sp of subParts) {
          const trimmed = sp.trim();
          if (!trimmed) continue;
          // Further split by sentence breaks (period + space + capital letter)
          const sentences = trimmed.split(/\.\s+(?=[A-Z])/);
          for (const sent of sentences) {
            const cleaned = this.cleanTopic(sent);
            if (this.isValidTopic(cleaned)) {
              topics.push(cleaned);
            }
          }
        }
      } else if (line.includes(', ') && line.length > 50) {
        // Split long lines by commas
        const subParts = line.split(', ');
        for (const sp of subParts) {
          const cleaned = this.cleanTopic(sp);
          if (this.isValidTopic(cleaned)) {
            topics.push(cleaned);
          }
        }
      } else {
        // Keep as single topic
        const cleaned = this.cleanTopic(line);
        if (this.isValidTopic(cleaned)) {
          topics.push(cleaned);
        }
      }
    }

    return topics;
  }

  // ======================== Validation & Cleaning ========================

  /**
   * Check if a topic string is valid content.
   * Ported from syllabus_parser.py → _is_valid_topic()
   */
  private static isValidTopic(topic: string): boolean {
    if (!topic || topic.length < 3) return false;

    const lower = topic.toLowerCase();

    // Skip common standalone words
    const singleWordSkips = ['and', 'or', 'the', 'of', 'in', 'to', 'for', 'with', 'from', 'by', 'at', 'on'];
    if (singleWordSkips.includes(lower)) return false;

    // Filter very short single-word topics
    if (topic.length < 4 && !topic.includes(' ')) {
      if (topic === topic.toUpperCase()) return true;        // Acronyms like "JSX"
      if (/\d/.test(topic)) return true;                      // Contains digits like "3D"
      return false;
    }

    // Skip metadata phrases
    const skipPhrases = [
      'total hours', 'periods', 'semester', 'category', 'credit',
      'version', 'lecture', 'tutorial', 'practical', 'exam',
      'course code', 'course title',
    ];
    if (skipPhrases.some(phrase => lower.includes(phrase))) return false;

    // Skip purely numeric or duration strings
    if (/^[\d\s\W]+$/.test(topic)) return false;
    if (/^\d+\s*(?:hrs?|hours?)$/i.test(topic)) return false;

    return true;
  }

  /**
   * Clean up a topic string.
   * Ported from syllabus_parser.py → _clean_topic()
   */
  private static cleanTopic(text: string): string {
    // Remove parens with hours like (9) or (9 Hours)
    text = text.replace(/\(\s*\d+\s*(?:hrs?|hours?)?\s*\)/gi, '');
    // Remove numbers at start like "1.", "2)", "3-"
    text = text.replace(/^\d+[.)\-]\s*/, '');
    // Remove leading non-word chars
    text = text.replace(/^[\W_]+/, '');
    // Remove page numbers at end
    text = text.replace(/\s*\d{1,3}(?:-\d{1,3})?$/, '');
    return text.trim();
  }

  // ======================== Table Row Parser ========================

  /**
   * Parse structured table rows (from Excel/CSV).
   * Detects column layout from header row.
   */
  private static parseTableRows(rows: any[][]): SyllabusUnit[] {
    if (rows.length === 0) return [];

    const units: { [key: string]: SyllabusUnit } = {};

    // Detect column indices from header
    const headerRow = rows[0];
    const colIndices = { unit: 0, unit_name: 1, topics: 2, hours: 3, description: 4 };

    if (headerRow) {
      headerRow.forEach((cell: any, idx: number) => {
        if (!cell) return;
        const cellUpper = String(cell).toUpperCase();

        if (cellUpper.includes('UNIT') && !cellUpper.includes('NAME') && idx < 2) {
          colIndices.unit = idx;
        } else if (cellUpper.includes('UNIT') && cellUpper.includes('NAME')) {
          colIndices.unit_name = idx;
        } else if (cellUpper.includes('TOPIC')) {
          colIndices.topics = idx;
        } else if (cellUpper.includes('HOUR') || cellUpper.includes('DURATION')) {
          colIndices.hours = idx;
        } else if (cellUpper.includes('DESCRIPTION') || cellUpper.includes('CONTENT')) {
          colIndices.description = idx;
        }
      });
    }

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell: any) => !cell)) continue;

      const unit = String(row[colIndices.unit] || '').trim();
      const unitName = String(row[colIndices.unit_name] || '').trim();
      const topicsStr = String(row[colIndices.topics] || '').trim();
      const hours = String(row[colIndices.hours] || '').trim();

      if (unit && unitName && topicsStr) {
        const key = `${unit}_${unitName}`;

        // Parse topics — can be comma, newline, or semicolon separated
        const topics = topicsStr
          .split(/[,\n;]/)
          .map((t: string) => t.trim())
          .filter((t: string) => t && !t.match(/^(guided|self-study|self study)/i));

        if (topics.length > 0) {
          units[key] = {
            unitNumber: parseInt(unit.replace(/^Unit\s*/i, ''), 10) || i,
            title: unitName,
            topics,
          };
        }
      }
    }

    return Object.values(units);
  }

  // ======================== Utilities ========================

  /**
   * Convert Roman numeral or digit string to integer.
   */
  private static romanToInt(s: string): number {
    s = s.trim().toUpperCase();
    if (/^\d+$/.test(s)) return parseInt(s, 10);

    const romanMap: Record<string, number> = {
      I: 1, II: 2, III: 3, IV: 4, V: 5,
      VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
    };
    return romanMap[s] ?? 1;
  }
}
