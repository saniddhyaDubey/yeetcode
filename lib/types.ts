export type Difficulty = "Easy" | "Medium" | "Hard";

export interface QuestionData {
  question: string;
  timer: number;
  description: string;
}

export interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

export interface EvaluationResult {
  summary: string;
  breakdown: Record<string, string | number>;
  finalScore: number;
}
