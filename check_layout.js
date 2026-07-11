import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: project } = await supabase
    .from('portfolio_projects')
    .select('published_revision_id')
    .eq('slug', 'invisible-punctum')
    .single();

  if (!project || !project.published_revision_id) {
    console.log("No published revision found.");
    return;
  }

  const { data: revision } = await supabase
    .from('portfolio_project_revisions')
    .select('layout_style')
    .eq('id', project.published_revision_id)
    .single();

  console.log("Published layout_style:", revision?.layout_style);
}

check().catch(console.error);
