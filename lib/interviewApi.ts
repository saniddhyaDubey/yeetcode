import { EvaluationResult, Message } from "./types";

const BASE_URL = "http://localhost:8080";

/**
 * Sends the selected question and difficulty to the backend to initialise
 * a new interview session before the user enters the playground.
 */
export async function setupInterview(
  difficulty: string,
  question: string,
  timer: number
): Promise<void> {
  await fetch(`${BASE_URL}/api/interview/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty, question, timer }),
  });
}

/**
 * Posts the full conversation history to the backend and returns
 * the AI-generated score breakdown and summary.
 */
export async function evaluateInterview(
  messages: Message[]
): Promise<EvaluationResult> {
  const conversationHistory = messages
    .map((m) => `${m.sender === "user" ? "Candidate" : "Interviewer"}: ${m.text}`)
    .join("\n\n");

  const response = await fetch(`${BASE_URL}/api/interview/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationHistory }),
  });

  return response.json();
}
