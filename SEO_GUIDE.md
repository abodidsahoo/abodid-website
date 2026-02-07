# SEO & Social Media Preview Guide

This guide explains how to control the image and text that appear when you share a link on **WhatsApp**, **Twitter**, **LinkedIn**, etc.

## How it Works
The site uses a dynamic Open Graph (OG) image generator located at `/api/og`. By default, it generates a gradient background with the page title.

## How to Check Your Preview
1.  **Local Testing**: You cannot test WhatsApp previews on `localhost`.
2.  **Live Testing**: Use these tools once deployed:
    -   [Facebook Debugger](https://developers.facebook.com/tools/debug/) (Best for WhatsApp/FB)
    -   [Twitter Card Validator](https://cards-dev.twitter.com/validator)
    -   [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## How to Change the Image

### Method 1: Per-Page (Easiest for specific pages)
You can set a specific image for any page by passing the `image` prop to the `BaseLayout` or `Layout` in your Astro file.

**Example (`src/pages/about.astro`):**
```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout 
  title="About Me" 
  image="/images/my-custom-about-image.jpg" <!-- Add this line -->
>
  <!-- Page Content -->
</Layout>
```
*Note: The image path should be in your `public` folder. E.g., `public/images/my-custom-about-image.jpg` becomes `/images/my-custom-about-image.jpg`.*

### Method 2: Database (For CMS Content)
If you are using the `page_metadata` table in Supabase:
1.  Go to your Supabase Dashboard.
2.  Open the `page_metadata` table.
3.  Find or create a row for the path (e.g., `/about`).
4.  Set the `og_image_url` column to the full URL of your image.

### Method 3: Global Default (Code Change)
To change the fallback look (the gradient), edit:
**`src/lib/og-helper.tsx`**

You can modify the `gradients` array or the CSS in the `generateOgImage` function.

## How to Change Text (Title & Description)
The logic in `src/layouts/BaseLayout.astro` prioritizes sources in this order:
1.  **Props**: Passed directly to the component (`<Layout title="...">`).
2.  **Database**: Fetched from `page_metadata` table.
3.  **Defaults**: Fallback values.

To update functionality, simply update the `title` and `description` props in your Astro pages.
