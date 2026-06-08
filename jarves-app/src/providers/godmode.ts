/**
 * G0DM0D3 Provider Configuration
 * Races multiple AI models in parallel and returns the best response.
 */

export interface GodmodeConfig {
  apiKey: string;
  baseUrl: string;
}

export interface GodmodeResponse {
  content: string;
  winner: string;
  score: number;
  totalModels: number;
  duration: number;
  metadata?: Record<string, any>;
}

export class GodmodeProvider {
  private config: GodmodeConfig;
  private endpoint: string;

  constructor(config: GodmodeConfig) {
    this.config = config;
    this.endpoint = `${config.baseUrl}/ultraplinian/completions`;
  }

  async generateResponse(systemPrompt: string, userMessage: string): Promise<GodmodeResponse> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'auto',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`G0DM0D3 API error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';
      const metadata = data.metadata || {};

      // Extract race metadata
      const winner = metadata.winner || 'Unknown';
      const score = metadata.score || 0;
      const totalModels = metadata.total_models || 0;
      const duration = metadata.duration || 0;

      return {
        content,
        winner,
        score,
        totalModels,
        duration,
        metadata,
      };
    } catch (error) {
      console.error('G0DM0D3 error:', error);
      throw error;
    }
  }

  async analyzeImage(systemPrompt: string, imageBase64: string, userMessage?: string): Promise<GodmodeResponse> {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
      ];

      if (userMessage) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        });
      } else {
        messages.push({
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        });
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'auto',
          messages,
          temperature: 0.5,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`G0DM0D3 vision error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';
      const metadata = data.metadata || {};

      const winner = metadata.winner || 'Unknown';
      const score = metadata.score || 0;
      const totalModels = metadata.total_models || 0;
      const duration = metadata.duration || 0;

      return {
        content,
        winner,
        score,
        totalModels,
        duration,
        metadata,
      };
    } catch (error) {
      console.error('G0DM0D3 vision error:', error);
      throw error;
    }
  }
}

// Provider metadata for UI
export const GODMODE_PROVIDER = {
  id: 'godmode',
  name: 'G0DM0D3 (Multi-AI Race)',
  description: 'Races 10+ AI models in parallel and returns the best response',
  icon: '🏆',
  theme: 'gold',
  requiresApiKey: true,
  apiKeyName: 'OPENROUTER_API_KEY',
  baseUrl: 'http://localhost:7860/v1',
  setupCommand: 'docker run -p 7860:7860 ghcr.io/elder-plinius/g0dm0d3',
};
