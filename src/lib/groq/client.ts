import Groq from 'groq-sdk';

export const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqUsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export async function createChatCompletion(
  messages: GroqChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
): Promise<{ content: string; usage: GroqUsageStats }> {
  const completion = await groqClient.chat.completions.create({
    messages,
    model: options?.model || process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    temperature: options?.temperature || 0.7,
    max_tokens: options?.max_tokens || 1024,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    usage: {
      prompt_tokens: completion.usage?.prompt_tokens || 0,
      completion_tokens: completion.usage?.completion_tokens || 0,
      total_tokens: completion.usage?.total_tokens || 0,
    },
  };
}
