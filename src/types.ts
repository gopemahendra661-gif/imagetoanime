/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface UseCaseItem {
  title: string;
  description: string;
}

export interface ExamplePattern {
  input: string;
  output: string;
  explanation: string;
}

export interface SEOPage {
  slug: string;
  keyword: string;
  title: string;
  metaDescription: string;
  intro: string;
  faqList: FAQItem[];
  useCases: UseCaseItem[];
  examples: ExamplePattern[];
  relatedTools: string[];
  schemaMarkup: any; // JSON-LD schema
  category: string;
  canonicalUrl: string;
  createdAt: string;
  updatedAt: string;
  socialMediaScripts?: {
    pinterestDescription: string;
    reelCaption: string;
    shortsScript: string;
  };
}

export interface KeywordResult {
  keyword: string;
  slug: string;
  intent: "informational" | "transactional" | "commercial" | "navigational" | "utility";
  difficulty: number; // 1-100 scale
  searchVolumeEstimate: number;
  category: string;
  competition: "Low" | "Medium" | "High";
  relatedLongTails: string[];
}

export interface AutomationLog {
  id: string;
  timestamp: string;
  step: string;
  message: string;
  status: "info" | "success" | "warning" | "error";
}

export interface AutomationStatus {
  lastRun: string;
  nextRun: string;
  isRunning: boolean;
  activePagesGeneratedCount: number;
  totalKeywordsTracked: number;
  engineStatus: "Active" | "Idle" | "Error";
}
