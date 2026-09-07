import type {APIRoute} from 'astro';
import {getPortfolioPhotos,groupPortfolio} from '../../lib/photography/server';
export const GET: APIRoute = async ({url}) => {
 const id=url.searchParams.get('id');
 if(!id||id.length>240) return new Response('Invalid series',{status:400});
 const group=groupPortfolio(await getPortfolioPhotos()).find(g=>g.id===id);
 if(!group) return new Response('Series not found',{status:404});
 return new Response(JSON.stringify({images:group.images}),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}});
};
