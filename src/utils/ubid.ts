//src/utils/ubid.ts
import { createHash, randomBytes } from 'crypto';

// Sanitize input for UBID and BNS to prevent invalid characters
function sanitizeInput(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

// ✅ UBID Format: UBID-NETWORKTYPE-CHAINPROTOCOL-<12-char-hash>
export function generateUBID(networkType: string, chainProtocol: string): string {
  const sanitizedNetwork = sanitizeInput(networkType).toUpperCase();
  const sanitizedProtocol = sanitizeInput(chainProtocol).toUpperCase();
  const random = randomBytes(16).toString('hex').substring(0, 12);
  return `UBID-${sanitizedNetwork}-${sanitizedProtocol}-${random}`;
}

// ✅ UUID Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (RFC 4122 v4)
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ✅ BNS Name Format: sanitizedName.bchain
export function generateBNSName(name: string): string {
  const sanitized = sanitizeInput(name);
  return `${sanitized}.bchain`;
}

// ✅ Cross-Chain Address Format: BCHAIN://blockchainId/userId
export function generateCrossChainAddress(blockchainId: string, userId: string): string {
  const encodedBlockchainId = encodeURIComponent(blockchainId);
  const encodedUserId = encodeURIComponent(userId);
  return `BCHAIN://${encodedBlockchainId}/${encodedUserId}`;
}

// ✅ API Key: 48-character hex string (secure random)
export function generateAPIKey(): string {
  return randomBytes(24).toString('hex');
}


// //src/utils/ubid.ts
// import { createHash, randomBytes } from 'crypto';

// // Sanitize input for UBID and BNS to prevent invalid characters
// function sanitizeInput(input: string): string {
//   return input.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
// }

// // ✅ Enhanced UBID Format: UBID-NETWORKTYPE-CHAINPROTOCOL-<16-char-hash>
// // Increased entropy from 12 to 16 characters for better global uniqueness
// export function generateUBID(networkType: string, chainProtocol: string): string {
//   // Input validation
//   if (!networkType || !chainProtocol) {
//     throw new Error('NetworkType and chainProtocol are required for UBID generation');
//   }
  
//   const sanitizedNetwork = sanitizeInput(networkType).toUpperCase();
//   const sanitizedProtocol = sanitizeInput(chainProtocol).toUpperCase();
  
//   // Enhanced: Use 64 bits of entropy (16 hex chars) for global uniqueness
//   const random = randomBytes(8).toString('hex').toUpperCase();
  
//   // Add timestamp component for better uniqueness and ordering
//   const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  
//   return `UBID-${sanitizedNetwork}-${sanitizedProtocol}-${timestamp}${random}`;
// }

// // ✅ Enhanced UUID Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (RFC 4122 v4)
// // More secure implementation using crypto.randomBytes
// export function generateUUID(): string {
//   const randomBytes16 = randomBytes(16);
  
//   // Set version (4) and variant bits according to RFC 4122
//   randomBytes16[6] = (randomBytes16[10] & 0x0f) | 0x40; // Version 4
//   randomBytes16[2] = (randomBytes16[2] & 0x3f) | 0x80; // Variant 10
  
//   const hex = randomBytes16.toString('hex');
//   return [
//     hex.substring(0, 8),
//     hex.substring(8, 12),
//     hex.substring(12, 16),
//     hex.substring(16, 20),
//     hex.substring(20, 32)
//   ].join('-');
// }

// // ✅ Enhanced BNS Name Format: sanitizedName.bchain
// // Added validation and length limits
// export function generateBNSName(name: string): string {
//   if (!name || name.trim().length === 0) {
//     throw new Error('Name is required for BNS generation');
//   }
  
//   const sanitized = sanitizeInput(name);
  
//   // Ensure minimum and maximum length for BNS compatibility
//   if (sanitized.length < 3) {
//     throw new Error('BNS name must be at least 3 characters after sanitization');
//   }
  
//   if (sanitized.length > 63) {
//     // Truncate to meet DNS label length limits
//     return `${sanitized.substring(0, 59)}.bchain`;
//   }
  
//   return `${sanitized}.bchain`;
// }

// // ✅ Enhanced Cross-Chain Address Format: BCHAIN://blockchainId/userId
// // Added validation and proper URI encoding
// export function generateCrossChainAddress(blockchainId: string, userId: string): string {
//   if (!blockchainId || !userId) {
//     throw new Error('BlockchainId and userId are required for cross-chain address generation');
//   }
  
//   // Validate blockchain ID format (alphanumeric with hyphens/underscores)
//   if (!/^[a-zA-Z0-9_-]+$/.test(blockchainId)) {
//     throw new Error('Invalid blockchainId format. Only alphanumeric characters, hyphens, and underscores allowed');
//   }
  
//   const encodedBlockchainId = encodeURIComponent(blockchainId);
//   const encodedUserId = encodeURIComponent(userId);
  
//   return `BCHAIN://${encodedBlockchainId}/${encodedUserId}`;
// }

// // ✅ Enhanced API Key: 64-character hex string (secure random)
// // Increased from 48 to 64 characters for enterprise-grade security
// export function generateAPIKey(): string {
//   // Generate 256 bits (32 bytes) of entropy for maximum security
//   return randomBytes(32).toString('hex');
// }

// // ✅ Additional utility functions for validation and formatting

// // Validate UBID format
// export function validateUBID(ubid: string): boolean {
//   if (!ubid || typeof ubid !== 'string') return false;
  
//   // Enhanced pattern to match the new format with timestamp
//   const ubidPattern = /^UBID-[A-Z0-9_-]+-[A-Z0-9_-]+-[A-Z0-9]{12}$/;
//   return ubidPattern.test(ubid);
// }

// // Format UBID for display (keeps existing functionality)
// export function formatUBIDShort(ubid: string, maxLength: number = 20): string {
//   if (!ubid) return '';
//   if (ubid.length <= maxLength) return ubid;
//   return `${ubid.slice(0, maxLength)}...`;
// }

// // Validate UUID format
// export function validateUUID(uuid: string): boolean {
//   if (!uuid || typeof uuid !== 'string') return false;
  
//   const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//   return uuidPattern.test(uuid);
// }

// // Validate BNS name format
// export function validateBNSName(bnsName: string): boolean {
//   if (!bnsName || typeof bnsName !== 'string') return false;
  
//   const bnsPattern = /^[a-z0-9_-]{3,59}\.bchain$/;
//   return bnsPattern.test(bnsName);
// }

// // Validate Cross-Chain Address format
// export function validateCrossChainAddress(address: string): boolean {
//   if (!address || typeof address !== 'string') return false;
  
//   const addressPattern = /^BCHAIN:\/\/[a-zA-Z0-9_%-]+\/[a-zA-Z0-9_%-]+$/;
//   return addressPattern.test(address);
// }

// // Validate API Key format
// export function validateAPIKey(apiKey: string): boolean {
//   if (!apiKey || typeof apiKey !== 'string') return false;
  
//   // 64 hex characters (256 bits)
//   const apiKeyPattern = /^[a-f0-9]{64}$/i;
//   return apiKeyPattern.test(apiKey);
// }

// // Extract components from UBID
// export function parseUBID(ubid: string): { 
//   prefix: string; 
//   networkType: string; 
//   chainProtocol: string; 
//   identifier: string 
// } | null {
//   if (!validateUBID(ubid)) return null;
  
//   const parts = ubid.split('-');
//   if (parts.length !== 4) return null;
  
//   return {
//     prefix: parts[0],
//     networkType: parts[11],
//     chainProtocol: parts[12],
//     identifier: parts[1]
//   };
// }

// // Generate secure hash for data integrity
// export function generateSecureHash(data: string): string {
//   return createHash('sha256').update(data).digest('hex');
// }

// // Generate deterministic UBID from wallet address (for blockchain integration)
// export function generateDeterministicUBID(
//   walletAddress: string, 
//   networkType: string, 
//   chainProtocol: string
// ): string {
//   if (!walletAddress || !networkType || !chainProtocol) {
//     throw new Error('All parameters are required for deterministic UBID generation');
//   }
  
//   const sanitizedNetwork = sanitizeInput(networkType).toUpperCase();
//   const sanitizedProtocol = sanitizeInput(chainProtocol).toUpperCase();
  
//   // Create deterministic hash from wallet address
//   const walletHash = createHash('sha256')
//     .update(walletAddress.toLowerCase())
//     .digest('hex')
//     .substring(0, 12)
//     .toUpperCase();
  
//   return `UBID-${sanitizedNetwork}-${sanitizedProtocol}-${walletHash}`;
// }
