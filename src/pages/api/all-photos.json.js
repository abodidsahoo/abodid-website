
import { getAllPhotography } from '../../lib/api';

export const GET = async () => {
    const allProjects = await getAllPhotography();

    // Flatten to just get a massive list of all photo objects/urls
    // We want to mix covers and gallery images
    let allPhotos = [];

    allProjects.forEach(project => {
        // Add cover
        if (project.image) {
            allPhotos.push({
                image: project.image,
                title: project.title,
                type: 'cover'
            });
        }

        // Add gallery images
        if (project.images && Array.isArray(project.images)) {
            project.images.forEach(imgUrl => {
                allPhotos.push({
                    image: imgUrl,
                    title: project.title, // Share title or obscure it
                    type: 'gallery'
                });
            });
        }
    });

    return new Response(JSON.stringify(allPhotos), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
};
