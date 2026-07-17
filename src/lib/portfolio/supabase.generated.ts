export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      about_timeline_cards: {
        Row: {
          brands_projects: string | null
          created_at: string
          focus: string
          gradient_g1: string
          gradient_g2: string
          half: string
          highlight: boolean
          id: number
          institutions: string | null
          location_context: string | null
          sort_index: number
          updated_at: string
          value_built: string
          what_happened: string
          year: number
        }
        Insert: {
          brands_projects?: string | null
          created_at?: string
          focus: string
          gradient_g1?: string
          gradient_g2?: string
          half: string
          highlight?: boolean
          id?: number
          institutions?: string | null
          location_context?: string | null
          sort_index: number
          updated_at?: string
          value_built: string
          what_happened: string
          year: number
        }
        Update: {
          brands_projects?: string | null
          created_at?: string
          focus?: string
          gradient_g1?: string
          gradient_g2?: string
          half?: string
          highlight?: boolean
          id?: number
          institutions?: string | null
          location_context?: string | null
          sort_index?: number
          updated_at?: string
          value_built?: string
          what_happened?: string
          year?: number
        }
        Relationships: []
      }
      awards: {
        Row: {
          category: string | null
          created_at: string
          date: string | null
          description: string | null
          id: number
          organization: string | null
          published: boolean | null
          title: string
          url: string | null
          value: string | null
          year: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: number
          organization?: string | null
          published?: boolean | null
          title: string
          url?: string | null
          value?: string | null
          year?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: number
          organization?: string | null
          published?: boolean | null
          title?: string
          url?: string | null
          value?: string | null
          year?: string | null
        }
        Relationships: []
      }
      blog: {
        Row: {
          category: string[] | null
          content: string | null
          cover_image: string | null
          excerpt: string | null
          id: string
          published: boolean | null
          published_at: string
          slug: string
          sort_order: number | null
          tags: string[] | null
          title: string
        }
        Insert: {
          category?: string[] | null
          content?: string | null
          cover_image?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean | null
          published_at?: string
          slug: string
          sort_order?: number | null
          tags?: string[] | null
          title: string
        }
        Update: {
          category?: string[] | null
          content?: string | null
          cover_image?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean | null
          published_at?: string
          slug?: string
          sort_order?: number | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          category: string | null
          created_at: string
          display_order: number | null
          id: string
          logo_url: string
          name: string
          role: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          logo_url: string
          name: string
          role?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          logo_url?: string
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      bsa_one_photo_submissions: {
        Row: {
          audio_duration_seconds: number | null
          audio_file_name: string | null
          audio_mime: string | null
          audio_path: string | null
          audio_size_bytes: number | null
          created_at: string
          id: string
          image_file_name: string | null
          image_mime: string | null
          image_path: string | null
          image_size_bytes: number | null
          metadata: Json
          project_slug: string
          response_text: string | null
          source_context: string
          submission_status: string
          updated_at: string
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_file_name?: string | null
          audio_mime?: string | null
          audio_path?: string | null
          audio_size_bytes?: number | null
          created_at?: string
          id?: string
          image_file_name?: string | null
          image_mime?: string | null
          image_path?: string | null
          image_size_bytes?: number | null
          metadata?: Json
          project_slug?: string
          response_text?: string | null
          source_context?: string
          submission_status?: string
          updated_at?: string
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_file_name?: string | null
          audio_mime?: string | null
          audio_path?: string | null
          audio_size_bytes?: number | null
          created_at?: string
          id?: string
          image_file_name?: string | null
          image_mime?: string | null
          image_path?: string | null
          image_size_bytes?: number | null
          metadata?: Json
          project_slug?: string
          response_text?: string | null
          source_context?: string
          submission_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      conference_days: {
        Row: {
          day: string
          label: string
        }
        Insert: {
          day: string
          label: string
        }
        Update: {
          day?: string
          label?: string
        }
        Relationships: []
      }
      du_workshop_feedback: {
        Row: {
          best_part: string | null
          created_at: string
          future_workshop_topics: string | null
          id: string
          improvements: string | null
          metadata: Json
          newsletter_consent: boolean
          other_comments: string | null
          participant_email: string | null
          participant_name: string | null
          submission_status: string
          updated_at: string
          workshop_slug: string
        }
        Insert: {
          best_part?: string | null
          created_at?: string
          future_workshop_topics?: string | null
          id?: string
          improvements?: string | null
          metadata?: Json
          newsletter_consent?: boolean
          other_comments?: string | null
          participant_email?: string | null
          participant_name?: string | null
          submission_status?: string
          updated_at?: string
          workshop_slug?: string
        }
        Update: {
          best_part?: string | null
          created_at?: string
          future_workshop_topics?: string | null
          id?: string
          improvements?: string | null
          metadata?: Json
          newsletter_consent?: boolean
          other_comments?: string | null
          participant_email?: string | null
          participant_name?: string | null
          submission_status?: string
          updated_at?: string
          workshop_slug?: string
        }
        Relationships: []
      }
      education: {
        Row: {
          course: string | null
          created_at: string
          degree: string | null
          details: string | null
          end_year: string | null
          id: number
          institution: string
          link_text: string | null
          link_url: string | null
          location: string | null
          published: boolean | null
          sort_order: number | null
          specialization: string | null
          start_year: string | null
        }
        Insert: {
          course?: string | null
          created_at?: string
          degree?: string | null
          details?: string | null
          end_year?: string | null
          id?: number
          institution: string
          link_text?: string | null
          link_url?: string | null
          location?: string | null
          published?: boolean | null
          sort_order?: number | null
          specialization?: string | null
          start_year?: string | null
        }
        Update: {
          course?: string | null
          created_at?: string
          degree?: string | null
          details?: string | null
          end_year?: string | null
          id?: number
          institution?: string
          link_text?: string | null
          link_url?: string | null
          location?: string | null
          published?: boolean | null
          sort_order?: number | null
          specialization?: string | null
          start_year?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          day: string
          end_at: string
          id: string
          kind: string
          room_id: string | null
          session_block: string | null
          sort_order: number | null
          start_at: string
          theme_code: string | null
          title_display: string
          title_raw: string
          track: number | null
        }
        Insert: {
          day: string
          end_at: string
          id?: string
          kind?: string
          room_id?: string | null
          session_block?: string | null
          sort_order?: number | null
          start_at: string
          theme_code?: string | null
          title_display: string
          title_raw: string
          track?: number | null
        }
        Update: {
          day?: string
          end_at?: string
          id?: string
          kind?: string
          room_id?: string | null
          session_block?: string | null
          sort_order?: number | null
          start_at?: string
          theme_code?: string | null
          title_display?: string
          title_raw?: string
          track?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_day_fkey"
            columns: ["day"]
            isOneToOne: false
            referencedRelation: "conference_days"
            referencedColumns: ["day"]
          },
          {
            foreignKeyName: "events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_theme_code_fkey"
            columns: ["theme_code"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["code"]
          },
        ]
      }
      films: {
        Row: {
          categories: string[] | null
          created_at: string
          description: string | null
          genre: string | null
          id: string
          published: boolean | null
          role: string | null
          roles: string[] | null
          sort_order: number | null
          thumbnail_url: string | null
          title: string
          video_url: string | null
          year: number | null
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          published?: boolean | null
          role?: string | null
          roles?: string[] | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
          year?: number | null
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          published?: boolean | null
          role?: string | null
          roles?: string[] | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      hub_resource_bookmarks: {
        Row: {
          created_at: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_resource_bookmarks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "hub_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_resource_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_resource_tags: {
        Row: {
          resource_id: string
          tag_id: string
        }
        Insert: {
          resource_id: string
          tag_id: string
        }
        Update: {
          resource_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_resource_tags_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "hub_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_resource_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "hub_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_resource_upvotes: {
        Row: {
          created_at: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_resource_upvotes_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "hub_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_resource_upvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_resources: {
        Row: {
          admin_notes: string | null
          audience: string | null
          created_at: string | null
          credit_text: string | null
          description: string | null
          fts: unknown
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_by: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          upvotes_count: number | null
          url: string
        }
        Insert: {
          admin_notes?: string | null
          audience?: string | null
          created_at?: string | null
          credit_text?: string | null
          description?: string | null
          fts?: unknown
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          upvotes_count?: number | null
          url: string
        }
        Update: {
          admin_notes?: string | null
          audience?: string | null
          created_at?: string | null
          credit_text?: string | null
          description?: string | null
          fts?: unknown
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          upvotes_count?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_resources_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_resources_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_featured: boolean | null
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_featured?: boolean | null
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_featured?: boolean | null
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      media_mentions: {
        Row: {
          categories: string[] | null
          created_at: string
          id: string
          image_url: string | null
          publication: string | null
          published: boolean | null
          published_at: string
          title: string
          url: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          id?: string
          image_url?: string | null
          publication?: string | null
          published?: boolean | null
          published_at?: string
          title: string
          url: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          id?: string
          image_url?: string | null
          publication?: string | null
          published?: boolean | null
          published_at?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      moodboard_items: {
        Row: {
          created_at: string
          id: string
          image_url: string
          image_height: number | null
          image_width: number | null
          aspect_ratio: number | null
          published: boolean
          search_text: string
          storage_path: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          image_height?: number | null
          image_width?: number | null
          published?: boolean
          search_text?: string
          storage_path: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          image_height?: number | null
          image_width?: number | null
          published?: boolean
          search_text?: string
          storage_path?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_broadcasts: {
        Row: {
          created_at: string
          id: string
          message: string | null
          newsletter_id: string | null
          sent_count: number | null
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          newsletter_id?: string | null
          sent_count?: number | null
          subject: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          newsletter_id?: string | null
          sent_count?: number | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_broadcasts_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          id: string
          is_template: boolean
          preview_text: string
          sender_email: string
          sender_name: string
          sent_at: string | null
          settings: Json
          status: string
          subject: string
          template_name: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          preview_text?: string
          sender_email?: string
          sender_name?: string
          sent_at?: string | null
          settings?: Json
          status?: string
          subject?: string
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          preview_text?: string
          sender_email?: string
          sender_name?: string
          sent_at?: string | null
          settings?: Json
          status?: string
          subject?: string
          template_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_opens: {
        Row: {
          broadcast_id: string | null
          id: string
          opened_at: string
        }
        Insert: {
          broadcast_id?: string | null
          id?: string
          opened_at?: string
        }
        Update: {
          broadcast_id?: string | null
          id?: string
          opened_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_opens_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "newsletter_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      obsidian_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          content_hash: string
          created_at: string | null
          embedding: string | null
          embedding_model: string | null
          file_path: string
          folder_path: string | null
          frontmatter: Json | null
          heading: string | null
          id: number
          is_public: boolean | null
          note_id: string | null
          note_title: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          content_hash: string
          created_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          file_path: string
          folder_path?: string | null
          frontmatter?: Json | null
          heading?: string | null
          id?: number
          is_public?: boolean | null
          note_id?: string | null
          note_title: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          content_hash?: string
          created_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          file_path?: string
          folder_path?: string | null
          frontmatter?: Json | null
          heading?: string | null
          id?: number
          is_public?: boolean | null
          note_id?: string | null
          note_title?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      page_metadata: {
        Row: {
          created_at: string | null
          focus_keyword: string | null
          id: string
          is_active: boolean | null
          meta_description: string | null
          meta_title: string | null
          og_image_alt: string | null
          og_image_url: string | null
          og_type: string | null
          page_path: string
          page_title: string
          robots_index: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          focus_keyword?: string | null
          id?: string
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_alt?: string | null
          og_image_url?: string | null
          og_type?: string | null
          page_path: string
          page_title: string
          robots_index?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          focus_keyword?: string | null
          id?: string
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_alt?: string | null
          og_image_url?: string | null
          og_type?: string | null
          page_path?: string
          page_title?: string
          robots_index?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      photo_feedback: {
        Row: {
          audio_duration_ms: number | null
          audio_mime: string | null
          audio_path: string | null
          audio_url: string | null
          created_at: string
          feeling_text: string | null
          id: string
          image_url: string
          name: string | null
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_mime?: string | null
          audio_path?: string | null
          audio_url?: string | null
          created_at?: string
          feeling_text?: string | null
          id?: string
          image_url: string
          name?: string | null
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          audio_duration_ms?: number | null
          audio_mime?: string | null
          audio_path?: string | null
          audio_url?: string | null
          created_at?: string
          feeling_text?: string | null
          id?: string
          image_url?: string
          name?: string | null
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      photo_stories: {
        Row: {
          created_at: string
          genre: string | null
          id: string
          is_art: boolean
          is_commercial: boolean
          is_story_locked: boolean
          photo_url: string
          sample_story_markdown: string
          story_markdown: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          genre?: string | null
          id?: string
          is_art?: boolean
          is_commercial?: boolean
          is_story_locked?: boolean
          photo_url: string
          sample_story_markdown?: string
          story_markdown?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          genre?: string | null
          id?: string
          is_art?: boolean
          is_commercial?: boolean
          is_story_locked?: boolean
          photo_url?: string
          sample_story_markdown?: string
          story_markdown?: string
          updated_at?: string
        }
        Relationships: []
      }
      photography: {
        Row: {
          category: string[] | null
          Collaborator: string | null
          content: string | null
          cover_image: string | null
          created_at: string
          gallery_images: Json | null
          id: string
          intro: string | null
          location: string | null
          published: boolean | null
          published_at: string | null
          slug: string
          sort_order: number | null
          tags: string[] | null
          title: string
          Year: number | null
        }
        Insert: {
          category?: string[] | null
          Collaborator?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          gallery_images?: Json | null
          id?: string
          intro?: string | null
          location?: string | null
          published?: boolean | null
          published_at?: string | null
          slug: string
          sort_order?: number | null
          tags?: string[] | null
          title: string
          Year?: number | null
        }
        Update: {
          category?: string[] | null
          Collaborator?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          gallery_images?: Json | null
          id?: string
          intro?: string | null
          location?: string | null
          published?: boolean | null
          published_at?: string | null
          slug?: string
          sort_order?: number | null
          tags?: string[] | null
          title?: string
          Year?: number | null
        }
        Relationships: []
      }
      portfolio_collaborators: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          organisation: string
          primary_url: string
          secondary_url: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          organisation?: string
          primary_url?: string
          secondary_url?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          organisation?: string
          primary_url?: string
          secondary_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_organisations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          logo_media_id: string | null
          name: string
          slug: string
          updated_at: string
          url: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          logo_media_id?: string | null
          name: string
          slug: string
          updated_at?: string
          url?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          logo_media_id?: string | null
          name?: string
          slug?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_organisations_logo_media_fk"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_project_blocks: {
        Row: {
          block_type: string
          content_jsonb: Json
          created_at: string
          id: string
          position: number
          revision_id: string
          settings_jsonb: Json
          updated_at: string
          visible: boolean
        }
        Insert: {
          block_type: string
          content_jsonb?: Json
          created_at?: string
          id?: string
          position?: number
          revision_id: string
          settings_jsonb?: Json
          updated_at?: string
          visible?: boolean
        }
        Update: {
          block_type?: string
          content_jsonb?: Json
          created_at?: string
          id?: string
          position?: number
          revision_id?: string
          settings_jsonb?: Json
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_project_blocks_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "portfolio_project_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_project_revisions: {
        Row: {
          context: string
          cover_alt: string
          cover_focal_x: number
          cover_focal_y: number
          cover_url: string
          created_at: string
          created_by: string | null
          duration: string
          id: string
          limited_public: boolean
          location: string
          lock_version: number
          meta_description: string
          one_line_description: string
          outcome_heading: string
          outcome_text: string
          project_id: string
          published_at: string | null
          revision_number: number
          search_visible: boolean
          seo_title: string
          social_image_url: string
          specific_contribution: string
          state: string
          title: string
          updated_at: string
          work_in_progress: boolean
          year_end: number | null
          year_start: number | null
        }
        Insert: {
          context?: string
          cover_alt?: string
          cover_focal_x?: number
          cover_focal_y?: number
          cover_url?: string
          created_at?: string
          created_by?: string | null
          duration?: string
          id?: string
          limited_public?: boolean
          location?: string
          lock_version?: number
          meta_description?: string
          one_line_description?: string
          outcome_heading?: string
          outcome_text?: string
          project_id: string
          published_at?: string | null
          revision_number: number
          search_visible?: boolean
          seo_title?: string
          social_image_url?: string
          specific_contribution?: string
          state?: string
          title?: string
          updated_at?: string
          work_in_progress?: boolean
          year_end?: number | null
          year_start?: number | null
        }
        Update: {
          context?: string
          cover_alt?: string
          cover_focal_x?: number
          cover_focal_y?: number
          cover_url?: string
          created_at?: string
          created_by?: string | null
          duration?: string
          id?: string
          limited_public?: boolean
          location?: string
          lock_version?: number
          meta_description?: string
          one_line_description?: string
          outcome_heading?: string
          outcome_text?: string
          project_id?: string
          published_at?: string | null
          revision_number?: number
          search_visible?: boolean
          seo_title?: string
          social_image_url?: string
          specific_contribution?: string
          state?: string
          title?: string
          updated_at?: string
          work_in_progress?: boolean
          year_end?: number | null
          year_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_project_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_project_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_index"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "portfolio_project_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          created_at: string
          created_by: string | null
          draft_revision_id: string | null
          featured_order: number
          id: string
          published_revision_id: string | null
          slug: string
          status: string
          storage_folder: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_revision_id?: string | null
          featured_order?: number
          id?: string
          published_revision_id?: string | null
          slug: string
          status?: string
          storage_folder: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_revision_id?: string | null
          featured_order?: number
          id?: string
          published_revision_id?: string | null
          slug?: string
          status?: string
          storage_folder?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_draft_revision_fk"
            columns: ["draft_revision_id"]
            isOneToOne: false
            referencedRelation: "portfolio_project_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_projects_published_revision_fk"
            columns: ["published_revision_id"]
            isOneToOne: false
            referencedRelation: "portfolio_project_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_revision_collaborators: {
        Row: {
          collaborator_id: string
          display_order: number
          organisation: string
          primary_url: string
          revision_id: string
          role_label: string
          secondary_url: string
        }
        Insert: {
          collaborator_id: string
          display_order?: number
          organisation?: string
          primary_url?: string
          revision_id: string
          role_label?: string
          secondary_url?: string
        }
        Update: {
          collaborator_id?: string
          display_order?: number
          organisation?: string
          primary_url?: string
          revision_id?: string
          role_label?: string
          secondary_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_revision_collaborators_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "portfolio_collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_revision_collaborators_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "portfolio_project_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_revision_links: {
        Row: {
          display_order: number
          id: string
          label: string
          link_type: string
          revision_id: string
          url: string
        }
        Insert: {
          display_order?: number
          id?: string
          label: string
          link_type?: string
          revision_id: string
          url: string
        }
        Update: {
          display_order?: number
          id?: string
          label?: string
          link_type?: string
          revision_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_revision_links_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "portfolio_project_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_revision_organisations: {
        Row: {
          display_order: number
          organisation_id: string
          relationship_label: string
          revision_id: string
        }
        Insert: {
          display_order?: number
          organisation_id: string
          relationship_label?: string
          revision_id: string
        }
        Update: {
          display_order?: number
          organisation_id?: string
          relationship_label?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_revision_organisations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "portfolio_organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_revision_organisations_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "portfolio_project_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_revision_taxonomy: {
        Row: {
          display_order: number
          revision_id: string
          term_id: string
        }
        Insert: {
          display_order?: number
          revision_id: string
          term_id: string
        }
        Update: {
          display_order?: number
          revision_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_revision_taxonomy_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "portfolio_project_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_revision_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "portfolio_taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_slug_redirects: {
        Row: {
          created_at: string
          old_slug: string
          project_id: string
        }
        Insert: {
          created_at?: string
          old_slug: string
          project_id: string
        }
        Update: {
          created_at?: string
          old_slug?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_slug_redirects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_slug_redirects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_index"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "portfolio_slug_redirects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      portfolio_taxonomy_terms: {
        Row: {
          aliases: string[]
          archived: boolean
          created_at: string
          group_type: string
          id: string
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          archived?: boolean
          created_at?: string
          group_type: string
          id?: string
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          archived?: boolean
          created_at?: string
          group_type?: string
          id?: string
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean | null
          role: string | null
          social_links: Json | null
          taste_score: number | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean | null
          role?: string | null
          social_links?: Json | null
          taste_score?: number | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          role?: string | null
          social_links?: Json | null
          taste_score?: number | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      research: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          featured: boolean | null
          id: string
          published: boolean | null
          slug: string
          sort_order: number | null
          tags: string[] | null
          title: string
          visible: boolean | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          published?: boolean | null
          slug: string
          sort_order?: number | null
          tags?: string[] | null
          title: string
          visible?: boolean | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          published?: boolean | null
          slug?: string
          sort_order?: number | null
          tags?: string[] | null
          title?: string
          visible?: boolean | null
        }
        Relationships: []
      }
      research_papers: {
        Row: {
          created_at: string
          description: string | null
          explanation: string | null
          formatted_title: string | null
          id: string
          pdf_url: string | null
          published: boolean | null
          published_at: string | null
          tags: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          explanation?: string | null
          formatted_title?: string | null
          id?: string
          pdf_url?: string | null
          published?: boolean | null
          published_at?: string | null
          tags?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          explanation?: string | null
          formatted_title?: string | null
          id?: string
          pdf_url?: string | null
          published?: boolean | null
          published_at?: string | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      research_workspace_papers: {
        Row: {
          abstract: string | null
          analysis_version: string
          authors_json: Json
          cleaned_filename: string | null
          created_at: string
          display_title: string | null
          doi: string | null
          extracted_paper_json: Json | null
          extraction_status: string
          file_fingerprint: string
          id: string
          insight_status: string
          insights_json: Json | null
          journal: string | null
          metadata_json: Json
          ocr_status: string
          original_filename: string
          page_map_json: Json
          preferred_filename: string | null
          source_type: string
          source_url: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string
          upload_status: string
          warnings_json: Json
          year: number | null
        }
        Insert: {
          abstract?: string | null
          analysis_version?: string
          authors_json?: Json
          cleaned_filename?: string | null
          created_at?: string
          display_title?: string | null
          doi?: string | null
          extracted_paper_json?: Json | null
          extraction_status?: string
          file_fingerprint: string
          id?: string
          insight_status?: string
          insights_json?: Json | null
          journal?: string | null
          metadata_json?: Json
          ocr_status?: string
          original_filename: string
          page_map_json?: Json
          preferred_filename?: string | null
          source_type: string
          source_url?: string | null
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          upload_status?: string
          warnings_json?: Json
          year?: number | null
        }
        Update: {
          abstract?: string | null
          analysis_version?: string
          authors_json?: Json
          cleaned_filename?: string | null
          created_at?: string
          display_title?: string | null
          doi?: string | null
          extracted_paper_json?: Json | null
          extraction_status?: string
          file_fingerprint?: string
          id?: string
          insight_status?: string
          insights_json?: Json | null
          journal?: string | null
          metadata_json?: Json
          ocr_status?: string
          original_filename?: string
          page_map_json?: Json
          preferred_filename?: string | null
          source_type?: string
          source_url?: string | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          upload_status?: string
          warnings_json?: Json
          year?: number | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      second_brain_club: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          content: string | null
          created_at: string | null
          id: string
          items: Json | null
          published: boolean | null
          sort_order: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          published?: boolean | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          published?: boolean | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          email: string
          id: string
          name: string | null
          source: string | null
          status: string | null
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          company: string | null
          content: string
          created_at: string
          id: string
          is_approved: boolean | null
          name: string
          role: string | null
        }
        Insert: {
          company?: string | null
          content: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          name: string
          role?: string | null
        }
        Update: {
          company?: string | null
          content?: string
          created_at?: string
          id?: string
          is_approved?: boolean | null
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      themes: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      work_experience: {
        Row: {
          category: string | null
          company: string
          created_at: string | null
          description: string | null
          duration: string
          id: string
          published: boolean | null
          role: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          company: string
          created_at?: string | null
          description?: string | null
          duration: string
          id?: string
          published?: boolean | null
          role: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          company?: string
          created_at?: string | null
          description?: string | null
          duration?: string
          id?: string
          published?: boolean | null
          role?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      portfolio_public_index: {
        Row: {
          cover_alt: string | null
          cover_focal_x: number | null
          cover_focal_y: number | null
          cover_url: string | null
          featured_order: number | null
          limited_public: boolean | null
          one_line_description: string | null
          organisations: Json | null
          project_id: string | null
          revision_number: number | null
          search_visible: boolean | null
          slug: string | null
          status: string | null
          taxonomies: Json | null
          title: string | null
          work_in_progress: boolean | null
          year_end: number | null
          year_start: number | null
        }
        Relationships: []
      }
      portfolio_public_projects: {
        Row: {
          blocks: Json | null
          collaborators: Json | null
          context: string | null
          cover_alt: string | null
          cover_focal_x: number | null
          cover_focal_y: number | null
          cover_url: string | null
          duration: string | null
          featured_order: number | null
          limited_public: boolean | null
          links: Json | null
          location: string | null
          meta_description: string | null
          one_line_description: string | null
          organisations: Json | null
          outcome_heading: string | null
          outcome_text: string | null
          project_id: string | null
          revision_number: number | null
          search_visible: boolean | null
          seo_title: string | null
          slug: string | null
          social_image_url: string | null
          specific_contribution: string | null
          status: string | null
          taxonomies: Json | null
          title: string | null
          work_in_progress: boolean | null
          year_end: number | null
          year_start: number | null
        }
        Relationships: []
      }
      portfolio_public_redirects: {
        Row: {
          old_slug: string | null
          slug: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      match_obsidian_chunks: {
        Args: {
          file_path_filter?: string
          folder_filter?: string
          match_count?: number
          match_threshold?: number
          public_only?: boolean
          query_embedding: string
          tag_filter?: string
        }
        Returns: {
          chunk_index: number
          chunk_text: string
          file_path: string
          folder_path: string
          heading: string
          id: number
          note_id: string
          note_title: string
          similarity: number
          tags: string[]
        }[]
      }
      portfolio_create_project: { Args: { p_title?: string }; Returns: string }
      portfolio_is_admin: { Args: never; Returns: boolean }
      portfolio_media_reference_count: {
        Args: { p_asset_id: string }
        Returns: number
      }
      portfolio_merge_taxonomy_terms: {
        Args: { p_source: string; p_target: string }
        Returns: undefined
      }
      portfolio_publish_project: {
        Args: { p_project_id: string }
        Returns: string
      }
      portfolio_reorder_projects: {
        Args: { p_project_ids: string[] }
        Returns: undefined
      }
      portfolio_restore_revision: {
        Args: { p_project_id: string; p_revision_id: string }
        Returns: string
      }
      portfolio_save_draft: {
        Args: {
          p_expected_lock_version: number
          p_payload: Json
          p_project_id: string
        }
        Returns: number
      }
      portfolio_slugify: { Args: { value: string }; Returns: string }
      portfolio_update_slug: {
        Args: { p_project_id: string; p_slug: string }
        Returns: string
      }
      search_moodboard_items: {
        Args: { lim?: number; q?: string }
        Returns: {
          created_at: string
          id: string
          image_url: string
          published: boolean
          search_text: string
          storage_path: string
          tags: string[]
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "moodboard_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_tags: {
        Args: { lim?: number; q: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          id: string
          is_featured: boolean | null
          name: string
          slug: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "hub_tags"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_photo_stories_from_photography: {
        Args: never
        Returns: {
          inserted_count: number
          total_rows: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
