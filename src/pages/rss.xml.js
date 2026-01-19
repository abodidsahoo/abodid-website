import rss from '@astrojs/rss';
import { getAllPosts } from '../lib/api';

export async function GET(context) {
    const posts = await getAllPosts();
    return rss({
        title: 'Abodid | Blog',
        description: 'Thoughts, notes, and observations from Abodid.',
        site: context.site,
        items: posts.map((post) => ({
            title: post.title,
            pubDate: post.pubDate,
            description: post.description,
            link: post.href,
        })),
        customData: `<language>en-us</language>`,
    });
}
