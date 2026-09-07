import sharp from 'sharp';
import { dominantColor } from './dominantColor.mjs';
import saved from '../../data/photographyPalettes.generated.json';
export type PaletteData = { bg: string; isDark: boolean; textColor: string; subtextColor: string };
const paletteCache = new Map<string, PaletteData>(Object.entries(saved));
export const getSavedPalette = (url: string): PaletteData => paletteCache.get(url) || {bg:'#fbfbf9',isDark:false,textColor:'#141414',subtextColor:'#494949'};
export async function extractPaletteFromServerImage(imageUrl: string): Promise<PaletteData> {
  if (paletteCache.has(imageUrl)) return paletteCache.get(imageUrl)!;
  const response=await fetch(imageUrl,{signal:AbortSignal.timeout(5000)});
  if(!response.ok) throw new Error('Palette image unavailable');
  const data=await sharp(Buffer.from(await response.arrayBuffer())).resize(120,120,{fit:'inside',kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  const palette=dominantColor(data);paletteCache.set(imageUrl,palette);return palette;
}
