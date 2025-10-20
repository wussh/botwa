/**
 * Language Detection Service
 * Detects the language of messages
 */

/**
 * Detect dominant language of the message (English or Indonesian)
 * @param {string} text - Message text
 * @returns {string} Detected language ('english', 'indonesian', or 'mixed')
 */
export function detectLanguage(text) {
  const englishWords = text.match(/\b(the|you|and|to|is|are|i'm|it's|that|this|what|how|when|why|love|haha|yes|no|ok|please|thank|but|with|for|from|have|has|do|does|will|would|could|should|can|be|been|being|get|got|go|going|come|coming|see|know|think|want|need|like|feel|look|good|bad|time|day|night|today|tomorrow|yesterday|sorry|thanks|hello|hi|bye|hey|there|here|make|made|take|tell|ask|help|work|home|friend|people|thing|way|life|world|new|old|first|last|long|little|own|other|some|more|much|many|most|few|very|too|so|just|now|then|only|over|back|after|before|because|if|about|into|through|during|including|between|under|never|always|maybe|perhaps)\b/gi);
  const indonesianWords = text.match(/\b(aku|kamu|iya|nggak|tidak|ngga|aja|dong|nih|ya|banget|sih|deh|lah|kan|gue|lu|udah|belum|gimana|kenapa|dimana|kapan|siapa|sama|juga|masih|lagi|bisa|mau|pengen|emang|memang|kayak|seperti|terus|tapi|atau|kalau|kalo|abis|habis|dah|ada|gak|ga|tau|tahu|bener|beneran|serius|parah|anjay|wkwk|hehe|haha|sayang|cinta|rindu|kangen|sedih|senang|bahagia|capek|lelah|ngantuk|lapar|haus|pusing|ribet|susah|gampang|mudah|sulit|selamat|pagi|siang|sore|malam|hari|maaf|terima|kasih|tolong|bantu|minta|butuh|perlu|soal|masalah|cerita|orang|teman|keluarga|rumah|kerja|sekolah|kuliah|belajar|main|jalan|makan|minum|tidur|istirahat|lanjut|bikin|coba|lihat|dengar|bilang|bicara)\b/gi);
  
  const englishCount = englishWords ? englishWords.length : 0;
  const indoCount = indonesianWords ? indonesianWords.length : 0;

  // More decisive threshold
  if (englishCount > indoCount * 1.2) return 'english';
  if (indoCount > englishCount * 1.2) return 'indonesian';
  
  // For ambiguous cases, check for strong indicators
  if (/\b(selamat|gimana|kenapa|dimana|siapa|dong|nih|banget|sih|deh|lah|gue|lu|gak|ga)\b/i.test(text)) return 'indonesian';
  if (/\b(hey|what|how|where|when|who|why|please|thanks)\b/i.test(text)) return 'english';
  
  return 'mixed';
}

export default detectLanguage;
