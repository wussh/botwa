/**
 * Model Selection Service
 * Intelligently selects the best AI model based on context
 */

import config from '../config/index.js';

// Pre-computed emotion sets for fast lookup
const NEGATIVE_EMOTIONS = new Set(['sad', 'anxious', 'frustrated']);
const POSITIVE_EMOTIONS = new Set(['happy', 'excited']);

/**
 * Select the best AI model based on intent, emotion, and context
 * @param {string} intent - Message intent
 * @param {string} emotion - Detected emotion
 * @param {object} temporalContext - Time-based context
 * @param {object} moodDrift - User's mood trend
 * @returns {object} Selected model and confidence score
 */
export function selectModel(intent, emotion, temporalContext = {}, moodDrift = {}) {
  const modelScores = {
    [config.AI_MODELS.factual]: 0.1,
    [config.AI_MODELS.emotional]: 0.1,
    [config.AI_MODELS.creative]: 0.1,
    [config.AI_MODELS.coding]: 0.1,
    [config.AI_MODELS.summarization]: 0.1
  };
  
  // Intent-based scoring
  switch (intent) {
    case 'question':
    case 'command':
      modelScores[config.AI_MODELS.factual] += 0.7;
      break;
    case 'emotional':
      modelScores[config.AI_MODELS.emotional] += 0.8;
      break;
    case 'technical':
      modelScores[config.AI_MODELS.coding] += 0.9;
      break;
    case 'smalltalk':
      modelScores[config.AI_MODELS.creative] += 0.6;
      break;
    default:
      modelScores[config.AI_MODELS.emotional] += 0.5;
  }
  
  // Emotion-based scoring modifiers (using Set for O(1) lookup)
  if (NEGATIVE_EMOTIONS.has(emotion)) {
    modelScores[config.AI_MODELS.emotional] += 0.4;
  }
  
  if (emotion === 'flirty') {
    modelScores[config.AI_MODELS.creative] += 0.5;
    modelScores[config.AI_MODELS.emotional] += 0.3;
  }
  
  if (POSITIVE_EMOTIONS.has(emotion)) {
    modelScores[config.AI_MODELS.creative] += 0.3;
  }
  
  // Temporal context scoring
  if (temporalContext?.timeContext === 'late_night') {
    modelScores[config.AI_MODELS.emotional] += 0.2;
  }
  
  if (temporalContext?.isWeekend) {
    modelScores[config.AI_MODELS.creative] += 0.1;
  }
  
  // Mood drift influence
  if (moodDrift?.moodScore < -0.5) {
    modelScores[config.AI_MODELS.emotional] += 0.3;
  }
  
  if (moodDrift?.moodScore > 0.5) {
    modelScores[config.AI_MODELS.creative] += 0.2;
  }
  
  // Find highest scoring model without full sort (more efficient)
  let selectedModel = null;
  let maxScore = -Infinity;
  
  for (const [model, score] of Object.entries(modelScores)) {
    if (score > maxScore) {
      maxScore = score;
      selectedModel = model;
    }
  }
  
  return { model: selectedModel, confidence: maxScore };
}

/**
 * Get fallback models for when primary model fails
 * @param {string} primaryModel - The primary model that failed
 * @returns {Array<string>} Array of fallback models in order of preference
 */
export function getFallbackModels(primaryModel) {
  const fallbackChain = [
    'phi3:3.8b',
    'gemma3:4b-it-qat',
    'llama3.2:latest',
    'phi4-mini-reasoning:3.8b'
  ];
  
  // Remove the primary model from fallbacks
  return fallbackChain.filter(model => model !== primaryModel);
}

export default { selectModel, getFallbackModels };
