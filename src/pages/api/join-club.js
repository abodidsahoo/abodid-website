import { supabase } from '../../lib/supabaseClient';

export const POST = async ({ request }) => {
    try {
        const { first_name, email } = await request.json();

        // Basic validation
        if (!first_name || !email) {
            return new Response(
                JSON.stringify({ error: 'First name and email are required.' }),
                { status: 400 }
            );
        }
        // Check if Supabase is initialized
        if (!supabase) {
            console.error('Supabase client is null. Check environment variables.');
            return new Response(
                JSON.stringify({ error: 'Database connection failed: Client not initialized.' }),
                { status: 500 }
            );
        }

        // Insert into Supabase
        // Insert into Supabase
        const { data, error } = await supabase
            .from('second_brain_club')
            .insert([{ first_name, email }])
            .select();

        if (error) {
            // Handle unique constraint violation (email already exists)
            if (error.code === '23505') {
                return new Response(
                    JSON.stringify({ error: 'This email is already registered.' }),
                    { status: 409 }
                );
            }
            throw error;
        }

        return new Response(
            JSON.stringify({
                message: 'Welcome to the Second Brain Club!',
                user: data[0]
            }),
            { status: 200 }
        );

    } catch (error) {
        console.error('Join Club Error:', error);
        return new Response(
            JSON.stringify({ error: `Server Error: ${error.message || 'Unknown'}` }),
            { status: 500 }
        );
    }
};
