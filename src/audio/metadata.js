/** Bounded ID3v2.3/v2.4 title + artist reader. Unknown encodings/frames fall back to filename. */
export async function readMetadata(file) {
  const result = { title: file.name.replace(/\.[^.]+$/, ''), artist: 'Archivo local' };
  try {
    const bytes = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
    const ascii = (start, size) => String.fromCharCode(...bytes.subarray(start, start + size));
    if (ascii(0, 3) !== 'ID3' || ![3, 4].includes(bytes[3]) || bytes[5] & 0xc0) return result;
    const sync = (o) =>
      ((bytes[o] & 127) << 21) |
      ((bytes[o + 1] & 127) << 14) |
      ((bytes[o + 2] & 127) << 7) |
      (bytes[o + 3] & 127);
    const end = Math.min(bytes.length, 10 + sync(6));
    for (let pos = 10; pos + 10 <= end;) {
      const name = ascii(pos, 4),
        size = bytes[3] === 4 ? sync(pos + 4) : new DataView(bytes.buffer).getUint32(pos + 4);
      if (!size || pos + 10 + size > end) break;
      if (['TIT2', 'TPE1'].includes(name) && bytes[pos + 9] === 0) {
        const encoding = bytes[pos + 10];
        const content = bytes.subarray(pos + 11, pos + 10 + size);
        const decoder = ['iso-8859-1', 'utf-16', 'utf-16be', 'utf-8'][encoding];
        if (decoder) {
          const value = new TextDecoder(decoder).decode(content).replace(/\0/g, '').trim();
          if (value) result[name === 'TIT2' ? 'title' : 'artist'] = value;
        }
      }
      pos += 10 + size;
    }
  } catch {
    /* Metadata must never prevent playback. */
  }
  return result;
}
