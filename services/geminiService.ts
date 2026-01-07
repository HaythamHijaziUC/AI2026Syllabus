import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, EvaluationCriteria } from "../types";

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Extend window interface for Mammoth
declare global {
  interface Window {
    mammoth: any;
  }
}

/**
 * Helper to parse clean JSON from model output that might contain markdown
 */
const parseJSON = (text: string) => {
  try {
    const trimmed = text.trim();
    
    // Try finding JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);

    // Try finding JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);

    // Fallback cleanup
    let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    return JSON.parse(clean);
  } catch (e) {
    console.warn("JSON Parse Warning: Returning empty object/array.", e);
    return {};
  }
};

/**
 * Wraps a promise with a timeout
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMsg));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

/**
 * Converts a File object to a Generative Part (Inline Data or Text).
 * Handles PDF, DOCX (via mammoth), and TXT.
 */
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } } | { text: string }> => {
  
  // 1. PDF - Supported Natively by Gemini
  if (file.type === 'application/pdf') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(',')[1];
          resolve({
            inlineData: {
              data: base64Data,
              mimeType: file.type,
            },
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
  }

  // 2. Plain Text
  if (file.type === 'text/plain') {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
              resolve({ text: reader.result as string });
          };
          reader.onerror = reject;
          reader.readAsText(file);
      });
  }

  // 3. DOCX - Extract text using Mammoth.js
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      if (!window.mammoth) {
          throw new Error("Document processor (Mammoth) not loaded. Please refresh.");
      }
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
              const arrayBuffer = event.target?.result;
              window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                  .then((result: any) => {
                      resolve({ text: `[Extracted Content from DOCX]:\n${result.value}` });
                  })
                  .catch((err: any) => reject(new Error("Failed to process DOCX file: " + err.message)));
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
      });
  }

  throw new Error(`Unsupported file type: ${file.type}. Please upload PDF, DOCX, or TXT.`);
};

/**
 * Step 1: Extract, Evaluate, and Generate Initial Report (Internal Analysis)
 */
export const evaluateSyllabusContent = async (
  filePart: { inlineData: { data: string; mimeType: string } } | { text: string },
  criteria: EvaluationCriteria,
  language: 'en' | 'ar'
): Promise<Partial<AnalysisResult>> => {
  const client = getClient();
  
  const prompt = `
    You are an expert Academic Quality Assurance Officer at Palestine Ahliya University (PAU).
    
    Task: Analyze the attached syllabus file content to ensure it meets high academic standards.
    Output Language: ${language === 'ar' ? 'Arabic' : 'English'}.
    
    CRITICAL INSTRUCTIONS:
    1.  **Deep Analysis**: You MUST populate 'gapAnalysis' arrays. Do NOT leave them empty.
        - **missingComponents**: List specific sections missing (e.g., "No plagiarism policy", "Missing weekly reading list", "No grade breakdown").
        - **weaknesses**: Critique quality (e.g., "ILOs are too vague", "Assessment weight is unbalanced", "Old references").
        - **strengths**: Highlight good parts (e.g., "Clear weekly plan", "Diverse assessment").
    2.  **Extract Topics**: Summarize the core list of topics covered in the course into the 'syllabusTopics' array.
    3.  **Revised ILOs**: You MUST rewrite at least 3-5 ILOs to be more measurable (using Bloom's verbs).
    4.  **Suggested Activities**: Provide 3 specific active learning activities.

    Criteria to evaluate:
    1. ILO Clarity: ${criteria.iloClarity ? 'Check strictly for Bloom\'s taxonomy and specificity.' : 'Standard check.'}
    2. Alignment: ${criteria.iloAlignment ? 'Check if weekly topics map to ILOs.' : 'Standard check.'}
    3. Assessments: ${criteria.assessmentQuality ? 'Evaluate variety, rubrics, and weight.' : 'Standard check.'}
    4. References: ${criteria.referenceCurrency ? 'Check if books are recent (last 5-7 years).' : 'Standard check.'}
    
    Please provide a structured JSON response with:
    - courseTitle
    - syllabusTopics (Array of strings: list of main topics found)
    - overallScore (0-100)
    - sectionScores (Array of object { section, score, feedback })
    - gapAnalysis (missingComponents, weaknesses, strengths) -> THESE ARRAYS MUST NOT BE EMPTY.
    - recommendations (list of strings)
    - revisedILOs (list of strings) -> MUST CONTAIN AT LEAST 3 ITEMS.
    - suggestedActivities (Array of { title, description, learningOutcomeMap })
  `;

  const request = client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [filePart, { text: prompt }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            courseTitle: { type: Type.STRING },
            syllabusTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
            overallScore: { type: Type.NUMBER },
            sectionScores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  feedback: { type: Type.STRING },
                },
              },
            },
            gapAnalysis: {
              type: Type.OBJECT,
              properties: {
                missingComponents: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            revisedILOs: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedActivities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  learningOutcomeMap: { type: Type.STRING },
                }
              }
            }
          },
        },
      },
    });

  const response = await withTimeout<GenerateContentResponse>(request, 60000, "Analysis timed out (60s).");
  
  const parsedData = parseJSON(response.text || '{}');

  const defaultAnalysis = {
      courseTitle: "Untitled Course",
      syllabusTopics: ["General Topics"],
      overallScore: 0,
      sectionScores: [],
      gapAnalysis: {
          missingComponents: ["Analysis yielded no missing components data."],
          weaknesses: ["Analysis yielded no weakness data."],
          strengths: ["Analysis yielded no strength data."]
      },
      recommendations: [],
      revisedILOs: ["No revisions generated."],
      suggestedActivities: []
  };

  const finalData = { ...defaultAnalysis, ...parsedData };
  
  // Data Validation & Sanitization
  if (!Array.isArray(finalData.sectionScores)) finalData.sectionScores = [];
  if (!Array.isArray(finalData.syllabusTopics)) finalData.syllabusTopics = ["Topics not extracted"];
  if (!Array.isArray(finalData.recommendations)) finalData.recommendations = [];
  if (!Array.isArray(finalData.revisedILOs)) finalData.revisedILOs = [];
  if (!Array.isArray(finalData.suggestedActivities)) finalData.suggestedActivities = [];

  // Gap Analysis Sanitization
  if (!finalData.gapAnalysis || typeof finalData.gapAnalysis !== 'object') {
      finalData.gapAnalysis = defaultAnalysis.gapAnalysis;
  } else {
      if (!Array.isArray(finalData.gapAnalysis.missingComponents)) finalData.gapAnalysis.missingComponents = [];
      if (!Array.isArray(finalData.gapAnalysis.weaknesses)) finalData.gapAnalysis.weaknesses = [];
      if (!Array.isArray(finalData.gapAnalysis.strengths)) finalData.gapAnalysis.strengths = [];
  }
  
  return finalData;
};

