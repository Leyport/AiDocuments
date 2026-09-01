import { InjectionToken } from '@angular/core';
import { getApp } from 'firebase/app';
import { AI, VertexAIBackend, getAI } from 'firebase/ai';

/**
 * @angular/fire@20.0.1's own `ai` wrapper imports a `getVertexAI` symbol that
 * no longer exists in firebase@12.x's `firebase/ai` module, so it fails to
 * bundle. Wire this directly against `firebase/ai` instead.
 *
 * Uses the Vertex AI Gemini API backend (billed through the project's
 * standard Google Cloud billing account) rather than the Gemini Developer
 * API backend, which runs on a separate AI Studio prepay-credits system.
 */
export const AI_INSTANCE = new InjectionToken<AI>('firebase.ai', {
  providedIn: 'root',
  factory: () => getAI(getApp(), { backend: new VertexAIBackend() })
});
