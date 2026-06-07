/**
 * aiService.ts — Full port of backend ai_service.py
 * 
 * Multi-provider AI question generation with:
 * - Provider fallback chain (Cerebras → Groq → NVIDIA → OpenRouter)
 * - Unit-assignment round-robin for even topic coverage
 * - Chunked generation (max 10 questions per API call)
 * - 5-attempt JSON parsing with repair logic
 * - BTL distribution scaling
 * - Markdown stripping & unit reference removal
 */

// K-Level / BTL keyword guide
const K_KEYWORDS: Record<string, string> = {
  BTL1: 'define, recall, list, identify, state, name',
  BTL2: 'explain, describe, summarize, discuss, classify',
  BTL3: 'solve, apply, calculate, demonstrate, construct',
  BTL4: 'analyze, differentiate, examine, break down, infer',
  BTL5: 'evaluate, assess, justify, judge, defend',
  BTL6: 'design, create, formulate, develop, build',
};

const BTL_ORDER = ['BTL1', 'BTL2', 'BTL3', 'BTL4', 'BTL5', 'BTL6'];

// HTTP codes that trigger provider fallback
const FALLBACK_STATUS_CODES = new Set([404, 429, 503, 529]);

type AIServiceErrorCode = 'NO_PROVIDER' | 'BAD_KEY' | 'RATE_LIMIT' | 'UNREACHABLE' | 'PARSE_FAILED';

class AIServiceError extends Error {
  code: AIServiceErrorCode;
  userMessage: string;

  constructor(code: AIServiceErrorCode, userMessage: string) {
    super(userMessage);
    this.name = 'AIServiceError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
}

interface UnitAssignment {
  unit: Record<string, any>;
  count: number;
  mcq: number;
}

interface PartConfig {
  partName: string;
  questionCount: number;
  marksPerQuestion: number;
  totalMarks?: number;
  allowedBTLLevels: string[];
  mcqCount?: number;
  btlDistribution?: Record<string, number>;
  defaultBTL?: string;
  description?: string;
}

function _log(tag: string, msg: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [${tag}] ${msg}`);
}

class AIService {
  private providerChain: ProviderConfig[] = [];
  private CHUNK_SIZE = 10;

  constructor() {
    this.rebuildProviderChain();
  }

  /**
   * Rebuild the provider chain from localStorage keys
   */
  rebuildProviderChain() {
    this.providerChain = [];

    const cerebrasKey = localStorage.getItem('CEREBRAS_API_KEY') || '';
    const cerebrasKey2 = localStorage.getItem('CEREBRAS_API_KEY_2') || '';
    const groqKey = localStorage.getItem('GROQ_API_KEY') || '';
    const nvidiaKey = localStorage.getItem('NVIDIA_API_KEY') || '';
    const openrouterKey = localStorage.getItem('OPENROUTER_API_KEY') || '';

    // Priority 1: Cerebras key 1
    if (cerebrasKey.trim()) {
      this.providerChain.push({
        name: 'cerebras',
        apiKey: cerebrasKey.trim(),
        baseUrl: 'https://api.cerebras.ai/v1',
        model: 'gpt-oss-120b',
        maxTokens: 8000,
      });
    }

    // Priority 1b: Cerebras key 2
    if (cerebrasKey2.trim()) {
      this.providerChain.push({
        name: 'cerebras-2',
        apiKey: cerebrasKey2.trim(),
        baseUrl: 'https://api.cerebras.ai/v1',
        model: 'gpt-oss-120b',
        maxTokens: 8000,
      });
    }

    // Priority 2: Groq
    if (groqKey.trim()) {
      this.providerChain.push({
        name: 'groq',
        apiKey: groqKey.trim(),
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        maxTokens: 8000,
      });
    }

    // Priority 3: NVIDIA
    if (nvidiaKey.trim()) {
      this.providerChain.push({
        name: 'nvidia',
        apiKey: nvidiaKey.trim(),
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'meta/llama-3.3-70b-instruct',
        maxTokens: 4096,
      });
    }

    // Priority 4: OpenRouter
    if (openrouterKey.trim()) {
      this.providerChain.push({
        name: 'openrouter',
        apiKey: openrouterKey.trim(),
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'meta-llama/llama-3.3-70b-instruct',
        maxTokens: 8000,
      });
    }

    if (this.providerChain.length > 0) {
      _log('AI', `Provider chain: ${this.providerChain.map(p => p.name.toUpperCase()).join(' → ')}`);
    } else {
      _log('AI', '⚠ No AI providers configured — generation will fail');
    }
  }

  /**
   * Make a single API call to one provider
   */
  private async _callProvider(prov: ProviderConfig, prompt: string, attempt: number, total: number): Promise<string | null> {
    _log('AI', `🚀 [${attempt}/${total}] Trying ${prov.name.toUpperCase()} | Model: ${prov.model}`);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${prov.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (prov.name === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Question Mind Mobile';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
      const tStart = performance.now();
      const response = await fetch(`${prov.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: prov.model,
          messages: [
            {
              role: 'system',
              content: 'You are an academic exam question paper setter. You understand Bloom\'s Taxonomy (BTL1-BTL6), subject domains, and exam design. Always respond with ONLY a valid JSON array — no markdown, no explanation, no extra text before or after.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: prov.maxTokens,
        }),
      });
      clearTimeout(timeout);

