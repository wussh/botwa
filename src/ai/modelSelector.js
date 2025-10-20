/**
 * Model Selection Service
 * Intelligently selects the best AI model based on context
 */

import config from '../config/index.js';

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
  
  // Emotion-based scoring modifiers
  if (['sad', 'anxious', 'frustrated'].includes(emotion)) {
    modelScores[config.AI_MODELS.emotional] += 0.4;
  }
  
  if (emotion === 'flirty') {
    modelScores[config.AI_MODELS.creative] += 0.5;
    modelScores[config.AI_MODELS.emotional] += 0.3;
  }
  
  if (emotion === 'happy' || emotion === 'excited') {
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
  
  // Select highest scoring model
  const selectedEntry = Object.entries(modelScores)
    .sort((a, b) => b[1] - a[1])[0];
  
  const selectedModel = selectedEntry[0];
  const confidence = selectedEntry[1];
  
  return { model: selectedModel, confidence };
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
