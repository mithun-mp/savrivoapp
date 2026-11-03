export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePriceNumber(raw: string | number | undefined | null): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return isNaN(raw) ? undefined : raw;

  // Remove currency symbols, commas, and whitespace
  const clean = raw.replace(/[^\d.]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) || parsed <= 0 ? undefined : Math.round(parsed * 100) / 100;
}

export function extractMetaTag(html: string, propertyOrName: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${propertyOrName}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${propertyOrName}["']`, 'i'),
  ];

  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return undefined;
}

export function extractJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const rawContent = match[1].trim();
    if (!rawContent) continue;
    try {
      const parsed = JSON.parse(rawContent);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'object' && item !== null) {
            blocks.push(item as Record<string, unknown>);
          }
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray((parsed as Record<string, unknown>)['@graph'])) {
          for (const item of (parsed as Record<string, unknown>)['@graph'] as unknown[]) {
            if (typeof item === 'object' && item !== null) {
              blocks.push(item as Record<string, unknown>);
            }
          }
        } else {
          blocks.push(parsed as Record<string, unknown>);
        }
      }
    } catch {
      // Ignore invalid JSON-LD block
    }
  }

  return blocks;
}

export function findProductInJsonLd(blocks: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const block of blocks) {
    const type = block['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
      return block;
    }
  }
  return null;
}

