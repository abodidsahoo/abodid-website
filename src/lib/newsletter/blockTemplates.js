/**
 * Email-safe HTML block templates for newsletter composition
 * All templates use inline CSS for maximum email client compatibility
 */

export const getHeaderBlock = (options = {}) => {
  const { logoUrl = 'https://via.placeholder.com/150x50?text=LOGO', title = 'Your Newsletter Title' } = options;
  
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0; padding: 0;">
  <tr>
    <td style="padding: 32px 24px; text-align: center; background-color: #ffffff; border-bottom: 2px solid #e5e7eb;">
      <img src="${logoUrl}" alt="Logo" style="max-width: 150px; height: auto; margin-bottom: 16px;" />
      <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${title}</h1>
    </td>
  </tr>
</table>
`.trim();
};

export const getFooterBlock = (options = {}) => {
  const { 
    companyName = 'Your Company',
    address = '123 Main St, City, State 12345',
    socialLinks = { twitter: '#', linkedin: '#', website: '#' }
  } = options;
  
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0; padding: 0;">
  <tr>
    <td style="padding: 32px 24px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        © 2026 ${companyName}. All rights reserved.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 12px; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${address}
      </p>
      <p style="margin: 0 0 16px 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <a href="${socialLinks.website}" style="color: #3b82f6; text-decoration: none; margin: 0 8px;">Website</a>
        <a href="${socialLinks.twitter}" style="color: #3b82f6; text-decoration: none; margin: 0 8px;">Twitter</a>
        <a href="${socialLinks.linkedin}" style="color: #3b82f6; text-decoration: none; margin: 0 8px;">LinkedIn</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        You're receiving this because you subscribed to our newsletter.<br/>
        <a href="{{{unsubscribe_url}}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
      </p>
    </td>
  </tr>
</table>
`.trim();
};

export const getContentBlock = (options = {}) => {
  const { padding = '24px' } = options;
  
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0; padding: 0;">
  <tr>
    <td style="padding: ${padding}; background-color: #ffffff;">
      <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        [Add your content here. Click to edit this placeholder text.]
      </p>
    </td>
  </tr>
</table>
`.trim();
};

export const getCalloutBlock = (options = {}) => {
  const { 
    backgroundColor = '#eff6ff',
    borderColor = '#3b82f6',
    title = 'Important Notice'
  } = options;
  
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0; padding: 0;">
  <tr>
    <td style="padding: 20px; background-color: ${backgroundColor}; border-left: 4px solid ${borderColor}; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #1e40af; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        ${title}
      </h3>
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #1e3a8a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        [Add your callout message here. This is great for highlighting special announcements or important updates.]
      </p>
    </td>
  </tr>
</table>
`.trim();
};

export const getImageBlock = (options = {}) => {
  const { 
    imageUrl = 'https://via.placeholder.com/600x400?text=Image',
    alt = 'Newsletter Image',
    caption = '',
    borderRadius = '8px'
  } = options;
  
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; padding: 0;">
  <tr>
    <td style="padding: 0; text-align: center;">
      <img src="${imageUrl}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: ${borderRadius}; display: block; margin: 0 auto;" />
      ${caption ? `<p style="margin: 12px 0 0 0; font-size: 14px; color: #6b7280; font-style: italic; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${caption}</p>` : ''}
    </td>
  </tr>
</table>
`.trim();
};

export const getDividerBlock = (options = {}) => {
  const { 
    color = '#e5e7eb',
    spacing = '32px'
  } = options;
  
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: ${spacing} 0; padding: 0;">
  <tr>
    <td style="padding: 0;">
      <div style="height: 1px; background-color: ${color}; margin: 0;"></div>
    </td>
  </tr>
</table>
`.trim();
};

// Export all blocks as a collection for easy iteration
export const blockTemplates = {
  header: {
    name: 'Header',
    description: 'Newsletter header with logo and title',
    category: 'structure',
    icon: '📰',
    getHtml: getHeaderBlock
  },
  footer: {
    name: 'Footer',
    description: 'Newsletter footer with links and unsubscribe',
    category: 'structure',
    icon: '📋',
    getHtml: getFooterBlock
  },
  content: {
    name: 'Content Section',
    description: 'Basic content area with padding',
    category: 'content',
    icon: '📝',
    getHtml: getContentBlock
  },
  callout: {
    name: 'Callout Box',
    description: 'Highlighted callout section',
    category: 'design',
    icon: '💡',
    getHtml: getCalloutBlock
  },
  image: {
    name: 'Image Block',
    description: 'Responsive image with optional caption',
    category: 'content',
    icon: '🖼️',
    getHtml: getImageBlock
  },
  divider: {
    name: 'Divider',
    description: 'Horizontal divider line',
    category: 'design',
    icon: '➖',
    getHtml: getDividerBlock
  }
};
