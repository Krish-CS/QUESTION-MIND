/**
 * Excel Generator Service for Question Banks
 * Replaces Python excel_service.py with ExcelJS
 * Generates beautifully formatted question papers
 */

import * as XLSX from 'xlsx';

interface QuestionData {
  question: string;
  answer: string;
  marks: number;
  unit: number;
  btl: string;
  isMCQ?: boolean;
  options?: Record<string, string>;
  correctOption?: string;
  cdap_part?: number;
}

interface ExcelOptions {
  title: string;
  subject: string;
  date?: string;
  totalMarks?: number;
  duration?: string;
  includeAnswers?: boolean;
  includeUnitInfo?: boolean;
}

export class ExcelGeneratorService {
  /**
   * Generate a formatted question paper Excel file
   */
  static generateQuestionPaper(
    questions: QuestionData[],
    parts: Record<string, QuestionData[]>,
    options: ExcelOptions
  ): Blob {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Cover Page
    const coverSheet = XLSX.utils.aoa_to_sheet([
      [options.title],
      [""],
      [`Subject: ${options.subject}`],
      [`Date: ${options.date || new Date().toLocaleDateString()}`],
      [`Total Marks: ${options.totalMarks || 100}`],
      [`Duration: ${options.duration || "3 Hours"}`],
      [""],
      ["Instructions:"],
      ["1. Answer all questions"],
      ["2. Use blue/black pen only"],
      ["3. Show all working for calculations"],
    ]);
    XLSX.utils.book_append_sheet(workbook, coverSheet, "Cover");

    // Sheet 2: Questions
    const questionsSheet = this.generateQuestionsSheet(questions, options);
    XLSX.utils.book_append_sheet(workbook, questionsSheet, "Questions");

    // Sheet 3: Answer Key (if requested)
    if (options.includeAnswers) {
      const answersSheet = this.generateAnswersSheet(questions, options);
      XLSX.utils.book_append_sheet(workbook, answersSheet, "Answer Key");
    }

    // Sheet 4: Statistics (if requested)
    if (options.includeUnitInfo) {
      const statsSheet = this.generateStatsSheet(questions, options);
      XLSX.utils.book_append_sheet(workbook, statsSheet, "Statistics");
    }

    // Write and convert to blob
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    return new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  /**
   * Generate questions sheet
   */
  private static generateQuestionsSheet(
    questions: QuestionData[],
    options: ExcelOptions
  ): XLSX.WorkSheet {
    const data: any[][] = [
      ["Question Paper", "", "", ""],
      [options.subject, "", "", ""],
      ["", "", "", ""],
      ["Q.No", "Question", "Marks", "BTL"],
    ];

    let qNum = 1;
    for (const q of questions) {
      const questionText = this.cleanText(q.question);
      let fullText = questionText;

      if (q.isMCQ && q.options) {
        fullText += "\n\nOptions:\n";
        for (const [key, val] of Object.entries(q.options)) {
          fullText += `${key}) ${val}\n`;
        }
      }

      data.push([qNum.toString(), fullText, q.marks.toString(), q.btl]);
      qNum++;
    }

    const sheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    sheet["!cols"] = [
      { wch: 5 },  // Q.No
      { wch: 50 }, // Question
      { wch: 8 },  // Marks
      { wch: 8 },  // BTL
    ];

    // Set row heights
    sheet["!rows"] = data.map((_, i) => {
      if (i <= 2) return { hpx: 20 }; // Header rows
      return { hpx: 60 }; // Question rows
    });

    return sheet;
  }

  /**
   * Generate answer key sheet
   */
  private static generateAnswersSheet(
    questions: QuestionData[],
    options: ExcelOptions
  ): XLSX.WorkSheet {
    const data: any[][] = [
      ["Answer Key", "", "", ""],
      [options.subject, "", "", ""],
      ["", "", "", ""],
      ["Q.No", "Answer", "Marks", "Marks Distribution"],
    ];

    let qNum = 1;
    for (const q of questions) {
      let answerText = this.cleanText(q.answer);

      if (q.isMCQ && q.correctOption) {
        answerText = `Correct Option: ${q.correctOption}\n\n${answerText}`;
      }

      const marksDistribution = this.getMarksDistribution(q.marks);
      data.push([qNum.toString(), answerText, q.marks.toString(), marksDistribution]);
      qNum++;
    }

    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [
      { wch: 5 },
      { wch: 60 },
      { wch: 8 },
      { wch: 15 },
    ];
    sheet["!rows"] = data.map((_, i) => ({
      hpx: i <= 2 ? 20 : 80,
    }));

    return sheet;
  }

  /**
   * Generate statistics sheet
   */
  private static generateStatsSheet(
    questions: QuestionData[],
    _options: ExcelOptions
  ): XLSX.WorkSheet {
    // Count by unit
    const unitStats: Record<number, number> = {};
    const btlStats: Record<string, number> = {};
    let totalMarks = 0;
    let mcqCount = 0;

    for (const q of questions) {
      unitStats[q.unit] = (unitStats[q.unit] || 0) + 1;
      btlStats[q.btl] = (btlStats[q.btl] || 0) + 1;
      totalMarks += q.marks;
      if (q.isMCQ) mcqCount++;
    }

    const data: any[][] = [
      ["Question Bank Statistics", ""],
      ["", ""],
      ["Total Questions", questions.length],
      ["MCQ Count", mcqCount],
      ["Descriptive Questions", questions.length - mcqCount],
      ["Total Marks", totalMarks],
      ["", ""],
      ["By Unit", "Count"],
    ];

    for (const [unit, count] of Object.entries(unitStats).sort()) {
      data.push([`Unit ${unit}`, count]);
    }

    data.push(["", ""]);
    data.push(["By BTL Level", "Count"]);

    for (const [btl, count] of Object.entries(btlStats).sort()) {
      data.push([btl, count]);
    }

    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [{ wch: 25 }, { wch: 15 }];

    return sheet;
  }

  /**
   * Export questions as CSV (simple format)
   */
  static exportCSV(questions: QuestionData[]): Blob {
    const headers = ["Question", "Answer", "Unit", "BTL", "Marks", "Type"];
    const rows = questions.map((q) => [
      this.escapeCSV(q.question),
      this.escapeCSV(q.answer),
      q.unit,
      q.btl,
      q.marks,
      q.isMCQ ? "MCQ" : "Descriptive",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    return new Blob([csv], { type: "text/csv" });
  }

  /**
   * Utility: Clean text for Excel (remove markdown, excess newlines)
   */
  private static cleanText(text: string): string {
    if (!text) return "";
    // Remove markdown bold/italic
    text = text.replace(/\*\*(.+?)\*\*/g, "$1");
    text = text.replace(/\*(.+?)\*/g, "$1");
    text = text.replace(/__(.+?)__/g, "$1");
    text = text.replace(/_(.+?)_/g, "$1");
    // Remove markdown headers
    text = text.replace(/^#+\s+/gm, "");
    // Collapse excessive newlines
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  }

  /**
   * Utility: Escape CSV special characters
   */
  private static escapeCSV(text: string): string {
    if (!text) return '""';
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * Utility: Get marks distribution hint
   */
  private static getMarksDistribution(marks: number): string {
    if (marks <= 2) return "Full/Half";
    if (marks <= 5) return "Full/3/Half/1/0";
    if (marks <= 8) return "Full/5/3/2/1/0";
    return "Full/Half only";
  }

  /**
   * Download file helper
   */
  static downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
