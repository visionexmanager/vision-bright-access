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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academy_chat_sessions: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      academy_course_modules: {
        Row: {
          content_url: string | null
          course_id: string
          id: string
          order_index: number
          title: string
        }
        Insert: {
          content_url?: string | null
          course_id: string
          id?: string
          order_index?: number
          title?: string
        }
        Update: {
          content_url?: string | null
          course_id?: string
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_course_reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_courses: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          description: string
          difficulty: string
          duration_minutes: number
          gallery_urls: string[]
          id: string
          instructor_id: string
          is_free: boolean
          language: string
          learning_outcomes: string[]
          level: string
          price_vx: number | null
          published: boolean
          rating_avg: number | null
          rating_count: number
          requirements: string[]
          source: string
          status: string
          students_count: number
          subject: string
          tags: string[]
          title: string
          trailer_video_url: string | null
          updated_at: string
          youtube_video_id: string | null
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string
          difficulty?: string
          duration_minutes?: number
          gallery_urls?: string[]
          id?: string
          instructor_id: string
          is_free?: boolean
          language?: string
          learning_outcomes?: string[]
          level?: string
          price_vx?: number | null
          published?: boolean
          rating_avg?: number | null
          rating_count?: number
          requirements?: string[]
          source?: string
          status?: string
          students_count?: number
          subject?: string
          tags?: string[]
          title?: string
          trailer_video_url?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string
          difficulty?: string
          duration_minutes?: number
          gallery_urls?: string[]
          id?: string
          instructor_id?: string
          is_free?: boolean
          language?: string
          learning_outcomes?: string[]
          level?: string
          price_vx?: number | null
          published?: boolean
          rating_avg?: number | null
          rating_count?: number
          requirements?: string[]
          source?: string
          status?: string
          students_count?: number
          subject?: string
          tags?: string[]
          title?: string
          trailer_video_url?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "academy_instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          current_lesson_id: string | null
          enrolled_at: string
          id: string
          last_position_seconds: number
          progress_percent: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          current_lesson_id?: string | null
          enrolled_at?: string
          id?: string
          last_position_seconds?: number
          progress_percent?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          current_lesson_id?: string | null
          enrolled_at?: string
          id?: string
          last_position_seconds?: number
          progress_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_enrollments_current_lesson_fkey"
            columns: ["current_lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_instructor_applications: {
        Row: {
          agreement_accepted: boolean
          bio: string
          country: string | null
          created_at: string
          experience_years: number
          expertise: string[]
          headline: string
          id: string
          identity_verification_status: string
          languages: string[]
          portfolio_url: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          skills: string[]
          status: string
          submitted_at: string | null
          terms_accepted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          agreement_accepted?: boolean
          bio?: string
          country?: string | null
          created_at?: string
          experience_years?: number
          expertise?: string[]
          headline?: string
          id?: string
          identity_verification_status?: string
          languages?: string[]
          portfolio_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          skills?: string[]
          status?: string
          submitted_at?: string | null
          terms_accepted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          agreement_accepted?: boolean
          bio?: string
          country?: string | null
          created_at?: string
          experience_years?: number
          expertise?: string[]
          headline?: string
          id?: string
          identity_verification_status?: string
          languages?: string[]
          portfolio_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          skills?: string[]
          status?: string
          submitted_at?: string | null
          terms_accepted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      academy_instructors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          certifications: string[]
          country: string | null
          courses_count: number
          cover_image_url: string | null
          created_at: string
          expertise: string[]
          headline: string | null
          id: string
          languages: string[]
          level: string
          name: string
          organization_id: string | null
          portfolio_url: string | null
          rating: number | null
          skills: string[]
          social_links: Json
          students_count: number
          subjects: string[]
          updated_at: string
          user_id: string | null
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          certifications?: string[]
          country?: string | null
          courses_count?: number
          cover_image_url?: string | null
          created_at?: string
          expertise?: string[]
          headline?: string | null
          id?: string
          languages?: string[]
          level?: string
          name?: string
          organization_id?: string | null
          portfolio_url?: string | null
          rating?: number | null
          skills?: string[]
          social_links?: Json
          students_count?: number
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          certifications?: string[]
          country?: string | null
          courses_count?: number
          cover_image_url?: string | null
          created_at?: string
          expertise?: string[]
          headline?: string | null
          id?: string
          languages?: string[]
          level?: string
          name?: string
          organization_id?: string | null
          portfolio_url?: string | null
          rating?: number | null
          skills?: string[]
          social_links?: Json
          students_count?: number
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      academy_learning_track_progress: {
        Row: {
          completed_course_ids: string[]
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_course_ids?: string[]
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_course_ids?: string[]
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_learning_track_progress_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "academy_learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_learning_tracks: {
        Row: {
          certificate_id: string | null
          course_ids: string[]
          created_at: string
          description: string
          difficulty: string
          estimated_duration_minutes: number
          id: string
          skills: string[]
          title: string
        }
        Insert: {
          certificate_id?: string | null
          course_ids?: string[]
          created_at?: string
          description?: string
          difficulty?: string
          estimated_duration_minutes?: number
          id?: string
          skills?: string[]
          title?: string
        }
        Update: {
          certificate_id?: string | null
          course_ids?: string[]
          created_at?: string
          description?: string
          difficulty?: string
          estimated_duration_minutes?: number
          id?: string
          skills?: string[]
          title?: string
        }
        Relationships: []
      }
      academy_lesson_bookmarks: {
        Row: {
          created_at: string
          id: string
          label: string | null
          lesson_id: string
          timestamp_seconds: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          lesson_id: string
          timestamp_seconds?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          lesson_id?: string
          timestamp_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lesson_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string
          timestamp_seconds: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id: string
          timestamp_seconds?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string
          timestamp_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lesson_progress: {
        Row: {
          completed: boolean
          course_id: string
          last_position_seconds: number
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          course_id: string
          last_position_seconds?: number
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          course_id?: string
          last_position_seconds?: number
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_lessons: {
        Row: {
          attachments: Json
          body_markdown: string | null
          code_snippets: Json
          course_id: string
          created_at: string
          duration_seconds: number
          external_links: Json
          file_url: string | null
          id: string
          is_preview: boolean
          kind: string
          live_session_scheduled_at: string | null
          module_id: string
          order_index: number
          title: string
          updated_at: string
          video_url: string | null
          youtube_video_id: string | null
        }
        Insert: {
          attachments?: Json
          body_markdown?: string | null
          code_snippets?: Json
          course_id: string
          created_at?: string
          duration_seconds?: number
          external_links?: Json
          file_url?: string | null
          id?: string
          is_preview?: boolean
          kind?: string
          live_session_scheduled_at?: string | null
          module_id: string
          order_index?: number
          title?: string
          updated_at?: string
          video_url?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          attachments?: Json
          body_markdown?: string | null
          code_snippets?: Json
          course_id?: string
          created_at?: string
          duration_seconds?: number
          external_links?: Json
          file_url?: string | null
          id?: string
          is_preview?: boolean
          kind?: string
          live_session_scheduled_at?: string | null
          module_id?: string
          order_index?: number
          title?: string
          updated_at?: string
          video_url?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_profiles: {
        Row: {
          country: string
          created_at: string
          gender: string
          last_active: string
          level: string
          name: string
          streak_days: number
          updated_at: string
          user_id: string
          xp_total: number
        }
        Insert: {
          country?: string
          created_at?: string
          gender?: string
          last_active?: string
          level?: string
          name?: string
          streak_days?: number
          updated_at?: string
          user_id: string
          xp_total?: number
        }
        Update: {
          country?: string
          created_at?: string
          gender?: string
          last_active?: string
          level?: string
          name?: string
          streak_days?: number
          updated_at?: string
          user_id?: string
          xp_total?: number
        }
        Relationships: []
      }
      academy_xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      ai_embeddings: {
        Row: {
          content: string
          embedding: string | null
          id: string
          source_id: string
          source_table: string
          updated_at: string
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: string
          source_id: string
          source_table: string
          updated_at?: string
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: string
          source_id?: string
          source_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_interactions: {
        Row: {
          cache_hit: boolean
          completion_tokens: number | null
          created_at: string
          feedback_comment: string | null
          feedback_rating: number | null
          id: string
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          provider: string
          request_summary: string | null
          response_summary: string | null
          service: string
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          feedback_comment?: string | null
          feedback_rating?: number | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider: string
          request_summary?: string | null
          response_summary?: string | null
          service: string
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          feedback_comment?: string | null
          feedback_rating?: number | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider?: string
          request_summary?: string | null
          response_summary?: string | null
          service?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          response: Json
          service: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
          response: Json
          service: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          response?: Json
          service?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_user_memory: {
        Row: {
          accessibility_needs: string[]
          created_at: string
          frequent_sections: Json
          interaction_count: number
          interests: string[]
          last_context: Json
          memory_enabled: boolean
          preferred_language: string | null
          preferred_tone: string | null
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accessibility_needs?: string[]
          created_at?: string
          frequent_sections?: Json
          interaction_count?: number
          interests?: string[]
          last_context?: Json
          memory_enabled?: boolean
          preferred_language?: string | null
          preferred_tone?: string | null
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accessibility_needs?: string[]
          created_at?: string
          frequent_sections?: Json
          interaction_count?: number
          interests?: string[]
          last_context?: Json
          memory_enabled?: boolean
          preferred_language?: string | null
          preferred_tone?: string | null
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ams_activity_logs: {
        Row: {
          action: string
          asset_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          asset_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          asset_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_activity_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_assets: {
        Row: {
          asset_type: string
          created_at: string
          duration_sec: number | null
          filename: string
          folder_id: string | null
          id: string
          metadata: Json
          mime_type: string | null
          original_name: string
          owner_id: string
          project_id: string | null
          public_url: string | null
          size_bytes: number
          status: string
          storage_path: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          duration_sec?: number | null
          filename: string
          folder_id?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_name: string
          owner_id: string
          project_id?: string | null
          public_url?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          duration_sec?: number | null
          filename?: string
          folder_id?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_name?: string
          owner_id?: string
          project_id?: string | null
          public_url?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "ams_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_document_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_filename: string | null
          input_text: string | null
          language: string
          mode: string
          project_id: string | null
          result_json: Json | null
          result_text: string | null
          source_asset_id: string | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_filename?: string | null
          input_text?: string | null
          language?: string
          mode: string
          project_id?: string | null
          result_json?: Json | null
          result_text?: string | null
          source_asset_id?: string | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_filename?: string | null
          input_text?: string | null
          language?: string
          mode?: string
          project_id?: string | null
          result_json?: Json | null
          result_text?: string | null
          source_asset_id?: string | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_document_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_document_jobs_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_favorites: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ams_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          project_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          parent_id?: string | null
          project_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ams_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ams_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_image_jobs: {
        Row: {
          asset_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          height: number | null
          id: string
          image_url: string | null
          mode: string
          model: string
          project_id: string | null
          prompt: string | null
          provider: string
          provider_job_id: string | null
          quality: string
          revised_prompt: string | null
          size: string
          source_asset_id: string | null
          source_image_url: string | null
          started_at: string | null
          status: string
          storage_path: string | null
          style: string
          user_id: string
          width: number | null
        }
        Insert: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          mode?: string
          model?: string
          project_id?: string | null
          prompt?: string | null
          provider?: string
          provider_job_id?: string | null
          quality?: string
          revised_prompt?: string | null
          size?: string
          source_asset_id?: string | null
          source_image_url?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          style?: string
          user_id: string
          width?: number | null
        }
        Update: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          mode?: string
          model?: string
          project_id?: string | null
          prompt?: string | null
          provider?: string
          provider_job_id?: string | null
          quality?: string
          revised_prompt?: string | null
          size?: string
          source_asset_id?: string | null
          source_image_url?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          style?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ams_image_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_image_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_image_jobs_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_favorite: boolean
          language: string
          name: string
          owner_id: string
          status: string
          tags: string[]
          thumbnail_url: string | null
          updated_at: string
          video_preset: string | null
          voice_preset: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_favorite?: boolean
          language?: string
          name: string
          owner_id: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
          video_preset?: string | null
          voice_preset?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_favorite?: boolean
          language?: string
          name?: string
          owner_id?: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          updated_at?: string
          video_preset?: string | null
          voice_preset?: string | null
        }
        Relationships: []
      }
      ams_speech_jobs: {
        Row: {
          asset_id: string | null
          completed_at: string | null
          created_at: string
          duration_sec: number | null
          emotion: string
          error_message: string | null
          file_size_bytes: number | null
          id: string
          input_text: string
          language: string
          model: string
          output_format: string
          pitch: number
          preset_id: string | null
          preset_name: string | null
          project_id: string | null
          provider: string
          public_url: string | null
          retry_count: number
          speed: number
          started_at: string | null
          status: string
          storage_path: string | null
          user_id: string
          voice_id: string
          voice_name: string | null
        }
        Insert: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_sec?: number | null
          emotion?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          input_text: string
          language?: string
          model?: string
          output_format?: string
          pitch?: number
          preset_id?: string | null
          preset_name?: string | null
          project_id?: string | null
          provider?: string
          public_url?: string | null
          retry_count?: number
          speed?: number
          started_at?: string | null
          status?: string
          storage_path?: string | null
          user_id: string
          voice_id: string
          voice_name?: string | null
        }
        Update: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          duration_sec?: number | null
          emotion?: string
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          input_text?: string
          language?: string
          model?: string
          output_format?: string
          pitch?: number
          preset_id?: string | null
          preset_name?: string | null
          project_id?: string | null
          provider?: string
          public_url?: string | null
          retry_count?: number
          speed?: number
          started_at?: string | null
          status?: string
          storage_path?: string | null
          user_id?: string
          voice_id?: string
          voice_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ams_speech_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_speech_jobs_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "ams_speech_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_speech_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_speech_presets: {
        Row: {
          created_at: string
          emotion: string
          id: string
          is_favorite: boolean
          language: string
          model: string
          name: string
          output_format: string
          pitch: number
          provider: string
          speed: number
          updated_at: string
          user_id: string
          voice_id: string
        }
        Insert: {
          created_at?: string
          emotion?: string
          id?: string
          is_favorite?: boolean
          language?: string
          model?: string
          name: string
          output_format?: string
          pitch?: number
          provider?: string
          speed?: number
          updated_at?: string
          user_id: string
          voice_id: string
        }
        Update: {
          created_at?: string
          emotion?: string
          id?: string
          is_favorite?: boolean
          language?: string
          model?: string
          name?: string
          output_format?: string
          pitch?: number
          provider?: string
          speed?: number
          updated_at?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: []
      }
      ams_storage_usage: {
        Row: {
          asset_count: number
          project_count: number
          quota_bytes: number
          updated_at: string
          used_bytes: number
          user_id: string
        }
        Insert: {
          asset_count?: number
          project_count?: number
          quota_bytes?: number
          updated_at?: string
          used_bytes?: number
          user_id: string
        }
        Update: {
          asset_count?: number
          project_count?: number
          quota_bytes?: number
          updated_at?: string
          used_bytes?: number
          user_id?: string
        }
        Relationships: []
      }
      ams_templates: {
        Row: {
          category: string
          config: Json
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string | null
          template_type: string
          thumbnail_url: string | null
          usage_count: number
        }
        Insert: {
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id?: string | null
          template_type: string
          thumbnail_url?: string | null
          usage_count?: number
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string | null
          template_type?: string
          thumbnail_url?: string | null
          usage_count?: number
        }
        Relationships: []
      }
      ams_text_tool_jobs: {
        Row: {
          asset_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          language: string
          options: Json
          project_id: string | null
          prompt: string
          result_json: Json | null
          result_text: string | null
          started_at: string | null
          status: string
          tool: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string
          options?: Json
          project_id?: string | null
          prompt: string
          result_json?: Json | null
          result_text?: string | null
          started_at?: string | null
          status?: string
          tool: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string
          options?: Json
          project_id?: string | null
          prompt?: string
          result_json?: Json | null
          result_text?: string | null
          started_at?: string | null
          status?: string
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_text_tool_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_text_tool_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_transcription_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          detected_language: string | null
          duration_sec: number | null
          error_message: string | null
          id: string
          input_filename: string
          input_mime_type: string | null
          input_size_bytes: number | null
          language_hint: string | null
          project_id: string | null
          provider: string
          segments: Json | null
          source_asset_id: string | null
          started_at: string | null
          status: string
          transcript_text: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          detected_language?: string | null
          duration_sec?: number | null
          error_message?: string | null
          id?: string
          input_filename: string
          input_mime_type?: string | null
          input_size_bytes?: number | null
          language_hint?: string | null
          project_id?: string | null
          provider?: string
          segments?: Json | null
          source_asset_id?: string | null
          started_at?: string | null
          status?: string
          transcript_text?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          detected_language?: string | null
          duration_sec?: number | null
          error_message?: string | null
          id?: string
          input_filename?: string
          input_mime_type?: string | null
          input_size_bytes?: number | null
          language_hint?: string | null
          project_id?: string | null
          provider?: string
          segments?: Json | null
          source_asset_id?: string | null
          started_at?: string | null
          status?: string
          transcript_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_transcription_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ams_transcription_jobs_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_user_preferences: {
        Row: {
          default_language: string
          default_video_preset: string | null
          default_voice_preset: string | null
          notifications: Json
          ui_preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          default_language?: string
          default_video_preset?: string | null
          default_voice_preset?: string | null
          notifications?: Json
          ui_preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          default_language?: string
          default_video_preset?: string | null
          default_voice_preset?: string | null
          notifications?: Json
          ui_preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ams_voice_favorites: {
        Row: {
          created_at: string
          user_id: string
          voice_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          voice_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_voice_favorites_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "ams_voices"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_voice_recent: {
        Row: {
          use_count: number
          used_at: string
          user_id: string
          voice_id: string
        }
        Insert: {
          use_count?: number
          used_at?: string
          user_id: string
          voice_id: string
        }
        Update: {
          use_count?: number
          used_at?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_voice_recent_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "ams_voices"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_voices: {
        Row: {
          accent: string | null
          age_style: string | null
          category: string
          created_at: string
          description: string | null
          gender: string | null
          id: string
          is_premium: boolean
          language: string
          name: string
          provider: string
          provider_voice_id: string
          requires_model: string | null
          sample_url: string | null
          sort_order: number
          supported_languages: string[]
          tags: string[]
        }
        Insert: {
          accent?: string | null
          age_style?: string | null
          category?: string
          created_at?: string
          description?: string | null
          gender?: string | null
          id: string
          is_premium?: boolean
          language?: string
          name: string
          provider?: string
          provider_voice_id: string
          requires_model?: string | null
          sample_url?: string | null
          sort_order?: number
          supported_languages?: string[]
          tags?: string[]
        }
        Update: {
          accent?: string | null
          age_style?: string | null
          category?: string
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_premium?: boolean
          language?: string
          name?: string
          provider?: string
          provider_voice_id?: string
          requires_model?: string | null
          sample_url?: string | null
          sort_order?: number
          supported_languages?: string[]
          tags?: string[]
        }
        Relationships: []
      }
      applications: {
        Row: {
          ai_score: number | null
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          resume_snapshot: string | null
          status: Database["public"]["Enums"]["career_application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_score?: number | null
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          resume_snapshot?: string | null
          status?: Database["public"]["Enums"]["career_application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_score?: number | null
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          resume_snapshot?: string | null
          status?: Database["public"]["Enums"]["career_application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_results: {
        Row: {
          analysis_text: string
          answers: Json
          created_at: string
          id: string
          student_profile: Json
          user_id: string
        }
        Insert: {
          analysis_text?: string
          answers?: Json
          created_at?: string
          id?: string
          student_profile?: Json
          user_id: string
        }
        Update: {
          analysis_text?: string
          answers?: Json
          created_at?: string
          id?: string
          student_profile?: Json
          user_id?: string
        }
        Relationships: []
      }
      bazaar_disputes: {
        Row: {
          buyer_id: string
          created_at: string | null
          description: string
          id: string
          product_id: string | null
          reason: string
          resolution: string | null
          seller_response: string | null
          shop_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          description: string
          id?: string
          product_id?: string | null
          reason: string
          resolution?: string | null
          seller_response?: string | null
          shop_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          description?: string
          id?: string
          product_id?: string | null
          reason?: string
          resolution?: string | null
          seller_response?: string | null
          shop_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_disputes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bazaar_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bazaar_disputes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "bazaar_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          product_snapshot: Json
          quantity: number
          unit_price_usd: number | null
          unit_price_vx: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_snapshot?: Json
          quantity: number
          unit_price_usd?: number | null
          unit_price_vx?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_snapshot?: Json
          quantity?: number
          unit_price_usd?: number | null
          unit_price_vx?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "bazaar_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bazaar_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bazaar_products"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_orders: {
        Row: {
          buyer_id: string
          buyer_note: string | null
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string
          shipping_address: Json | null
          shipping_email: string | null
          shipping_name: string | null
          shipping_phone: string | null
          shop_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          total_usd: number | null
          total_vx: number | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_note?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method: string
          shipping_address?: Json | null
          shipping_email?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shop_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          total_usd?: number | null
          total_vx?: number | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_note?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          shipping_address?: Json | null
          shipping_email?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          shop_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          total_usd?: number | null
          total_vx?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "bazaar_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_product_interactions: {
        Row: {
          actor_id: string | null
          created_at: string | null
          id: string
          interaction_type: string
          metadata: Json | null
          product_id: string
          shop_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          interaction_type: string
          metadata?: Json | null
          product_id: string
          shop_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          id?: string
          interaction_type?: string
          metadata?: Json | null
          product_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_product_interactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bazaar_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bazaar_product_interactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "bazaar_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_products: {
        Row: {
          accepts_cash: boolean
          accepts_vx: boolean
          alt_text: string | null
          cart_count: number | null
          category: string | null
          created_at: string | null
          delivery_time: string | null
          description: string | null
          id: string
          image: string | null
          in_stock: boolean | null
          is_accessible: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          price_usd: number | null
          price_vx: number | null
          product_type: string | null
          return_policy: string | null
          shelf_position: string | null
          shipping_cost: number | null
          shipping_from: string | null
          shop_id: string
          sold_count: number | null
          stock_qty: number | null
          views_count: number | null
        }
        Insert: {
          accepts_cash?: boolean
          accepts_vx?: boolean
          alt_text?: string | null
          cart_count?: number | null
          category?: string | null
          created_at?: string | null
          delivery_time?: string | null
          description?: string | null
          id?: string
          image?: string | null
          in_stock?: boolean | null
          is_accessible?: boolean | null
          is_featured?: boolean | null
          name: string
          price: number
          price_usd?: number | null
          price_vx?: number | null
          product_type?: string | null
          return_policy?: string | null
          shelf_position?: string | null
          shipping_cost?: number | null
          shipping_from?: string | null
          shop_id: string
          sold_count?: number | null
          stock_qty?: number | null
          views_count?: number | null
        }
        Update: {
          accepts_cash?: boolean
          accepts_vx?: boolean
          alt_text?: string | null
          cart_count?: number | null
          category?: string | null
          created_at?: string | null
          delivery_time?: string | null
          description?: string | null
          id?: string
          image?: string | null
          in_stock?: boolean | null
          is_accessible?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          price_usd?: number | null
          price_vx?: number | null
          product_type?: string | null
          return_policy?: string | null
          shelf_position?: string | null
          shipping_cost?: number | null
          shipping_from?: string | null
          shop_id?: string
          sold_count?: number | null
          stock_qty?: number | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "bazaar_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          product_id: string
          rating: number
          reviewer_id: string
          shop_id: string
          verified_purchase: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          rating: number
          reviewer_id: string
          shop_id: string
          verified_purchase?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          rating?: number
          reviewer_id?: string
          shop_id?: string
          verified_purchase?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bazaar_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bazaar_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "bazaar_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bazaar_shops: {
        Row: {
          bg_image: string | null
          country: string | null
          created_at: string | null
          description: string | null
          email_notifications: boolean | null
          id: string
          is_active: boolean | null
          last_rent_paid: string | null
          low_stock_notifications: boolean
          message_notifications: boolean
          name: string
          order_notifications: boolean
          owner_id: string
          response_rate: number | null
          review_notifications: boolean
          sign_style: string | null
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean
          theme_color: string | null
          tier: string
          trust_score: number | null
          vacation_mode: boolean | null
          whatsapp_notifications: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          bg_image?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email_notifications?: boolean | null
          id?: string
          is_active?: boolean | null
          last_rent_paid?: string | null
          low_stock_notifications?: boolean
          message_notifications?: boolean
          name: string
          order_notifications?: boolean
          owner_id: string
          response_rate?: number | null
          review_notifications?: boolean
          sign_style?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          theme_color?: string | null
          tier: string
          trust_score?: number | null
          vacation_mode?: boolean | null
          whatsapp_notifications?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          bg_image?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email_notifications?: boolean | null
          id?: string
          is_active?: boolean | null
          last_rent_paid?: string | null
          low_stock_notifications?: boolean
          message_notifications?: boolean
          name?: string
          order_notifications?: boolean
          owner_id?: string
          response_rate?: number | null
          review_notifications?: boolean
          sign_style?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          theme_color?: string | null
          tier?: string
          trust_score?: number | null
          vacation_mode?: boolean | null
          whatsapp_notifications?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      bazaar_wishlists: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bazaar_wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bazaar_products"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_unlimited: boolean
          limits: Json
          name: string
          price_monthly_usd: number
          sort_order: number
          vx_credits_monthly: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id: string
          is_active?: boolean
          is_unlimited?: boolean
          limits?: Json
          name: string
          price_monthly_usd?: number
          sort_order?: number
          vx_credits_monthly?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          limits?: Json
          name?: string
          price_monthly_usd?: number
          sort_order?: number
          vx_credits_monthly?: number
        }
        Relationships: []
      }
      billing_rules: {
        Row: {
          description: string | null
          id: string
          updated_at: string
          vx_cost: number
        }
        Insert: {
          description?: string | null
          id: string
          updated_at?: string
          vx_cost: number
        }
        Update: {
          description?: string | null
          id?: string
          updated_at?: string
          vx_cost?: number
        }
        Relationships: []
      }
      career_analytics_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      career_billing_invoices: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          currency: string
          id: string
          invoice_pdf_url: string | null
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["career_invoice_status"]
          stripe_invoice_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          invoice_pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["career_invoice_status"]
          stripe_invoice_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          invoice_pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["career_invoice_status"]
          stripe_invoice_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_billing_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "career_billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      career_billing_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_monthly_usd: number | null
          price_yearly_usd: number | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id: string
          is_active?: boolean
          limits?: Json
          name: string
          price_monthly_usd?: number | null
          price_yearly_usd?: number | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_monthly_usd?: number | null
          price_yearly_usd?: number | null
          sort_order?: number
        }
        Relationships: []
      }
      career_billing_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          company_id: string
          created_at: string
          current_period_end: string
          current_period_start: string
          grace_period_ends_at: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["career_subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          company_id: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          grace_period_ends_at?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["career_subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          company_id?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          grace_period_ends_at?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["career_subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_billing_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_billing_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "career_billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      career_consent_records: {
        Row: {
          consent_type: string
          granted: boolean
          granted_at: string
          id: string
          policy_version: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          granted: boolean
          granted_at?: string
          id?: string
          policy_version?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          granted?: boolean
          granted_at?: string
          id?: string
          policy_version?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      career_data_requests: {
        Row: {
          completed_at: string | null
          id: string
          notes: string | null
          request_type: Database["public"]["Enums"]["career_data_request_type"]
          requested_at: string
          result_url: string | null
          status: Database["public"]["Enums"]["career_data_request_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          request_type: Database["public"]["Enums"]["career_data_request_type"]
          requested_at?: string
          result_url?: string | null
          status?: Database["public"]["Enums"]["career_data_request_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          request_type?: Database["public"]["Enums"]["career_data_request_type"]
          requested_at?: string
          result_url?: string | null
          status?: Database["public"]["Enums"]["career_data_request_status"]
          user_id?: string
        }
        Relationships: []
      }
      career_encrypted_secrets: {
        Row: {
          ciphertext: string
          created_at: string
          id: string
          label: string
          owner_user_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          id?: string
          label: string
          owner_user_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          id?: string
          label?: string
          owner_user_id?: string
        }
        Relationships: []
      }
      career_error_log: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          service: string
          severity: string
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          service: string
          severity?: string
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          service?: string
          severity?: string
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      career_file_scan_results: {
        Row: {
          created_at: string
          details: Json
          id: string
          owner_user_id: string | null
          scan_status: string
          scanned_at: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          owner_user_id?: string | null
          scan_status?: string
          scanned_at?: string | null
          storage_bucket: string
          storage_path: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          owner_user_id?: string | null
          scan_status?: string
          scanned_at?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: []
      }
      career_goals: {
        Row: {
          created_at: string
          deadline: string | null
          estimated_completion: string | null
          id: string
          priority: string
          progress: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          estimated_completion?: string | null
          id?: string
          priority?: string
          progress?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          estimated_completion?: string | null
          id?: string
          priority?: string
          progress?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      career_known_devices: {
        Row: {
          device_fingerprint: string
          first_seen: string
          id: string
          ip_hash: string | null
          last_seen: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_fingerprint: string
          first_seen?: string
          id?: string
          ip_hash?: string | null
          last_seen?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_fingerprint?: string
          first_seen?: string
          id?: string
          ip_hash?: string | null
          last_seen?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      career_login_attempts: {
        Row: {
          created_at: string
          id: string
          identifier: string
          ip_hash: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          ip_hash?: string | null
          success: boolean
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          ip_hash?: string | null
          success?: boolean
        }
        Relationships: []
      }
      career_permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      career_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          followers_count: number
          following_count: number
          github_url: string | null
          headline: string | null
          id: string
          languages: string[]
          linkedin_url: string | null
          location: string | null
          portfolio_url: string | null
          resume_url: string | null
          skills: string[]
          updated_at: string
          user_id: string
          website_url: string | null
          years_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          followers_count?: number
          following_count?: number
          github_url?: string | null
          headline?: string | null
          id?: string
          languages?: string[]
          linkedin_url?: string | null
          location?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          skills?: string[]
          updated_at?: string
          user_id: string
          website_url?: string | null
          years_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          followers_count?: number
          following_count?: number
          github_url?: string | null
          headline?: string | null
          id?: string
          languages?: string[]
          linkedin_url?: string | null
          location?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          skills?: string[]
          updated_at?: string
          user_id?: string
          website_url?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      career_request_metrics: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          latency_ms: number
          method: string
          status_code: number
          trace_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          latency_ms: number
          method: string
          status_code: number
          trace_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          latency_ms?: number
          method?: string
          status_code?: number
          trace_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      career_role_permissions: {
        Row: {
          permission_id: string
          role: Database["public"]["Enums"]["career_role"]
        }
        Insert: {
          permission_id: string
          role: Database["public"]["Enums"]["career_role"]
        }
        Update: {
          permission_id?: string
          role?: Database["public"]["Enums"]["career_role"]
        }
        Relationships: [
          {
            foreignKeyName: "career_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "career_permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      career_security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      career_security_settings: {
        Row: {
          mfa_enforced: boolean
          session_timeout_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          mfa_enforced?: boolean
          session_timeout_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          mfa_enforced?: boolean
          session_timeout_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      career_system_health_checks: {
        Row: {
          checked_at: string
          component: string
          detail: string | null
          id: string
          status: string
        }
        Insert: {
          checked_at?: string
          component: string
          detail?: string | null
          id?: string
          status: string
        }
        Update: {
          checked_at?: string
          component?: string
          detail?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      career_usage_counters: {
        Row: {
          company_id: string
          count: number
          metric: string
          period_end: string
          period_start: string
        }
        Insert: {
          company_id: string
          count?: number
          metric: string
          period_end: string
          period_start: string
        }
        Update: {
          company_id?: string
          count?: number
          metric?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_usage_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      career_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["career_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["career_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["career_role"]
          user_id?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          created_at: string
          credential_id: string | null
          credential_url: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          title: string
          user_id: string
          verification_status: Database["public"]["Enums"]["career_verification_status"]
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          title: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["career_verification_status"]
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          title?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["career_verification_status"]
        }
        Relationships: []
      }
      communities: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          member_count: number
          name: string
          slug: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          member_count?: number
          name: string
          slug: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          member_count?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["community_member_role"]
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_member_role"]
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accessibility_rating: number | null
          created_at: string
          description: string | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          owner_user_id: string
          size: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          accessibility_rating?: number | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          owner_user_id: string
          size?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          accessibility_rating?: number | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          size?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      content_items: {
        Row: {
          category: string
          created_at: string | null
          description: string
          duration: number
          extra_label: string | null
          extra_value: number | null
          id: string
          level: string
          points: number
          published: boolean | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string
          duration?: number
          extra_label?: string | null
          extra_value?: number | null
          id?: string
          level?: string
          points?: number
          published?: boolean | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          duration?: number
          extra_label?: string | null
          extra_value?: number | null
          id?: string
          level?: string
          points?: number
          published?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_text: string | null
          participant_1: string
          participant_2: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          participant_1: string
          participant_2: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          participant_1?: string
          participant_2?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount_vx: number
          balance_after: number
          created_at: string
          description: string
          id: string
          idempotency_key: string | null
          job_id: string | null
          meta: Json | null
          operation_type: string | null
          project_id: string | null
          provider_slug: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_vx: number
          balance_after: number
          created_at?: string
          description: string
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          meta?: Json | null
          operation_type?: string | null
          project_id?: string | null
          provider_slug?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_vx?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          meta?: Json | null
          operation_type?: string | null
          project_id?: string | null
          provider_slug?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_wallets: {
        Row: {
          balance_vx: number
          lifetime_earned_vx: number
          lifetime_spent_vx: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_vx?: number
          lifetime_earned_vx?: number
          lifetime_spent_vx?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_vx?: number
          lifetime_earned_vx?: number
          lifetime_spent_vx?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          device_id: string | null
          id: string
          ip_address: string | null
          reason: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          reason: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          reason?: string
        }
        Relationships: []
      }
      device_fingerprints: {
        Row: {
          device_id: string
          first_seen_at: string
          id: string
          ip_address: string | null
          last_seen_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          device_id: string
          first_seen_at?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          device_id?: string
          first_seen_at?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      diet_plans: {
        Row: {
          calorie_goal: number
          created_at: string
          id: string
          plan: Json
          plan_name: string
          user_data: Json
          user_id: string
        }
        Insert: {
          calorie_goal?: number
          created_at?: string
          id?: string
          plan?: Json
          plan_name?: string
          user_data?: Json
          user_id: string
        }
        Update: {
          calorie_goal?: number
          created_at?: string
          id?: string
          plan?: Json
          plan_name?: string
          user_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          comment: string | null
          created_at: string
          destination_location: string | null
          driver_name: string
          id: string
          pickup_location: string | null
          rating: number
          service_type: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          destination_location?: string | null
          driver_name?: string
          id?: string
          pickup_location?: string | null
          rating: number
          service_type?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          destination_location?: string | null
          driver_name?: string
          id?: string
          pickup_location?: string | null
          rating?: number
          service_type?: string
          user_id?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          event_id: string
          id: string
          registered_at: string
          reminder_opt_in: boolean
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          registered_at?: string
          reminder_opt_in?: boolean
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          registered_at?: string
          reminder_opt_in?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["career_event_type"]
          id: string
          is_virtual: boolean
          location: string | null
          organizer_user_id: string
          registered_count: number
          starts_at: string
          title: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["career_event_type"]
          id?: string
          is_virtual?: boolean
          location?: string | null
          organizer_user_id: string
          registered_count?: number
          starts_at: string
          title: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["career_event_type"]
          id?: string
          is_virtual?: boolean
          location?: string | null
          organizer_user_id?: string
          registered_count?: number
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      finance_holdings: {
        Row: {
          asset_class: string
          avg_buy_price: number
          created_at: string
          currency: string
          id: string
          name: string
          portfolio_id: string
          quantity: number
          symbol: string
        }
        Insert: {
          asset_class?: string
          avg_buy_price?: number
          created_at?: string
          currency?: string
          id?: string
          name: string
          portfolio_id: string
          quantity?: number
          symbol: string
        }
        Update: {
          asset_class?: string
          avg_buy_price?: number
          created_at?: string
          currency?: string
          id?: string
          name?: string
          portfolio_id?: string
          quantity?: number
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "finance_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_portfolios: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_watchlist_items: {
        Row: {
          added_at: string
          alert_price: number | null
          asset_class: string
          id: string
          name: string
          note: string | null
          symbol: string
          watchlist_id: string
        }
        Insert: {
          added_at?: string
          alert_price?: number | null
          asset_class?: string
          id?: string
          name: string
          note?: string | null
          symbol: string
          watchlist_id: string
        }
        Update: {
          added_at?: string
          alert_price?: number | null
          asset_class?: string
          id?: string
          name?: string
          note?: string | null
          symbol?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "finance_watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      freelance_projects: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          client_user_id: string
          created_at: string
          description: string | null
          id: string
          status: Database["public"]["Enums"]["freelance_project_status"]
          title: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          client_user_id: string
          created_at?: string
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["freelance_project_status"]
          title: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          client_user_id?: string
          created_at?: string
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["freelance_project_status"]
          title?: string
        }
        Relationships: []
      }
      freelance_proposals: {
        Row: {
          cover_letter: string | null
          created_at: string
          freelancer_user_id: string
          id: string
          project_id: string
          proposed_rate: number | null
          status: Database["public"]["Enums"]["freelance_proposal_status"]
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          freelancer_user_id: string
          id?: string
          project_id: string
          proposed_rate?: number | null
          status?: Database["public"]["Enums"]["freelance_proposal_status"]
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          freelancer_user_id?: string
          id?: string
          project_id?: string
          proposed_rate?: number | null
          status?: Database["public"]["Enums"]["freelance_proposal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "freelance_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "freelance_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          created_at: string | null
          current_player_id: string | null
          expires_at: string | null
          game_state: Json | null
          game_type: string
          host_id: string | null
          id: string
          max_players: number
          players: Json
          status: string
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_player_id?: string | null
          expires_at?: string | null
          game_state?: Json | null
          game_type: string
          host_id?: string | null
          id: string
          max_players?: number
          players?: Json
          status?: string
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_player_id?: string | null
          expires_at?: string | null
          game_state?: Json | null
          game_type?: string
          host_id?: string | null
          id?: string
          max_players?: number
          players?: Json
          status?: string
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          accessibility_friendly: boolean
          applicant_count: number
          company_id: string
          created_at: string
          currency: string
          description: string
          experience_level: Database["public"]["Enums"]["career_experience_level"]
          external_ref: string | null
          id: string
          job_type: Database["public"]["Enums"]["career_job_type"]
          location: string | null
          optimization_score: number | null
          posted_by: string
          remote: boolean
          salary_max: number | null
          salary_min: number | null
          skills_required: string[]
          source: string
          status: Database["public"]["Enums"]["career_job_status"]
          title: string
          updated_at: string
          visa_sponsorship: boolean
        }
        Insert: {
          accessibility_friendly?: boolean
          applicant_count?: number
          company_id: string
          created_at?: string
          currency?: string
          description: string
          experience_level?: Database["public"]["Enums"]["career_experience_level"]
          external_ref?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["career_job_type"]
          location?: string | null
          optimization_score?: number | null
          posted_by: string
          remote?: boolean
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[]
          source?: string
          status?: Database["public"]["Enums"]["career_job_status"]
          title: string
          updated_at?: string
          visa_sponsorship?: boolean
        }
        Update: {
          accessibility_friendly?: boolean
          applicant_count?: number
          company_id?: string
          created_at?: string
          currency?: string
          description?: string
          experience_level?: Database["public"]["Enums"]["career_experience_level"]
          external_ref?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["career_job_type"]
          location?: string | null
          optimization_score?: number | null
          posted_by?: string
          remote?: boolean
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[]
          source?: string
          status?: Database["public"]["Enums"]["career_job_status"]
          title?: string
          updated_at?: string
          visa_sponsorship?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_logs: {
        Row: {
          calories: number
          created_at: string
          id: string
          ingredients: string[] | null
          logged_at: string
          meal_name: string
          meal_type: string
          rating: number | null
          user_id: string
        }
        Insert: {
          calories?: number
          created_at?: string
          id?: string
          ingredients?: string[] | null
          logged_at?: string
          meal_name: string
          meal_type?: string
          rating?: number | null
          user_id: string
        }
        Update: {
          calories?: number
          created_at?: string
          id?: string
          ingredients?: string[] | null
          logged_at?: string
          meal_name?: string
          meal_type?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      mentor_bookings: {
        Row: {
          booked_by: string
          created_at: string
          duration_minutes: number
          id: string
          mentor_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["mentor_booking_status"]
          video_session_url: string | null
        }
        Insert: {
          booked_by: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mentor_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["mentor_booking_status"]
          video_session_url?: string | null
        }
        Update: {
          booked_by?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mentor_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["mentor_booking_status"]
          video_session_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_bookings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentors: {
        Row: {
          bio: string | null
          created_at: string
          free_sessions_offered: number
          hourly_rate: number | null
          id: string
          is_active: boolean
          languages: string[]
          rating: number | null
          review_count: number
          specialties: string[]
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          free_sessions_offered?: number
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          languages?: string[]
          rating?: number | null
          review_count?: number
          specialties?: string[]
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          free_sessions_offered?: number
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          languages?: string[]
          rating?: number | null
          review_count?: number
          specialties?: string[]
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          is_ai_generated: boolean
          is_read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          is_read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          is_ai_generated?: boolean
          is_read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          category: string
          content: string | null
          created_at: string
          description: string
          icon_name: string
          id: string
          newsletter_sent: boolean
          published: boolean
          published_at: string | null
          title: string
          translations: Json | null
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          description: string
          icon_name?: string
          id?: string
          newsletter_sent?: boolean
          published?: boolean
          published_at?: string | null
          title: string
          translations?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          description?: string
          icon_name?: string
          id?: string
          newsletter_sent?: boolean
          published?: boolean
          published_at?: string | null
          title?: string
          translations?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          lang: string
          last_sent_date: string | null
          name: string | null
          subscribed_at: string | null
          topics: string[] | null
        }
        Insert: {
          email: string
          id?: string
          lang?: string
          last_sent_date?: string | null
          name?: string | null
          subscribed_at?: string | null
          topics?: string[] | null
        }
        Update: {
          email?: string
          id?: string
          lang?: string
          last_sent_date?: string | null
          name?: string | null
          subscribed_at?: string | null
          topics?: string[] | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          sent_by: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          sent_by?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          sent_by?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oasis_sessions: {
        Row: {
          completed_at: string
          duration_seconds: number
          id: string
          session_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          duration_seconds?: number
          id?: string
          session_type: string
          user_id: string
        }
        Update: {
          completed_at?: string
          duration_seconds?: number
          id?: string
          session_type?: string
          user_id?: string
        }
        Relationships: []
      }
      page_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page_path: string
          page_title: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path: string
          page_title?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string
          page_title?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ph_configs: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      ph_failovers: {
        Row: {
          created_at: string
          error_message: string | null
          from_provider_id: string | null
          from_slug: string | null
          id: string
          job_type: string | null
          reason: string | null
          resolved: boolean
          resolved_at: string | null
          to_provider_id: string | null
          to_slug: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          from_provider_id?: string | null
          from_slug?: string | null
          id?: string
          job_type?: string | null
          reason?: string | null
          resolved?: boolean
          resolved_at?: string | null
          to_provider_id?: string | null
          to_slug?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          from_provider_id?: string | null
          from_slug?: string | null
          id?: string
          job_type?: string | null
          reason?: string | null
          resolved?: boolean
          resolved_at?: string | null
          to_provider_id?: string | null
          to_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ph_failovers_from_provider_id_fkey"
            columns: ["from_provider_id"]
            isOneToOne: false
            referencedRelation: "ph_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ph_failovers_to_provider_id_fkey"
            columns: ["to_provider_id"]
            isOneToOne: false
            referencedRelation: "ph_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ph_logs: {
        Row: {
          action: string
          cost_usd: number | null
          created_at: string
          error_code: string | null
          error_message: string | null
          failover_to: string | null
          id: string
          job_type: string | null
          latency_ms: number | null
          provider_id: string | null
          provider_slug: string | null
          request_meta: Json | null
          retry_count: number | null
          status: string
        }
        Insert: {
          action: string
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failover_to?: string | null
          id?: string
          job_type?: string | null
          latency_ms?: number | null
          provider_id?: string | null
          provider_slug?: string | null
          request_meta?: Json | null
          retry_count?: number | null
          status: string
        }
        Update: {
          action?: string
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failover_to?: string | null
          id?: string
          job_type?: string | null
          latency_ms?: number | null
          provider_id?: string | null
          provider_slug?: string | null
          request_meta?: Json | null
          retry_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ph_logs_failover_to_fkey"
            columns: ["failover_to"]
            isOneToOne: false
            referencedRelation: "ph_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ph_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ph_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ph_metrics: {
        Row: {
          created_at: string
          failures: number
          id: string
          period_start: string
          provider_id: string
          requests: number
          successes: number
          total_cost_usd: number
          total_latency_ms: number
        }
        Insert: {
          created_at?: string
          failures?: number
          id?: string
          period_start: string
          provider_id: string
          requests?: number
          successes?: number
          total_cost_usd?: number
          total_latency_ms?: number
        }
        Update: {
          created_at?: string
          failures?: number
          id?: string
          period_start?: string
          provider_id?: string
          requests?: number
          successes?: number
          total_cost_usd?: number
          total_latency_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "ph_metrics_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ph_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ph_providers: {
        Row: {
          api_key_ref: string | null
          avg_latency_ms: number | null
          base_url: string | null
          capabilities: string[] | null
          config: Json
          consecutive_failures: number
          cost_limit_daily_usd: number | null
          cost_per_request: number | null
          created_at: string
          default_model: string | null
          health_score: number
          id: string
          is_system: boolean
          last_failure_at: string | null
          last_health_check: string | null
          max_rpm: number | null
          name: string
          priority: number
          regions: string[] | null
          slug: string
          status: string
          success_rate: number | null
          type: string
          updated_at: string
        }
        Insert: {
          api_key_ref?: string | null
          avg_latency_ms?: number | null
          base_url?: string | null
          capabilities?: string[] | null
          config?: Json
          consecutive_failures?: number
          cost_limit_daily_usd?: number | null
          cost_per_request?: number | null
          created_at?: string
          default_model?: string | null
          health_score?: number
          id?: string
          is_system?: boolean
          last_failure_at?: string | null
          last_health_check?: string | null
          max_rpm?: number | null
          name: string
          priority?: number
          regions?: string[] | null
          slug: string
          status?: string
          success_rate?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          api_key_ref?: string | null
          avg_latency_ms?: number | null
          base_url?: string | null
          capabilities?: string[] | null
          config?: Json
          consecutive_failures?: number
          cost_limit_daily_usd?: number | null
          cost_per_request?: number | null
          created_at?: string
          default_model?: string | null
          health_score?: number
          id?: string
          is_system?: boolean
          last_failure_at?: string | null
          last_health_check?: string | null
          max_rpm?: number | null
          name?: string
          priority?: number
          regions?: string[] | null
          slug?: string
          status?: string
          success_rate?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          image: string | null
          in_stock: boolean | null
          name: string
          points: number
          price: number
          rating: number | null
          store_type: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          image?: string | null
          in_stock?: boolean | null
          name: string
          points?: number
          price?: number
          rating?: number | null
          store_type?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          image?: string | null
          in_stock?: boolean | null
          name?: string
          points?: number
          price?: number
          rating?: number | null
          store_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          is_verified: boolean
          last_login_at: string | null
          status: string
          suspended_until: string | null
          trial_billing_processed_at: string | null
          trial_billing_warned_at: string | null
          trial_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          is_verified?: boolean
          last_login_at?: string | null
          status?: string
          suspended_until?: string | null
          trial_billing_processed_at?: string | null
          trial_billing_warned_at?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          is_verified?: boolean
          last_login_at?: string | null
          status?: string
          suspended_until?: string | null
          trial_billing_processed_at?: string | null
          trial_billing_warned_at?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      queue_jobs: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          locked_at: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      radio_genres: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          name_ar: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          name_ar: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          name_ar?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      radio_stations: {
        Row: {
          bitrate: string
          country: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          genre_id: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          language: string
          logo_url: string | null
          name: string
          name_ar: string
          official_url: string | null
          sort_order: number
          stream_url: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          bitrate?: string
          country?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          genre_id?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          language?: string
          logo_url?: string | null
          name: string
          name_ar: string
          official_url?: string | null
          sort_order?: number
          stream_url: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          bitrate?: string
          country?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          genre_id?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          language?: string
          logo_url?: string | null
          name?: string
          name_ar?: string
          official_url?: string | null
          sort_order?: number
          stream_url?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_stations_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "radio_genres"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_stream_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          station_id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          station_id: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          station_id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_stream_tokens_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "radio_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_stream_tokens_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "radio_stations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_subscription_plans: {
        Row: {
          created_at: string
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          name: string
          name_ar: string
          sort_order: number
          vx_price: number
        }
        Insert: {
          created_at?: string
          duration_days: number
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          name_ar: string
          sort_order?: number
          vx_price: number
        }
        Update: {
          created_at?: string
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string
          sort_order?: number
          vx_price?: number
        }
        Relationships: []
      }
      radio_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          plan_id: string
          started_at: string
          status: string
          user_id: string
          vx_paid: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          user_id: string
          vx_paid: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          user_id?: string
          vx_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "radio_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "radio_subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          target_id: string
          target_type: Database["public"]["Enums"]["review_target_type"]
        }
        Insert: {
          author_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          target_id: string
          target_type: Database["public"]["Enums"]["review_target_type"]
        }
        Update: {
          author_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          target_id?: string
          target_type?: Database["public"]["Enums"]["review_target_type"]
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          phone: string | null
          service_type: string
          status: string
          user_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          phone?: string | null
          service_type: string
          status?: string
          user_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string | null
          service_type?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      simulation_progress: {
        Row: {
          completed: boolean
          created_at: string
          current_step: number
          decisions: Json
          id: string
          paid_seconds: number
          score: number
          simulation_id: string
          updated_at: string
          usage_seconds: number
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_step?: number
          decisions?: Json
          id?: string
          paid_seconds?: number
          score?: number
          simulation_id: string
          updated_at?: string
          usage_seconds?: number
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_step?: number
          decisions?: Json
          id?: string
          paid_seconds?: number
          score?: number
          simulation_id?: string
          updated_at?: string
          usage_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_progress_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          created_at: string | null
          description: string
          difficulty: string
          estimated_duration: number
          id: string
          points: number
          published: boolean
          slug: string
          sort_order: number
          subcategory: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string
          difficulty?: string
          estimated_duration?: number
          id?: string
          points?: number
          published?: boolean
          slug: string
          sort_order?: number
          subcategory?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          difficulty?: string
          estimated_duration?: number
          id?: string
          points?: number
          published?: boolean
          slug?: string
          sort_order?: number
          subcategory?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tool_purchases: {
        Row: {
          created_at: string
          id: string
          points_spent: number
          tool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_spent?: number
          tool_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_spent?: number
          tool_id?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_status: {
        Row: {
          created_at: string
          ends_at: string
          expired_at: string | null
          is_active: boolean
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string
          expired_at?: string | null
          is_active?: boolean
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          expired_at?: string | null
          is_active?: boolean
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tv_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          name_ar: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          name_ar: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          name_ar?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      tv_channels: {
        Row: {
          category_id: string | null
          country: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          language: string
          logo_url: string | null
          name: string
          name_ar: string
          official_url: string | null
          quality: string
          sort_order: number
          stream_url: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          language?: string
          logo_url?: string | null
          name: string
          name_ar: string
          official_url?: string | null
          quality?: string
          sort_order?: number
          stream_url: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          language?: string
          logo_url?: string | null
          name?: string
          name_ar?: string
          official_url?: string | null
          quality?: string
          sort_order?: number
          stream_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tv_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_favorites: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_favorites_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_favorites_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_stream_sources: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_checked_at: string | null
          priority: number
          reliability: number
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_checked_at?: string | null
          priority?: number
          reliability?: number
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_checked_at?: string | null
          priority?: number
          reliability?: number
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_stream_sources_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_stream_sources_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_stream_tokens: {
        Row: {
          channel_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_stream_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_stream_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_subscription_plans: {
        Row: {
          created_at: string
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          name: string
          name_ar: string
          sort_order: number
          vx_price: number
        }
        Insert: {
          created_at?: string
          duration_days: number
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          name_ar: string
          sort_order?: number
          vx_price: number
        }
        Update: {
          created_at?: string
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string
          sort_order?: number
          vx_price?: number
        }
        Relationships: []
      }
      tv_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          plan_id: string
          started_at: string
          status: string
          user_id: string
          vx_paid: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          user_id: string
          vx_paid: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          user_id?: string
          vx_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "tv_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "tv_subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_user_playlists: {
        Row: {
          channel_count: number
          created_at: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          source_url: string | null
          type: string
          updated_at: string
          user_id: string
          xtream_host: string | null
          xtream_pass: string | null
          xtream_user: string | null
        }
        Insert: {
          channel_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          source_url?: string | null
          type?: string
          updated_at?: string
          user_id: string
          xtream_host?: string | null
          xtream_pass?: string | null
          xtream_user?: string | null
        }
        Update: {
          channel_count?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          source_url?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          xtream_host?: string | null
          xtream_pass?: string | null
          xtream_user?: string | null
        }
        Relationships: []
      }
      tv_watch_stats: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          session_date: string
          updated_at: string
          user_id: string
          watch_duration: number
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          session_date?: string
          updated_at?: string
          user_id: string
          watch_duration?: number
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          session_date?: string
          updated_at?: string
          user_id?: string
          watch_duration?: number
        }
        Relationships: [
          {
            foreignKeyName: "tv_watch_stats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tv_watch_stats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          billing_mode: string
          created_at: string
          credits_used: number
          id: string
          job_id: string | null
          meta: Json | null
          operation_type: string
          plan_id: string | null
          project_id: string | null
          provider_slug: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          billing_mode?: string
          created_at?: string
          credits_used?: number
          id?: string
          job_id?: string | null
          meta?: Json | null
          operation_type: string
          plan_id?: string | null
          project_id?: string | null
          provider_slug?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          billing_mode?: string
          created_at?: string
          credits_used?: number
          id?: string
          job_id?: string | null
          meta?: Json | null
          operation_type?: string
          plan_id?: string | null
          project_id?: string | null
          provider_slug?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_features: {
        Row: {
          enabled: boolean
          feature_key: string
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          ends_at: string | null
          external_sub_id: string | null
          id: string
          next_renewal_at: string | null
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
          vx_credits_remaining: number
          vx_reset_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          external_sub_id?: string | null
          id?: string
          next_renewal_at?: string | null
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
          vx_credits_remaining?: number
          vx_reset_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string | null
          external_sub_id?: string | null
          id?: string
          next_renewal_at?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          vx_credits_remaining?: number
          vx_reset_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      users_billing: {
        Row: {
          active_plan_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          is_in_trial: boolean
          last_operation_at: string | null
          total_credits_spent: number
          total_operations: number
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_plan_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          is_in_trial?: boolean
          last_operation_at?: string | null
          total_credits_spent?: number
          total_operations?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_plan_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          is_in_trial?: boolean
          last_operation_at?: string | null
          total_credits_spent?: number
          total_operations?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_room_ai_purchases: {
        Row: {
          price_vx: number
          purchased_at: string
          source: string
          user_id: string
        }
        Insert: {
          price_vx?: number
          purchased_at?: string
          source?: string
          user_id: string
        }
        Update: {
          price_vx?: number
          purchased_at?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_room_bans: {
        Row: {
          banned_by: string
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_room_bans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_room_members: {
        Row: {
          id: string
          is_listener: boolean
          is_on_stage: boolean
          joined_at: string
          last_seen_at: string
          raise_hand: boolean
          raised_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_listener?: boolean
          is_on_stage?: boolean
          joined_at?: string
          last_seen_at?: string
          raise_hand?: boolean
          raised_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_listener?: boolean
          is_on_stage?: boolean
          joined_at?: string
          last_seen_at?: string
          raise_hand?: boolean
          raised_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_rooms: {
        Row: {
          allow_camera: boolean
          allow_chat: boolean
          allow_mic: boolean
          allow_screen_share: boolean
          cost_vx: number
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          is_private: boolean
          join_cost_vx: number
          max_users: number
          owner_id: string | null
          room_mode: string | null
          room_name: string
          room_password: string | null
          room_topic: string | null
          room_type: string
          scheduled_at: string | null
          updated_at: string
        }
        Insert: {
          allow_camera?: boolean
          allow_chat?: boolean
          allow_mic?: boolean
          allow_screen_share?: boolean
          cost_vx?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_private?: boolean
          join_cost_vx?: number
          max_users?: number
          owner_id?: string | null
          room_mode?: string | null
          room_name?: string
          room_password?: string | null
          room_topic?: string | null
          room_type?: string
          scheduled_at?: string | null
          updated_at?: string
        }
        Update: {
          allow_camera?: boolean
          allow_chat?: boolean
          allow_mic?: boolean
          allow_screen_share?: boolean
          cost_vx?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_private?: boolean
          join_cost_vx?: number
          max_users?: number
          owner_id?: string | null
          room_mode?: string | null
          room_name?: string
          room_password?: string | null
          room_topic?: string | null
          room_type?: string
          scheduled_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vs_training_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          estimated_duration_sec: number | null
          id: string
          profile_id: string
          progress: number
          provider: string
          provider_job_id: string | null
          provider_voice_id: string | null
          retry_count: number
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          estimated_duration_sec?: number | null
          id?: string
          profile_id: string
          progress?: number
          provider?: string
          provider_job_id?: string | null
          provider_voice_id?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          estimated_duration_sec?: number | null
          id?: string
          profile_id?: string
          progress?: number
          provider?: string
          provider_job_id?: string | null
          provider_voice_id?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vs_training_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vs_voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vs_training_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          level?: string
          message: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vs_training_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "vs_training_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      vs_voice_datasets: {
        Row: {
          channels: number | null
          clarity_score: number | null
          created_at: string
          duration_sec: number | null
          file_size_bytes: number
          filename: string
          id: string
          is_valid: boolean | null
          mime_type: string
          noise_level: number | null
          profile_id: string
          quality_score: number | null
          rejection_reason: string | null
          sample_rate: number | null
          snr_db: number | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          channels?: number | null
          clarity_score?: number | null
          created_at?: string
          duration_sec?: number | null
          file_size_bytes?: number
          filename: string
          id?: string
          is_valid?: boolean | null
          mime_type?: string
          noise_level?: number | null
          profile_id: string
          quality_score?: number | null
          rejection_reason?: string | null
          sample_rate?: number | null
          snr_db?: number | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          channels?: number | null
          clarity_score?: number | null
          created_at?: string
          duration_sec?: number | null
          file_size_bytes?: number
          filename?: string
          id?: string
          is_valid?: boolean | null
          mime_type?: string
          noise_level?: number | null
          profile_id?: string
          quality_score?: number | null
          rejection_reason?: string | null
          sample_rate?: number | null
          snr_db?: number | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vs_voice_datasets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vs_voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vs_voice_profiles: {
        Row: {
          accent: string | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          is_favorite: boolean
          is_shared: boolean
          language: string
          name: string
          preview_asset_id: string | null
          project_id: string | null
          provider: string
          provider_model: string | null
          provider_voice_id: string | null
          quality_score: number | null
          sample_count: number
          status: string
          tags: string[]
          thumbnail_url: string | null
          total_duration_sec: number | null
          training_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_favorite?: boolean
          is_shared?: boolean
          language?: string
          name: string
          preview_asset_id?: string | null
          project_id?: string | null
          provider?: string
          provider_model?: string | null
          provider_voice_id?: string | null
          quality_score?: number | null
          sample_count?: number
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          total_duration_sec?: number | null
          training_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_favorite?: boolean
          is_shared?: boolean
          language?: string
          name?: string
          preview_asset_id?: string | null
          project_id?: string | null
          provider?: string
          provider_model?: string | null
          provider_voice_id?: string | null
          quality_score?: number | null
          sample_count?: number
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          total_duration_sec?: number | null
          training_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vs_voice_profiles_preview_asset_id_fkey"
            columns: ["preview_asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vs_voice_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vx_coin_orders: {
        Row: {
          admin_notes: string | null
          coins: number
          created_at: string
          fee_usd: number
          id: string
          payment_method: string
          price_usd: number
          proof_url: string | null
          reference_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_usd: number
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          coins: number
          created_at?: string
          fee_usd: number
          id?: string
          payment_method: string
          price_usd: number
          proof_url?: string | null
          reference_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_usd: number
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          coins?: number
          created_at?: string
          fee_usd?: number
          id?: string
          payment_method?: string
          price_usd?: number
          proof_url?: string | null
          reference_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_usd?: number
          user_id?: string
        }
        Relationships: []
      }
      vx_purchases: {
        Row: {
          amount: number
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          item_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          item_type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      vx_video_jobs: {
        Row: {
          aspect_ratio: string
          asset_id: string | null
          audio_asset_id: string | null
          audio_mode: string | null
          camera_motion: string | null
          completed_at: string | null
          created_at: string
          creativity: number
          duration_actual_sec: number | null
          duration_sec: number
          error_message: string | null
          estimated_complete: string | null
          file_size_bytes: number | null
          fps: number
          generation_time_ms: number | null
          height: number | null
          id: string
          is_archived: boolean
          is_favorite: boolean
          negative_prompt: string | null
          progress: number
          project_id: string | null
          prompt: string
          provider: string
          provider_job_id: string | null
          provider_model: string | null
          resolution: string
          retry_count: number
          seed: number | null
          started_at: string | null
          status: string
          storage_path: string | null
          style: string
          template_id: string | null
          thumbnail_path: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          width: number | null
        }
        Insert: {
          aspect_ratio?: string
          asset_id?: string | null
          audio_asset_id?: string | null
          audio_mode?: string | null
          camera_motion?: string | null
          completed_at?: string | null
          created_at?: string
          creativity?: number
          duration_actual_sec?: number | null
          duration_sec?: number
          error_message?: string | null
          estimated_complete?: string | null
          file_size_bytes?: number | null
          fps?: number
          generation_time_ms?: number | null
          height?: number | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          negative_prompt?: string | null
          progress?: number
          project_id?: string | null
          prompt: string
          provider?: string
          provider_job_id?: string | null
          provider_model?: string | null
          resolution?: string
          retry_count?: number
          seed?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          style?: string
          template_id?: string | null
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          width?: number | null
        }
        Update: {
          aspect_ratio?: string
          asset_id?: string | null
          audio_asset_id?: string | null
          audio_mode?: string | null
          camera_motion?: string | null
          completed_at?: string | null
          created_at?: string
          creativity?: number
          duration_actual_sec?: number | null
          duration_sec?: number
          error_message?: string | null
          estimated_complete?: string | null
          file_size_bytes?: number | null
          fps?: number
          generation_time_ms?: number | null
          height?: number | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          negative_prompt?: string | null
          progress?: number
          project_id?: string | null
          prompt?: string
          provider?: string
          provider_job_id?: string | null
          provider_model?: string | null
          resolution?: string
          retry_count?: number
          seed?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          style?: string
          template_id?: string | null
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vx_jobs_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vx_video_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vx_video_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vx_video_jobs_audio_asset_id_fkey"
            columns: ["audio_asset_id"]
            isOneToOne: false
            referencedRelation: "ams_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vx_video_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ams_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vx_video_templates: {
        Row: {
          aspect_ratio: string
          camera_motion: string | null
          created_at: string
          creativity: number
          description: string | null
          duration_sec: number
          fps: number
          id: string
          is_favorite: boolean
          name: string
          negative_prompt: string | null
          prompt_template: string
          provider: string
          provider_model: string | null
          resolution: string
          style: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          camera_motion?: string | null
          created_at?: string
          creativity?: number
          description?: string | null
          duration_sec?: number
          fps?: number
          id?: string
          is_favorite?: boolean
          name: string
          negative_prompt?: string | null
          prompt_template: string
          provider?: string
          provider_model?: string | null
          resolution?: string
          style?: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          camera_motion?: string | null
          created_at?: string
          creativity?: number
          description?: string | null
          duration_sec?: number
          fps?: number
          id?: string
          is_favorite?: boolean
          name?: string
          negative_prompt?: string | null
          prompt_template?: string
          provider?: string
          provider_model?: string | null
          resolution?: string
          style?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      radio_stations_public: {
        Row: {
          bitrate: string | null
          country: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          genre_id: string | null
          id: string | null
          is_active: boolean | null
          is_featured: boolean | null
          language: string | null
          logo_url: string | null
          name: string | null
          name_ar: string | null
          official_url: string | null
          sort_order: number | null
          website_url: string | null
        }
        Insert: {
          bitrate?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          genre_id?: string | null
          id?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          language?: string | null
          logo_url?: string | null
          name?: string | null
          name_ar?: string | null
          official_url?: string | null
          sort_order?: number | null
          website_url?: string | null
        }
        Update: {
          bitrate?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          genre_id?: string | null
          id?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          language?: string | null
          logo_url?: string | null
          name?: string | null
          name_ar?: string | null
          official_url?: string | null
          sort_order?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_stations_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "radio_genres"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_channels_public: {
        Row: {
          category_id: string | null
          country: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          id: string | null
          is_active: boolean | null
          is_featured: boolean | null
          language: string | null
          logo_url: string | null
          name: string | null
          name_ar: string | null
          official_url: string | null
          quality: string | null
          sort_order: number | null
        }
        Insert: {
          category_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          language?: string | null
          logo_url?: string | null
          name?: string | null
          name_ar?: string | null
          official_url?: string | null
          quality?: string | null
          sort_order?: number | null
        }
        Update: {
          category_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          language?: string | null
          logo_url?: string | null
          name?: string | null
          name_ar?: string | null
          official_url?: string | null
          quality?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tv_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_voice_room_ai: { Args: never; Returns: Json }
      admin_adjust_vx: {
        Args: { p_email: string; p_points: number; p_reason?: string }
        Returns: Json
      }
      admin_give_vx: {
        Args: { _amount: number; _reason?: string; _target_user_id: string }
        Returns: Json
      }
      admin_grant_points: {
        Args: { _points: number; _reason: string; _user_id: string }
        Returns: undefined
      }
      ams_log_activity: {
        Args: {
          p_action: string
          p_asset_id: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
          p_project_id: string
        }
        Returns: undefined
      }
      ams_recalculate_storage: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
      ams_record_voice_usage: {
        Args: { p_voice_id: string }
        Returns: undefined
      }
      approve_vx_coin_order: {
        Args: { _admin_notes?: string; _order_id: string }
        Returns: {
          admin_notes: string | null
          coins: number
          created_at: string
          fee_usd: number
          id: string
          payment_method: string
          price_usd: number
          proof_url: string | null
          reference_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_usd: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vx_coin_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_academy_xp: {
        Args: { _amount: number; _reason: string }
        Returns: undefined
      }
      award_achievement: {
        Args: { _achievement_key: string }
        Returns: undefined
      }
      award_points: {
        Args: { _points: number; _reason: string }
        Returns: undefined
      }
      ban_device: {
        Args: { _device_id: string; _ip?: string; _reason: string }
        Returns: undefined
      }
      ban_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      billing_consume: {
        Args: {
          p_idempotency_key?: string
          p_job_id?: string
          p_meta?: Json
          p_operation_type: string
          p_project_id?: string
          p_provider_slug?: string
          p_user_id: string
        }
        Returns: Json
      }
      billing_get_status: { Args: { p_user_id: string }; Returns: Json }
      billing_grant_credits: {
        Args: {
          p_amount_vx: number
          p_description?: string
          p_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      billing_initialize_user: {
        Args: { p_email?: string; p_user_id: string }
        Returns: Json
      }
      billing_refund: {
        Args: { p_job_id: string; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      career_decrypt: {
        Args: { _ciphertext: string; _key: string }
        Returns: string
      }
      career_encrypt: {
        Args: { _key: string; _plaintext: string }
        Returns: string
      }
      check_ai_rate_limit: {
        Args: { _function_name: string; _user_id: string }
        Returns: boolean
      }
      check_career_usage_allowed: {
        Args: { _company_id: string; _metric: string }
        Returns: boolean
      }
      claim_queue_jobs: {
        Args: { _job_type: string; _limit?: number }
        Returns: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          locked_at: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "queue_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_tv_data: {
        Args: never
        Returns: {
          deleted_watch_rows: number
        }[]
      }
      cleanup_stale_voice_rooms: {
        Args: { p_stale_after?: string }
        Returns: undefined
      }
      cleanup_voice_room: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: undefined
      }
      create_bazaar_cash_order: {
        Args: {
          _buyer_id: string
          _buyer_note?: string
          _items: Json
          _shop_id: string
        }
        Returns: Json
      }
      create_bazaar_vx_order: {
        Args: { _buyer_note?: string; _items: Json; _shop_id: string }
        Returns: string
      }
      create_vx_coin_order: {
        Args: {
          _coins: number
          _payment_method: string
          _proof_url?: string
          _reference_code: string
        }
        Returns: {
          admin_notes: string | null
          coins: number
          created_at: string
          fee_usd: number
          id: string
          payment_method: string
          price_usd: number
          proof_url: string | null
          reference_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_usd: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vx_coin_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      device_trial_used: { Args: { _device_id: string }; Returns: boolean }
      finalize_bazaar_cash_order: {
        Args: {
          _checkout_session_id: string
          _order_id: string
          _payment_intent_id: string
        }
        Returns: undefined
      }
      generate_radio_stream_token: {
        Args: { _station_id: string }
        Returns: Json
      }
      generate_stream_token: { Args: { _channel_id: string }; Returns: Json }
      get_active_radio_subscription: {
        Args: never
        Returns: {
          expires_at: string
          plan_name: string
          plan_name_ar: string
          started_at: string
          status: string
          sub_id: string
          vx_paid: number
        }[]
      }
      get_active_tv_subscription: {
        Args: never
        Returns: {
          expires_at: string
          plan_name: string
          plan_name_ar: string
          started_at: string
          status: string
          sub_id: string
          vx_paid: number
        }[]
      }
      get_career_admin_overview: { Args: never; Returns: Json }
      get_career_ai_usage_analytics: {
        Args: { _end: string; _start: string }
        Returns: {
          avg_latency_ms: number
          cache_hit_rate: number
          calls: number
          service: string
        }[]
      }
      get_career_conversion_rate: { Args: never; Returns: number }
      get_career_geographic_distribution: {
        Args: never
        Returns: {
          candidate_count: number
          location: string
        }[]
      }
      get_career_job_posting_trends: {
        Args: { _end: string; _start: string }
        Returns: {
          day: string
          jobs_posted: number
        }[]
      }
      get_career_retention_rate: { Args: never; Returns: number }
      get_career_revenue_analytics: {
        Args: { _end: string; _start: string }
        Returns: {
          day: string
          invoice_count: number
          revenue_cents: number
        }[]
      }
      get_career_security_alerts: {
        Args: { _limit?: number }
        Returns: {
          alert_type: string
          description: string
          occurred_at: string
          severity: string
          user_id: string
        }[]
      }
      get_career_user_growth: {
        Args: { _end: string; _start: string }
        Returns: {
          day: string
          new_candidates: number
          new_employers: number
        }[]
      }
      get_leaderboard: {
        Args: { result_limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          rank: number
          total_points: number
          user_id: string
        }[]
      }
      get_my_voice_room_ids: { Args: never; Returns: string[] }
      get_tv_favorites: {
        Args: never
        Returns: {
          channel_id: string
          created_at: string
        }[]
      }
      get_tv_recommendations: {
        Args: { _limit?: number }
        Returns: {
          channel_id: string
          reason: string
          total_watch_seconds: number
        }[]
      }
      get_tv_trending: {
        Args: { _limit?: number }
        Returns: {
          channel_id: string
          total_watch_time: number
          unique_viewers: number
        }[]
      }
      has_any_career_role: { Args: { _user_id: string }; Returns: boolean }
      has_career_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_career_role: {
        Args: {
          _role: Database["public"]["Enums"]["career_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_career_usage: {
        Args: { _amount?: number; _company_id: string; _metric: string }
        Returns: number
      }
      is_academy_course_owner: {
        Args: { _course_id: string }
        Returns: boolean
      }
      is_academy_course_published: {
        Args: { _course_id: string }
        Returns: boolean
      }
      is_career_login_blocked: {
        Args: { _identifier: string }
        Returns: boolean
      }
      is_device_banned: {
        Args: { _device_id: string; _ip?: string }
        Returns: boolean
      }
      is_enrolled_in_academy_course: {
        Args: { _course_id: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          _action: string
          _details?: Json
          _target_id?: string
          _target_type?: string
        }
        Returns: undefined
      }
      log_career_security_event: {
        Args: {
          _event_type: string
          _ip_hash?: string
          _metadata?: Json
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      match_embeddings: {
        Args: {
          filter_source?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          similarity: number
          source_id: string
          source_table: string
        }[]
      }
      maybe_revoke_trial: {
        Args: { _device_id: string; _user_id: string }
        Returns: undefined
      }
      notify_self: {
        Args: { _body: string; _title: string; _type?: string }
        Returns: undefined
      }
      ph_get_provider_stats: {
        Args: { p_hours?: number; p_provider_id: string }
        Returns: Json
      }
      ph_record_metric: {
        Args: {
          p_cost_usd?: number
          p_latency_ms: number
          p_provider_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      radio_cleanup_expired: { Args: never; Returns: undefined }
      record_career_login_attempt: {
        Args: { _identifier: string; _ip_hash?: string; _success: boolean }
        Returns: undefined
      }
      record_device_fingerprint: {
        Args: { _device_id: string; _user_agent?: string; _user_id: string }
        Returns: undefined
      }
      record_tv_watch: {
        Args: { _channel_id: string; _seconds: number }
        Returns: undefined
      }
      reject_vx_coin_order: {
        Args: { _admin_notes?: string; _order_id: string }
        Returns: {
          admin_notes: string | null
          coins: number
          created_at: string
          fee_usd: number
          id: string
          payment_method: string
          price_usd: number
          proof_url: string | null
          reference_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_usd: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vx_coin_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_bazaar_cash_order: {
        Args: { _order_id: string }
        Returns: undefined
      }
      spend_vx: {
        Args: {
          _amount: number
          _item_id?: string
          _item_name?: string
          _item_type: string
        }
        Returns: boolean
      }
      subscribe_radio: { Args: { _plan_id: string }; Returns: Json }
      subscribe_tv: { Args: { _plan_id: string }; Returns: Json }
      suspend_user: {
        Args: { _reason: string; _until: string; _user_id: string }
        Returns: undefined
      }
      system_deduct_vx: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: boolean
      }
      system_insert_notification: {
        Args: {
          _body: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: undefined
      }
      toggle_tv_favorite: { Args: { _channel_id: string }; Returns: Json }
      toggle_user_feature: {
        Args: { _enabled: boolean; _feature_key: string; _user_id: string }
        Returns: undefined
      }
      tv_cleanup_expired: { Args: never; Returns: undefined }
      unban_device: { Args: { _device_id: string }; Returns: undefined }
      unban_user: { Args: { _user_id: string }; Returns: undefined }
      update_source_reliability: {
        Args: { _reliability: number; _source_id: string }
        Returns: undefined
      }
      vs_log_training: {
        Args: {
          p_job_id: string
          p_level: string
          p_message: string
          p_meta?: Json
        }
        Returns: undefined
      }
      vs_sync_profile_stats: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      vx_use_template: { Args: { p_template_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      career_application_status:
        | "applied"
        | "reviewing"
        | "interview"
        | "offer"
        | "accepted"
        | "rejected"
        | "withdrawn"
      career_data_request_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
      career_data_request_type: "export" | "deletion"
      career_event_type:
        | "career_fair"
        | "webinar"
        | "workshop"
        | "hackathon"
        | "networking"
        | "university"
        | "virtual"
      career_experience_level: "entry" | "mid" | "senior" | "lead"
      career_invoice_status: "paid" | "open" | "void" | "uncollectible"
      career_job_status: "draft" | "active" | "paused" | "closed"
      career_job_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "temporary"
        | "internship"
        | "freelance"
      career_role: "candidate" | "employer" | "mentor" | "freelancer"
      career_subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      career_verification_status: "unverified" | "pending" | "verified"
      community_member_role: "member" | "moderator" | "admin"
      freelance_project_status:
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
      freelance_proposal_status:
        | "submitted"
        | "accepted"
        | "rejected"
        | "withdrawn"
      mentor_booking_status:
        | "requested"
        | "confirmed"
        | "completed"
        | "cancelled"
      review_target_type: "mentor" | "company" | "freelancer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
      career_application_status: [
        "applied",
        "reviewing",
        "interview",
        "offer",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      career_data_request_status: [
        "pending",
        "processing",
        "completed",
        "failed",
      ],
      career_data_request_type: ["export", "deletion"],
      career_event_type: [
        "career_fair",
        "webinar",
        "workshop",
        "hackathon",
        "networking",
        "university",
        "virtual",
      ],
      career_experience_level: ["entry", "mid", "senior", "lead"],
      career_invoice_status: ["paid", "open", "void", "uncollectible"],
      career_job_status: ["draft", "active", "paused", "closed"],
      career_job_type: [
        "full_time",
        "part_time",
        "contract",
        "temporary",
        "internship",
        "freelance",
      ],
      career_role: ["candidate", "employer", "mentor", "freelancer"],
      career_subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      career_verification_status: ["unverified", "pending", "verified"],
      community_member_role: ["member", "moderator", "admin"],
      freelance_project_status: [
        "open",
        "in_progress",
        "completed",
        "cancelled",
      ],
      freelance_proposal_status: [
        "submitted",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      mentor_booking_status: [
        "requested",
        "confirmed",
        "completed",
        "cancelled",
      ],
      review_target_type: ["mentor", "company", "freelancer"],
    },
  },
} as const
