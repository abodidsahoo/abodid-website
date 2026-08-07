import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseMarkdownToBlocks(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const blocks = [];
  let currentText = [];

  const flushText = () => {
    if (currentText.length > 0) {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'text',
        text: currentText.join('\n').trim()
      });
      currentText = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    
    // Heading
    if (line.match(/^#{1,6}\s+(.*)$/)) {
      flushText();
      const match = line.match(/^#{1,6}\s+(.*)$/);
      blocks.push({
        id: crypto.randomUUID(),
        type: 'heading',
        text: match[1]
      });
      continue;
    }

    // Image
    if (line.match(/^!\[(.*?)\]\((.*?)\)$/)) {
      flushText();
      const match = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      blocks.push({
        id: crypto.randomUUID(),
        type: 'image',
        alt: match[1],
        imageUrl: match[2],
        caption: ''
      });
      continue;
    }

    // Divider
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      flushText();
      blocks.push({
        id: crypto.randomUUID(),
        type: 'divider'
      });
      continue;
    }

    // Quote
    if (line.startsWith('> ')) {
      flushText();
      let quoteText = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteText.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      i--; // step back so the outer loop doesn't skip a line
      blocks.push({
        id: crypto.randomUUID(),
        type: 'quote',
        text: quoteText.join('\n').trim(),
        citation: ''
      });
      continue;
    }

    currentText.push(line);
  }
  flushText();
  return blocks;
}

async function migrate() {
  console.log('Fetching blogs...');
  const { data: blogs, error } = await supabase.from('blog').select('id, content, blocks');
  
  if (error) {
    console.error('Error fetching blogs:', error);
    return;
  }
  
  console.log(`Found ${blogs.length} total blogs.`);
  
  const toUpdate = blogs.filter(b => !b.blocks || b.blocks.length === 0);
  console.log(`${toUpdate.length} blogs need migration.`);
  
  for (const blog of toUpdate) {
    if (!blog.content) continue;
    
    const newBlocks = parseMarkdownToBlocks(blog.content);
    if (newBlocks.length === 0) continue;
    
    console.log(`Updating blog ID ${blog.id} with ${newBlocks.length} blocks...`);
    const { error: updateError } = await supabase
      .from('blog')
      .update({ blocks: newBlocks })
      .eq('id', blog.id);
      
    if (updateError) {
      console.error(`Failed to update blog ${blog.id}:`, updateError);
    } else {
      console.log(`Successfully updated blog ${blog.id}`);
    }
  }
  
  console.log('Migration complete!');
}

migrate();
