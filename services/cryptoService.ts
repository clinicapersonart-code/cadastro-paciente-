import { BackupData, EncryptedPackage } from '../types';

function base64FromBytes(bytes: Uint8Array): string {
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
}

function bytesFromBase64(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptJSON(obj: BackupData, password: string): Promise<EncryptedPackage> {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const data = enc.encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return {
        format: 'personart-aesgcm-v1',
        iv: base64FromBytes(iv),
        salt: base64FromBytes(salt),
        ct: base64FromBytes(new Uint8Array(ct))
    };
}

export async function decryptJSON(pkg: EncryptedPackage, password: string): Promise<BackupData> {
    if (!(pkg && pkg.format === 'personart-aesgcm-v1')) {
        throw new Error('Arquivo não reconhecido ou formato inválido.');
    }
    const dec = new TextDecoder();
    const salt = bytesFromBase64(pkg.salt);
    const iv = bytesFromBase64(pkg.iv);
    const key = await deriveKey(password, salt);
    const ct = bytesFromBase64(pkg.ct);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(dec.decode(pt));
}