      const elapsed = ((performance.now() - tStart) / 1000).toFixed(2);
      _log('AI', `⏱ Response in ${elapsed}s | HTTP ${response.status} | ${prov.name.toUpperCase()}`);

      if (response.status === 200) {
        const data = await response.json();
        const choices = data.choices || [];
        const content = (choices[0]?.message?.content || '').trim();

        if (!content) {
          _log('AI', `⚠ ${prov.name.toUpperCase()} returned empty content — trying next provider`);
          return null;
        }

        _log('AI', `📄 Response length: ${content.length.toLocaleString()} chars`);
        return content;
      } else if (response.status === 429) {
        _log('AI', `⚡ ${prov.name.toUpperCase()} rate-limited (HTTP 429)`);
        return '__RATE_LIMITED__';
      } else if (FALLBACK_STATUS_CODES.has(response.status)) {
        _log('AI', `⚡ ${prov.name.toUpperCase()} overloaded (HTTP ${response.status})`);
        return null;
      } else if (response.status === 401) {
        _log('AI', `🔑 ${prov.name.toUpperCase()} auth failed (HTTP 401)`);
        return '__BAD_KEY__';
      } else {
        _log('AI', `❌ ${prov.name.toUpperCase()} HTTP ${response.status} — skipping`);
        return null;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        _log('AI', `⏰ ${prov.name.toUpperCase()} timed out after 120s`);
      } else {
        _log('AI', `💥 ${prov.name.toUpperCase()} error: ${err.message}`);
      }
      return null;
    }
  }

  /**
   * Try every provider in the chain with fallback
   */
  private async _callWithFallback(prompt: string, provStartIdx: number = 0): Promise<string> {
    if (!this.providerChain.length) {
      throw new AIServiceError(
        'NO_PROVIDER',
        'No AI provider API key is configured. Please add or update your API key in AI Settings and try again.'
      );
    }

    const num = this.providerChain.length;
    const badKeys = new Set<string>();
    const rateLimited = new Set<string>();
    let otherFailures = 0;

    for (let i = 0; i < num; i++) {
      const idx = (provStartIdx + i) % num;
      const prov = this.providerChain[idx];

      if (badKeys.has(prov.name)) continue;

      if (rateLimited.has(prov.name)) {
        _log('AI', `⏳ ${prov.name.toUpperCase()} was rate-limited — waiting 2s`);
        await this._sleep(2000);
      }

      const content = await this._callProvider(prov, prompt, i + 1, num);

      if (content === '__BAD_KEY__') {
        badKeys.add(prov.name);
        continue;
      }
      if (content === '__RATE_LIMITED__') {
        rateLimited.add(prov.name);
        await this._sleep(1000);
        continue;
      }
      if (content === null) {
        otherFailures += 1;
        continue;
      }
      return content; // success
    }

    _log('AI', '🚫 All providers exhausted — no content returned');
    if (badKeys.size === num) {
      throw new AIServiceError(
        'BAD_KEY',
        'AI authentication failed. Your API key may be invalid or expired. Please check your API key in AI Settings.'
      );
    }
    if (rateLimited.size === num) {
      throw new AIServiceError(
        'RATE_LIMIT',
        'AI rate limit or quota exhausted. Please check your API key usage and try again.'
      );
    }
    if (otherFailures > 0 || rateLimited.size > 0 || badKeys.size > 0) {
      throw new AIServiceError(
        'UNREACHABLE',
        'AI providers are unreachable or your API key is exhausted. Please verify your API key in AI Settings and try again.'
      );
    }
    throw new AIServiceError(
      'UNREACHABLE',
      'AI providers are unreachable. Please verify your API key and network, then try again.'
    );
  }

  /**
   * Generate questions for a single part
   */
  async generateQuestions(
    syllabusUnits: Record<string, any>[],
    partConfig: PartConfig,
    subjectName: string,
    cdapUnits?: Record<string, any>[] | null,
  ): Promise<Record<string, any>[]> {
    this.rebuildProviderChain();

    if (!this.providerChain.length) {
      throw new AIServiceError(
        'NO_PROVIDER',
        'No AI provider API key is configured. Please add or update your API key in AI Settings and try again.'
      );
    }

    const partName = partConfig.partName || 'Part';
    const qCount = partConfig.questionCount || 5;
    const marks = partConfig.marksPerQuestion || 2;
    const mcqCount = partConfig.mcqCount || 0;

    _log('AI', `📋 Generating: ${partName} | Subject: ${subjectName}`);
    _log('AI', `📊 Questions: ${qCount} | Marks: ${marks} | BTL: ${partConfig.allowedBTLLevels.join(', ')}`);

    // Dynamic chunk size
    let effectiveChunk = this.CHUNK_SIZE;
    if (marks >= 13) effectiveChunk = 5;
    else if (marks >= 8) effectiveChunk = 7;

    // Step 1: assign questions to units (round-robin)
    const unitAssignments = this._assignQuestionsToUnits(qCount, syllabusUnits, mcqCount);

    // Step 2: group into chunks
    const chunks = this._groupIntoChunks(unitAssignments, effectiveChunk);
    _log('AI', `🔀 ${qCount} Qs → ${chunks.length} chunk(s)`);

    const allQuestions: Record<string, any>[] = [];

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunkUnits = chunks[chunkIdx];
      const chunkTotal = chunkUnits.reduce((s, ua) => s + ua.count, 0);
      const chunkMcq = chunkUnits.reduce((s, ua) => s + ua.mcq, 0);

      // Scale BTL distribution for this chunk
      const partTotal = partConfig.questionCount || 1;
      const origDist = partConfig.btlDistribution || {};
      const allowed = new Set(partConfig.allowedBTLLevels || []);
      let scaledDist: Record<string, number> | null = null;

      if (Object.keys(origDist).length > 0 && chunkTotal < partTotal) {
        scaledDist = {};
        for (const [k, v] of Object.entries(origDist)) {
          if (v && Number(v) > 0) {
            const scaled = Math.round((Number(v) * chunkTotal) / partTotal);
            if (scaled > 0 && allowed.has(k)) {
              scaledDist[k] = scaled;
            }
          }
        }
      } else if (Object.keys(origDist).length > 0) {
        scaledDist = origDist;
      }

      const chunkConfig: PartConfig = {
        ...partConfig,
        questionCount: chunkTotal,
        mcqCount: chunkMcq,
        btlDistribution: scaledDist || undefined,
      };

      // Rotate providers across chunks for load balancing
      const provIdx = chunkIdx % this.providerChain.length;

      const prompt = this._buildPrompt(chunkUnits, chunkConfig, subjectName, cdapUnits);
      _log('AI', `📦 Chunk ${chunkIdx + 1}/${chunks.length} | ${chunkTotal}q | Prompt: ${prompt.length.toLocaleString()} chars`);

      let content = await this._callWithFallback(prompt, provIdx);

      // Retry if failed
      _log('AI', `🔄 Chunk ${chunkIdx + 1}: all providers failed — waiting 5s then retrying`);
      await this._sleep(5000);
      const retryStart = (provIdx + 1) % this.providerChain.length;
      content = await this._callWithFallback(prompt, retryStart);

      // Parse
      let questions: Record<string, any>[];
      try {
        questions = this._parseQuestions(content, chunkConfig, !!cdapUnits);
      } catch {
        // Parse failed — retry the API call once more
        _log('AI', `🔄 Chunk ${chunkIdx + 1}: parse failed — retrying (3s)`);
        await this._sleep(3000);
        const retryStart = (provIdx + 1) % this.providerChain.length;
        const content2 = await this._callWithFallback(prompt, retryStart);
        questions = this._parseQuestions(content2, chunkConfig, !!cdapUnits);
      }

      // Stamp unit numbers from assignment
      let qPtr = 0;
      for (const ua of chunkUnits) {
        const unitNum = ua.unit.unitNumber || 1;
        for (let j = 0; j < ua.count; j++) {
          if (qPtr < questions.length) {
            questions[qPtr].unit = unitNum;
            qPtr++;
          }
        }
      }

      _log('AI', `✅ Chunk ${chunkIdx + 1}: ${questions.length} questions parsed`);
      allQuestions.push(...questions);
    }

    _log('AI', `🏁 Assembled ${allQuestions.length} questions across ${chunks.length} chunk(s)`);
    return allQuestions;
  }

  /**
   * Generate questions for all parts
   */
  async generateFullQuestionBank(
    syllabusUnits: Record<string, any>[],
    parts: PartConfig[],
    subjectName: string,
    cdapUnits?: Record<string, any>[] | null,
  ): Promise<Record<string, Record<string, any>[]>> {
    const result: Record<string, Record<string, any>[]> = {};
    _log('QB', `🎓 Starting full question bank generation | Subject: ${subjectName} | Parts: ${parts.length}`);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partName = part.partName || 'Part';
      _log('QB', `[${i + 1}/${parts.length}] Starting ${partName}...`);
      const questions = await this.generateQuestions(syllabusUnits, part, subjectName, cdapUnits);
      result[partName] = questions;
      _log('QB', `[${i + 1}/${parts.length}] ${partName} done — ${questions.length} questions`);
    }

    const totalQ = Object.values(result).reduce((s, v) => s + v.length, 0);
    _log('QB', `🏁 Generation complete! Total: ${totalQ} questions across ${parts.length} parts`);
    return result;
  }

  // ── Unit-assignment helpers ──

  private _assignQuestionsToUnits(totalQ: number, units: Record<string, any>[], mcqCount: number): UnitAssignment[] {
    if (!units.length || totalQ === 0) return [];
    const n = units.length;
    const base = Math.floor(totalQ / n);
    const remainder = totalQ % n;
    const mcqRatio = totalQ ? mcqCount / totalQ : 0;

    const result: UnitAssignment[] = [];
    for (let i = 0; i < n; i++) {
      const q = base + (i < remainder ? 1 : 0);
      if (q > 0) {
        result.push({
          unit: units[i],
          count: q,
          mcq: Math.round(mcqRatio * q),
        });
      }
    }
    return result;
  }

  private _groupIntoChunks(unitAssignments: UnitAssignment[], chunkSize: number): UnitAssignment[][] {
    const chunks: UnitAssignment[][] = [];
    let current: UnitAssignment[] = [];
    let currentTotal = 0;

    for (const ua of unitAssignments) {
      if (currentTotal + ua.count > chunkSize && current.length > 0) {
        chunks.push(current);
        current = [];
        currentTotal = 0;
      }
      current.push(ua);
      currentTotal += ua.count;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  // ── Prompt builder ──

  private _buildPrompt(
    unitAssignments: UnitAssignment[],
    part: PartConfig,
    subject: string,
    cdapUnits?: Record<string, any>[] | null,
  ): string {
    const partName = part.partName || 'Part';
    const marks = part.marksPerQuestion || 2;
    const count = part.questionCount || 5;
    const btlLevels = part.allowedBTLLevels || ['BTL1', 'BTL2'];
    const mcqCount = part.mcqCount || 0;
    const descCount = count - mcqCount;
    const hasCdap = !!cdapUnits && cdapUnits.length > 0;

    let answerDepth: string;
    if (marks <= 2) answerDepth = '1-2 sentences';
    else if (marks <= 8) answerDepth = '5-8 sentences with example';
    else answerDepth = 'structured ~200-300 word explanation with steps/code/examples';

    // Unit coverage lines
    const unitLines: string[] = [];
    for (const ua of unitAssignments) {
      const u = ua.unit;
      const topics = this._extractTopics(u).slice(0, 8).join(', ');
      unitLines.push(`- ${ua.count}q from: ${u.title || ''} | ${topics}`);
    }
    const unitBlock = unitLines.join('\n');

    // CDAP context
    let cdapText = '';
    if (hasCdap) {
      const chunkUnitNums = new Set(unitAssignments.map(ua => ua.unit.unitNumber));
      const cdapLines: string[] = [];
      for (const u of cdapUnits!) {
        if (!chunkUnitNums.has(u.unit_number)) continue;
        const fmtTopics = (tlist: any[]) =>
          tlist.slice(0, 6).map(t => (typeof t === 'object' ? t.topic || String(t) : String(t))).join(', ');
        const p1 = fmtTopics(u.part1_topics || []);
        const p2 = fmtTopics(u.part2_topics || []);
        if (p1) cdapLines.push(`Part1: ${p1}`);
        if (p2) cdapLines.push(`Part2: ${p2}`);
      }
      if (cdapLines.length) cdapText = '\nCDAP topics:\n' + cdapLines.join('\n');
    }

    const cdapField = hasCdap ? ', "cdap_part": 1_or_2' : '';
    const cdapRule = hasCdap ? '- "cdap_part": alternate 1 and 2\n' : '';

    // K-level keywords
    const kPairs = BTL_ORDER
      .filter(btl => btlLevels.includes(btl))
      .map(btl => `${btl}/K${BTL_ORDER.indexOf(btl) + 1}: ${K_KEYWORDS[btl]}`);
    const kKeywordsLine = kPairs.join(' | ');

    // BTL distribution line
    const btlDist = part.btlDistribution || {};
    const activeDist: Record<string, number> = {};
    for (const [k, v] of Object.entries(btlDist)) {
      if (btlLevels.includes(k) && v && Number(v) > 0) activeDist[k] = Number(v);
    }

    let distRule = '';
    if (Object.keys(activeDist).length > 0) {
      const distParts = Object.entries(activeDist)
        .map(([k, v]) => `${k}/K${BTL_ORDER.indexOf(k) + 1}=${v}q`);
      distRule = `- EXACT BTL/K distribution required: ${distParts.join(', ')} (counts are mandatory)\n`;
    } else if (btlLevels.length > 1) {
      distRule = `- Distribute the ${count} questions as evenly as possible across these BTL levels: ${btlLevels.join(', ')}\n`;
    }

    let prompt = `Generate exactly ${count} exam questions for "${subject}" (${partName}).

UNIT COVERAGE — generate EXACTLY the count specified from each topic set:
${unitBlock}${cdapText}

RULES:
- ${mcqCount} MCQ + ${descCount} descriptive | ${marks} marks each | BTL: ${btlLevels.join(', ')}
- K-level keywords: ${kKeywordsLine}
${distRule}- Answer depth: ${answerDepth}
- For code/DB topics: include relevant SQL/pseudocode in answers
- BTL3+: frame with real-world context ("Given a hospital system...", "For an e-commerce DB...")
- NEVER mention unit names or numbers inside question or answer text
${cdapRule}`;

    if (mcqCount > 0) {
      prompt += `OUTPUT — JSON array of EXACTLY ${count} items. First ${mcqCount} MCQ, rest descriptive:
[{"question":"...","unit":1${cdapField},"btl":"BTL1","marks":${marks},"isMCQ":true,"options":{"A":"...","B":"...","C":"...","D":"..."},"correctOption":"A","answer":"..."},
 {"question":"...","unit":1${cdapField},"btl":"BTL2","marks":${marks},"isMCQ":false,"answer":"..."}]`;
    } else {
      prompt += `OUTPUT — JSON array of EXACTLY ${count} items:
[{"question":"...","unit":1${cdapField},"btl":"BTL2","marks":${marks},"answer":"..."}]`;
    }

    prompt += '\nReturn ONLY the JSON array. No markdown. Escape internal quotes as \\" and newlines as \\\\n.';
    return prompt;
  }

  private _extractTopics(unit: Record<string, any>): string[] {
    const topics = unit.topics || [];
    if (!topics.length) return [unit.title || 'General'];
    return topics.map((t: any) => (typeof t === 'string' ? t : t.topicName || String(t)));
  }

  // ── JSON Parsing — 5-attempt repair ──

  private _parseQuestions(content: string, part: PartConfig, hasCdap: boolean): Record<string, any>[] {
    const marks = part.marksPerQuestion || 2;

    const finalise = (questions: any[]): Record<string, any>[] => {
      questions = questions.filter((q: any) => typeof q === 'object' && q !== null);
      for (const q of questions) {
        if (!('marks' in q)) q.marks = marks;
        if (hasCdap && !('cdap_part' in q)) q.cdap_part = 1;
      }
      return this._cleanQuestions(questions);
    };

    try {
      content = content.trim();
      // Strip markdown code fences
      content = content.replace(/^```(?:json)?\s*/g, '');
      content = content.replace(/\s*```$/g, '');

      // Locate the outermost JSON array
      const jsonMatch = content.match(/\[[\s\S]*/);
      if (!jsonMatch) {
        _log('PARSE', '⚠ No JSON array found');
        throw new Error('No array');
      }

      let jsonStr = jsonMatch[0];
      // Trim to last ']'
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBracket !== -1) jsonStr = jsonStr.substring(0, lastBracket + 1);

      // Attempt 1: Direct parse
      try {
        const questions = JSON.parse(jsonStr);
        _log('PARSE', `✅ Attempt 1 (direct) — ${questions.length} questions`);
        return finalise(questions);
      } catch (e1: any) {
        _log('PARSE', `⚠ Attempt 1 failed: ${e1.message}`);
      }

      // Attempt 2: Basic repair on extracted array
      try {
        const repaired = this._basicRepair(jsonStr);
        const questions = JSON.parse(repaired);
        if (Array.isArray(questions) && questions.length > 0) {
          _log('PARSE', `✅ Attempt 2 (basic repair) — ${questions.length} questions`);
          return finalise(questions);
        }
      } catch (e2: any) {
        _log('PARSE', `⚠ Attempt 2 failed: ${e2.message}`);
      }

      // Attempt 3: Repair on full raw content
      try {
        const repaired = this._basicRepair(content);
        const parsed = JSON.parse(repaired);
        let questions: any[];
        if (Array.isArray(parsed)) {
          questions = parsed;
        } else if (typeof parsed === 'object') {
          questions = Object.values(parsed).find(v => Array.isArray(v) && v.length > 0) as any[] || [];
        } else {
          throw new Error('Unexpected type');
        }
        if (questions.length > 0) {
          _log('PARSE', `✅ Attempt 3 (full repair) — ${questions.length} questions`);
          return finalise(questions);
        }
      } catch (e3: any) {
        _log('PARSE', `⚠ Attempt 3 failed: ${e3.message}`);
      }

      // Attempt 4: Truncation recovery + repair
      try {
        const recovered = this._repairTruncatedJson(jsonStr);
        const repaired = this._basicRepair(recovered);
        const questions = JSON.parse(repaired);
        if (Array.isArray(questions) && questions.length > 0) {
          _log('PARSE', `✅ Attempt 4 (truncate+repair) — ${questions.length} questions`);
          return finalise(questions);
        }
      } catch (e4: any) {
        _log('PARSE', `⚠ Attempt 4 failed: ${e4.message}`);
      }

      // Attempt 5: Salvage individual objects
      try {
        const objPattern = /\{(?:[^{}]|\{[^{}]*\})*"question"(?:[^{}]|\{[^{}]*\})*\}/g;
        const matches = jsonStr.match(objPattern);
        if (matches && matches.length > 0) {
          const questions: any[] = [];
          for (const m of matches) {
            try {
              questions.push(JSON.parse(m));
            } catch {
              try {
                questions.push(JSON.parse(this._basicRepair(m)));
              } catch {
                // skip malformed
              }
            }
          }
          if (questions.length > 0) {
            _log('PARSE', `✅ Attempt 5 (salvage) — ${questions.length} questions`);
            return finalise(questions);
          }
        }
      } catch (e5: any) {
        _log('PARSE', `⚠ Attempt 5 failed: ${e5.message}`);
      }

    } catch (e: any) {
      _log('PARSE', `💥 Unexpected parse error: ${e.message}`);
    }

    _log('PARSE', '❌ All 5 parse attempts failed');
    throw new AIServiceError(
      'PARSE_FAILED',
      'AI response could not be parsed. Please try again or switch providers in AI Settings.'
    );
  }

  /**
   * Basic JSON repair: fix common issues from AI responses
   */
  private _basicRepair(text: string): string {
    // Remove trailing commas before } or ]
    text = text.replace(/,\s*([}\]])/g, '$1');
    // Fix single quotes used as string delimiters (crude)
    // Replace unescaped newlines inside strings
    text = text.replace(/\r?\n/g, '\\n');
    // Fix common issue: literal newlines in JSON string values
    text = text.replace(/\\n\\n/g, '\\n');
    return text;
  }

  /**
   * Attempt to close a JSON array that was cut off mid-stream
   */
  private _repairTruncatedJson(text: string): string {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace === -1) return text;
    let truncated = text.substring(0, lastBrace + 1);
    truncated = truncated.trimEnd().replace(/,\s*$/, '');
    return truncated + '\n]';
  }

  // ── Markdown cleanup ──

  private _cleanMarkdown(text: string): string {
    if (typeof text !== 'string') return text;
    // Remove bold
    text = text.replace(/\*\*(.+?)\*\*/gs, '$1');
    text = text.replace(/__(.+?)__/gs, '$1');
    // Remove italic (single * or _) — careful not to match ** or __
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, '$1');
    text = text.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/gs, '$1');
    // Remove markdown headers
    text = text.replace(/^#{1,6}\s*/gm, '');
    // Remove horizontal rules
    text = text.replace(/^[-*_]{3,}\s*$/gm, '');
    // Collapse 3+ blank lines
    text = text.replace(/\n{3,}/g, '\n\n');
    // Decode unicode escapes
    text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return text.trim();
  }

  private _removeUnitReferences(text: string): string {
    if (typeof text !== 'string') return text;
    const patterns = [
      /\b[Ii]n [Uu]nit\s*\d+[,:]?\s*/g,
      /\b[Aa]s (?:discussed|covered|described|mentioned|stated|explained) in [Uu]nit\s*\d+[,:]?\s*/g,
      /\b[Aa]ccording to [Uu]nit\s*\d+[,:]?\s*/g,
      /\b[Ii]n the context of [Uu]nit\s*\d+[,:]?\s*/g,
      /\b[Ff]rom [Uu]nit\s*\d+[,:]?\s*/g,
      /\b\([Uu]nit\s*\d+\)\s*/g,
      /\b[Uu]nit\s*\d+\s*[-–:]\s*/g,
    ];
    for (const p of patterns) {
      text = text.replace(p, '');
    }
    return text.replace(/  +/g, ' ').trim();
  }

  private _cleanQuestions(questions: any[]): any[] {
    const textFields = ['question', 'answer', 'hint', 'explanation'];
    for (const q of questions) {
      for (const field of textFields) {
        if (field in q && typeof q[field] === 'string') {
          q[field] = this._cleanMarkdown(q[field]);
          q[field] = this._removeUnitReferences(q[field]);
        }
      }
    }
    return questions;
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const aiService = new AIService();