/**
 * Step 2: Benchmarking
 * Uses a delimiter-based strategy to avoid JSON issues with Search Tools.
 */
export const performBenchmarking = async (
  courseTitle: string,
  targetUniversities: string,
  currentTopics: string[],
  language: 'en' | 'ar'
): Promise<any[]> => {
  const client = getClient();
  
  // Format current topics for the prompt to give context
  const topicsContext = currentTopics.slice(0, 10).join(', ');

  const searchPrompt = `
    Context: The user is evaluating a syllabus for the course "${courseTitle}".
    Current Syllabus Topics: ${topicsContext}.
    Target Benchmark: "${targetUniversities || "Standard Global Curriculum"}".
    
    INSTRUCTIONS:
    1. **INTERPRET THE GOAL**:
       - If the target is an accreditation body (ABET, ACM, IEEE), search for their specific curriculum guidelines/student outcomes for this subject.
       - If the target is a University, search for their syllabus/catalog for "${courseTitle}".
       - If general, search for top-tier university syllabuses.
    
    2. **SEARCH**: Perform a Google Search.
       Query ideas: 
       - "${courseTitle} syllabus ${targetUniversities}"
       - "${targetUniversities} ${courseTitle} learning outcomes"
       - "ABET requirements for ${courseTitle}"
    
    3. **COMPARE & ANALYZE**: 
       - Compare the found benchmark against the 'Current Syllabus Topics' provided above.
       - Identify what the benchmark includes that the current syllabus MISSES (e.g., "ABET requires ethics, but current topics don't show it").
       - Identify if the current syllabus is aligned or outdated.

    Output Language: ${language === 'ar' ? 'Arabic' : 'English'}.
    
    STRICT OUTPUT FORMAT:
    Do not use JSON. Use the following text format for each benchmark found (provide 1 to 3 items):
    
    BENCHMARK_ITEM
    University: [Name of University OR Standard (e.g., ABET)]
    Comparison: [Comparison Analysis: "The ABET standard requires X, Y, Z. Your syllabus covers X but misses Y..."]
    END_ITEM
  `;

  try {
    const request = client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Do NOT set responseMimeType to JSON when using tools
      },
    });

    const response = await withTimeout<GenerateContentResponse>(request, 90000, "Benchmarking search timed out.");
    const text = response.text || '';
    
    // Parse the text output manually
    const results: any[] = [];
    const items = text.split('BENCHMARK_ITEM');
    
    for (const item of items) {
        // Regex allows for optional asterisks (**) and case insensitivity
        const uniMatch = item.match(/University[:*]*\s*(.+?)(?:\n|$)/i);
        const compMatch = item.match(/Comparison[:*]*\s*([\s\S]+?)(?:END_ITEM|$)/i);
        
        if (uniMatch && compMatch) {
            results.push({
                university: uniMatch[1].trim().replace(/\*/g, ''),
                comparison: compMatch[1].trim()
            });
        }
    }
    
    // Attempt to attach a URL from grounding metadata to the first result
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && results.length > 0) {
        const webChunk = chunks.find((c: any) => c.web?.uri);
        if (webChunk) {
            results[0].url = webChunk.web.uri;
        }
    }
    
    return results.length > 0 ? results : [{ university: "No Data", comparison: "Could not retrieve benchmarks." }];

  } catch (error) {
    console.warn("Benchmarking error:", error);
    return [{ university: "Search Unavailable", comparison: "Benchmarking skipped due to connection timeout or error." }];
  }
};

