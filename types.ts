export interface EvaluationCriteria {
  iloClarity: boolean;
  iloAlignment: boolean;
  assessmentQuality: boolean;
  referenceCurrency: boolean;
  structureCompliance: boolean;
  benchmarkUniversities: string;
}

export interface SectionScore {
  section: string;
  score: number; // 0-100
  feedback: string;
}

export interface GapAnalysis {
  missingComponents: string[];
  weaknesses: string[];
  strengths: string[];
}

export interface Tutor {
  name: string;
  affiliation: string;
  email: string;
  specialization: string;
}

export interface ClassroomActivity {
  title: string;
  description: string;
  learningOutcomeMap: string;
}

export interface BenchmarkResult {
  university: string;
  comparison: string;
  url?: string;
}

export interface AnalysisResult {
  overallScore: number;
  courseTitle: string;
  syllabusTopics: string[]; // Added for context passing
  sectionScores: SectionScore[];
  gapAnalysis: GapAnalysis;
  recommendations: string[];
  revisedILOs: string[];
  benchmarks: BenchmarkResult[];
  tutors: Tutor[];
  suggestedActivities: ClassroomActivity[];
}

export type ProcessingStatus = 'idle' | 'uploading' | 'analyzing' | 'gathering_data' | 'complete' | 'error';