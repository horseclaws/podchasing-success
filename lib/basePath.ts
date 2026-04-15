export const basePath = process.env.NODE_ENV === 'production' ? '/percy' : '';

export function withBase(path: string): string {
  return `${basePath}${path}`;
}
