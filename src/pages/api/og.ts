import { generateOgImage } from '../../lib/og-helper';

export const config = {
    runtime: 'edge',
};

export async function GET({ request }: { request: Request }) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Abodid Sahoo';
    const image = searchParams.get('image');

    return generateOgImage(title, image || undefined);
}
