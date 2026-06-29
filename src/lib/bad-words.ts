export const BAD_WORDS = [
  // Vietnamese bad words (basic list)
  "địt", "lồn", "buồi", "cặc", "phò", "đĩ", "chó đẻ", "vãi lồn", "đm", "đmm", "vkl", "vcl",
  "dcm", "đcm", "đậu má", "con đĩ", "đụ", "má mày", "cái l", "cứt", "đái", "ăn cứt",
  // English bad words (basic list)
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "motherfucker", "bastard",
  "whore", "slut", "faggot", "nigger", "nigga", "cock", "suck", "penis", "vagina",
  // Spam / Promotional
  "casino", "đánh bài", "tài xỉu", "lô đề", "bong88", "188bet", "cá cược", "viagra",
];

/**
 * Checks if a given text contains any bad words.
 * Returns true if it does, false otherwise.
 */
export function containsBadWords(text: string): boolean {
  if (!text) return false;
  
  // Normalize text: lowercase and remove accents/diacritics for better matching
  const normalizedText = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Create an array of words to test
  const words = normalizedText.split(/[\s,.;:!?\(\)\[\]\{\}]+/);

  for (const badWord of BAD_WORDS) {
    // Normalize bad word just in case
    const normalizedBadWord = badWord
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    // Check if the exact bad word exists in the split array (prevents "địa" matching "đị" if it existed)
    // For phrases (like "tài xỉu"), we check the whole string.
    if (normalizedBadWord.includes(" ")) {
      if (normalizedText.includes(normalizedBadWord)) {
        return true;
      }
    } else {
      if (words.includes(normalizedBadWord)) {
        return true;
      }
    }
  }

  return false;
}
