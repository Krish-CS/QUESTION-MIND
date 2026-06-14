/**
 * Excel Generator Service for Question Banks
 * Replaces Python excel_service.py with ExcelJS
 * Generates beautifully formatted question papers with IMAGE support
 */

import ExcelJS from 'exceljs';

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
  imageData?: string;
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
  static async generateQuestionPaper(
    questions: QuestionData[],
    parts: Record<string, QuestionData[]>,
    options: ExcelOptions
  ): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Cover Page
    const coverSheet = workbook.addWorksheet("Cover");
    coverSheet.addRow([options.title]);
    coverSheet.addRow([]);
    coverSheet.addRow([`Subject: ${options.subject}`]);
    coverSheet.addRow([`Date: ${options.date || new Date().toLocaleDateString()}`]);
    coverSheet.addRow([`Total Marks: ${options.totalMarks || 100}`]);
    coverSheet.addRow([`Duration: ${options.duration || "3 Hours"}`]);
    coverSheet.addRow([]);
    coverSheet.addRow(["Instructions:"]);
    coverSheet.addRow(["1. Answer all questions"]);
    coverSheet.addRow(["2. Use blue/black pen only"]);
    coverSheet.addRow(["3. Show all working for calculations"]);

    // Sheet 2: Questions
    this.generateQuestionsSheet(workbook, questions, options);

    // Sheet 3: Answer Key (if requested)
    if (options.includeAnswers) {
      this.generateAnswersSheet(workbook, questions, options);
    }

    // Sheet 4: Statistics (if requested)
    if (options.includeUnitInfo) {
      this.generateStatsSheet(workbook, questions, options);
    }

    // Write and convert to blob
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  /**
   * Generate questions sheet
   */
  private static generateQuestionsSheet(
    workbook: ExcelJS.Workbook,
    questions: QuestionData[],
    options: ExcelOptions
  ): void {
    const sheet = workbook.addWorksheet("Questions");
    sheet.columns = [
      { width: 8 },  // Q.No
      { width: 60 }, // Question
      { width: 10 }, // Marks
      { width: 10 }, // BTL
    ];

    sheet.addRow(["Question Paper", "", "", ""]);
    sheet.addRow([options.subject, "", "", ""]);
    sheet.addRow(["", "", "", ""]);
    sheet.addRow(["Q.No", "Question", "Marks", "BTL"]);

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

      const row = sheet.addRow([qNum.toString(), fullText, q.marks.toString(), q.btl]);
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      
      let rowHeight = 60;

      // Embed Image if exists
      if (q.imageData) {
        try {
          const extension = q.imageData.split(';')[0].split('/')[1] || 'png';
          // Ensure extension is supported by exceljs (jpeg, png, gif)
          const validExt = ['jpeg', 'jpg', 'png', 'gif'].includes(extension.toLowerCase()) ? extension.toLowerCase().replace('jpg', 'jpeg') : 'png';
          
          const imageId = workbook.addImage({
            base64: q.imageData,
            extension: validExt as any,
          });

          // Insert image below text in the 'Question' column (col 1 is B since it's 0-indexed in exceljs tl obj)
          // Actually, let's make row taller to accommodate it
          sheet.addImage(imageId, {
            tl: { col: 1, row: row.number - 1 + 0.3 }, // slightly below top
            ext: { width: 300, height: 180 }
          });
          
          rowHeight = Math.max(rowHeight, 150); // Provide space for image
        } catch (e) {
          console.error("Failed to add image to Excel sheet", e);
        }
      }

      row.height = rowHeight;
      qNum++;
    }
  }

  /**
   * Generate answer key sheet
   */
  private static generateAnswersSheet(
    workbook: ExcelJS.Workbook,
    questions: QuestionData[],
    options: ExcelOptions
  ): void {
    const sheet = workbook.addWorksheet("Answer Key");
    sheet.columns = [
      { width: 8 },
      { width: 60 },
      { width: 10 },
      { width: 20 },
    ];

    sheet.addRow(["Answer Key", "", "", ""]);
    sheet.addRow([options.subject, "", "", ""]);
    sheet.addRow(["", "", "", ""]);
    sheet.addRow(["Q.No", "Answer", "Marks", "Marks Distribution"]);

    let qNum = 1;
    for (const q of questions) {
      let answerText = this.cleanText(q.answer);

      if (q.isMCQ && q.correctOption) {
        answerText = `Correct Option: ${q.correctOption}\n\n${answerText}`;
      }

      const marksDistribution = this.getMarksDistribution(q.marks);
      const row = sheet.addRow([qNum.toString(), answerText, q.marks.toString(), marksDistribution]);
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      row.height = 80;
      qNum++;
    }
  }

  /**
   * Generate statistics sheet
   */
  private static generateStatsSheet(
    workbook: ExcelJS.Workbook,
    questions: QuestionData[],
    _options: ExcelOptions
  ): void {
    const sheet = workbook.addWorksheet("Statistics");
    sheet.columns = [
      { width: 25 },
      { width: 15 }
    ];

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

    sheet.addRow(["Question Bank Statistics", ""]);
    sheet.addRow(["", ""]);
    sheet.addRow(["Total Questions", questions.length]);
    sheet.addRow(["MCQ Count", mcqCount]);
    sheet.addRow(["Descriptive Questions", questions.length - mcqCount]);
    sheet.addRow(["Total Marks", totalMarks]);
    sheet.addRow(["", ""]);
    sheet.addRow(["By Unit", "Count"]);

    for (const [unit, count] of Object.entries(unitStats).sort()) {
      sheet.addRow([`Unit ${unit}`, count]);
    }

    sheet.addRow(["", ""]);
    sheet.addRow(["By BTL Level", "Count"]);

    for (const [btl, count] of Object.entries(btlStats).sort()) {
      sheet.addRow([btl, count]);
    }
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
    text = text.replace(/\*\*(.+?)\*\*/g, "$1");
    text = text.replace(/\*(.+?)\*/g, "$1");
    text = text.replace(/__(.+?)__/g, "$1");
    text = text.replace(/_(.+?)_/g, "$1");
    text = text.replace(/^#+\s+/gm, "");
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
