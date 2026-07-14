export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatSource {
  url: string;
  title: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  sources?: ChatSource[];
}
