const DEFAULT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(length = 6, alphabet = DEFAULT_ALPHABET) {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    result += alphabet[index];
  }
  return result;
}

function generateUniqueRoomCode(existingCodes, length = 6, maxAttempts = 1000) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generateRoomCode(length, DEFAULT_ALPHABET);
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error("Could not generate a unique room code");
}

module.exports = {
  generateRoomCode,
  generateUniqueRoomCode
};