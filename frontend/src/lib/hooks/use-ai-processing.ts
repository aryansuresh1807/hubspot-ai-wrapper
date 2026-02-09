'use client';

import { useState, useCallback } from 'react';
import {
  mockAIProcessingResults,
  mockDrafts,
  mockTouchDateRecommendations,
  type MockAIProcessingResult,
  type MockDraft,
  type MockTouchDateRecommendation,
  type MockContact,
  type RelationshipStatus,
  getContactById,
} from '@/lib/mock-data';

const SIMULATED_DELAY_MS = 800;
const EXTRACT_DELAY_MS = 1200;
const DRAFTS_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// useProcessNotes – simulate AI note processing (dates, relationship, key points)
// ---------------------------------------------------------------------------

export interface ProcessNotesResult {
  extractedStartDate: string | null;
  extractedDueDate: string | null;
  extractedRelationship: RelationshipStatus | null;
  subjectConfidence: number;
  nextStepsConfidence: number;
  questionsConfidence: number;
  keyPoints: string[];
}

/** Simulates AI processing of note text. Returns loading state and result. */
export function useProcessNotes(): {
  processNotes: (noteText: string, activityId?: string) => Promise<ProcessNotesResult>;
  isLoading: boolean;
  result: ProcessNotesResult | null;
  error: string | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ProcessNotesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processNotes = useCallback(
    async (noteText: string, activityId?: string): Promise<ProcessNotesResult> => {
      setIsLoading(true);
      setError(null);
      setResult(null);
      try {
        await new Promise((r) => setTimeout(r, SIMULATED_DELAY_MS));
        const mock = activityId
          ? mockAIProcessingResults[activityId]
          : Object.values(mockAIProcessingResults)[0];
        const resolved: ProcessNotesResult = mock
          ? {
              extractedStartDate: mock.extractedStartDate,
              extractedDueDate: mock.extractedDueDate,
              extractedRelationship: mock.extractedRelationship,
              subjectConfidence: mock.subjectConfidence,
              nextStepsConfidence: mock.nextStepsConfidence,
              questionsConfidence: mock.questionsConfidence,
              keyPoints: mock.keyPoints,
            }
          : {
              extractedStartDate: null,
              extractedDueDate: null,
              extractedRelationship: null,
              subjectConfidence: 75,
              nextStepsConfidence: 70,
              questionsConfidence: 65,
              keyPoints: ['Follow-up needed', 'Review timeline'],
            };
        setResult(resolved);
        return resolved;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Processing failed';
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { processNotes, isLoading, result, error };
}

// ---------------------------------------------------------------------------
// useExtractContact – simulate AI contact extraction from text
// ---------------------------------------------------------------------------

export interface ExtractContactResult {
  contact: Partial<MockContact> | null;
  confidence: number;
  fieldsExtracted: string[];
}

/** Simulates AI contact extraction from free text. */
export function useExtractContact(): {
  extractContact: (text: string) => Promise<ExtractContactResult>;
  isLoading: boolean;
  result: ExtractContactResult | null;
  error: string | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractContactResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractContact = useCallback(async (text: string): Promise<ExtractContactResult> => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      await new Promise((r) => setTimeout(r, EXTRACT_DELAY_MS));
      const sample = getContactById('c1');
      const resolved: ExtractContactResult = sample
        ? {
            contact: {
              firstName: sample.firstName,
              lastName: sample.lastName,
              email: sample.email,
              phone: sample.phone,
              jobTitle: sample.jobTitle,
              relationshipStatus: sample.relationshipStatus,
            },
            confidence: 85,
            fieldsExtracted: ['firstName', 'lastName', 'email', 'jobTitle'],
          }
        : {
            contact: {
              firstName: 'Extracted',
              lastName: 'Contact',
              email: 'extracted@example.com',
              jobTitle: 'Unknown',
            },
            confidence: 72,
            fieldsExtracted: ['firstName', 'lastName', 'email'],
          };
      setResult(resolved);
      return resolved;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { extractContact, isLoading, result, error };
}

// ---------------------------------------------------------------------------
// useGenerateDrafts – simulate AI draft generation
// ---------------------------------------------------------------------------

export interface GenerateDraftsResult {
  drafts: MockDraft[];
  touchDateRecommendations: MockTouchDateRecommendation[];
}

/** Simulates AI draft generation for an activity. */
export function useGenerateDrafts(): {
  generateDrafts: (activityId: string) => Promise<GenerateDraftsResult>;
  isLoading: boolean;
  result: GenerateDraftsResult | null;
  error: string | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateDraftsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateDrafts = useCallback(
    async (activityId: string): Promise<GenerateDraftsResult> => {
      setIsLoading(true);
      setError(null);
      setResult(null);
      try {
        await new Promise((r) => setTimeout(r, DRAFTS_DELAY_MS));
        const drafts = mockDrafts.filter((d) => d.activityId === activityId);
        const touchDateRecommendations = mockTouchDateRecommendations.filter(
          (t) => t.activityId === activityId
        );
        const resolved: GenerateDraftsResult = {
          drafts: drafts.length > 0 ? drafts : [
            {
              id: `d-gen-${activityId}`,
              activityId,
              draftText: 'Thank you for your time. Following up as discussed. Best regards.',
              tone: 'formal',
              confidence: 82,
            },
          ],
          touchDateRecommendations: touchDateRecommendations.length > 0
            ? touchDateRecommendations
            : [
                {
                  id: `td-gen-${activityId}`,
                  activityId,
                  recommendedStart: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                  recommendedDue: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                  confidence: 75,
                  rationale: 'Suggested follow-up window based on note context.',
                },
              ],
        };
        setResult(resolved);
        return resolved;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Draft generation failed';
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { generateDrafts, isLoading, result, error };
}
