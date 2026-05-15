export type ModelId = 'auto' | 'gpt-4o' | 'claude-sonnet' | 'gemini-flash' | 'llama-3.3-70b';

export const MODELS: { id: ModelId; label: string; totalLimit: number }[] = [
  { id: 'auto',          label: 'Auto (Kimi)',   totalLimit: 300 },
  { id: 'gemini-flash',  label: 'Gemini Flash',  totalLimit: 200 },
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', totalLimit: 150 },
  { id: 'claude-sonnet', label: 'Claude Sonnet', totalLimit: 40  },
  { id: 'gpt-4o',        label: 'GPT-4o',        totalLimit: 40  },
];

export const LIMIT_CONTACT = {
  email: 'ismail.moudden1@gmail.com',
  linkedin: 'https://www.linkedin.com/in/ismail-moudden',
};

export function getModelLabel(id: ModelId): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}
