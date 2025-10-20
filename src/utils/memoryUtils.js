/**
 * Memory Utility Functions
 * Helper functions for memory management
 */

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Similarity score (0-1)
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Find most similar memories using vector embeddings
 * @param {Array<number>} queryEmbedding - Query vector
 * @param {Array<object>} memories - Array of memory objects with embeddings
 * @param {number} threshold - Minimum similarity threshold
 * @param {number} limit - Maximum number of results
 * @returns {Array<object>} Sorted array of similar memories
 */
export function findSimilarMemories(queryEmbedding, memories, threshold = 0.7, limit = 5) {
  if (!queryEmbedding || !memories || memories.length === 0) return [];
  
  const similarities = memories
    .map(memory => ({
      ...memory,
      similarity: cosineSimilarity(queryEmbedding, memory.embedding)
    }))
    .filter(m => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return similarities;
}

/**
 * Truncate array to maximum length (FIFO)
 * @param {Array} array - Array to truncate
 * @param {number} maxLength - Maximum length
 * @returns {Array} Truncated array
 */
export function truncateArray(array, maxLength) {
  if (!Array.isArray(array)) return [];
  if (array.length <= maxLength) return array;
  return array.slice(-maxLength);
}

/**
 * Calculate time decay factor for memory importance
 * @param {Date} timestamp - Memory timestamp
 * @param {number} decayHours - Hours until 50% decay
 * @returns {number} Decay factor (0-1)
 */
export function calculateDecayFactor(timestamp, decayHours = 48) {
  const now = Date.now();
  const age = now - new Date(timestamp).getTime();
  const ageHours = age / (1000 * 60 * 60);
  
  // Exponential decay: factor = 0.5^(age/decayHours)
  return Math.pow(0.5, ageHours / decayHours);
}

/**
 * Merge and deduplicate memory arrays
 * @param {Array} oldMemories - Existing memories
 * @param {Array} newMemories - New memories to add
 * @param {string} key - Key to use for deduplication
 * @returns {Array} Merged and deduplicated array
 */
export function mergeMemories(oldMemories, newMemories, key = 'id') {
  const merged = [...oldMemories];
  const existingKeys = new Set(oldMemories.map(m => m[key]));
  
  newMemories.forEach(memory => {
    if (!existingKeys.has(memory[key])) {
      merged.push(memory);
      existingKeys.add(memory[key]);
    }
  });
  
  return merged;
}

/**
 * Calculate memory importance score
 * @param {object} memory - Memory object
 * @returns {number} Importance score (0-1)
 */
export function calculateImportance(memory) {
  let score = 0;
  
  // Emotional weight
  if (memory.emotion && memory.emotion !== 'neutral') {
    score += 0.3;
  }
  
  // Recency factor
  const decayFactor = calculateDecayFactor(memory.timestamp);
  score += decayFactor * 0.3;
  
  // Explicit importance flag
  if (memory.important) {
    score += 0.4;
  }
  
  return Math.min(score, 1);
}