/**
 * Step 3: Find Tutors
 * Uses a delimiter-based strategy to avoid JSON issues with Search Tools.
 */
export const findLocalTutors = async (
  courseTitle: string,
  language: 'en' | 'ar'
): Promise<any[]> => {
  const client = getClient();

  const tutorPrompt = `
    Search for academic professors, lecturers, or tutors who specialize in "${courseTitle}" or related fields 
    specifically at universities in Jordan (e.g., University of Jordan, JUST, Yarmouk) or Palestine (e.g., Birzeit, An-Najah, Palestine Ahliya University, Al-Quds University).
    
    SEARCH STRATEGY:
    1. Use the exact course name "${courseTitle}".
    2. ALSO search for common variations or synonyms of this course title (e.g., if "Data Structures", also search for "Algorithms", "Computer Science", or "Programming").
    3. Look for faculty members in the relevant department.

    Find 3-5 profiles.
    Output Language: ${language === 'ar' ? 'Arabic' : 'English'}.

    STRICT OUTPUT FORMAT:
    Do not use JSON. Use the following text format for each tutor found:

    TUTOR_ITEM
    Name: [Name]
    Affiliation: [University/Inst]
    Email: [Email or "Not listed"]
    Specialization: [Field]
    END_ITEM
  `;

  try {
    const request = client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: tutorPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Do NOT set responseMimeType to JSON when using tools
      },
    });

    const response = await withTimeout<GenerateContentResponse>(request, 90000, "Tutor search timed out.");
    const text = response.text || '';

    // Parse text output
    const results: any[] = [];
    const items = text.split('TUTOR_ITEM');

    for (const item of items) {
        const nameMatch = item.match(/Name[:*]*\s*(.+?)(?:\n|$)/i);
        const affMatch = item.match(/Affiliation[:*]*\s*(.+?)(?:\n|$)/i);
        const emailMatch = item.match(/Email[:*]*\s*(.+?)(?:\n|$)/i);
        const specMatch = item.match(/Specialization[:*]*\s*([\s\S]+?)(?:END_ITEM|$)/i);

        if (nameMatch) {
            results.push({
                name: nameMatch[1].trim().replace(/\*/g, ''),
                affiliation: affMatch ? affMatch[1].trim().replace(/\*/g, '') : "Unknown",
                email: emailMatch ? emailMatch[1].trim().replace(/\*/g, '') : "Not listed",
                specialization: specMatch ? specMatch[1].trim() : "Related Field"
            });
        }
    }
    
    return results;
  } catch (error) {
    console.warn("Tutor search error:", error);
    return [];
  }
};

/**
 * Step 4: Translation Service
 * Translates the entire result object to the target language.
 */
export const translateAnalysisResult = async (
  data: AnalysisResult,
  targetLang: 'en' | 'ar'
): Promise<AnalysisResult> => {
  const client = getClient();
  const langName = targetLang === 'ar' ? 'Arabic' : 'English';
  
  const prompt = `
    Translate ALL string values in the following JSON object to ${langName}.
    
    IMPORTANT:
    1. PRESERVE the exact JSON structure and Keys. ONLY translate the Values.
    2. Do NOT translate "score" numbers or proper names if they are better kept in original (but translate University names if common).
    3. Ensure the output is valid JSON.
    
    JSON:
    ${JSON.stringify(data)}
  `;

  const request = client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  const response = await withTimeout<GenerateContentResponse>(request, 60000, "Translation timed out.");
  const parsed = parseJSON(response.text || '{}');

  // Merge translation with original data to ensure structure is preserved even if translation fails partially.
  // This prevents crashes if keys are missing in the translated output.
  return { ...data, ...parsed } as AnalysisResult;
};