/**
 * CDAP Parser — Full JavaScript port of backend cdap_parser.py
 *
 * Extracts units with Part 1/Part 2 topics from PDF, DOCX, and Excel files.
 *
 * CDAP (Course Delivery and Assessment Plan) Structure:
 *   - Units/Modules
 *   - Each unit has Part 1 and Part 2 topics
 *   - Topics may have subtopics
 *
 * All processing is local — no network calls, no backend dependency.
 */

import * as XLSX from 'xlsx';
import { extractTextFromPDF } from '../pdfExtractor';
import type { CDAPUnit, CDAPTopicEntry } from '../../types';

// Dynamically import mammoth only when needed
let mammothModule: any = null;
async function getMammoth() {
  if (!mammothModule) {
    mammothModule = await import('mammoth');
  }
  return mammothModule;
}

// Re-export types for consumers
export type { CDAPUnit, CDAPTopicEntry };

// Helper to extract topic string from union type
function getTopicStr(t: string | CDAPTopicEntry): string {
  return typeof t === 'string' ? t : t.topic;
}

export class CDAPParser {
  // ======================== Public Entry Point ========================

  /**
   * Parse CDAP from any supported file format.
   */
  static async parseFile(file: File): Promise<CDAPUnit[]> {
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
   * Parse PDF CDAP: extract text + tables, parse structure.
   */
  static async parsePDF(file: File): Promise<CDAPUnit[]> {
    try {
      console.log('[CDAPParser] Extracting PDF text via pdfjs-dist...');
      const text = await extractTextFromPDF(file);
      console.log(`[CDAPParser] Extracted ${text.length} chars from PDF`);

      // For PDFs, first try text-based CDAP structure extraction
      const result = this.extractCDAPStructure(text);
      if (result.length > 0) return result;

      // Fallback: try table-row parsing on split lines
      const lines = text.split('\n').map(l => l.split(/\s{2,}|\t/));
      const tableResult = this.parseTableRows(lines);
      return tableResult;
    } catch (error) {
      console.error('[CDAPParser] PDF parse error:', error);
      return [];
    }
  }

  /**
   * Parse DOCX CDAP: extract text with mammoth, parse structure.
   */
  static async parseDOCX(file: File): Promise<CDAPUnit[]> {
    try {
      console.log('[CDAPParser] Extracting DOCX text via mammoth...');
      const mammoth = await getMammoth();
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || '';
      console.log(`[CDAPParser] Extracted ${text.length} chars from DOCX`);
      return this.extractCDAPStructure(text);
    } catch (error) {
      console.error('[CDAPParser] DOCX parse error:', error);
      return [];
    }
  }

  /**
   * Parse Excel CDAP: structured column-based parsing.
   *
   * Expected structure (e.g., OS CDAP.xlsx):
   *   Column A: UNIT number (1.0, 2.0, etc.)
   *   Column B: SYLLABUS (UNIT NAME)
   *   Column C: OUTCOME (CO)
   *   Column D: PART NO. (1.0 or 2.0)
   *   Column E: TOPICS TO BE COVERED
   *   Column F: SUB TOPICS
   *   Column G: BT LEVEL
   */
  static async parseExcel(file: File): Promise<CDAPUnit[]> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      return this.parseTableRows(data);
    } catch (error) {
      console.error('[CDAPParser] Excel parse error:', error);
      return [];
    }
  }

  // ======================== Table Row Parser (ported from Python) ========================

  /**
   * Parse structured table rows.
   * Detects columns dynamically from header.
   *
   * Ported from cdap_parser.py → _parse_excel() / _parse_table_rows()
   */
  private static parseTableRows(rows: any[][]): CDAPUnit[] {
    if (!rows || rows.length === 0) return [];

    const units: Record<number, CDAPUnit> = {};
    let currentUnit: number | null = null;
    let currentUnitName: string | null = null;

    // Find header row (within first 5 rows)
    let headerRowIdx = 0;
    for (let idx = 0; idx < Math.min(5, rows.length); idx++) {
      const rowValues = (rows[idx] || []).map(c => (c != null ? String(c).trim().toUpperCase() : ''));
      if (rowValues.some(v => v.includes('UNIT') || v.includes('PART') || v.includes('TOPIC'))) {
        headerRowIdx = idx;
        break;
      }
    }

    // Detect column indices from header
    const colIndices = { unit: 0, unit_name: 1, part: 3, topic: 4, subtopic: 5 };
    if (headerRowIdx < rows.length) {
      const header = rows[headerRowIdx] || [];
      header.forEach((cell: any, idx: number) => {
        if (!cell) return;
        const cellUpper = String(cell).toUpperCase().replace(/\n/g, ' ');

        if (cellUpper.includes('UNIT') && !cellUpper.includes('NAME') && idx < 2) {
          colIndices.unit = idx;
        } else if (cellUpper.includes('SYLLABUS') || (cellUpper.includes('UNIT') && cellUpper.includes('NAME'))) {
          colIndices.unit_name = idx;
        } else if (cellUpper.includes('PART')) {
          colIndices.part = idx;
        } else if (cellUpper.includes('TOPIC') && !cellUpper.includes('SUB')) {
          colIndices.topic = idx;
        } else if (cellUpper.includes('SUB') && cellUpper.includes('TOPIC')) {
          colIndices.subtopic = idx;
        }
      });
    }

    // Parse data rows
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(cell => cell == null)) continue;

      const rowValues = row.map(c => (c != null ? String(c).trim().replace(/\n/g, ' ') : ''));

      // Skip invalid rows
      if (rowValues[0]?.includes('#REF!')) continue;

      let partNum: number | null = null;

      // Check Unit column
      const unitCol = colIndices.unit;
      if (rowValues.length > unitCol && rowValues[unitCol]) {
        const unitVal = rowValues[unitCol];
        const skipHeaders = ['UNIT', 'UNIT NO', 'UNIT NO.', 'UNIT NUMBER', 'NONE', ''];
        if (!skipHeaders.includes(unitVal.toUpperCase())) {
          const uMatch = unitVal.match(/(?:unit|module)?\s*[:\-]?\s*([\d.]+)/i);
          if (uMatch) {
            currentUnit = Math.floor(parseFloat(uMatch[1]));
            const unitNameCol = colIndices.unit_name;
            if (rowValues.length > unitNameCol && rowValues[unitNameCol]) {
              currentUnitName = rowValues[unitNameCol];
            }
          }
        }
      }

      if (currentUnit === null) currentUnit = 1;

      // Get Part Number
      const partCol = colIndices.part;
      if (rowValues.length > partCol && rowValues[partCol]) {
        const partVal = rowValues[partCol];
        const skipPartHeaders = ['PART NO', 'PART NO.', 'PART NUMBER', 'PART', 'NONE', ''];
        if (!skipPartHeaders.includes(partVal.toUpperCase())) {
          if (['1', '1.0', 'Part 1', 'Part-1', 'I', 'PART I'].includes(partVal)) {
            partNum = 1;
          } else if (['2', '2.0', 'Part 2', 'Part-2', 'II', 'PART II'].includes(partVal)) {
            partNum = 2;
          } else {
            const pMatch = partVal.match(/[\d.]+/);
            if (pMatch) partNum = Math.floor(parseFloat(pMatch[0]));
          }
        }
      }

      // Get Topic
      const topicCol = colIndices.topic;
      const topicsToAdd: string[] = [];
      if (rowValues.length > topicCol && rowValues[topicCol]) {
        const topicVal = rowValues[topicCol];
        if (!topicVal.toUpperCase().includes('TOPIC') || topicVal.length > 30) {
          if (topicVal.length > 3 && topicVal.toUpperCase() !== 'NONE') {
            topicsToAdd.push(topicVal);
          }
        }
      }

      // Initialize unit if needed
      if (!(currentUnit in units)) {
        const unitName = currentUnitName || `Unit ${currentUnit}`;
        units[currentUnit] = {
          unit_number: currentUnit,
          unit_name: unitName,
          part1_topics: [],
          part2_topics: [],
        };
      } else if (currentUnitName && units[currentUnit].unit_name === `Unit ${currentUnit}`) {
        units[currentUnit].unit_name = currentUnitName;
      }

      // Add topics to the correct part
      for (const topicText of topicsToAdd) {
        if (!topicText) continue;

        // Get subtopic if available
        const subtopics: string[] = [];
        const subtopicCol = colIndices.subtopic;
        if (rowValues.length > subtopicCol && rowValues[subtopicCol]) {
          const subtopicVal = rowValues[subtopicCol].trim();
          if (subtopicVal && subtopicVal.length > 3 && !subtopicVal.toUpperCase().startsWith('SUB')) {
            subtopics.push(subtopicVal);
          }
        }

        const targetPart = partNum || 1;
        const targetList = targetPart === 1 ? units[currentUnit].part1_topics : units[currentUnit].part2_topics;

        // Check for duplicates
        const existing = targetList.find(t => getTopicStr(t) === topicText);
        if (existing && typeof existing !== 'string') {
          for (const st of subtopics) {
            if (!existing.subtopics.includes(st)) {
              existing.subtopics.push(st);
            }
          }
        } else {
          targetList.push({ topic: topicText, subtopics });
        }
      }
    }

    return Object.values(units);
  }

  // ======================== Text-Based CDAP Parser ========================

  /**
   * Extract CDAP structure from raw text.
   * Identifies units and Part 1/Part 2 sections.
   *
   * Ported from cdap_parser.py → _extract_cdap_structure()
   */
  private static extractCDAPStructure(text: string): CDAPUnit[] {
    const units: CDAPUnit[] = [];
    let currentUnit: CDAPUnit | null = null;
    let currentPart: number | null = null;

    const lines = text.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Detect unit/module headers
      let unitMatch = line.match(/(?:unit|module)\s*[-:]?\s*([IVX\d]+)(?:\s*[-:]\s*(.+))?/i);

      // Alternative: "1 Introduction..." or "1 | Introduction..."
      if (!unitMatch) {
        const simpleMatch = line.match(/^(\d+)(?:\s+|(?:\s*[|]\s*))([A-Za-z].+)/);
        if (simpleMatch) {
          const uNum = parseInt(simpleMatch[1], 10);
          if (uNum >= 1 && uNum <= 10) {
            unitMatch = simpleMatch;
          }
        }
      }

      if (unitMatch) {
        const unitNum = this.romanToInt(unitMatch[1]);
        const unitName = unitMatch[2]?.trim() || `Unit ${unitNum}`;

        currentUnit = {
          unit_number: unitNum,
          unit_name: unitName,
          part1_topics: [],
          part2_topics: [],
        };
        units.push(currentUnit);
        currentPart = null;
        continue;
      }

      // Detect Part 1/Part 2 headers
      if (/part\s*[-:]?\s*1|part\s*i(?:\s|$)/i.test(line)) {
        currentPart = 1;
        continue;
      }
      if (/part\s*[-:]?\s*2|part\s*ii(?:\s|$)/i.test(line)) {
        currentPart = 2;
        continue;
      }

      // Add topics to current part
      if (currentUnit && currentPart && this.isValidCDAPTopic(line)) {
        const topic = this.cleanCDAPTopic(line);
        if (topic) {
          const topicEntry: CDAPTopicEntry = { topic, subtopics: [] };
          if (currentPart === 1) {
            if (!currentUnit.part1_topics.some(t => getTopicStr(t) === topic)) {
              currentUnit.part1_topics.push(topicEntry);
            }
          } else {
            if (!currentUnit.part2_topics.some(t => getTopicStr(t) === topic)) {
              currentUnit.part2_topics.push(topicEntry);
            }
          }
        }
      }
    }

    return units;
  }

  // ======================== Validation & Cleaning ========================

  /**
   * Check if text is a valid CDAP topic.
   */
  private static isValidCDAPTopic(text: string): boolean {
    text = text.trim();
    if (text.length < 5) return false;
    if (/^[\d.]+$/.test(text)) return false;
    if (['part 1', 'part 2', 'part i', 'part ii', 'topics'].includes(text.toLowerCase())) return false;
    return true;
  }

  /**
   * Clean a CDAP topic string.
   */
  private static cleanCDAPTopic(text: string): string {
    // Remove leading numbers/bullets
    text = text.replace(/^[\d.•\-–]+\s*/, '');
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ');
    return text.trim();
  }

  // ======================== Utilities ========================

  /**
   * Convert Roman numeral or digit string to integer.
   */
  private static romanToInt(s: string): number {
    s = s.trim().toUpperCase();
    if (/^\d+$/.test(s)) return parseInt(s, 10);

    const roman: Record<string, number> = { I: 1, V: 5, X: 10 };
    let result = 0;
    let prev = 0;
    for (const char of [...s].reverse()) {
      const val = roman[char] || 0;
      if (val < prev) {
        result -= val;
      } else {
        result += val;
      }
      prev = val;
    }
    return result > 0 ? result : 1;
  }
}
