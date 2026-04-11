export function toHexSequence(content: string): string {
  const hex = Buffer.from(content, 'utf8').toString('hex');
  const pairs = hex.match(/../g) ?? [];
  return pairs.join(' ');
}
