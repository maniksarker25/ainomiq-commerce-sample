export interface ImageMetadata {
  width: number;
  height: number;
  type: 'png' | 'jpeg' | 'gif' | 'webp' | 'unknown';
}

export function parseImageMetadata(buffer: Buffer): ImageMetadata {
  // Detect PNG
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, type: 'png' };
    }
  }

  // Detect GIF
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF') {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { width, height, type: 'gif' };
  }

  // Detect WebP
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const type = buffer.toString('ascii', 12, 16);
    if (type === 'VP8 ' && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height, type: 'webp' };
    }
    if (type === 'VP8L' && buffer.length >= 25) {
      const signature = buffer.readUInt8(20);
      if (signature === 0x2f) {
        const bits = buffer.readUInt32LE(21);
        const width = (bits & 0x3FFF) + 1;
        const height = ((bits >> 14) & 0x3FFF) + 1;
        return { width, height, type: 'webp' };
      }
    }
    if (type === 'VP8X' && buffer.length >= 30) {
      const width = (buffer.readUInt32LE(24) & 0xffffff) + 1;
      const height = (buffer.readUInt32LE(27) & 0xffffff) + 1;
      return { width, height, type: 'webp' };
    }
  }

  // Detect JPEG
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) {
        offset++;
        continue;
      }
      if (offset + 1 >= buffer.length) break;
      const marker = buffer[offset + 1];
      if (marker === 0xD9 || marker === 0xDA) {
        break; // EOI or SOS
      }

      if (offset + 3 >= buffer.length) break;
      const length = buffer.readUInt16BE(offset + 2);
      
      if (marker === 0xC0 || marker === 0xC2) {
        if (offset + 8 < buffer.length) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height, type: 'jpeg' };
        }
      }
      offset += 2 + length;
    }
  }

  return { width: 0, height: 0, type: 'unknown' };
}

export async function fetchImageMetadata(url: string): Promise<ImageMetadata> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return parseImageMetadata(buffer);
}
