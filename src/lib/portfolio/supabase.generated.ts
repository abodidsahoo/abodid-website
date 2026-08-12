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
      analytics_events: {
        Row: {
          event_name: string
          id: string
          menu_context: string
          menu_position: number | null
          occurred_at: string
          page_path: string
          page_view_id: string | null
          session_id: string
          target_label: string | null
          target_type: string | null
          target_url: string | null
        }
        Insert: {
          event_name: string
          id: string
          menu_context: string
          menu_position?: number | null
          occurred_at?: string
          page_path: string
          page_view_id?: string | null
          session_id: string
          target_label?: string | null
          target_type?: string | null
          target_url?: string | null
        }
        Update: {
          event_name?: string
          id?: string
          menu_context?: string
          menu_position?: number | null
          occurred_at?: string
          page_path?: string
          page_view_id?: string | null
          session_id?: string
          target_label?: string | null
          target_type?: string | null
          target_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_page_view_id_fkey"
            columns: ["page_view_id"]
            isOneToOne: false
            referencedRelation: "analytics_page_views"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_page_views: {
        Row: {
          engaged_seconds: number
          id: string
          page_path: string
          page_title: string | null
          project_id: string | null
          sequence_number: number
          session_id: string
          viewed_at: string
        }
        Insert: {
          engaged_seconds?: number
          id: string
          page_path: string
          page_title?: string | null
          project_id?: string | null
          sequence_number: number
          session_id: string
          viewed_at?: string
        }
        Update: {
          engaged_seconds?: number
          id?: string
          page_path?: string
          page_title?: string | null
          project_id?: string | null
          sequence_number?: number
          session_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_page_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_page_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects_export"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "analytics_page_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_index"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "analytics_page_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_projects"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "analytics_page_views_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_sessions: {
        Row: {
          city: string | null
          country: string
          created_at: string
          ended_at: string | null
          exit_page: string | null
          id: string
          landing_page: string
          referrer_domain: string | null
          source: string
          started_at: string
          total_engaged_seconds: number
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          ended_at?: string | null
          exit_page?: string | null
          id: string
          landing_page: string
          referrer_domain?: string | null
          source?: string
          started_at?: string
          total_engaged_seconds?: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id: string
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          ended_at?: string | null
          exit_page?: string | null
          id?: string
          landing_page?: string
          referrer_domain?: string | null
          source?: string
          started_at?: string
          total_engaged_seconds?: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string
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
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          enquiry_cta: string | null
          enquiry_path: string | null
          enquiry_source_name: string | null
          enquiry_title: string
          id: string
          message: string
          name: string
          notification_error: string | null
          notification_sent_at: string | null
          session_id: string
          submitted_at: string
        }
        Insert: {
          created_at?: string
          email: string
          enquiry_cta?: string | null
          enquiry_path?: string | null
          enquiry_source_name?: string | null
          enquiry_title: string
          id?: string
          message: string
          name: string
          notification_error?: string | null
          notification_sent_at?: string | null
          session_id: string
          submitted_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          enquiry_cta?: string | null
          enquiry_path?: string | null
          enquiry_source_name?: string | null
          enquiry_title?: string
          id?: string
          message?: string
          name?: string
          notification_error?: string | null
          notification_sent_at?: string | null
          session_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      ideas_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          title?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string | null
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt_text: string
          caption: string
          created_at: string
          created_by: string | null
          credit: string
          duration_seconds: number | null
          etag: string | null
          file_size: number
          folder_path: string
          height: number | null
          id: string
          last_processed_at: string | null
          metadata: Json
          mime_type: string
          object_key: string
          origin_project_id: string | null
          original_filename: string
          processing_error: string | null
          processing_status: string
          public_url: string
          ready_at: string | null
          storage_bucket: string
          storage_provider: string
          transform_version: number
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string
          caption?: string
          created_at?: string
          created_by?: string | null
          credit?: string
          duration_seconds?: number | null
          etag?: string | null
          file_size?: number
          folder_path?: string
          height?: number | null
          id?: string
          last_processed_at?: string | null
          metadata?: Json
          mime_type: string
          object_key: string
          origin_project_id?: string | null
          original_filename: string
          processing_error?: string | null
          processing_status?: string
          public_url: string
          ready_at?: string | null
          storage_bucket: string
          storage_provider?: string
          transform_version?: number
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          caption?: string
          created_at?: string
          created_by?: string | null
          credit?: string
          duration_seconds?: number | null
          etag?: string | null
          file_size?: number
          folder_path?: string
          height?: number | null
          id?: string
          last_processed_at?: string | null
          metadata?: Json
          mime_type?: string
          object_key?: string
          origin_project_id?: string | null
          original_filename?: string
          processing_error?: string | null
          processing_status?: string
          public_url?: string
          ready_at?: string | null
          storage_bucket?: string
          storage_provider?: string
          transform_version?: number
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_origin_project_id_fkey"
            columns: ["origin_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_origin_project_id_fkey"
            columns: ["origin_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects_export"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "media_assets_origin_project_id_fkey"
            columns: ["origin_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_index"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "media_assets_origin_project_id_fkey"
            columns: ["origin_project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_projects"
            referencedColumns: ["project_id"]
          },
        ]
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
      media_variants: {
        Row: {
          actual_height: number
          actual_width: number
          animated: boolean
          asset_id: string
          created_at: string
          etag: string | null
          file_size: number
          id: string
          metadata: Json
          mime_type: string
          object_key: string
          public_url: string
          quality: number
          source_etag: string | null
          target_width: number
          transform_version: number
          updated_at: string
          variant_key: string
        }
        Insert: {
          actual_height: number
          actual_width: number
          animated?: boolean
          asset_id: string
          created_at?: string
          etag?: string | null
          file_size?: number
          id?: string
          metadata?: Json
          mime_type?: string
          object_key: string
          public_url: string
          quality?: number
          source_etag?: string | null
          target_width: number
          transform_version?: number
          updated_at?: string
          variant_key: string
        }
        Update: {
          actual_height?: number
          actual_width?: number
          animated?: boolean
          asset_id?: string
          created_at?: string
          etag?: string | null
          file_size?: number
          id?: string
          metadata?: Json
          mime_type?: string
          object_key?: string
          public_url?: string
          quality?: number
          source_etag?: string | null
          target_width?: number
          transform_version?: number
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_variants_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      moodboard_items: {
        Row: {
          aspect_ratio: number | null
          created_at: string
          id: string
          image_height: number | null
          image_url: string
          image_width: number | null
          published: boolean
          search_text: string
          storage_path: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          aspect_ratio?: number | null
          created_at?: string
          id?: string
          image_height?: number | null
          image_url: string
          image_width?: number | null
          published?: boolean
          search_text?: string
          storage_path: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Update: {
          aspect_ratio?: number | null
          created_at?: string
          id?: string
          image_height?: number | null
          image_url?: string
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
      network_contacts: {
        Row: {
          archived: boolean
          city: string | null
          company: string | null
          confidence: Json
          connected_on: string | null
          country: string | null
          created_at: string
          custom_fields: Json
          do_not_contact: boolean
          email: string | null
          email_type: string
          embedded_at: string | null
          embedding: string | null
          embedding_input_hash: string | null
          embedding_model: string | null
          embedding_refresh_needed: boolean
          employment_history: Json
          enrichment_sources: Json
          enrichment_status: string
          expertise_keywords: string[]
          first_name: string | null
          full_name: string
          has_email: boolean
          id: string
          import_snapshot: Json
          imported_at: string
          incoming_conflicts: Json
          last_name: string | null
          last_seen_in_export: string
          last_verified_at: string | null
          linkedin_url: string | null
          match_explanation: string | null
          newsletter_consent_source: string | null
          newsletter_status: string
          notes: string | null
          outreach_goals: string[]
          owner_id: string
          personal_website: string | null
          position: string | null
          present_in_latest_export: boolean
          public_links: Json
          public_summary: string | null
          region: string | null
          relationship_context: string | null
          relationship_tier: string
          search_document: unknown
          search_text: string
          source_company: string | null
          source_email: string | null
          source_position: string | null
          source_record_key: string
          starred: boolean
          tags: string[]
          updated_at: string
          verification_state: string
          work_categories: string[]
        }
        Insert: {
          archived?: boolean
          city?: string | null
          company?: string | null
          confidence?: Json
          connected_on?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          do_not_contact?: boolean
          email?: string | null
          email_type?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_input_hash?: string | null
          embedding_model?: string | null
          embedding_refresh_needed?: boolean
          employment_history?: Json
          enrichment_sources?: Json
          enrichment_status?: string
          expertise_keywords?: string[]
          first_name?: string | null
          full_name: string
          has_email?: boolean
          id?: string
          import_snapshot?: Json
          imported_at?: string
          incoming_conflicts?: Json
          last_name?: string | null
          last_seen_in_export?: string
          last_verified_at?: string | null
          linkedin_url?: string | null
          match_explanation?: string | null
          newsletter_consent_source?: string | null
          newsletter_status?: string
          notes?: string | null
          outreach_goals?: string[]
          owner_id: string
          personal_website?: string | null
          position?: string | null
          present_in_latest_export?: boolean
          public_links?: Json
          public_summary?: string | null
          region?: string | null
          relationship_context?: string | null
          relationship_tier?: string
          search_document?: unknown
          search_text?: string
          source_company?: string | null
          source_email?: string | null
          source_position?: string | null
          source_record_key: string
          starred?: boolean
          tags?: string[]
          updated_at?: string
          verification_state?: string
          work_categories?: string[]
        }
        Update: {
          archived?: boolean
          city?: string | null
          company?: string | null
          confidence?: Json
          connected_on?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json
          do_not_contact?: boolean
          email?: string | null
          email_type?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_input_hash?: string | null
          embedding_model?: string | null
          embedding_refresh_needed?: boolean
          employment_history?: Json
          enrichment_sources?: Json
          enrichment_status?: string
          expertise_keywords?: string[]
          first_name?: string | null
          full_name?: string
          has_email?: boolean
          id?: string
          import_snapshot?: Json
          imported_at?: string
          incoming_conflicts?: Json
          last_name?: string | null
          last_seen_in_export?: string
          last_verified_at?: string | null
          linkedin_url?: string | null
          match_explanation?: string | null
          newsletter_consent_source?: string | null
          newsletter_status?: string
          notes?: string | null
          outreach_goals?: string[]
          owner_id?: string
          personal_website?: string | null
          position?: string | null
          present_in_latest_export?: boolean
          public_links?: Json
          public_summary?: string | null
          region?: string | null
          relationship_context?: string | null
          relationship_tier?: string
          search_document?: unknown
          search_text?: string
          source_company?: string | null
          source_email?: string | null
          source_position?: string | null
          source_record_key?: string
          starred?: boolean
          tags?: string[]
          updated_at?: string
          verification_state?: string
          work_categories?: string[]
        }
        Relationships: []
      }
      network_import_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          duplicate_count: number
          error_summary: Json
          failed_count: number
          id: string
          inserted_count: number
          owner_id: string
          source_filename: string
          source_sha256: string | null
          started_at: string
          status: string
          total_rows: number
          unchanged_count: number
          updated_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duplicate_count?: number
          error_summary?: Json
          failed_count?: number
          id?: string
          inserted_count?: number
          owner_id: string
          source_filename: string
          source_sha256?: string | null
          started_at?: string
          status?: string
          total_rows?: number
          unchanged_count?: number
          updated_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duplicate_count?: number
          error_summary?: Json
          failed_count?: number
          id?: string
          inserted_count?: number
          owner_id?: string
          source_filename?: string
          source_sha256?: string | null
          started_at?: string
          status?: string
          total_rows?: number
          unchanged_count?: number
          updated_count?: number
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
      newsletter_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          session_id: string | null
          source: string
          submitted_at: string
          subscriber_status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          session_id?: string | null
          source: string
          submitted_at?: string
          subscriber_status: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          session_id?: string | null
          source?: string
          submitted_at?: string
          subscriber_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
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
      portfolio_project_backups: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          slug: string
          title: string
          version_number: number
        }
        Insert: {
          content: Json
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          slug: string
          title: string
          version_number: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          slug?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_project_backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_project_backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_projects_export"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "portfolio_project_backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_index"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "portfolio_project_backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_public_projects"
            referencedColumns: ["project_id"]
          },
        ]
      }
      portfolio_projects: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          featured_order: number
          id: string
          lock_version: number
          published_at: string | null
          published_content: Json | null
          published_version: number
          slug: string
          status: string
          storage_folder: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          featured_order?: number
          id?: string
          lock_version?: number
          published_at?: string | null
          published_content?: Json | null
          published_version?: number
          slug: string
          status?: string
          storage_folder: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          featured_order?: number
          id?: string
          lock_version?: number
          published_at?: string | null
          published_content?: Json | null
          published_version?: number
          slug?: string
          status?: string
          storage_folder?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
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
            referencedRelation: "portfolio_projects_export"
            referencedColumns: ["project_id"]
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
      punctum_annotations: {
        Row: {
          created_at: string
          id: string
          moderated_at: string | null
          moderation_status: string
          response_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderation_status?: string
          response_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderation_status?: string
          response_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "punctum_annotations_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: true
            referencedRelation: "punctum_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      punctum_contact_options: {
        Row: {
          consent_version: string
          created_at: string
          encrypted_contact_value: string
          id: string
          session_id: string
        }
        Insert: {
          consent_version: string
          created_at?: string
          encrypted_contact_value: string
          id?: string
          session_id: string
        }
        Update: {
          consent_version?: string
          created_at?: string
          encrypted_contact_value?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "punctum_contact_options_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "punctum_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      punctum_generations: {
        Row: {
          access_token_hash: string
          completed_at: string | null
          context_crop_path: string | null
          created_at: string
          crop_height: number | null
          crop_width: number | null
          crop_x: number | null
          crop_y: number | null
          error_message: string | null
          generated_image_path: string | null
          generated_image_url: string | null
          generation_prompt: string
          generation_session_hash: string
          id: string
          idempotency_key: string
          mask_path: string | null
          masked_fragment_path: string | null
          model: string
          padding: Json
          palette: Json
          parent_generation_id: string | null
          post_generation_answer: string | null
          post_generation_explanation: string | null
          post_generation_polygon: Json | null
          provider: string
          seed: number
          source_height: number
          source_image_id: string | null
          source_image_url: string
          source_polygon_normalized: Json
          source_polygon_pixels: Json
          source_prompt: string
          source_response_id: string
          source_width: number
          status: string
          updated_at: string
          viewer_explanation: string
          visual_analysis: Json
        }
        Insert: {
          access_token_hash: string
          completed_at?: string | null
          context_crop_path?: string | null
          created_at?: string
          crop_height?: number | null
          crop_width?: number | null
          crop_x?: number | null
          crop_y?: number | null
          error_message?: string | null
          generated_image_path?: string | null
          generated_image_url?: string | null
          generation_prompt?: string
          generation_session_hash: string
          id?: string
          idempotency_key: string
          mask_path?: string | null
          masked_fragment_path?: string | null
          model?: string
          padding?: Json
          palette?: Json
          parent_generation_id?: string | null
          post_generation_answer?: string | null
          post_generation_explanation?: string | null
          post_generation_polygon?: Json | null
          provider?: string
          seed: number
          source_height: number
          source_image_id?: string | null
          source_image_url: string
          source_polygon_normalized: Json
          source_polygon_pixels?: Json
          source_prompt?: string
          source_response_id: string
          source_width: number
          status?: string
          updated_at?: string
          viewer_explanation?: string
          visual_analysis?: Json
        }
        Update: {
          access_token_hash?: string
          completed_at?: string | null
          context_crop_path?: string | null
          created_at?: string
          crop_height?: number | null
          crop_width?: number | null
          crop_x?: number | null
          crop_y?: number | null
          error_message?: string | null
          generated_image_path?: string | null
          generated_image_url?: string | null
          generation_prompt?: string
          generation_session_hash?: string
          id?: string
          idempotency_key?: string
          mask_path?: string | null
          masked_fragment_path?: string | null
          model?: string
          padding?: Json
          palette?: Json
          parent_generation_id?: string | null
          post_generation_answer?: string | null
          post_generation_explanation?: string | null
          post_generation_polygon?: Json | null
          provider?: string
          seed?: number
          source_height?: number
          source_image_id?: string | null
          source_image_url?: string
          source_polygon_normalized?: Json
          source_polygon_pixels?: Json
          source_prompt?: string
          source_response_id?: string
          source_width?: number
          status?: string
          updated_at?: string
          viewer_explanation?: string
          visual_analysis?: Json
        }
        Relationships: [
          {
            foreignKeyName: "punctum_generations_parent_generation_id_fkey"
            columns: ["parent_generation_id"]
            isOneToOne: false
            referencedRelation: "punctum_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punctum_generations_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "punctum_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punctum_generations_source_response_id_fkey"
            columns: ["source_response_id"]
            isOneToOne: false
            referencedRelation: "punctum_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      punctum_images: {
        Row: {
          active: boolean
          checksum: string
          created_at: string
          display_order: number
          height: number
          id: string
          public_url: string
          slug: string
          soft_background: string
          storage_path: string
          study_id: string
          title: string
          updated_at: string
          version: number
          width: number
        }
        Insert: {
          active?: boolean
          checksum: string
          created_at?: string
          display_order?: number
          height: number
          id?: string
          public_url: string
          slug: string
          soft_background?: string
          storage_path: string
          study_id: string
          title: string
          updated_at?: string
          version?: number
          width: number
        }
        Update: {
          active?: boolean
          checksum?: string
          created_at?: string
          display_order?: number
          height?: number
          id?: string
          public_url?: string
          slug?: string
          soft_background?: string
          storage_path?: string
          study_id?: string
          title?: string
          updated_at?: string
          version?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "punctum_images_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "punctum_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      punctum_responses: {
        Row: {
          algorithm_version: string
          brush_radius: number
          centroid_x: number
          centroid_y: number
          created_at: string
          drawing_type: string
          id: string
          idempotency_key: string
          image_checksum: string
          image_id: string
          image_version: number
          is_valid: boolean
          normalized_area: number
          polygon_fit_score: number | null
          polygon_vertices: Json
          public_visible: boolean
          quality_flags: Json
          session_id: string
          vertex_count: number
        }
        Insert: {
          algorithm_version: string
          brush_radius: number
          centroid_x: number
          centroid_y: number
          created_at?: string
          drawing_type: string
          id?: string
          idempotency_key: string
          image_checksum: string
          image_id: string
          image_version: number
          is_valid?: boolean
          normalized_area: number
          polygon_fit_score?: number | null
          polygon_vertices: Json
          public_visible?: boolean
          quality_flags?: Json
          session_id: string
          vertex_count: number
        }
        Update: {
          algorithm_version?: string
          brush_radius?: number
          centroid_x?: number
          centroid_y?: number
          created_at?: string
          drawing_type?: string
          id?: string
          idempotency_key?: string
          image_checksum?: string
          image_id?: string
          image_version?: number
          is_valid?: boolean
          normalized_area?: number
          polygon_fit_score?: number | null
          polygon_vertices?: Json
          public_visible?: boolean
          quality_flags?: Json
          session_id?: string
          vertex_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "punctum_responses_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "punctum_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punctum_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "punctum_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      punctum_sessions: {
        Row: {
          age_band: string | null
          age_confirmed: boolean
          completed_at: string | null
          consent_version: string
          country_code: string | null
          gender: string | null
          id: string
          metadata: Json
          public_session_id: string
          started_at: string
          study_id: string
          verification_method: string
          verified_at: string
        }
        Insert: {
          age_band?: string | null
          age_confirmed: boolean
          completed_at?: string | null
          consent_version: string
          country_code?: string | null
          gender?: string | null
          id?: string
          metadata?: Json
          public_session_id?: string
          started_at?: string
          study_id: string
          verification_method: string
          verified_at: string
        }
        Update: {
          age_band?: string | null
          age_confirmed?: boolean
          completed_at?: string | null
          consent_version?: string
          country_code?: string | null
          gender?: string | null
          id?: string
          metadata?: Json
          public_session_id?: string
          started_at?: string
          study_id?: string
          verification_method?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "punctum_sessions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "punctum_studies"
            referencedColumns: ["id"]
          },
        ]
      }
      punctum_studies: {
        Row: {
          consent_version: string
          created_at: string
          id: string
          minimum_cohort_size: number
          settings: Json
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          consent_version: string
          created_at?: string
          id?: string
          minimum_cohort_size?: number
          settings?: Json
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          consent_version?: string
          created_at?: string
          id?: string
          minimum_cohort_size?: number
          settings?: Json
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      research: {
        Row: {
          content: string
          cover_image: string | null
          created_at: string
          description: string | null
          experiment_url: string | null
          featured: boolean | null
          gallery_images: Json
          id: string
          published: boolean | null
          slug: string
          sort_order: number | null
          tags: string[] | null
          title: string
          updated_at: string
          visible: boolean | null
        }
        Insert: {
          content?: string
          cover_image?: string | null
          created_at?: string
          description?: string | null
          experiment_url?: string | null
          featured?: boolean | null
          gallery_images?: Json
          id?: string
          published?: boolean | null
          slug: string
          sort_order?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string
          visible?: boolean | null
        }
        Update: {
          content?: string
          cover_image?: string | null
          created_at?: string
          description?: string | null
          experiment_url?: string | null
          featured?: boolean | null
          gallery_images?: Json
          id?: string
          published?: boolean | null
          slug?: string
          sort_order?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string
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
      xr_showcase_items: {
        Row: {
          canonical_url: string | null
          created_at: string
          created_by: string | null
          description: string
          effective_image_url: string | null
          featured: boolean
          id: string
          image_alt: string | null
          manual_image_url: string | null
          metadata: Json
          metadata_error: string | null
          metadata_status: string
          preview_image_url: string | null
          primary_genre: string
          published_at: string | null
          search_document: unknown
          slug: string
          sort_order: number
          source_domain: string | null
          source_name: string | null
          source_url: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          effective_image_url?: string | null
          featured?: boolean
          id?: string
          image_alt?: string | null
          manual_image_url?: string | null
          metadata?: Json
          metadata_error?: string | null
          metadata_status?: string
          preview_image_url?: string | null
          primary_genre?: string
          published_at?: string | null
          search_document?: unknown
          slug: string
          sort_order?: number
          source_domain?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          effective_image_url?: string | null
          featured?: boolean
          id?: string
          image_alt?: string | null
          manual_image_url?: string | null
          metadata?: Json
          metadata_error?: string | null
          metadata_status?: string
          preview_image_url?: string | null
          primary_genre?: string
          published_at?: string | null
          search_document?: unknown
          slug?: string
          sort_order?: number
          source_domain?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      portfolio_projects_export: {
        Row: {
          content: Json | null
          created_at: string | null
          featured_order: number | null
          project_id: string | null
          project_name: string | null
          project_title: string | null
          published_at: string | null
          published_content: Json | null
          published_version: number | null
          status: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          featured_order?: number | null
          project_id?: string | null
          project_name?: string | null
          project_title?: string | null
          published_at?: string | null
          published_content?: Json | null
          published_version?: number | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          featured_order?: number | null
          project_id?: string | null
          project_name?: string | null
          project_title?: string | null
          published_at?: string | null
          published_content?: Json | null
          published_version?: number | null
          status?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      portfolio_public_index: {
        Row: {
          cover_alt: string | null
          cover_focal_x: number | null
          cover_focal_y: number | null
          cover_media: Json | null
          cover_media_id: string | null
          cover_url: string | null
          featured_order: number | null
          layout_style: number | null
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
          cover_media: Json | null
          cover_media_id: string | null
          cover_url: string | null
          duration: string | null
          featured_order: number | null
          layout_style: number | null
          limited_public: boolean | null
          links: Json | null
          location: string | null
          media_assets: Json | null
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
          social_image_media: Json | null
          social_image_media_id: string | null
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
      analytics_build_navigation_report:
        | { Args: { p_start_at: string }; Returns: Json }
        | {
            Args: { p_start_at: string; p_traffic_class: string }
            Returns: Json
          }
      analytics_build_report:
        | { Args: { p_start_at: string }; Returns: Json }
        | {
            Args: { p_start_at: string; p_traffic_class: string }
            Returns: Json
          }
      analytics_is_admin: { Args: never; Returns: boolean }
      analytics_record_engagement: {
        Args: {
          p_engaged_seconds: number
          p_exit_page: string
          p_page_view_id: string
          p_session_id: string
        }
        Returns: undefined
      }
      analytics_record_navigation_event: {
        Args: {
          p_event_id: string
          p_event_name: string
          p_menu_context: string
          p_page_path: string
          p_page_view_id: string
          p_position?: number
          p_session_id: string
          p_target_label?: string
          p_target_type?: string
          p_target_url?: string
        }
        Returns: undefined
      }
      analytics_record_page_open:
        | {
            Args: {
              p_city: string
              p_country: string
              p_landing_page: string
              p_page_path: string
              p_page_title: string
              p_page_view_id: string
              p_project_id?: string
              p_referrer_domain: string
              p_sequence_number: number
              p_session_id: string
              p_source: string
              p_utm_campaign: string
              p_utm_content: string
              p_utm_medium: string
              p_utm_source: string
              p_utm_term: string
              p_visitor_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_country: string
              p_landing_page: string
              p_page_path: string
              p_page_title: string
              p_page_view_id: string
              p_project_id?: string
              p_referrer_domain: string
              p_sequence_number: number
              p_session_id: string
              p_source: string
              p_utm_campaign: string
              p_utm_content: string
              p_utm_medium: string
              p_utm_source: string
              p_utm_term: string
              p_visitor_id: string
            }
            Returns: undefined
          }
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
      media_asset_id_from_url: { Args: { p_url: string }; Returns: string }
      media_asset_manifest: { Args: { p_asset_id: string }; Returns: Json }
      media_assets_is_admin: { Args: never; Returns: boolean }
      network_contact_facets: { Args: { p_owner_id: string }; Returns: Json }
      newsletter_is_admin: { Args: never; Returns: boolean }
      portfolio_create_project: { Args: { p_title?: string }; Returns: string }
      portfolio_is_admin: { Args: never; Returns: boolean }
      portfolio_json_uuid: { Args: { p_value: string }; Returns: string }
      portfolio_media_reference_count: {
        Args: { p_asset_id: string }
        Returns: number
      }
      portfolio_project_media_manifests: {
        Args: { p_content: Json }
        Returns: Json
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
      punctum_valid_polygon: { Args: { vertices: Json }; Returns: boolean }
      search_moodboard_items: {
        Args: { lim?: number; q?: string }
        Returns: {
          aspect_ratio: number | null
          created_at: string
          id: string
          image_height: number | null
          image_url: string
          image_width: number | null
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
      search_network_contacts: {
        Args: {
          p_city?: string
          p_company?: string
          p_connected_from?: string
          p_connected_to?: string
          p_country?: string
          p_do_not_contact?: boolean
          p_email_type?: string
          p_enrichment_status?: string
          p_expertise_keywords?: string[]
          p_has_email?: boolean
          p_include_archived?: boolean
          p_limit?: number
          p_newsletter_status?: string
          p_offset?: number
          p_outreach_goals?: string[]
          p_owner_id: string
          p_query?: string
          p_query_embedding?: string
          p_region?: string
          p_relationship_tier?: string
          p_sort?: string
          p_tags?: string[]
          p_verification_state?: string
          p_work_categories?: string[]
        }
        Returns: {
          contact: Json
          match_reason: string
          relevance_score: number
          total_count: number
        }[]
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
      update_network_contact_embeddings: {
        Args: { p_owner_id: string; p_rows: Json }
        Returns: number
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
