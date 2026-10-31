export const prerender = false;

import { generateOpportunitySocialImage } from '../../../lib/opportunities/opportunitySocialImage';

export function GET() {
  return generateOpportunitySocialImage();
}
