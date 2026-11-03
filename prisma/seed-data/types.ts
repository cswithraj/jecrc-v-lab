import type { Environment, Language } from "@prisma/client";

export interface RichExperiment {
  n: number; // catalog number this write-up fills
  title?: string; // defaults to catalog title
  language?: Language; // defaults to subject language
  env?: Environment;
  minutes?: number;
  objectives: string[];
  cos?: string[];
  theory: {
    introduction: string;
    definition: string;
    concepts: string[];
    terminology?: [string, string][];
    working: string;
    applications: string[];
    examples?: string;
  };
  problem: string;
  algorithm: string[];
  pseudocode?: string;
  flowchart?: string; // mermaid
  starter?: string;
  reference?: string;
  explanation?: string;
  sampleInput?: string;
  sampleOutput?: string;
  tests?: [input: string, expected: string, hidden?: boolean][];
  compareMode?: "EXACT" | "TRIM" | "TOKENS" | "FLOAT";
  viva: [q: string, a: string][];
  conclusion?: string;
}
export const R = String.raw;
