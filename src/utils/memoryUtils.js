/**
 * Memory Utility Functions
 * Helper functions for memory management
 */

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @param {number} normA - Pre-computed norm of vector a (optional)
 * @param {number} normB - Pre-computed norm of vector b (optional)
 * @returns {number} Similarity score (0-1)
 */
export function cosineSimilarity(a, b, normA = null, normB = null) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let computedNormA = normA !== null ? normA : 0;
  let computedNormB = normB !== null ? normB : 0;
  
  // Single pass through vectors
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    if (normA === null) computedNormA += a[i] * a[i];
    if (normB === null) computedNormB += b[i] * b[i];
  }
  
  // Use pre-computed norms if provided, otherwise compute square root
  const denominator = (normA !== null ? normA : Math.sqrt(computedNormA)) * 
                      (normB !== null ? normB : Math.sqrt(computedNormB));
  
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Find most similar memories using vector embeddings (optimized)
 * @param {Array<number>} queryEmbedding - Query vector
 * @param {Array<object>} memories - Array of memory objects with embeddings
 * @param {number} threshold - Minimum similarity threshold
 * @param {number} limit - Maximum number of results
 * @returns {Array<object>} Sorted array of similar memories
 */
export function findSimilarMemories(queryEmbedding, memories, threshold = 0.7, limit = 5) {
  if (!queryEmbedding || !memories || memories.length === 0) return [];
  
  // Pre-compute query vector norm for efficiency
  let queryNorm = 0;
  for (let i = 0; i < queryEmbedding.length; i++) {
    queryNorm += queryEmbedding[i] * queryEmbedding[i];
  }
  queryNorm = Math.sqrt(queryNorm);
  
  // Calculate similarities with pre-computed query norm
  const similarities = [];
  for (const memory of memories) {
    const similarity = cosineSimilarity(queryEmbedding, memory.embedding, queryNorm, null);
    if (similarity >= threshold) {
      similarities.push({
        ...memory,
        similarity
      });
    }
  }
  
  // Sort and limit results
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, limit);
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
