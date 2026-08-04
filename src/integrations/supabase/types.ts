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
          owner_id?: string
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
          owner_id?: string
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
          owner_id?: string
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
          user_id?: string
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
          user_id?: string
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
          user_id?: string
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
      arcade_achievement_definitions: {
        Row: {
          active: boolean
          badge_asset_id: string | null
          category: string
          description: string
          key: string
          title: string
          xp_reward: number
        }
        Insert: {
          active?: boolean
          badge_asset_id?: string | null
          category: string
          description: string
          key: string
          title: string
          xp_reward?: number
        }
        Update: {
          active?: boolean
          badge_asset_id?: string | null
          category?: string
          description?: string
          key?: string
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      arcade_ai_reports: {
        Row: {
          created_at: string
          explanation: string
          game_id: string | null
          id: number
          report_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          risk_score: number | null
          signals: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          explanation: string
          game_id?: string | null
          id?: never
          report_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number | null
          signals?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          explanation?: string
          game_id?: string | null
          id?: never
          report_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number | null
          signals?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      arcade_backup_runs: {
        Row: {
          backup_type: string
          checksum: string | null
          completed_at: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          provider_ref: string
          size_bytes: number | null
          started_at: string
          status: string
        }
        Insert: {
          backup_type: string
          checksum?: string | null
          completed_at?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          provider_ref: string
          size_bytes?: number | null
          started_at?: string
          status: string
        }
        Update: {
          backup_type?: string
          checksum?: string | null
          completed_at?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          provider_ref?: string
          size_bytes?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      arcade_challenge_progress: {
        Row: {
          challenge_id: string
          claimed_at: string | null
          completed_at: string | null
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          claimed_at?: string | null
          completed_at?: string | null
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "arcade_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_challenges: {
        Row: {
          active: boolean
          code: string
          description: string
          ends_at: string
          id: string
          metric: string
          period: string
          starts_at: string
          target: number
          title: string
          xp_reward: number
        }
        Insert: {
          active?: boolean
          code: string
          description: string
          ends_at: string
          id?: string
          metric: string
          period: string
          starts_at: string
          target: number
          title: string
          xp_reward?: number
        }
        Update: {
          active?: boolean
          code?: string
          description?: string
          ends_at?: string
          id?: string
          metric?: string
          period?: string
          starts_at?: string
          target?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      arcade_daily_login: {
        Row: {
          cycle_started_on: string | null
          last_claim_date: string | null
          streak_day: number
          total_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cycle_started_on?: string | null
          last_claim_date?: string | null
          streak_day?: number
          total_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cycle_started_on?: string | null
          last_claim_date?: string | null
          streak_day?: number
          total_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      arcade_economy_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          request_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          request_id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          request_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      arcade_game_scores: {
        Row: {
          completed: boolean
          duration_seconds: number
          game_id: string
          id: string
          recorded_at: string
          result: string
          score: number
          session_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          duration_seconds?: number
          game_id: string
          id?: string
          recorded_at?: string
          result: string
          score?: number
          session_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          duration_seconds?: number
          game_id?: string
          id?: string
          recorded_at?: string
          result?: string
          score?: number
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      arcade_gamer_profiles: {
        Row: {
          avatar_url: string | null
          best_win_streak: number
          created_at: string
          current_win_streak: number
          favorite_game_ids: string[]
          gamer_tag: string
          games_played: number
          level: number
          updated_at: string
          user_id: string
          wins: number
          xp_total: number
        }
        Insert: {
          avatar_url?: string | null
          best_win_streak?: number
          created_at?: string
          current_win_streak?: number
          favorite_game_ids?: string[]
          gamer_tag?: string
          games_played?: number
          level?: number
          updated_at?: string
          user_id: string
          wins?: number
          xp_total?: number
        }
        Update: {
          avatar_url?: string | null
          best_win_streak?: number
          created_at?: string
          current_win_streak?: number
          favorite_game_ids?: string[]
          gamer_tag?: string
          games_played?: number
          level?: number
          updated_at?: string
          user_id?: string
          wins?: number
          xp_total?: number
        }
        Relationships: []
      }
      arcade_inventory: {
        Row: {
          acquired_at: string
          equipped: boolean
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          equipped?: boolean
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          equipped?: boolean
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "arcade_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_mission_progress: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          mission_id: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          mission_id: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          mission_id?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "arcade_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_missions: {
        Row: {
          active: boolean
          code: string
          description: string
          ends_at: string
          id: string
          metric: string
          period: string
          reward_id: string | null
          season_id: string | null
          starts_at: string
          target: number
          title: string
        }
        Insert: {
          active?: boolean
          code: string
          description: string
          ends_at: string
          id?: string
          metric: string
          period: string
          reward_id?: string | null
          season_id?: string | null
          starts_at: string
          target: number
          title: string
        }
        Update: {
          active?: boolean
          code?: string
          description?: string
          ends_at?: string
          id?: string
          metric?: string
          period?: string
          reward_id?: string | null
          season_id?: string | null
          starts_at?: string
          target?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_missions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "arcade_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_missions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "arcade_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_player_challenges: {
        Row: {
          challenger_id: string
          challenger_score: number | null
          created_at: string
          expires_at: string
          game_id: string
          id: string
          opponent_id: string
          opponent_score: number | null
          status: string
          target_score: number | null
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          challenger_score?: number | null
          created_at?: string
          expires_at?: string
          game_id: string
          id?: string
          opponent_id: string
          opponent_score?: number | null
          status?: string
          target_score?: number | null
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          challenger_score?: number | null
          created_at?: string
          expires_at?: string
          game_id?: string
          id?: string
          opponent_id?: string
          opponent_score?: number | null
          status?: string
          target_score?: number | null
          winner_id?: string | null
        }
        Relationships: []
      }
      arcade_result_submissions: {
        Row: {
          client_started_at: string | null
          created_at: string
          device_hash: string | null
          duration_seconds: number
          game_id: string
          id: string
          input_count: number
          integrity_hash: string | null
          ip_hash: string | null
          rejection_reason: string | null
          replay_data: Json | null
          result: string
          risk_score: number
          score: number
          user_id: string
          validation_status: string
        }
        Insert: {
          client_started_at?: string | null
          created_at?: string
          device_hash?: string | null
          duration_seconds: number
          game_id: string
          id: string
          input_count?: number
          integrity_hash?: string | null
          ip_hash?: string | null
          rejection_reason?: string | null
          replay_data?: Json | null
          result: string
          risk_score?: number
          score: number
          user_id: string
          validation_status: string
        }
        Update: {
          client_started_at?: string | null
          created_at?: string
          device_hash?: string | null
          duration_seconds?: number
          game_id?: string
          id?: string
          input_count?: number
          integrity_hash?: string | null
          ip_hash?: string | null
          rejection_reason?: string | null
          replay_data?: Json | null
          result?: string
          risk_score?: number
          score?: number
          user_id?: string
          validation_status?: string
        }
        Relationships: []
      }
      arcade_reward_claims: {
        Row: {
          claimed_at: string
          id: string
          reward_id: string
          risk_score: number
          source_id: string
          status: string
          user_id: string
          vx_amount: number
          xp_amount: number
        }
        Insert: {
          claimed_at?: string
          id?: string
          reward_id: string
          risk_score?: number
          source_id: string
          status?: string
          user_id: string
          vx_amount: number
          xp_amount: number
        }
        Update: {
          claimed_at?: string
          id?: string
          reward_id?: string
          risk_score?: number
          source_id?: string
          status?: string
          user_id?: string
          vx_amount?: number
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "arcade_reward_claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "arcade_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_rewards: {
        Row: {
          active: boolean
          code: string
          cooldown_hours: number
          created_at: string
          ends_at: string | null
          event_type: string
          id: string
          max_claims: number
          starts_at: string | null
          title: string
          vx_amount: number
          xp_amount: number
        }
        Insert: {
          active?: boolean
          code: string
          cooldown_hours?: number
          created_at?: string
          ends_at?: string | null
          event_type: string
          id?: string
          max_claims?: number
          starts_at?: string | null
          title: string
          vx_amount: number
          xp_amount?: number
        }
        Update: {
          active?: boolean
          code?: string
          cooldown_hours?: number
          created_at?: string
          ends_at?: string | null
          event_type?: string
          id?: string
          max_claims?: number
          starts_at?: string | null
          title?: string
          vx_amount?: number
          xp_amount?: number
        }
        Relationships: []
      }
      arcade_runtime_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          game_id: string | null
          id: number
          message: string
          release_version: string | null
          route: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          game_id?: string | null
          id?: never
          message: string
          release_version?: string | null
          route: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          game_id?: string | null
          id?: never
          message?: string
          release_version?: string | null
          route?: string
          user_id?: string | null
        }
        Relationships: []
      }
      arcade_seasons: {
        Row: {
          code: string
          ends_at: string
          id: string
          starts_at: string
          status: string
          theme: Json
          title: string
        }
        Insert: {
          code: string
          ends_at: string
          id?: string
          starts_at: string
          status?: string
          theme?: Json
          title: string
        }
        Update: {
          code?: string
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          theme?: Json
          title?: string
        }
        Relationships: []
      }
      arcade_security_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: number
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: never
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          severity: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: never
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      arcade_shop_items: {
        Row: {
          active: boolean
          asset_key: string
          created_at: string
          description: string
          id: string
          item_type: string
          metadata: Json
          name: string
          sku: string
          vx_price: number
        }
        Insert: {
          active?: boolean
          asset_key: string
          created_at?: string
          description: string
          id?: string
          item_type: string
          metadata?: Json
          name: string
          sku: string
          vx_price: number
        }
        Update: {
          active?: boolean
          asset_key?: string
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          metadata?: Json
          name?: string
          sku?: string
          vx_price?: number
        }
        Relationships: []
      }
      arcade_tournament_entries: {
        Row: {
          best_score: number
          joined_at: string
          rank: number | null
          tournament_id: string
          user_id: string
          verified: boolean
        }
        Insert: {
          best_score?: number
          joined_at?: string
          rank?: number | null
          tournament_id: string
          user_id: string
          verified?: boolean
        }
        Update: {
          best_score?: number
          joined_at?: string
          rank?: number | null
          tournament_id?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "arcade_tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "arcade_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_tournaments: {
        Row: {
          code: string
          ends_at: string
          game_id: string
          id: string
          max_entries: number | null
          period: string
          prize_pool: Json
          rules: Json
          season_id: string | null
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          code: string
          ends_at: string
          game_id: string
          id?: string
          max_entries?: number | null
          period: string
          prize_pool?: Json
          rules?: Json
          season_id?: string | null
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          code?: string
          ends_at?: string
          game_id?: string
          id?: string
          max_entries?: number | null
          period?: string
          prize_pool?: Json
          rules?: Json
          season_id?: string | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "arcade_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_user_achievements: {
        Row: {
          achievement_key: string
          source_session_id: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          source_session_id?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          source_session_id?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_user_achievements_achievement_key_fkey"
            columns: ["achievement_key"]
            isOneToOne: false
            referencedRelation: "arcade_achievement_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      arcade_wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          category: string
          created_at: string
          direction: string
          id: string
          idempotency_key: string
          reference_id: string
          reference_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          category: string
          created_at?: string
          direction: string
          id?: string
          idempotency_key: string
          reference_id: string
          reference_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          category?: string
          created_at?: string
          direction?: string
          id?: string
          idempotency_key?: string
          reference_id?: string
          reference_type?: string
          user_id?: string
        }
        Relationships: []
      }
      arcade_xp_history: {
        Row: {
          amount: number
          created_at: string
          id: number
          reason: string
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          reason: string
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          reason?: string
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
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
      file_conversion_charges: {
        Row: {
          amount: number
          created_at: string
          file_size_bytes: number
          job_id: string
          module_type: string
          settled_at: string | null
          status: string
          target_format: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          file_size_bytes: number
          job_id: string
          module_type: string
          settled_at?: string | null
          status?: string
          target_format: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          file_size_bytes?: number
          job_id?: string
          module_type?: string
          settled_at?: string | null
          status?: string
          target_format?: string
          user_id?: string
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
      kids_academy_downloads: {
        Row: {
          downloaded_at: string
          format: string
          id: string
          lesson_id: string | null
          user_id: string
          worksheet_id: string | null
        }
        Insert: {
          downloaded_at?: string
          format: string
          id?: string
          lesson_id?: string | null
          user_id: string
          worksheet_id?: string | null
        }
        Update: {
          downloaded_at?: string
          format?: string
          id?: string
          lesson_id?: string | null
          user_id?: string
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_academy_downloads_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_academy_downloads_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "kids_worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_achievements: {
        Row: {
          created_at: string
          criteria: Json
          description: string | null
          icon: string | null
          id: string
          key: string
          reward_vx: number
          title: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          key: string
          reward_vx?: number
          title: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          key?: string
          reward_vx?: number
          title?: string
        }
        Relationships: []
      }
      kids_activity_attempts: {
        Row: {
          activity_id: string
          answer: Json
          attempted_at: string
          correct: boolean
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          answer?: Json
          attempted_at?: string
          correct?: boolean
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          answer?: Json
          attempted_at?: string
          correct?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_activity_attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "kids_lesson_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_ai_stories: {
        Row: {
          characters: Json
          cover_image_url: string | null
          created_at: string
          id: string
          is_public: boolean
          moral_lesson: string | null
          pages: Json
          prompt: string
          quiz: Json
          status: string
          title: string
          user_id: string
          vocabulary: Json
        }
        Insert: {
          characters?: Json
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          moral_lesson?: string | null
          pages?: Json
          prompt: string
          quiz?: Json
          status?: string
          title?: string
          user_id: string
          vocabulary?: Json
        }
        Update: {
          characters?: Json
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          moral_lesson?: string | null
          pages?: Json
          prompt?: string
          quiz?: Json
          status?: string
          title?: string
          user_id?: string
          vocabulary?: Json
        }
        Relationships: []
      }
      kids_assignment_submissions: {
        Row: {
          assignment_id: string
          content: string | null
          file_url: string | null
          grade: number | null
          id: string
          org_id: string
          status: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          file_url?: string | null
          grade?: number | null
          id?: string
          org_id: string
          status?: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          file_url?: string | null
          grade?: number | null
          id?: string
          org_id?: string
          status?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "kids_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_assignment_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_assignments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          org_id: string
          points: number
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id: string
          points?: number
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string
          points?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "kids_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          note: string | null
          org_id: string
          recorded_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          org_id: string
          recorded_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          org_id?: string
          recorded_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "kids_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_attendance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_bookmarks: {
        Row: {
          created_at: string
          id: string
          label: string | null
          page_number: number | null
          position: Json
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          page_number?: number | null
          position?: Json
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          page_number?: number | null
          position?: Json
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_bookmarks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_careers: {
        Row: {
          a_day_like: string | null
          color: string
          created_at: string
          description: string | null
          emoji: string
          order_index: number
          related_tracks: string[]
          skill_domains: string[]
          slug: string
          status: string
          title: string
        }
        Insert: {
          a_day_like?: string | null
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          related_tracks?: string[]
          skill_domains?: string[]
          slug: string
          status?: string
          title: string
        }
        Update: {
          a_day_like?: string | null
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          related_tracks?: string[]
          skill_domains?: string[]
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      kids_certificates: {
        Row: {
          certificate_number: string
          certificate_type: string
          id: string
          issued_at: string
          issuer_name: string
          recipient_name: string
          reference_id: string | null
          score_percent: number | null
          signature_hash: string | null
          title: string
          user_id: string
          verification_code: string
        }
        Insert: {
          certificate_number: string
          certificate_type: string
          id?: string
          issued_at?: string
          issuer_name?: string
          recipient_name: string
          reference_id?: string | null
          score_percent?: number | null
          signature_hash?: string | null
          title: string
          user_id: string
          verification_code: string
        }
        Update: {
          certificate_number?: string
          certificate_type?: string
          id?: string
          issued_at?: string
          issuer_name?: string
          recipient_name?: string
          reference_id?: string | null
          score_percent?: number | null
          signature_hash?: string | null
          title?: string
          user_id?: string
          verification_code?: string
        }
        Relationships: []
      }
      kids_child_settings: {
        Row: {
          allow_ai: boolean
          allow_chat: boolean
          allow_downloads: boolean
          allow_games: boolean
          allow_sharing: boolean
          allow_videos: boolean
          allow_voice_rooms: boolean
          bedtime_end: string | null
          bedtime_start: string | null
          break_interval_minutes: number
          child_user_id: string
          daily_limit_minutes: number
          recording_consent: boolean
          study_time_end: string | null
          study_time_start: string | null
          updated_at: string
        }
        Insert: {
          allow_ai?: boolean
          allow_chat?: boolean
          allow_downloads?: boolean
          allow_games?: boolean
          allow_sharing?: boolean
          allow_videos?: boolean
          allow_voice_rooms?: boolean
          bedtime_end?: string | null
          bedtime_start?: string | null
          break_interval_minutes?: number
          child_user_id: string
          daily_limit_minutes?: number
          recording_consent?: boolean
          study_time_end?: string | null
          study_time_start?: string | null
          updated_at?: string
        }
        Update: {
          allow_ai?: boolean
          allow_chat?: boolean
          allow_downloads?: boolean
          allow_games?: boolean
          allow_sharing?: boolean
          allow_videos?: boolean
          allow_voice_rooms?: boolean
          bedtime_end?: string | null
          bedtime_start?: string | null
          break_interval_minutes?: number
          child_user_id?: string
          daily_limit_minutes?: number
          recording_consent?: boolean
          study_time_end?: string | null
          study_time_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kids_class_students: {
        Row: {
          added_at: string
          class_id: string
          org_id: string
          student_id: string
        }
        Insert: {
          added_at?: string
          class_id: string
          org_id: string
          student_id: string
        }
        Update: {
          added_at?: string
          class_id?: string
          org_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "kids_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_class_students_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_classes: {
        Row: {
          created_at: string
          grade: string | null
          id: string
          name: string
          org_id: string
          school_id: string | null
          subject: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          grade?: string | null
          id?: string
          name: string
          org_id: string
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          grade?: string | null
          id?: string
          name?: string
          org_id?: string
          school_id?: string | null
          subject?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_classes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "kids_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_companion: {
        Row: {
          avatar: string
          created_at: string
          goals: string[]
          hobbies: string[]
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar?: string
          created_at?: string
          goals?: string[]
          hobbies?: string[]
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar?: string
          created_at?: string
          goals?: string[]
          hobbies?: string[]
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_text: string | null
          pair_key: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_text?: string | null
          pair_key?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_text?: string | null
          pair_key?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      kids_course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "kids_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_courses: {
        Row: {
          age_range: string
          coins_reward: number
          created_at: string
          description: string | null
          difficulty: string
          id: string
          lesson_count: number
          published_at: string | null
          slug: string
          status: string
          subject_id: string | null
          subtitle: string | null
          teacher_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          age_range?: string
          coins_reward?: number
          created_at?: string
          description?: string | null
          difficulty?: string
          id?: string
          lesson_count?: number
          published_at?: string | null
          slug: string
          status?: string
          subject_id?: string | null
          subtitle?: string | null
          teacher_id?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          age_range?: string
          coins_reward?: number
          created_at?: string
          description?: string | null
          difficulty?: string
          id?: string
          lesson_count?: number
          published_at?: string | null
          slug?: string
          status?: string
          subject_id?: string | null
          subtitle?: string | null
          teacher_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "kids_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_creative_challenge_submissions: {
        Row: {
          challenge_id: string
          id: string
          project_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          id?: string
          project_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          id?: string
          project_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_creative_challenge_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "kids_creative_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_creative_challenge_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "kids_creative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_creative_challenges: {
        Row: {
          created_at: string
          description: string | null
          id: string
          prompt_type: string
          reward_coins: number
          reward_xp: number
          title: string
          week_start: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          prompt_type: string
          reward_coins?: number
          reward_xp?: number
          title: string
          week_start: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          prompt_type?: string
          reward_coins?: number
          reward_xp?: number
          title?: string
          week_start?: string
        }
        Relationships: []
      }
      kids_creative_project_versions: {
        Row: {
          content: Json
          id: string
          project_id: string
          saved_at: string
        }
        Insert: {
          content: Json
          id?: string
          project_id: string
          saved_at?: string
        }
        Update: {
          content?: Json
          id?: string
          project_id?: string
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_creative_project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "kids_creative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_creative_projects: {
        Row: {
          asset_urls: string[]
          content: Json
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          parent_approved: boolean | null
          project_type: string
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_urls?: string[]
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          parent_approved?: boolean | null
          project_type: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_urls?: string[]
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          parent_approved?: boolean | null
          project_type?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_daily_challenges: {
        Row: {
          challenge_date: string
          created_at: string
          description: string | null
          game_id: string | null
          id: string
          lesson_id: string | null
          reward_coins: number
          reward_xp: number
          target_type: string
          target_value: number
          title: string
          world_slug: string | null
        }
        Insert: {
          challenge_date: string
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          lesson_id?: string | null
          reward_coins?: number
          reward_xp?: number
          target_type: string
          target_value?: number
          title: string
          world_slug?: string | null
        }
        Update: {
          challenge_date?: string
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          lesson_id?: string | null
          reward_coins?: number
          reward_xp?: number
          target_type?: string
          target_value?: number
          title?: string
          world_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_daily_challenges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "kids_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_daily_challenges_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_daily_challenges_world_slug_fkey"
            columns: ["world_slug"]
            isOneToOne: false
            referencedRelation: "kids_explorer_worlds"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_dashboard_widgets: {
        Row: {
          enabled: boolean
          position: number
          updated_at: string
          user_id: string
          widget_slug: string
        }
        Insert: {
          enabled?: boolean
          position?: number
          updated_at?: string
          user_id: string
          widget_slug: string
        }
        Update: {
          enabled?: boolean
          position?: number
          updated_at?: string
          user_id?: string
          widget_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_dashboard_widgets_widget_slug_fkey"
            columns: ["widget_slug"]
            isOneToOne: false
            referencedRelation: "kids_widgets"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_device_sessions: {
        Row: {
          device_id: string | null
          ended_at: string | null
          id: string
          login_at: string
          revoked: boolean
          user_id: string
        }
        Insert: {
          device_id?: string | null
          ended_at?: string | null
          id?: string
          login_at?: string
          revoked?: boolean
          user_id: string
        }
        Update: {
          device_id?: string | null
          ended_at?: string | null
          id?: string
          login_at?: string
          revoked?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_device_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "kids_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_key: string
          id: string
          last_active: string
          name: string
          platform: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_key: string
          id?: string
          last_active?: string
          name?: string
          platform?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_key?: string
          id?: string
          last_active?: string
          name?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_donations: {
        Row: {
          amount_coins: number
          cause: string
          created_at: string
          donor_id: string
          id: string
        }
        Insert: {
          amount_coins: number
          cause: string
          created_at?: string
          donor_id: string
          id?: string
        }
        Update: {
          amount_coins?: number
          cause?: string
          created_at?: string
          donor_id?: string
          id?: string
        }
        Relationships: []
      }
      kids_downloads: {
        Row: {
          downloaded_at: string
          format: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          downloaded_at?: string
          format: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          downloaded_at?: string
          format?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_downloads_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_economy_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: number
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: never
        }
        Relationships: []
      }
      kids_economy_guardians: {
        Row: {
          child_id: string
          created_at: string
          guardian_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          guardian_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          guardian_id?: string
        }
        Relationships: []
      }
      kids_emergency_numbers: {
        Row: {
          ambulance: string | null
          country_code: string
          country_name: string
          created_at: string
          fire: string | null
          general: string | null
          note: string | null
          order_index: number
          police: string | null
          status: string
        }
        Insert: {
          ambulance?: string | null
          country_code: string
          country_name: string
          created_at?: string
          fire?: string | null
          general?: string | null
          note?: string | null
          order_index?: number
          police?: string | null
          status?: string
        }
        Update: {
          ambulance?: string | null
          country_code?: string
          country_name?: string
          created_at?: string
          fire?: string | null
          general?: string | null
          note?: string | null
          order_index?: number
          police?: string | null
          status?: string
        }
        Relationships: []
      }
      kids_enterprise_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: number
          org_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: never
          org_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: never
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_enterprise_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_attendance: {
        Row: {
          duration_seconds: number
          event_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          duration_seconds?: number
          event_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          duration_seconds?: number
          event_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_limited_rewards: {
        Row: {
          created_at: string
          description: string | null
          emoji: string
          event_id: string | null
          expires_at: string | null
          id: string
          quantity_claimed: number
          quantity_total: number
          seasonal_key: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string
          event_id?: string | null
          expires_at?: string | null
          id?: string
          quantity_claimed?: number
          quantity_total: number
          seasonal_key?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string
          event_id?: string | null
          expires_at?: string | null
          id?: string
          quantity_claimed?: number
          quantity_total?: number
          seasonal_key?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_limited_rewards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_medals: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          event_id: string
          id: string
          medal_type: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          event_id: string
          id?: string
          medal_type: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          event_id?: string
          id?: string
          medal_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_medals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_messages: {
        Row: {
          content: string
          created_at: string
          event_id: string
          flagged_categories: string[]
          id: string
          is_flagged: boolean
          user_id: string
          was_filtered: boolean
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          flagged_categories?: string[]
          id?: string
          is_flagged?: boolean
          user_id: string
          was_filtered?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          flagged_categories?: string[]
          id?: string
          is_flagged?: boolean
          user_id?: string
          was_filtered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "kids_event_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_polls: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_active: boolean
          options: Json
          question: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          options?: Json
          question: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_polls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_question_upvotes: {
        Row: {
          created_at: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_question_upvotes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "kids_event_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_questions: {
        Row: {
          answer_text: string | null
          answered_at: string | null
          created_at: string
          event_id: string
          id: string
          is_answered: boolean
          question: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_answered?: boolean
          question: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_answered?: boolean
          question?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_registrations: {
        Row: {
          decided_at: string | null
          event_id: string
          id: string
          parental_approval_status: string
          registered_at: string
          status: string
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          event_id: string
          id?: string
          parental_approval_status?: string
          registered_at?: string
          status?: string
          user_id: string
        }
        Update: {
          decided_at?: string | null
          event_id?: string
          id?: string
          parental_approval_status?: string
          registered_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_replays: {
        Row: {
          captions_url: string | null
          created_at: string
          duration_seconds: number
          event_id: string
          id: string
          thumbnail_url: string | null
          video_url: string | null
          view_count: number
        }
        Insert: {
          captions_url?: string | null
          created_at?: string
          duration_seconds?: number
          event_id: string
          id?: string
          thumbnail_url?: string | null
          video_url?: string | null
          view_count?: number
        }
        Update: {
          captions_url?: string | null
          created_at?: string
          duration_seconds?: number
          event_id?: string
          id?: string
          thumbnail_url?: string | null
          video_url?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_replays_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_event_submissions: {
        Row: {
          content: string | null
          event_id: string
          file_url: string | null
          id: string
          rank: number | null
          score: number | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          event_id: string
          file_url?: string | null
          id?: string
          rank?: number | null
          score?: number | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          event_id?: string
          file_url?: string | null
          id?: string
          rank?: number | null
          score?: number | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_event_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kids_events"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_events: {
        Row: {
          age_group: string
          capacity: number | null
          category: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          emoji: string
          ends_at: string
          event_type: string
          host_id: string | null
          id: string
          language: string
          level: string
          reaction_counts: Json
          reward_coins: number
          reward_xp: number
          slug: string
          starts_at: string
          status: string
          title: string
          voice_room_id: string | null
        }
        Insert: {
          age_group?: string
          capacity?: number | null
          category: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          ends_at: string
          event_type: string
          host_id?: string | null
          id?: string
          language?: string
          level?: string
          reaction_counts?: Json
          reward_coins?: number
          reward_xp?: number
          slug: string
          starts_at: string
          status?: string
          title: string
          voice_room_id?: string | null
        }
        Update: {
          age_group?: string
          capacity?: number | null
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          ends_at?: string
          event_type?: string
          host_id?: string | null
          id?: string
          language?: string
          level?: string
          reaction_counts?: Json
          reward_coins?: number
          reward_xp?: number
          slug?: string
          starts_at?: string
          status?: string
          title?: string
          voice_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_events_voice_room_id_fkey"
            columns: ["voice_room_id"]
            isOneToOne: false
            referencedRelation: "kids_voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_exam_results: {
        Row: {
          created_at: string
          exam_id: string
          grade: string | null
          id: string
          marks: number
          org_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          grade?: string | null
          id?: string
          marks?: number
          org_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          grade?: string | null
          id?: string
          marks?: number
          org_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "kids_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_exam_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_exams: {
        Row: {
          class_id: string
          created_at: string
          exam_date: string | null
          id: string
          org_id: string
          subject: string | null
          title: string
          total_marks: number
        }
        Insert: {
          class_id: string
          created_at?: string
          exam_date?: string | null
          id?: string
          org_id: string
          subject?: string | null
          title: string
          total_marks?: number
        }
        Update: {
          class_id?: string
          created_at?: string
          exam_date?: string | null
          id?: string
          org_id?: string
          subject?: string | null
          title?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "kids_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_exams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_experiment_progress: {
        Row: {
          best_score: number
          completed: boolean
          completed_at: string | null
          experiment_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          best_score?: number
          completed?: boolean
          completed_at?: string | null
          experiment_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          best_score?: number
          completed?: boolean
          completed_at?: string | null
          experiment_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_experiment_progress_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "kids_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_experiments: {
        Row: {
          body: string | null
          color: string
          content: Json
          created_at: string
          difficulty: string
          duration_seconds: number | null
          emoji: string
          id: string
          kind: string
          lab: string
          order_index: number
          quiz: Json
          reward_coins: number
          reward_xp: number
          simulation: Json
          slug: string
          status: string
          steps: Json
          summary: string | null
          title: string
          topic: string
          video_url: string | null
        }
        Insert: {
          body?: string | null
          color?: string
          content?: Json
          created_at?: string
          difficulty?: string
          duration_seconds?: number | null
          emoji?: string
          id?: string
          kind?: string
          lab: string
          order_index?: number
          quiz?: Json
          reward_coins?: number
          reward_xp?: number
          simulation?: Json
          slug: string
          status?: string
          steps?: Json
          summary?: string | null
          title: string
          topic: string
          video_url?: string | null
        }
        Update: {
          body?: string | null
          color?: string
          content?: Json
          created_at?: string
          difficulty?: string
          duration_seconds?: number | null
          emoji?: string
          id?: string
          kind?: string
          lab?: string
          order_index?: number
          quiz?: Json
          reward_coins?: number
          reward_xp?: number
          simulation?: Json
          slug?: string
          status?: string
          steps?: Json
          summary?: string | null
          title?: string
          topic?: string
          video_url?: string | null
        }
        Relationships: []
      }
      kids_explorer_locations: {
        Row: {
          audio_url: string | null
          category: string
          content: Json
          created_at: string
          emoji: string
          fun_facts: Json
          id: string
          image_url: string | null
          name: string
          order_index: number
          slug: string
          status: string
          summary: string | null
          video_url: string | null
          world_slug: string
        }
        Insert: {
          audio_url?: string | null
          category: string
          content?: Json
          created_at?: string
          emoji?: string
          fun_facts?: Json
          id?: string
          image_url?: string | null
          name: string
          order_index?: number
          slug: string
          status?: string
          summary?: string | null
          video_url?: string | null
          world_slug: string
        }
        Update: {
          audio_url?: string | null
          category?: string
          content?: Json
          created_at?: string
          emoji?: string
          fun_facts?: Json
          id?: string
          image_url?: string | null
          name?: string
          order_index?: number
          slug?: string
          status?: string
          summary?: string | null
          video_url?: string | null
          world_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_explorer_locations_world_slug_fkey"
            columns: ["world_slug"]
            isOneToOne: false
            referencedRelation: "kids_explorer_worlds"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_explorer_passport_stamps: {
        Row: {
          stamped_at: string
          user_id: string
          world_slug: string
        }
        Insert: {
          stamped_at?: string
          user_id: string
          world_slug: string
        }
        Update: {
          stamped_at?: string
          user_id?: string
          world_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_explorer_passport_stamps_world_slug_fkey"
            columns: ["world_slug"]
            isOneToOne: false
            referencedRelation: "kids_explorer_worlds"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_explorer_simulator_saves: {
        Row: {
          id: string
          simulator_type: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          simulator_type: string
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          simulator_type?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_explorer_worlds: {
        Row: {
          color: string
          created_at: string
          description: string | null
          emoji: string
          kind: string
          order_index: number
          slug: string
          status: string
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          emoji: string
          kind: string
          order_index?: number
          slug: string
          status?: string
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          kind?: string
          order_index?: number
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      kids_families: {
        Row: {
          created_at: string
          family_name: string
          id: string
          parent_user_id: string
        }
        Insert: {
          created_at?: string
          family_name?: string
          id?: string
          parent_user_id: string
        }
        Update: {
          created_at?: string
          family_name?: string
          id?: string
          parent_user_id?: string
        }
        Relationships: []
      }
      kids_favorite_friends: {
        Row: {
          created_at: string
          friend_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_favorites: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_favorites_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_friendships: {
        Row: {
          addressee_id: string
          blocked_by: string | null
          created_at: string
          id: string
          pair_key: string | null
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          pair_key?: string | null
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          pair_key?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      kids_future_skills: {
        Row: {
          color: string
          created_at: string
          description: string | null
          emoji: string
          order_index: number
          related_track: string | null
          slug: string
          status: string
          title: string
          why_it_matters: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          related_track?: string | null
          slug: string
          status?: string
          title: string
          why_it_matters?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          related_track?: string | null
          slug?: string
          status?: string
          title?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_future_skills_related_track_fkey"
            columns: ["related_track"]
            isOneToOne: false
            referencedRelation: "kids_talent_tracks"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_game_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          game_count: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          game_count?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          game_count?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      kids_game_favorites: {
        Row: {
          created_at: string
          game_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_game_favorites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "kids_games"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_game_ratings: {
        Row: {
          created_at: string
          game_id: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "kids_games"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_game_sessions: {
        Row: {
          completed: boolean
          duration_seconds: number
          ended_at: string | null
          game_id: string
          hints_used: number
          id: string
          lives_used: number
          metadata: Json
          score: number
          started_at: string
          user_id: string
          won: boolean
        }
        Insert: {
          completed?: boolean
          duration_seconds?: number
          ended_at?: string | null
          game_id: string
          hints_used?: number
          id?: string
          lives_used?: number
          metadata?: Json
          score?: number
          started_at?: string
          user_id: string
          won?: boolean
        }
        Update: {
          completed?: boolean
          duration_seconds?: number
          ended_at?: string | null
          game_id?: string
          hints_used?: number
          id?: string
          lives_used?: number
          metadata?: Json
          score?: number
          started_at?: string
          user_id?: string
          won?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kids_game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "kids_games"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_games: {
        Row: {
          accessibility_features: Json
          age_range: string
          category_id: string | null
          coins_reward: number
          created_at: string
          description: string | null
          difficulty: string
          downloads_count: number
          engine_key: string | null
          estimated_minutes: number
          gallery: Json
          id: string
          is_accessible_audio: boolean
          is_multiplayer: boolean
          language_support: string[]
          players_count: number
          preview_video_url: string | null
          published_at: string | null
          rating_avg: number
          rating_count: number
          search_vector: unknown
          slug: string
          status: string
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          accessibility_features?: Json
          age_range?: string
          category_id?: string | null
          coins_reward?: number
          created_at?: string
          description?: string | null
          difficulty?: string
          downloads_count?: number
          engine_key?: string | null
          estimated_minutes?: number
          gallery?: Json
          id?: string
          is_accessible_audio?: boolean
          is_multiplayer?: boolean
          language_support?: string[]
          players_count?: number
          preview_video_url?: string | null
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          slug: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          accessibility_features?: Json
          age_range?: string
          category_id?: string | null
          coins_reward?: number
          created_at?: string
          description?: string | null
          difficulty?: string
          downloads_count?: number
          engine_key?: string | null
          estimated_minutes?: number
          gallery?: Json
          id?: string
          is_accessible_audio?: boolean
          is_multiplayer?: boolean
          language_support?: string[]
          players_count?: number
          preview_video_url?: string | null
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          slug?: string
          status?: string
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_games_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kids_game_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_gifts: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          from_id: string
          id: string
          kind: string
          message: string | null
          ref_slug: string | null
          status: string
          to_id: string
        }
        Insert: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          from_id: string
          id?: string
          kind: string
          message?: string | null
          ref_slug?: string | null
          status?: string
          to_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          from_id?: string
          id?: string
          kind?: string
          message?: string | null
          ref_slug?: string | null
          status?: string
          to_id?: string
        }
        Relationships: []
      }
      kids_habit_logs: {
        Row: {
          created_at: string
          habit_slug: string
          log_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_slug: string
          log_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_slug?: string
          log_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_habit_logs_habit_slug_fkey"
            columns: ["habit_slug"]
            isOneToOne: false
            referencedRelation: "kids_wellness_habits"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_healthy_challenge_progress: {
        Row: {
          challenge_id: string
          completed: boolean
          period_start: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          period_start: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          period_start?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_healthy_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "kids_healthy_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_healthy_challenges: {
        Row: {
          created_at: string
          description: string | null
          emoji: string
          id: string
          metric: string
          order_index: number
          period: string
          reward_coins: number
          reward_xp: number
          slug: string
          status: string
          target_value: number
          title: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          metric: string
          order_index?: number
          period?: string
          reward_coins?: number
          reward_xp?: number
          slug: string
          status?: string
          target_value?: number
          title: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          metric?: string
          order_index?: number
          period?: string
          reward_coins?: number
          reward_xp?: number
          slug?: string
          status?: string
          target_value?: number
          title?: string
          unit?: string | null
        }
        Relationships: []
      }
      kids_highlights: {
        Row: {
          color: string
          created_at: string
          id: string
          page_number: number | null
          quoted_text: string
          story_id: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          page_number?: number | null
          quoted_text: string
          story_id: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          page_number?: number | null
          quoted_text?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_highlights_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_homework: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_note: string | null
          id: string
          lesson_id: string | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_note?: string | null
          id?: string
          lesson_id?: string | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_note?: string | null
          id?: string
          lesson_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_homework_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "kids_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_homework_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_homework_submissions: {
        Row: {
          feedback: string | null
          file_urls: string[]
          grade: number | null
          graded_at: string | null
          homework_id: string
          id: string
          status: string
          submitted_at: string
          text_answer: string | null
          user_id: string
        }
        Insert: {
          feedback?: string | null
          file_urls?: string[]
          grade?: number | null
          graded_at?: string | null
          homework_id: string
          id?: string
          status?: string
          submitted_at?: string
          text_answer?: string | null
          user_id: string
        }
        Update: {
          feedback?: string | null
          file_urls?: string[]
          grade?: number | null
          graded_at?: string | null
          homework_id?: string
          id?: string
          status?: string
          submitted_at?: string
          text_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "kids_homework"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_innovation_challenges: {
        Row: {
          active_from: string | null
          active_to: string | null
          content: Json
          created_at: string
          description: string | null
          emoji: string
          id: string
          order_index: number
          problem: string
          reward_coins: number
          reward_xp: number
          slug: string
          status: string
          theme: string | null
          title: string
        }
        Insert: {
          active_from?: string | null
          active_to?: string | null
          content?: Json
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          order_index?: number
          problem: string
          reward_coins?: number
          reward_xp?: number
          slug: string
          status?: string
          theme?: string | null
          title: string
        }
        Update: {
          active_from?: string | null
          active_to?: string | null
          content?: Json
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          order_index?: number
          problem?: string
          reward_coins?: number
          reward_xp?: number
          slug?: string
          status?: string
          theme?: string | null
          title?: string
        }
        Relationships: []
      }
      kids_invoices: {
        Row: {
          amount_usd: number
          id: string
          issued_at: string
          status: string
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_usd?: number
          id?: string
          issued_at?: string
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_usd?: number
          id?: string
          issued_at?: string
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "kids_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_lesson_activities: {
        Row: {
          content: Json
          created_at: string
          id: string
          lesson_id: string
          order_index: number
          points: number
          prompt: string
          type: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          lesson_id: string
          order_index?: number
          points?: number
          prompt: string
          type: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          lesson_id?: string
          order_index?: number
          points?: number
          prompt?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_lesson_activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_lesson_progress: {
        Row: {
          completed_at: string | null
          last_accessed_at: string
          lesson_id: string
          score: number | null
          status: string
          time_spent_seconds: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          last_accessed_at?: string
          lesson_id: string
          score?: number | null
          status?: string
          time_spent_seconds?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          last_accessed_at?: string
          lesson_id?: string
          score?: number | null
          status?: string
          time_spent_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_lessons: {
        Row: {
          audio_url: string | null
          coins_reward: number
          content: string | null
          course_id: string
          created_at: string
          description: string | null
          estimated_minutes: number
          id: string
          order_index: number
          slug: string
          status: string
          title: string
          unit_id: string
          updated_at: string
          video_url: string | null
          xp_reward: number
        }
        Insert: {
          audio_url?: string | null
          coins_reward?: number
          content?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          order_index?: number
          slug: string
          status?: string
          title: string
          unit_id: string
          updated_at?: string
          video_url?: string | null
          xp_reward?: number
        }
        Update: {
          audio_url?: string | null
          coins_reward?: number
          content?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          order_index?: number
          slug?: string
          status?: string
          title?: string
          unit_id?: string
          updated_at?: string
          video_url?: string | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "kids_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_lessons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "kids_units"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_analytics: {
        Row: {
          completions: number
          day: string
          downloads: number
          product_id: string
          views: number
        }
        Insert: {
          completions?: number
          day?: string
          downloads?: number
          product_id: string
          views?: number
        }
        Update: {
          completions?: number
          day?: string
          downloads?: number
          product_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_analytics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: number
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: never
        }
        Relationships: []
      }
      kids_market_bundle_items: {
        Row: {
          bundle_id: string
          order_index: number
          product_id: string
        }
        Insert: {
          bundle_id: string
          order_index?: number
          product_id: string
        }
        Update: {
          bundle_id?: string
          order_index?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_market_bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_categories: {
        Row: {
          emoji: string
          order_index: number
          slug: string
          status: string
          title: string
        }
        Insert: {
          emoji?: string
          order_index?: number
          slug: string
          status?: string
          title: string
        }
        Update: {
          emoji?: string
          order_index?: number
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      kids_market_creator_earnings: {
        Row: {
          amount_coins: number
          created_at: string
          creator_id: string
          id: string
          order_id: string | null
          product_id: string
        }
        Insert: {
          amount_coins: number
          created_at?: string
          creator_id: string
          id?: string
          order_id?: string | null
          product_id: string
        }
        Update: {
          amount_coins?: number
          created_at?: string
          creator_id?: string
          id?: string
          order_id?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_creator_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "kids_market_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_market_creator_earnings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_creators: {
        Row: {
          avatar: string
          bio: string | null
          created_at: string
          display_name: string
          kind: string
          updated_at: string
          user_id: string
          verification_note: string | null
          verification_status: string
          verified: boolean
        }
        Insert: {
          avatar?: string
          bio?: string | null
          created_at?: string
          display_name: string
          kind?: string
          updated_at?: string
          user_id: string
          verification_note?: string | null
          verification_status?: string
          verified?: boolean
        }
        Update: {
          avatar?: string
          bio?: string | null
          created_at?: string
          display_name?: string
          kind?: string
          updated_at?: string
          user_id?: string
          verification_note?: string | null
          verification_status?: string
          verified?: boolean
        }
        Relationships: []
      }
      kids_market_licenses: {
        Row: {
          granted_at: string
          license: string
          order_id: string | null
          product_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          license?: string
          order_id?: string | null
          product_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          license?: string
          order_id?: string | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_licenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "kids_market_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_market_licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_moderation: {
        Row: {
          auto_flags: Json
          auto_status: string
          human_status: string
          notes: string | null
          product_id: string
          reviewer_id: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          auto_flags?: Json
          auto_status?: string
          human_status?: string
          notes?: string | null
          product_id: string
          reviewer_id?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          auto_flags?: Json
          auto_status?: string
          human_status?: string
          notes?: string | null
          product_id?: string
          reviewer_id?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_moderation_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_moderators: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_market_orders: {
        Row: {
          created_at: string
          id: string
          price_coins: number
          product_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_coins?: number
          product_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price_coins?: number
          product_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_products: {
        Row: {
          age_max: number
          age_min: number
          category: string
          content: Json
          created_at: string
          creator_id: string
          description: string | null
          downloads: number
          emoji: string
          file_url: string | null
          id: string
          is_free: boolean
          language: string
          level: string
          license: string
          preview_url: string | null
          price_coins: number
          rating_avg: number
          rating_count: number
          slug: string
          status: string
          thumbnail_url: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          age_max?: number
          age_min?: number
          category?: string
          content?: Json
          created_at?: string
          creator_id: string
          description?: string | null
          downloads?: number
          emoji?: string
          file_url?: string | null
          id?: string
          is_free?: boolean
          language?: string
          level?: string
          license?: string
          preview_url?: string | null
          price_coins?: number
          rating_avg?: number
          rating_count?: number
          slug: string
          status?: string
          thumbnail_url?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          age_max?: number
          age_min?: number
          category?: string
          content?: Json
          created_at?: string
          creator_id?: string
          description?: string | null
          downloads?: number
          emoji?: string
          file_url?: string | null
          id?: string
          is_free?: boolean
          language?: string
          level?: string
          license?: string
          preview_url?: string | null
          price_coins?: number
          rating_avg?: number
          rating_count?: number
          slug?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      kids_market_review_likes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "kids_market_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "kids_market_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          likes: number
          product_id: string
          rating: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          likes?: number
          product_id: string
          rating: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          likes?: number
          product_id?: string
          rating?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_market_wishlist: {
        Row: {
          added_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_market_wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "kids_market_products"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_marketplace_items: {
        Row: {
          category: string
          color: string
          created_at: string
          description: string | null
          emoji: string
          order_index: number
          price_coins: number
          rarity: string
          slug: string
          status: string
          title: string
        }
        Insert: {
          category: string
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          price_coins: number
          rarity?: string
          slug: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          price_coins?: number
          rarity?: string
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      kids_mentor_requests: {
        Row: {
          created_at: string
          id: string
          mentor_slug: string
          status: string
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentor_slug: string
          status?: string
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentor_slug?: string
          status?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_mentor_requests_mentor_slug_fkey"
            columns: ["mentor_slug"]
            isOneToOne: false
            referencedRelation: "kids_mentors"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_mentors: {
        Row: {
          accepting: boolean
          bio: string | null
          created_at: string
          emoji: string
          expertise: string[]
          name: string
          order_index: number
          related_tracks: string[]
          slug: string
          status: string
          title: string
        }
        Insert: {
          accepting?: boolean
          bio?: string | null
          created_at?: string
          emoji?: string
          expertise?: string[]
          name: string
          order_index?: number
          related_tracks?: string[]
          slug: string
          status?: string
          title: string
        }
        Update: {
          accepting?: boolean
          bio?: string | null
          created_at?: string
          emoji?: string
          expertise?: string[]
          name?: string
          order_index?: number
          related_tracks?: string[]
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      kids_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          flagged_categories: string[]
          id: string
          is_flagged: boolean
          is_read: boolean
          sender_id: string
          was_filtered: boolean
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          flagged_categories?: string[]
          id?: string
          is_flagged?: boolean
          is_read?: boolean
          sender_id: string
          was_filtered?: boolean
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          flagged_categories?: string[]
          id?: string
          is_flagged?: boolean
          is_read?: boolean
          sender_id?: string
          was_filtered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kids_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "kids_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_mood_logs: {
        Row: {
          color: string | null
          log_date: string
          mood: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          log_date?: string
          mood: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          log_date?: string
          mood?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_multiplayer_room_players: {
        Row: {
          is_ready: boolean
          joined_at: string
          room_id: string
          score: number
          user_id: string
        }
        Insert: {
          is_ready?: boolean
          joined_at?: string
          room_id: string
          score?: number
          user_id: string
        }
        Update: {
          is_ready?: boolean
          joined_at?: string
          room_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_multiplayer_room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_multiplayer_rooms: {
        Row: {
          code: string
          created_at: string
          game_id: string | null
          host_id: string
          id: string
          is_public: boolean
          max_players: number
          room_name: string
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          game_id?: string | null
          host_id: string
          id?: string
          is_public?: boolean
          max_players?: number
          room_name?: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          game_id?: string | null
          host_id?: string
          id?: string
          is_public?: boolean
          max_players?: number
          room_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_multiplayer_rooms_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "kids_games"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          page_number: number | null
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          page_number?: number | null
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          page_number?: number | null
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_notes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          emoji: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          emoji?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          emoji?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_npcs: {
        Row: {
          content: Json
          created_at: string
          emoji: string
          greeting: string | null
          name: string
          order_index: number
          region: string | null
          role: string
          slug: string
          status: string
        }
        Insert: {
          content?: Json
          created_at?: string
          emoji?: string
          greeting?: string | null
          name: string
          order_index?: number
          region?: string | null
          role: string
          slug: string
          status?: string
        }
        Update: {
          content?: Json
          created_at?: string
          emoji?: string
          greeting?: string | null
          name?: string
          order_index?: number
          region?: string | null
          role?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      kids_offline_downloads: {
        Row: {
          content_kind: string
          device_key: string | null
          downloaded_at: string
          ref_id: string
          size_kb: number
          title: string
          user_id: string
        }
        Insert: {
          content_kind: string
          device_key?: string | null
          downloaded_at?: string
          ref_id: string
          size_kb?: number
          title: string
          user_id: string
        }
        Update: {
          content_kind?: string
          device_key?: string | null
          downloaded_at?: string
          ref_id?: string
          size_kb?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_offline_sessions: {
        Row: {
          device_key: string | null
          ended_at: string | null
          id: string
          minutes: number
          started_at: string
          user_id: string
        }
        Insert: {
          device_key?: string | null
          ended_at?: string | null
          id?: string
          minutes?: number
          started_at?: string
          user_id: string
        }
        Update: {
          device_key?: string | null
          ended_at?: string | null
          id?: string
          minutes?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_ops_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: number
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: never
        }
        Relationships: []
      }
      kids_ops_error_events: {
        Row: {
          count: number
          detail: Json
          first_seen: string
          id: string
          kind: string
          last_seen: string
          message: string
          resolved: boolean
        }
        Insert: {
          count?: number
          detail?: Json
          first_seen?: string
          id?: string
          kind?: string
          last_seen?: string
          message: string
          resolved?: boolean
        }
        Update: {
          count?: number
          detail?: Json
          first_seen?: string
          id?: string
          kind?: string
          last_seen?: string
          message?: string
          resolved?: boolean
        }
        Relationships: []
      }
      kids_ops_feature_flags: {
        Row: {
          channel: string
          description: string | null
          enabled: boolean
          key: string
          rollout_pct: number
          updated_at: string
        }
        Insert: {
          channel?: string
          description?: string | null
          enabled?: boolean
          key: string
          rollout_pct?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      kids_ops_health_snapshots: {
        Row: {
          captured_at: string
          detail: Json
          id: string
          latency_ms: number | null
          service: string
          status: string
        }
        Insert: {
          captured_at?: string
          detail?: Json
          id?: string
          latency_ms?: number | null
          service: string
          status?: string
        }
        Update: {
          captured_at?: string
          detail?: Json
          id?: string
          latency_ms?: number | null
          service?: string
          status?: string
        }
        Relationships: []
      }
      kids_ops_incidents: {
        Row: {
          area: string | null
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      kids_ops_logs: {
        Row: {
          created_at: string
          id: number
          level: string
          message: string
          meta: Json
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          level?: string
          message: string
          meta?: Json
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          level?: string
          message?: string
          meta?: Json
          source?: string | null
        }
        Relationships: []
      }
      kids_ops_maintenance: {
        Row: {
          admins_bypass: boolean
          enabled: boolean
          id: number
          message: string | null
          mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admins_bypass?: boolean
          enabled?: boolean
          id?: number
          message?: string | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admins_bypass?: boolean
          enabled?: boolean
          id?: number
          message?: string | null
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      kids_ops_releases: {
        Row: {
          channel: string
          deployed_at: string
          id: string
          notes: string | null
          status: string
          version: string
        }
        Insert: {
          channel?: string
          deployed_at?: string
          id?: string
          notes?: string | null
          status?: string
          version: string
        }
        Update: {
          channel?: string
          deployed_at?: string
          id?: string
          notes?: string | null
          status?: string
          version?: string
        }
        Relationships: []
      }
      kids_ops_reports: {
        Row: {
          created_at: string
          id: string
          kind: string
          metrics: Json
          score: number | null
          summary: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metrics?: Json
          score?: number | null
          summary?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json
          score?: number | null
          summary?: string | null
        }
        Relationships: []
      }
      kids_ops_reviews: {
        Row: {
          content_kind: string
          created_at: string
          flags: Json
          id: string
          notes: string | null
          ref_id: string | null
          reviewer_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content_kind: string
          created_at?: string
          flags?: Json
          id?: string
          notes?: string | null
          ref_id?: string | null
          reviewer_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content_kind?: string
          created_at?: string
          flags?: Json
          id?: string
          notes?: string | null
          ref_id?: string | null
          reviewer_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      kids_org_announcements: {
        Row: {
          audience: string
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          meeting_at: string | null
          org_id: string
          title: string
        }
        Insert: {
          audience?: string
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          meeting_at?: string | null
          org_id: string
          title: string
        }
        Update: {
          audience?: string
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          meeting_at?: string | null
          org_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_org_announcements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_org_certificates: {
        Row: {
          description: string | null
          id: string
          issued_at: string
          issued_by: string | null
          org_id: string
          signature: string | null
          status: string
          student_id: string
          student_name: string
          title: string
          verify_code: string
        }
        Insert: {
          description?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          org_id: string
          signature?: string | null
          status?: string
          student_id: string
          student_name: string
          title: string
          verify_code?: string
        }
        Update: {
          description?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          org_id?: string
          signature?: string | null
          status?: string
          student_id?: string
          student_name?: string
          title?: string
          verify_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_org_certificates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_org_members: {
        Row: {
          created_at: string
          display_name: string | null
          org_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          org_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          org_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_org_resources: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string
          id: string
          org_id: string
          title: string
          type: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          id?: string
          org_id: string
          title: string
          type?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          id?: string
          org_id?: string
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_org_resources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_organizations: {
        Row: {
          branding: Json
          created_at: string
          created_by: string | null
          domain: string | null
          id: string
          kind: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          status: string
          storage_quota_mb: number
        }
        Insert: {
          branding?: Json
          created_at?: string
          created_by?: string | null
          domain?: string | null
          id?: string
          kind?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          status?: string
          storage_quota_mb?: number
        }
        Update: {
          branding?: Json
          created_at?: string
          created_by?: string | null
          domain?: string | null
          id?: string
          kind?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          status?: string
          storage_quota_mb?: number
        }
        Relationships: []
      }
      kids_parent_child_links: {
        Row: {
          child_user_id: string
          family_id: string | null
          id: string
          linked_at: string
          parent_user_id: string
        }
        Insert: {
          child_user_id: string
          family_id?: string | null
          id?: string
          linked_at?: string
          parent_user_id: string
        }
        Update: {
          child_user_id?: string
          family_id?: string | null
          id?: string
          linked_at?: string
          parent_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_parent_child_links_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "kids_families"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_parent_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          redeemed_at: string | null
          student_user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          redeemed_at?: string | null
          student_user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          redeemed_at?: string | null
          student_user_id?: string
        }
        Relationships: []
      }
      kids_partners: {
        Row: {
          created_at: string
          description: string | null
          emoji: string
          kind: string
          name: string
          order_index: number
          slug: string
          status: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string
          kind: string
          name: string
          order_index?: number
          slug: string
          status?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string
          kind?: string
          name?: string
          order_index?: number
          slug?: string
          status?: string
          url?: string | null
        }
        Relationships: []
      }
      kids_platform_audit: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: never
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      kids_player_game_stats: {
        Row: {
          games_played: number
          total_play_seconds: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          games_played?: number
          total_play_seconds?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          games_played?: number
          total_play_seconds?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      kids_plugin_installs: {
        Row: {
          enabled: boolean
          granted_permissions: Json
          installed_at: string
          plugin_slug: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          granted_permissions?: Json
          installed_at?: string
          plugin_slug: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          granted_permissions?: Json
          installed_at?: string
          plugin_slug?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_plugin_installs_plugin_slug_fkey"
            columns: ["plugin_slug"]
            isOneToOne: false
            referencedRelation: "kids_plugins"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_plugin_versions: {
        Row: {
          changelog: string | null
          id: string
          is_current: boolean
          plugin_slug: string
          released_at: string
          version: string
        }
        Insert: {
          changelog?: string | null
          id?: string
          is_current?: boolean
          plugin_slug: string
          released_at?: string
          version: string
        }
        Update: {
          changelog?: string | null
          id?: string
          is_current?: boolean
          plugin_slug?: string
          released_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_plugin_versions_plugin_slug_fkey"
            columns: ["plugin_slug"]
            isOneToOne: false
            referencedRelation: "kids_plugins"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_plugins: {
        Row: {
          author: string
          category: string
          color: string
          created_at: string
          dependencies: Json
          emoji: string
          entry: string
          is_core: boolean
          license: string
          manifest: Json
          name: string
          order_index: number
          permissions: Json
          routes: Json
          slug: string
          status: string
          summary: string | null
        }
        Insert: {
          author?: string
          category: string
          color?: string
          created_at?: string
          dependencies?: Json
          emoji?: string
          entry: string
          is_core?: boolean
          license?: string
          manifest?: Json
          name: string
          order_index?: number
          permissions?: Json
          routes?: Json
          slug: string
          status?: string
          summary?: string | null
        }
        Update: {
          author?: string
          category?: string
          color?: string
          created_at?: string
          dependencies?: Json
          emoji?: string
          entry?: string
          is_core?: boolean
          license?: string
          manifest?: Json
          name?: string
          order_index?: number
          permissions?: Json
          routes?: Json
          slug?: string
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      kids_portfolio_items: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          emoji: string
          id: string
          kind: string
          source: string
          title: string
          track_slug: string | null
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          kind?: string
          source?: string
          title: string
          track_slug?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          kind?: string
          source?: string
          title?: string
          track_slug?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_portfolio_items_track_slug_fkey"
            columns: ["track_slug"]
            isOneToOne: false
            referencedRelation: "kids_talent_tracks"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_project_likes: {
        Row: {
          created_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_project_likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "kids_stem_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_projects: {
        Row: {
          age_range: string
          coins_reward: number
          course_id: string
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          title: string
          xp_reward: number
        }
        Insert: {
          age_range?: string
          coins_reward?: number
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          title: string
          xp_reward?: number
        }
        Update: {
          age_range?: string
          coins_reward?: number
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_projects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "kids_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_quest_progress: {
        Row: {
          activity_id: string
          completed_at: string | null
          period_start: string
          status: string
          user_id: string
        }
        Insert: {
          activity_id: string
          completed_at?: string | null
          period_start?: string
          status?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          completed_at?: string | null
          period_start?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_quest_progress_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "kids_world_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string
          id: string
          quiz_id: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string
          id?: string
          quiz_id: string
          score?: number
          total?: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          id?: string
          quiz_id?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "kids_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_quiz_questions: {
        Row: {
          correct_answer: string
          explanation: string | null
          id: string
          options: Json
          order_index: number
          points: number
          question: string
          quiz_id: string
          type: string
        }
        Insert: {
          correct_answer: string
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number
          points?: number
          question: string
          quiz_id: string
          type: string
        }
        Update: {
          correct_answer?: string
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number
          points?: number
          question?: string
          quiz_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "kids_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_quizzes: {
        Row: {
          course_id: string | null
          created_at: string
          group_id: string | null
          id: string
          lesson_id: string | null
          location_id: string | null
          story_id: string | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lesson_id?: string | null
          location_id?: string | null
          story_id?: string | null
          title?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lesson_id?: string | null
          location_id?: string | null
          story_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "kids_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_quizzes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kids_social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_quizzes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "kids_explorer_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_quizzes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_reading_progress: {
        Row: {
          audio_position_seconds: number
          completed: boolean
          current_node_id: string | null
          current_page: number
          last_read_at: string
          minutes_read: number
          progress_percent: number
          story_id: string
          user_id: string
        }
        Insert: {
          audio_position_seconds?: number
          completed?: boolean
          current_node_id?: string | null
          current_page?: number
          last_read_at?: string
          minutes_read?: number
          progress_percent?: number
          story_id: string
          user_id: string
        }
        Update: {
          audio_position_seconds?: number
          completed?: boolean
          current_node_id?: string | null
          current_page?: number
          last_read_at?: string
          minutes_read?: number
          progress_percent?: number
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_reading_progress_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "kids_story_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_reading_progress_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_reading_stats: {
        Row: {
          current_streak: number
          last_read_date: string | null
          longest_streak: number
          total_minutes_read: number
          total_stories_read: number
          total_words_read: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_read_date?: string | null
          longest_streak?: number
          total_minutes_read?: number
          total_stories_read?: number
          total_words_read?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_read_date?: string | null
          longest_streak?: number
          total_minutes_read?: number
          total_stories_read?: number
          total_words_read?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_recently_viewed: {
        Row: {
          id: string
          story_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          story_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_recently_viewed_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_redeemables: {
        Row: {
          category: string
          color: string
          cost_coins: number
          created_at: string
          emoji: string
          name: string
          order_index: number
          slug: string
          status: string
        }
        Insert: {
          category: string
          color?: string
          cost_coins: number
          created_at?: string
          emoji?: string
          name: string
          order_index?: number
          slug: string
          status?: string
        }
        Update: {
          category?: string
          color?: string
          cost_coins?: number
          created_at?: string
          emoji?: string
          name?: string
          order_index?: number
          slug?: string
          status?: string
        }
        Relationships: []
      }
      kids_redemptions: {
        Row: {
          redeemable_slug: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          redeemable_slug: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          redeemable_slug?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_redemptions_redeemable_slug_fkey"
            columns: ["redeemable_slug"]
            isOneToOne: false
            referencedRelation: "kids_redeemables"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_region_visits: {
        Row: {
          first_visited_at: string
          region_slug: string
          user_id: string
        }
        Insert: {
          first_visited_at?: string
          region_slug: string
          user_id: string
        }
        Update: {
          first_visited_at?: string
          region_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_replay_progress: {
        Row: {
          position_seconds: number
          replay_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          position_seconds?: number
          replay_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          position_seconds?: number
          replay_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_replay_progress_replay_id_fkey"
            columns: ["replay_id"]
            isOneToOne: false
            referencedRelation: "kids_event_replays"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_research_articles: {
        Row: {
          body: string | null
          category: string
          color: string
          created_at: string
          emoji: string
          fun_facts: Json
          id: string
          images: Json
          order_index: number
          reading_level: string
          slug: string
          status: string
          summary: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          body?: string | null
          category?: string
          color?: string
          created_at?: string
          emoji?: string
          fun_facts?: Json
          id?: string
          images?: Json
          order_index?: number
          reading_level?: string
          slug: string
          status?: string
          summary?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          color?: string
          created_at?: string
          emoji?: string
          fun_facts?: Json
          id?: string
          images?: Json
          order_index?: number
          reading_level?: string
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      kids_research_reads: {
        Row: {
          article_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_research_reads_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kids_research_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_schools: {
        Row: {
          address: string | null
          created_at: string
          id: string
          kind: string
          logo_url: string | null
          name: string
          order_index: number
          org_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          kind?: string
          logo_url?: string | null
          name: string
          order_index?: number
          org_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          kind?: string
          logo_url?: string | null
          name?: string
          order_index?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_schools_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_search_history: {
        Row: {
          created_at: string
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_season_events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          icon: string | null
          id: string
          is_active: boolean
          key: string
          region_gated: boolean
          starts_at: string
          theme_color: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          region_gated?: boolean
          starts_at: string
          theme_color?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          region_gated?: boolean
          starts_at?: string
          theme_color?: string | null
          title?: string
        }
        Relationships: []
      }
      kids_skill_progress: {
        Row: {
          completed_at: string | null
          completed_tasks: number
          skill_slug: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_tasks?: number
          skill_slug: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_tasks?: number
          skill_slug?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_skill_progress_skill_slug_fkey"
            columns: ["skill_slug"]
            isOneToOne: false
            referencedRelation: "kids_skills"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_skills: {
        Row: {
          badge_key: string | null
          created_at: string
          description: string | null
          domain_slug: string
          emoji: string
          order_index: number
          prerequisites: string[]
          reward_coins: number
          reward_xp: number
          slug: string
          status: string
          tasks: Json
          tier: number
          title: string
        }
        Insert: {
          badge_key?: string | null
          created_at?: string
          description?: string | null
          domain_slug: string
          emoji?: string
          order_index?: number
          prerequisites?: string[]
          reward_coins?: number
          reward_xp?: number
          slug: string
          status?: string
          tasks?: Json
          tier?: number
          title: string
        }
        Update: {
          badge_key?: string | null
          created_at?: string
          description?: string | null
          domain_slug?: string
          emoji?: string
          order_index?: number
          prerequisites?: string[]
          reward_coins?: number
          reward_xp?: number
          slug?: string
          status?: string
          tasks?: Json
          tier?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_skills_domain_slug_fkey"
            columns: ["domain_slug"]
            isOneToOne: false
            referencedRelation: "kids_talent_domains"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_sleep_logs: {
        Row: {
          bedtime: string | null
          duration_minutes: number | null
          log_date: string
          quality: string | null
          updated_at: string
          user_id: string
          wake_time: string | null
        }
        Insert: {
          bedtime?: string | null
          duration_minutes?: number | null
          log_date?: string
          quality?: string | null
          updated_at?: string
          user_id: string
          wake_time?: string | null
        }
        Update: {
          bedtime?: string | null
          duration_minutes?: number | null
          log_date?: string
          quality?: string | null
          updated_at?: string
          user_id?: string
          wake_time?: string | null
        }
        Relationships: []
      }
      kids_social_challenge_participants: {
        Row: {
          challenge_id: string
          completed_at: string | null
          joined_at: string
          score: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          joined_at?: string
          score?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          joined_at?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "kids_social_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          description: string | null
          ends_at: string
          group_id: string | null
          id: string
          reward_coins: number
          reward_xp: number
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          challenge_type?: string
          created_at?: string
          description?: string | null
          ends_at: string
          group_id?: string | null
          id?: string
          reward_coins?: number
          reward_xp?: number
          starts_at?: string
          status?: string
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string | null
          ends_at?: string
          group_id?: string | null
          id?: string
          reward_coins?: number
          reward_xp?: number
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_challenges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kids_social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_group_assignment_submissions: {
        Row: {
          assignment_id: string
          content: string | null
          file_url: string | null
          id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          file_url?: string | null
          id?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          file_url?: string | null
          id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_group_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "kids_social_group_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_group_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          group_id: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          group_id: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          group_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_group_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kids_social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_group_materials: {
        Row: {
          created_at: string
          file_url: string
          group_id: string
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          group_id: string
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          group_id?: string
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_group_materials_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kids_social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kids_social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_group_messages: {
        Row: {
          content: string
          created_at: string
          flagged_categories: string[]
          group_id: string
          id: string
          is_flagged: boolean
          user_id: string
          was_filtered: boolean
        }
        Insert: {
          content: string
          created_at?: string
          flagged_categories?: string[]
          group_id: string
          id?: string
          is_flagged?: boolean
          user_id: string
          was_filtered?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          flagged_categories?: string[]
          group_id?: string
          id?: string
          is_flagged?: boolean
          user_id?: string
          was_filtered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kids_social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_groups: {
        Row: {
          created_at: string
          description: string | null
          emoji: string
          group_type: string
          id: string
          is_public: boolean
          max_members: number
          name: string
          owner_id: string | null
          slug: string
          status: string
          story_of_week_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string
          group_type: string
          id?: string
          is_public?: boolean
          max_members?: number
          name: string
          owner_id?: string | null
          slug: string
          status?: string
          story_of_week_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string
          group_type?: string
          id?: string
          is_public?: boolean
          max_members?: number
          name?: string
          owner_id?: string | null
          slug?: string
          status?: string
          story_of_week_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_social_groups_story_of_week_id_fkey"
            columns: ["story_of_week_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_social_user_moderation: {
        Row: {
          action: string
          created_at: string
          expires_at: string | null
          id: string
          moderator_id: string | null
          reason: string | null
          scope_id: string | null
          scope_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          expires_at?: string | null
          id?: string
          moderator_id?: string | null
          reason?: string | null
          scope_id?: string | null
          scope_type?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          moderator_id?: string | null
          reason?: string | null
          scope_id?: string | null
          scope_type?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_stem_labs: {
        Row: {
          color: string
          created_at: string
          emoji: string
          kind: string
          order_index: number
          slug: string
          status: string
          subtitle: string | null
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string
          kind?: string
          order_index?: number
          slug: string
          status?: string
          subtitle?: string | null
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string
          kind?: string
          order_index?: number
          slug?: string
          status?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      kids_stem_projects: {
        Row: {
          challenge_id: string | null
          created_at: string
          data: Json
          description: string | null
          emoji: string
          id: string
          is_public: boolean
          kind: string
          lab: string | null
          likes: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          data?: Json
          description?: string | null
          emoji?: string
          id?: string
          is_public?: boolean
          kind: string
          lab?: string | null
          likes?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          data?: Json
          description?: string | null
          emoji?: string
          id?: string
          is_public?: boolean
          kind?: string
          lab?: string | null
          likes?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_stem_projects_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "kids_innovation_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_stem_settings: {
        Row: {
          audio_descriptions: boolean
          simple_language: boolean
          updated_at: string
          user_id: string
          voice_commands: boolean
        }
        Insert: {
          audio_descriptions?: boolean
          simple_language?: boolean
          updated_at?: string
          user_id: string
          voice_commands?: boolean
        }
        Update: {
          audio_descriptions?: boolean
          simple_language?: boolean
          updated_at?: string
          user_id?: string
          voice_commands?: boolean
        }
        Relationships: []
      }
      kids_stories: {
        Row: {
          accessibility_features: Json
          age_group: string
          audio_url: string | null
          author_id: string | null
          bookmarks_count: number
          brf_url: string | null
          category_id: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string
          downloads_count: number
          duration_minutes: number | null
          epub_url: string | null
          gallery: Json
          id: string
          is_ai_generated: boolean
          is_interactive: boolean
          language: string
          likes_count: number
          narrator_id: string | null
          page_count: number
          pdf_url: string | null
          published_at: string | null
          rating_avg: number
          rating_count: number
          reading_time_minutes: number | null
          search_vector: unknown
          slug: string
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          translator: string | null
          updated_at: string
          video_url: string | null
          views_count: number
        }
        Insert: {
          accessibility_features?: Json
          age_group?: string
          audio_url?: string | null
          author_id?: string | null
          bookmarks_count?: number
          brf_url?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string
          downloads_count?: number
          duration_minutes?: number | null
          epub_url?: string | null
          gallery?: Json
          id?: string
          is_ai_generated?: boolean
          is_interactive?: boolean
          language?: string
          likes_count?: number
          narrator_id?: string | null
          page_count?: number
          pdf_url?: string | null
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          reading_time_minutes?: number | null
          search_vector?: unknown
          slug: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title: string
          translator?: string | null
          updated_at?: string
          video_url?: string | null
          views_count?: number
        }
        Update: {
          accessibility_features?: Json
          age_group?: string
          audio_url?: string | null
          author_id?: string | null
          bookmarks_count?: number
          brf_url?: string | null
          category_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string
          downloads_count?: number
          duration_minutes?: number | null
          epub_url?: string | null
          gallery?: Json
          id?: string
          is_ai_generated?: boolean
          is_interactive?: boolean
          language?: string
          likes_count?: number
          narrator_id?: string | null
          page_count?: number
          pdf_url?: string | null
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          reading_time_minutes?: number | null
          search_vector?: unknown
          slug?: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          translator?: string | null
          updated_at?: string
          video_url?: string | null
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "kids_story_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_stories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kids_story_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_stories_narrator_id_fkey"
            columns: ["narrator_id"]
            isOneToOne: false
            referencedRelation: "kids_story_narrators"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_story_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      kids_story_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          story_count: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          story_count?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          story_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      kids_story_chapters: {
        Row: {
          audio_start_seconds: number | null
          chapter_number: number
          created_at: string
          id: string
          start_page: number
          story_id: string
          title: string
        }
        Insert: {
          audio_start_seconds?: number | null
          chapter_number: number
          created_at?: string
          id?: string
          start_page?: number
          story_id: string
          title: string
        }
        Update: {
          audio_start_seconds?: number | null
          chapter_number?: number
          created_at?: string
          id?: string
          start_page?: number
          story_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_story_chapters_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_story_choices: {
        Row: {
          choice_text: string
          id: string
          next_node_id: string | null
          node_id: string
          order_index: number
        }
        Insert: {
          choice_text: string
          id?: string
          next_node_id?: string | null
          node_id: string
          order_index?: number
        }
        Update: {
          choice_text?: string
          id?: string
          next_node_id?: string | null
          node_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "kids_story_choices_next_node_id_fkey"
            columns: ["next_node_id"]
            isOneToOne: false
            referencedRelation: "kids_story_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_story_choices_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "kids_story_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_story_narrators: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          voice_sample_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          voice_sample_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          voice_sample_url?: string | null
        }
        Relationships: []
      }
      kids_story_nodes: {
        Row: {
          audio_url: string | null
          created_at: string
          ending_type: string | null
          id: string
          image_url: string | null
          is_ending: boolean
          is_start: boolean
          node_key: string
          story_id: string
          text_content: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          ending_type?: string | null
          id?: string
          image_url?: string | null
          is_ending?: boolean
          is_start?: boolean
          node_key: string
          story_id: string
          text_content?: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          ending_type?: string | null
          id?: string
          image_url?: string | null
          is_ending?: boolean
          is_start?: boolean
          node_key?: string
          story_id?: string
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_story_nodes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_story_pages: {
        Row: {
          audio_start_seconds: number | null
          chapter_id: string | null
          created_at: string
          id: string
          image_url: string | null
          page_number: number
          story_id: string
          text_content: string
        }
        Insert: {
          audio_start_seconds?: number | null
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_number: number
          story_id: string
          text_content?: string
        }
        Update: {
          audio_start_seconds?: number | null
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_number?: number
          story_id?: string
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_story_pages_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "kids_story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_story_pages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_story_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          review: string | null
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          review?: string | null
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          review?: string | null
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_story_ratings_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "kids_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_student_projects: {
        Row: {
          feedback: string | null
          file_urls: string[]
          grade: number | null
          graded_at: string | null
          id: string
          project_id: string
          status: string
          submitted_at: string
          text_content: string | null
          user_id: string
        }
        Insert: {
          feedback?: string | null
          file_urls?: string[]
          grade?: number | null
          graded_at?: string | null
          id?: string
          project_id: string
          status?: string
          submitted_at?: string
          text_content?: string | null
          user_id: string
        }
        Update: {
          feedback?: string | null
          file_urls?: string[]
          grade?: number | null
          graded_at?: string | null
          id?: string
          project_id?: string
          status?: string
          submitted_at?: string
          text_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_student_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "kids_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_subjects: {
        Row: {
          applicable_age_ranges: string[]
          color: string | null
          course_count: number
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          applicable_age_ranges?: string[]
          color?: string | null
          course_count?: number
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          applicable_age_ranges?: string[]
          color?: string | null
          course_count?: number
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      kids_subscription_plans: {
        Row: {
          audience: string
          color: string
          created_at: string
          emoji: string
          features: Json
          name: string
          order_index: number
          period: string
          price_usd: number
          slug: string
          status: string
          tier: string
        }
        Insert: {
          audience?: string
          color?: string
          created_at?: string
          emoji?: string
          features?: Json
          name: string
          order_index?: number
          period?: string
          price_usd?: number
          slug: string
          status?: string
          tier: string
        }
        Update: {
          audience?: string
          color?: string
          created_at?: string
          emoji?: string
          features?: Json
          name?: string
          order_index?: number
          period?: string
          price_usd?: number
          slug?: string
          status?: string
          tier?: string
        }
        Relationships: []
      }
      kids_subscriptions: {
        Row: {
          approved_by: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          org_id: string | null
          plan_slug: string
          provider: string
          renews_at: string | null
          started_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          approved_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          plan_slug: string
          provider?: string
          renews_at?: string | null
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          approved_by?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          plan_slug?: string
          provider?: string
          renews_at?: string | null
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_subscriptions_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "kids_subscription_plans"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_sync_events: {
        Row: {
          created_at: string
          detail: Json
          device_key: string | null
          entity: string | null
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          device_key?: string | null
          entity?: string | null
          id?: never
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          device_key?: string | null
          entity?: string | null
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_sync_queue: {
        Row: {
          client_ts: string
          created_at: string
          device_key: string | null
          entity: string
          entity_id: string | null
          id: string
          op: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          client_ts: string
          created_at?: string
          device_key?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          op?: string
          payload?: Json
          status?: string
          user_id: string
        }
        Update: {
          client_ts?: string
          created_at?: string
          device_key?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          op?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_talent_assessment_questions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          options: Json
          order_index: number
          prompt: string
          status: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          options?: Json
          order_index?: number
          prompt: string
          status?: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          options?: Json
          order_index?: number
          prompt?: string
          status?: string
        }
        Relationships: []
      }
      kids_talent_domains: {
        Row: {
          color: string
          created_at: string
          description: string | null
          emoji: string
          order_index: number
          slug: string
          status: string
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          slug: string
          status?: string
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          order_index?: number
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      kids_talent_results: {
        Row: {
          domain_scores: Json
          taken_at: string
          top_domains: string[]
          user_id: string
        }
        Insert: {
          domain_scores?: Json
          taken_at?: string
          top_domains?: string[]
          user_id: string
        }
        Update: {
          domain_scores?: Json
          taken_at?: string
          top_domains?: string[]
          user_id?: string
        }
        Relationships: []
      }
      kids_talent_tracks: {
        Row: {
          color: string
          created_at: string
          description: string | null
          emoji: string
          is_future_track: boolean
          order_index: number
          primary_domain: string | null
          slug: string
          status: string
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          is_future_track?: boolean
          order_index?: number
          primary_domain?: string | null
          slug: string
          status?: string
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          is_future_track?: boolean
          order_index?: number
          primary_domain?: string | null
          slug?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_talent_tracks_primary_domain_fkey"
            columns: ["primary_domain"]
            isOneToOne: false
            referencedRelation: "kids_talent_domains"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_teacher_profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string | null
          is_approved: boolean
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          is_approved?: boolean
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          is_approved?: boolean
          user_id?: string
        }
        Relationships: []
      }
      kids_theme_prefs: {
        Row: {
          theme_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          theme_slug?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          theme_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_theme_prefs_theme_slug_fkey"
            columns: ["theme_slug"]
            isOneToOne: false
            referencedRelation: "kids_themes"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_themes: {
        Row: {
          created_at: string
          data_theme: string
          emoji: string
          is_seasonal: boolean
          name: string
          order_index: number
          slug: string
          status: string
          variant: string
        }
        Insert: {
          created_at?: string
          data_theme: string
          emoji?: string
          is_seasonal?: boolean
          name: string
          order_index?: number
          slug: string
          status?: string
          variant?: string
        }
        Update: {
          created_at?: string
          data_theme?: string
          emoji?: string
          is_seasonal?: boolean
          name?: string
          order_index?: number
          slug?: string
          status?: string
          variant?: string
        }
        Relationships: []
      }
      kids_timetable: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          org_id: string
          period: number
          recurring: boolean
          start_time: string | null
          subject: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          org_id: string
          period?: number
          recurring?: boolean
          start_time?: string | null
          subject: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          org_id?: string
          period?: number
          recurring?: boolean
          start_time?: string | null
          subject?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_timetable_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "kids_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_timetable_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "kids_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_track_module_progress: {
        Row: {
          completed_at: string
          module_id: string
          track_slug: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          module_id: string
          track_slug: string
          user_id: string
        }
        Update: {
          completed_at?: string
          module_id?: string
          track_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_track_module_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "kids_track_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_track_module_progress_track_slug_fkey"
            columns: ["track_slug"]
            isOneToOne: false
            referencedRelation: "kids_talent_tracks"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_track_modules: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          emoji: string
          id: string
          kind: string
          order_index: number
          reward_coins: number
          reward_xp: number
          slug: string
          status: string
          title: string
          track_slug: string
        }
        Insert: {
          content?: Json
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          kind?: string
          order_index?: number
          reward_coins?: number
          reward_xp?: number
          slug: string
          status?: string
          title: string
          track_slug: string
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          kind?: string
          order_index?: number
          reward_coins?: number
          reward_xp?: number
          slug?: string
          status?: string
          title?: string
          track_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_track_modules_track_slug_fkey"
            columns: ["track_slug"]
            isOneToOne: false
            referencedRelation: "kids_talent_tracks"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_transport_unlocks: {
        Row: {
          transport_slug: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          transport_slug: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          transport_slug?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_transport_unlocks_transport_slug_fkey"
            columns: ["transport_slug"]
            isOneToOne: false
            referencedRelation: "kids_transportation"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_transportation: {
        Row: {
          created_at: string
          emoji: string
          name: string
          order_index: number
          slug: string
          speed: number
          status: string
          unlock_achievement: string | null
        }
        Insert: {
          created_at?: string
          emoji?: string
          name: string
          order_index?: number
          slug: string
          speed?: number
          status?: string
          unlock_achievement?: string | null
        }
        Update: {
          created_at?: string
          emoji?: string
          name?: string
          order_index?: number
          slug?: string
          speed?: number
          status?: string
          unlock_achievement?: string | null
        }
        Relationships: []
      }
      kids_units: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_units_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "kids_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_universe_characters: {
        Row: {
          bio: string | null
          city_slug: string
          created_at: string
          emoji: string
          id: string
          name: string
        }
        Insert: {
          bio?: string | null
          city_slug: string
          created_at?: string
          emoji: string
          id?: string
          name: string
        }
        Update: {
          bio?: string | null
          city_slug?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_universe_characters_city_slug_fkey"
            columns: ["city_slug"]
            isOneToOne: false
            referencedRelation: "kids_universe_cities"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_universe_cities: {
        Row: {
          color: string
          created_at: string
          description: string | null
          emoji: string
          name: string
          order_index: number
          slug: string
          theme: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          emoji: string
          name: string
          order_index?: number
          slug: string
          theme: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          name?: string
          order_index?: number
          slug?: string
          theme?: string
        }
        Relationships: []
      }
      kids_universe_city_visits: {
        Row: {
          city_slug: string
          first_visited_at: string
          user_id: string
        }
        Insert: {
          city_slug: string
          first_visited_at?: string
          user_id: string
        }
        Update: {
          city_slug?: string
          first_visited_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_universe_city_visits_city_slug_fkey"
            columns: ["city_slug"]
            isOneToOne: false
            referencedRelation: "kids_universe_cities"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_usage_pings: {
        Row: {
          category: string
          child_user_id: string
          id: string
          pinged_at: string
          seconds: number
        }
        Insert: {
          category: string
          child_user_id: string
          id?: string
          pinged_at?: string
          seconds?: number
        }
        Update: {
          category?: string
          child_user_id?: string
          id?: string
          pinged_at?: string
          seconds?: number
        }
        Relationships: []
      }
      kids_user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "kids_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_user_daily_challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          current_value: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          current_value?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          current_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_user_daily_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "kids_daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_user_limited_rewards: {
        Row: {
          claimed_at: string
          reward_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          reward_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          reward_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_user_limited_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "kids_event_limited_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_user_mutes: {
        Row: {
          created_at: string
          muted_user_id: string
          muter_id: string
        }
        Insert: {
          created_at?: string
          muted_user_id: string
          muter_id: string
        }
        Update: {
          created_at?: string
          muted_user_id?: string
          muter_id?: string
        }
        Relationships: []
      }
      kids_user_preferences: {
        Row: {
          audio_guidance: boolean
          auto_download: boolean
          low_data: boolean
          tv_mode: boolean
          updated_at: string
          user_id: string
          wifi_only: boolean
        }
        Insert: {
          audio_guidance?: boolean
          auto_download?: boolean
          low_data?: boolean
          tv_mode?: boolean
          updated_at?: string
          user_id: string
          wifi_only?: boolean
        }
        Update: {
          audio_guidance?: boolean
          auto_download?: boolean
          low_data?: boolean
          tv_mode?: boolean
          updated_at?: string
          user_id?: string
          wifi_only?: boolean
        }
        Relationships: []
      }
      kids_user_weekly_challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          current_value: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          current_value?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          current_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_user_weekly_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "kids_weekly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_voice_room_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_voice_room_bans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_voice_room_members: {
        Row: {
          is_listener: boolean
          is_muted: boolean
          joined_at: string
          raised_at: string | null
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          is_listener?: boolean
          is_muted?: boolean
          joined_at?: string
          raised_at?: string | null
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          is_listener?: boolean
          is_muted?: boolean
          joined_at?: string
          raised_at?: string | null
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_voice_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_voice_room_recording_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          room_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          room_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_voice_room_recording_log_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "kids_voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_voice_rooms: {
        Row: {
          allow_chat: boolean
          created_at: string
          ended_at: string | null
          group_id: string | null
          id: string
          is_private: boolean
          max_users: number
          owner_id: string | null
          recording_active: boolean
          room_name: string
          room_password: string | null
          scheduled_at: string | null
          status: string
          topic: string | null
        }
        Insert: {
          allow_chat?: boolean
          created_at?: string
          ended_at?: string | null
          group_id?: string | null
          id?: string
          is_private?: boolean
          max_users?: number
          owner_id?: string | null
          recording_active?: boolean
          room_name: string
          room_password?: string | null
          scheduled_at?: string | null
          status?: string
          topic?: string | null
        }
        Update: {
          allow_chat?: boolean
          created_at?: string
          ended_at?: string | null
          group_id?: string | null
          id?: string
          is_private?: boolean
          max_users?: number
          owner_id?: string | null
          recording_active?: boolean
          room_name?: string
          room_password?: string | null
          scheduled_at?: string | null
          status?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_voice_rooms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kids_social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_weekly_challenges: {
        Row: {
          created_at: string
          description: string | null
          game_id: string | null
          id: string
          lesson_id: string | null
          reward_coins: number
          reward_xp: number
          target_type: string
          target_value: number
          title: string
          week_start: string
          world_slug: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          lesson_id?: string | null
          reward_coins?: number
          reward_xp?: number
          target_type: string
          target_value?: number
          title: string
          week_start: string
          world_slug?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          lesson_id?: string | null
          reward_coins?: number
          reward_xp?: number
          target_type?: string
          target_value?: number
          title?: string
          week_start?: string
          world_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_weekly_challenges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "kids_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_weekly_challenges_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_weekly_challenges_world_slug_fkey"
            columns: ["world_slug"]
            isOneToOne: false
            referencedRelation: "kids_explorer_worlds"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_wellness_habits: {
        Row: {
          color: string
          created_at: string
          description: string | null
          emoji: string
          kind: string
          order_index: number
          reward_coins: number
          reward_xp: number
          routine_slot: string
          slug: string
          status: string
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          kind?: string
          order_index?: number
          reward_coins?: number
          reward_xp?: number
          routine_slot?: string
          slug: string
          status?: string
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          emoji?: string
          kind?: string
          order_index?: number
          reward_coins?: number
          reward_xp?: number
          routine_slot?: string
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      kids_wellness_lessons: {
        Row: {
          body: string | null
          category: string
          color: string
          content: Json
          created_at: string
          duration_seconds: number | null
          emoji: string
          id: string
          order_index: number
          slug: string
          status: string
          steps: Json
          summary: string | null
          title: string
          topic: string
        }
        Insert: {
          body?: string | null
          category: string
          color?: string
          content?: Json
          created_at?: string
          duration_seconds?: number | null
          emoji?: string
          id?: string
          order_index?: number
          slug: string
          status?: string
          steps?: Json
          summary?: string | null
          title: string
          topic: string
        }
        Update: {
          body?: string | null
          category?: string
          color?: string
          content?: Json
          created_at?: string
          duration_seconds?: number | null
          emoji?: string
          id?: string
          order_index?: number
          slug?: string
          status?: string
          steps?: Json
          summary?: string | null
          title?: string
          topic?: string
        }
        Relationships: []
      }
      kids_wellness_sessions: {
        Row: {
          id: string
          kind: string
          logged_at: string
          minutes: number
          ref_slug: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          logged_at?: string
          minutes?: number
          ref_slug: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          logged_at?: string
          minutes?: number
          ref_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_wellness_settings: {
        Row: {
          country_code: string
          custom_emergency: Json
          reminders_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code?: string
          custom_emergency?: Json
          reminders_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string
          custom_emergency?: Json
          reminders_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_widgets: {
        Row: {
          created_at: string
          emoji: string
          entry: string
          name: string
          needs_auth: boolean
          order_index: number
          size: string
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          entry: string
          name: string
          needs_auth?: boolean
          order_index?: number
          size?: string
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          emoji?: string
          entry?: string
          name?: string
          needs_auth?: boolean
          order_index?: number
          size?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      kids_worksheets: {
        Row: {
          course_id: string | null
          created_at: string
          file_url: string
          id: string
          lesson_id: string | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          file_url: string
          id?: string
          lesson_id?: string | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          file_url?: string
          id?: string
          lesson_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_worksheets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "kids_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_worksheets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "kids_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_world_activities: {
        Row: {
          cadence: string
          content: Json
          created_at: string
          emoji: string
          id: string
          kind: string
          npc_slug: string | null
          order_index: number
          region: string
          reward_coins: number
          reward_xp: number
          slug: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          cadence?: string
          content?: Json
          created_at?: string
          emoji?: string
          id?: string
          kind?: string
          npc_slug?: string | null
          order_index?: number
          region: string
          reward_coins?: number
          reward_xp?: number
          slug: string
          status?: string
          summary?: string | null
          title: string
        }
        Update: {
          cadence?: string
          content?: Json
          created_at?: string
          emoji?: string
          id?: string
          kind?: string
          npc_slug?: string | null
          order_index?: number
          region?: string
          reward_coins?: number
          reward_xp?: number
          slug?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      kids_world_audit: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: never
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      kids_world_homes: {
        Row: {
          created_at: string
          name: string
          rooms: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          name?: string
          rooms?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          name?: string
          rooms?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_world_inventory: {
        Row: {
          acquired_at: string
          category: string
          item_slug: string
          placed: boolean
          pos_x: number | null
          pos_y: number | null
          room: string | null
          user_id: string
        }
        Insert: {
          acquired_at?: string
          category: string
          item_slug: string
          placed?: boolean
          pos_x?: number | null
          pos_y?: number | null
          room?: string | null
          user_id: string
        }
        Update: {
          acquired_at?: string
          category?: string
          item_slug?: string
          placed?: boolean
          pos_x?: number | null
          pos_y?: number | null
          room?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kids_world_inventory_item_slug_fkey"
            columns: ["item_slug"]
            isOneToOne: false
            referencedRelation: "kids_marketplace_items"
            referencedColumns: ["slug"]
          },
        ]
      }
      kids_world_regions: {
        Row: {
          color: string
          created_at: string
          emoji: string
          kind: string
          map_x: number
          map_y: number
          order_index: number
          parent_slug: string | null
          route: string | null
          slug: string
          status: string
          subtitle: string | null
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string
          kind?: string
          map_x?: number
          map_y?: number
          order_index?: number
          parent_slug?: string | null
          route?: string | null
          slug: string
          status?: string
          subtitle?: string | null
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string
          kind?: string
          map_x?: number
          map_y?: number
          order_index?: number
          parent_slug?: string | null
          route?: string | null
          slug?: string
          status?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      kids_world_settings: {
        Row: {
          audio_navigation: boolean
          current_transport: string
          updated_at: string
          user_id: string
          voice_commands: boolean
          weather: string
        }
        Insert: {
          audio_navigation?: boolean
          current_transport?: string
          updated_at?: string
          user_id: string
          voice_commands?: boolean
          weather?: string
        }
        Update: {
          audio_navigation?: boolean
          current_transport?: string
          updated_at?: string
          user_id?: string
          voice_commands?: boolean
          weather?: string
        }
        Relationships: []
      }
      kids_xp_events: {
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
      library_academy_course_books: {
        Row: {
          academy_course_id: string
          book_id: string
          id: string
          is_required: boolean
          order_index: number
        }
        Insert: {
          academy_course_id: string
          book_id: string
          id?: string
          is_required?: boolean
          order_index?: number
        }
        Update: {
          academy_course_id?: string
          book_id?: string
          id?: string
          is_required?: boolean
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_academy_course_books_academy_course_id_fkey"
            columns: ["academy_course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_academy_course_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_achievements: {
        Row: {
          code: string
          created_at: string
          criteria: Json
          description: string | null
          icon: string | null
          id: string
          name: string
          reward_vx: number
        }
        Insert: {
          code: string
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          reward_vx?: number
        }
        Update: {
          code?: string
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          reward_vx?: number
        }
        Relationships: []
      }
      library_ai_activity_log: {
        Row: {
          activity_type: string
          book_id: string
          created_at: string
          id: string
          metadata: Json
          snippet: string
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          book_id: string
          created_at?: string
          id?: string
          metadata?: Json
          snippet: string
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          book_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          snippet?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_ai_activity_log_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_ai_chat_sessions: {
        Row: {
          book_id: string | null
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          session_type: string
          title: string | null
          user_id: string
        }
        Insert: {
          book_id?: string | null
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          session_type?: string
          title?: string | null
          user_id: string
        }
        Update: {
          book_id?: string | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          session_type?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_ai_chat_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_ai_content_cache: {
        Row: {
          action: string
          content_hash: string
          created_at: string
          id: string
          result_text: string
        }
        Insert: {
          action: string
          content_hash: string
          created_at?: string
          id?: string
          result_text: string
        }
        Update: {
          action?: string
          content_hash?: string
          created_at?: string
          id?: string
          result_text?: string
        }
        Relationships: []
      }
      library_ai_flashcards: {
        Row: {
          back: string
          book_id: string
          chapter_id: string | null
          created_at: string
          front: string
          id: string
          mastered: boolean
          user_id: string
        }
        Insert: {
          back: string
          book_id: string
          chapter_id?: string | null
          created_at?: string
          front: string
          id?: string
          mastered?: boolean
          user_id: string
        }
        Update: {
          back?: string
          book_id?: string
          chapter_id?: string | null
          created_at?: string
          front?: string
          id?: string
          mastered?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_ai_flashcards_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_ai_flashcards_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_ai_preferences: {
        Row: {
          accessibility_preferences: Json
          last_translation_language: string | null
          learning_style: string | null
          listening_speed_preference: number
          memory_paused: boolean
          memory_paused_at: string | null
          preferred_book_length: string | null
          preferred_reading_time: string | null
          reading_mode: string
          reading_speed_pages_per_hour: number | null
          speech_pitch: number
          speech_speed: number
          updated_at: string
          user_id: string
          voice: string
        }
        Insert: {
          accessibility_preferences?: Json
          last_translation_language?: string | null
          learning_style?: string | null
          listening_speed_preference?: number
          memory_paused?: boolean
          memory_paused_at?: string | null
          preferred_book_length?: string | null
          preferred_reading_time?: string | null
          reading_mode?: string
          reading_speed_pages_per_hour?: number | null
          speech_pitch?: number
          speech_speed?: number
          updated_at?: string
          user_id: string
          voice?: string
        }
        Update: {
          accessibility_preferences?: Json
          last_translation_language?: string | null
          learning_style?: string | null
          listening_speed_preference?: number
          memory_paused?: boolean
          memory_paused_at?: string | null
          preferred_book_length?: string | null
          preferred_reading_time?: string | null
          reading_mode?: string
          reading_speed_pages_per_hour?: number | null
          speech_pitch?: number
          speech_speed?: number
          updated_at?: string
          user_id?: string
          voice?: string
        }
        Relationships: []
      }
      library_ai_quiz_attempts: {
        Row: {
          answers: Json
          book_id: string
          chapter_id: string | null
          created_at: string
          id: string
          quiz: Json
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers: Json
          book_id: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          quiz: Json
          score: number
          total: number
          user_id: string
        }
        Update: {
          answers?: Json
          book_id?: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          quiz?: Json
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_ai_quiz_attempts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_ai_quiz_attempts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_ai_summaries: {
        Row: {
          book_id: string
          chapter_id: string | null
          content: string
          created_at: string
          id: string
          length: string
          scope: string
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          content: string
          created_at?: string
          id?: string
          length: string
          scope: string
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          content?: string
          created_at?: string
          id?: string
          length?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_ai_summaries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_ai_summaries_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_analytics_events: {
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
      library_audiobook_chapters: {
        Row: {
          audio_file_id: string | null
          audiobook_id: string
          book_id: string
          chapter_number: number
          created_at: string
          duration_seconds: number
          id: string
          is_ai_generated: boolean
          is_free_preview: boolean
          order_index: number
          title: string | null
        }
        Insert: {
          audio_file_id?: string | null
          audiobook_id: string
          book_id: string
          chapter_number: number
          created_at?: string
          duration_seconds?: number
          id?: string
          is_ai_generated?: boolean
          is_free_preview?: boolean
          order_index?: number
          title?: string | null
        }
        Update: {
          audio_file_id?: string | null
          audiobook_id?: string
          book_id?: string
          chapter_number?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          is_ai_generated?: boolean
          is_free_preview?: boolean
          order_index?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_audiobook_chapters_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "library_book_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_audiobook_chapters_audiobook_id_fkey"
            columns: ["audiobook_id"]
            isOneToOne: false
            referencedRelation: "library_audiobooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_audiobook_chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_audiobooks: {
        Row: {
          audio_file_id: string | null
          book_id: string
          chapter_count: number
          created_at: string
          duration_seconds: number
          id: string
          narrator_id: string | null
          narrator_name: string | null
          sample_url: string | null
          updated_at: string
        }
        Insert: {
          audio_file_id?: string | null
          book_id: string
          chapter_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          narrator_id?: string | null
          narrator_name?: string | null
          sample_url?: string | null
          updated_at?: string
        }
        Update: {
          audio_file_id?: string | null
          book_id?: string
          chapter_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          narrator_id?: string | null
          narrator_name?: string | null
          sample_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_audiobooks_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "library_book_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_audiobooks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_audiobooks_narrator_id_fkey"
            columns: ["narrator_id"]
            isOneToOne: false
            referencedRelation: "library_narrators"
            referencedColumns: ["id"]
          },
        ]
      }
      library_author_followers: {
        Row: {
          author_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_author_followers_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "library_authors"
            referencedColumns: ["id"]
          },
        ]
      }
      library_authors: {
        Row: {
          bio: string | null
          birth_year: number | null
          books_count: number
          created_at: string
          follower_count: number
          id: string
          name: string
          nationality: string | null
          photo_url: string | null
          rating_avg: number | null
          rating_count: number
          search_vector: unknown
          slug: string
          social_links: Json
          updated_at: string
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          bio?: string | null
          birth_year?: number | null
          books_count?: number
          created_at?: string
          follower_count?: number
          id?: string
          name: string
          nationality?: string | null
          photo_url?: string | null
          rating_avg?: number | null
          rating_count?: number
          search_vector?: unknown
          slug: string
          social_links?: Json
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          bio?: string | null
          birth_year?: number | null
          books_count?: number
          created_at?: string
          follower_count?: number
          id?: string
          name?: string
          nationality?: string | null
          photo_url?: string | null
          rating_avg?: number | null
          rating_count?: number
          search_vector?: unknown
          slug?: string
          social_links?: Json
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      library_background_jobs: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          job_type: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_book_awards: {
        Row: {
          awarding_body: string | null
          book_id: string
          created_at: string
          icon_url: string | null
          id: string
          name: string
          rank: string | null
          year: number | null
        }
        Insert: {
          awarding_body?: string | null
          book_id: string
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          rank?: string | null
          year?: number | null
        }
        Update: {
          awarding_body?: string | null
          book_id?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          rank?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_awards_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_collaborators: {
        Row: {
          book_id: string
          created_at: string
          id: string
          invited_by: string
          invited_email: string | null
          role: Database["public"]["Enums"]["library_collaborator_role"]
          status: Database["public"]["Enums"]["library_collaborator_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          invited_by: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["library_collaborator_role"]
          status?: Database["public"]["Enums"]["library_collaborator_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          invited_by?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["library_collaborator_role"]
          status?: Database["public"]["Enums"]["library_collaborator_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_collaborators_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_comments: {
        Row: {
          anchor: Json | null
          author_id: string
          body: string
          book_id: string
          chapter_id: string | null
          created_at: string
          id: string
          parent_comment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          anchor?: Json | null
          author_id: string
          body: string
          book_id: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          anchor?: Json | null
          author_id?: string
          body?: string
          book_id?: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_comments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_book_comments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_book_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "library_book_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_courses: {
        Row: {
          academy_course_id: string
          book_id: string
          created_at: string
          created_by: string
          id: string
        }
        Insert: {
          academy_course_id: string
          book_id: string
          created_at?: string
          created_by: string
          id?: string
        }
        Update: {
          academy_course_id?: string
          book_id?: string
          created_at?: string
          created_by?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_courses_academy_course_id_fkey"
            columns: ["academy_course_id"]
            isOneToOne: true
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_book_courses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_daily_dimension_stats: {
        Row: {
          book_id: string
          count: number
          dimension: string
          dimension_value: string
          stat_date: string
        }
        Insert: {
          book_id: string
          count?: number
          dimension: string
          dimension_value: string
          stat_date: string
        }
        Update: {
          book_id?: string
          count?: number
          dimension?: string
          dimension_value?: string
          stat_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_daily_dimension_stats_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_daily_stats: {
        Row: {
          book_id: string
          downloads: number
          favorites_added: number
          purchases: number
          reading_minutes: number
          reading_sessions_completed: number
          reading_sessions_started: number
          revenue_usd: number
          revenue_vx: number
          reviews_added: number
          stat_date: string
          views: number
        }
        Insert: {
          book_id: string
          downloads?: number
          favorites_added?: number
          purchases?: number
          reading_minutes?: number
          reading_sessions_completed?: number
          reading_sessions_started?: number
          revenue_usd?: number
          revenue_vx?: number
          reviews_added?: number
          stat_date: string
          views?: number
        }
        Update: {
          book_id?: string
          downloads?: number
          favorites_added?: number
          purchases?: number
          reading_minutes?: number
          reading_sessions_completed?: number
          reading_sessions_started?: number
          revenue_usd?: number
          revenue_vx?: number
          reviews_added?: number
          stat_date?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_book_daily_stats_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_editions: {
        Row: {
          archived_at: string | null
          book_id: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          edition_label: string
          id: string
          is_current: boolean
        }
        Insert: {
          archived_at?: string | null
          book_id: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          edition_label: string
          id?: string
          is_current?: boolean
        }
        Update: {
          archived_at?: string | null
          book_id?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          edition_label?: string
          id?: string
          is_current?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "library_book_editions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_files: {
        Row: {
          book_id: string
          created_at: string
          file_size_bytes: number | null
          file_type: string
          file_url: string | null
          id: string
          is_primary: boolean
          storage_path: string
        }
        Insert: {
          book_id: string
          created_at?: string
          file_size_bytes?: number | null
          file_type: string
          file_url?: string | null
          id?: string
          is_primary?: boolean
          storage_path: string
        }
        Update: {
          book_id?: string
          created_at?: string
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          is_primary?: boolean
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_files_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_gallery: {
        Row: {
          book_id: string
          caption: string | null
          created_at: string
          display_order: number
          id: string
          media_type: string
          url: string
        }
        Insert: {
          book_id: string
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          media_type: string
          url: string
        }
        Update: {
          book_id?: string
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          media_type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_gallery_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_recommendations: {
        Row: {
          book_id: string
          generated_at: string
          reason: string | null
          score: number
          user_id: string
        }
        Insert: {
          book_id: string
          generated_at?: string
          reason?: string | null
          score?: number
          user_id: string
        }
        Update: {
          book_id?: string
          generated_at?: string
          reason?: string | null
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_recommendations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_suggestions: {
        Row: {
          base_version_id: string | null
          book_id: string
          chapter_id: string
          created_at: string
          id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string
          suggested_content: Json
        }
        Insert: {
          base_version_id?: string | null
          book_id: string
          chapter_id: string
          created_at?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by: string
          suggested_content: Json
        }
        Update: {
          base_version_id?: string | null
          book_id?: string
          chapter_id?: string
          created_at?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string
          suggested_content?: Json
        }
        Relationships: [
          {
            foreignKeyName: "library_book_suggestions_base_version_id_fkey"
            columns: ["base_version_id"]
            isOneToOne: false
            referencedRelation: "library_book_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_book_suggestions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_book_suggestions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_tags: {
        Row: {
          book_id: string
          tag_id: string
        }
        Insert: {
          book_id: string
          tag_id: string
        }
        Update: {
          book_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_tags_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_book_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "library_tag_popularity"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "library_book_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "library_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_translations: {
        Row: {
          book_id: string
          created_at: string
          description: string | null
          description_long: string | null
          id: string
          keywords: string[]
          language_code: string
          subtitle: string | null
          title: string
          translated_by: string
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          description?: string | null
          description_long?: string | null
          id?: string
          keywords?: string[]
          language_code: string
          subtitle?: string | null
          title: string
          translated_by?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          description?: string | null
          description_long?: string | null
          id?: string
          keywords?: string[]
          language_code?: string
          subtitle?: string | null
          title?: string
          translated_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_translations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_versions: {
        Row: {
          book_id: string
          chapter_id: string
          content_json: Json
          content_text: string
          created_at: string
          created_by: string
          id: string
          is_autosave: boolean
          version_note: string | null
        }
        Insert: {
          book_id: string
          chapter_id: string
          content_json: Json
          content_text?: string
          created_at?: string
          created_by: string
          id?: string
          is_autosave?: boolean
          version_note?: string | null
        }
        Update: {
          book_id?: string
          chapter_id?: string
          content_json?: Json
          content_text?: string
          created_at?: string
          created_by?: string
          id?: string
          is_autosave?: boolean
          version_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_versions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_book_versions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_bookmarks: {
        Row: {
          book_id: string
          created_at: string
          id: string
          label: string | null
          page_number: number | null
          position: Json
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          label?: string | null
          page_number?: number | null
          position?: Json
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          label?: string | null
          page_number?: number | null
          position?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_bookmarks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          age_category: string | null
          age_rating: string
          author_id: string
          auto_classified_at: string | null
          book_type: string
          category_id: string | null
          content_format: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          description_long: string | null
          difficulty_level: string | null
          doi: string | null
          downloads_count: number
          duplicate_checked_at: string | null
          edition: string | null
          embedding: string | null
          flash_deal_ends_at: string | null
          id: string
          import_source: string | null
          imported_by: string | null
          is_free: boolean
          isbn: string | null
          issn: string | null
          keywords: string[]
          language: string
          lending_copies_total: number | null
          license_details: string | null
          license_type: string
          likes_count: number
          page_count: number | null
          potential_duplicate_of: string | null
          price_usd: number | null
          price_vx: number | null
          pricing_model: string
          publish_status: string
          published_date: string | null
          publisher_id: string | null
          rating_avg: number | null
          rating_count: number
          reading_level: string | null
          reading_time_minutes: number | null
          rental_period_days: number | null
          rental_price_usd: number | null
          rental_price_vx: number | null
          review_note: string | null
          reviews_count: number
          scheduled_publish_at: string | null
          search_vector: unknown
          series_id: string | null
          series_position: number | null
          slug: string
          subtitle: string | null
          subtopics: string[]
          suggested_donation_usd: number | null
          title: string
          topics: string[]
          trailer_video_url: string | null
          updated_at: string
          views_count: number
        }
        Insert: {
          age_category?: string | null
          age_rating?: string
          author_id: string
          auto_classified_at?: string | null
          book_type?: string
          category_id?: string | null
          content_format?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          description_long?: string | null
          difficulty_level?: string | null
          doi?: string | null
          downloads_count?: number
          duplicate_checked_at?: string | null
          edition?: string | null
          embedding?: string | null
          flash_deal_ends_at?: string | null
          id?: string
          import_source?: string | null
          imported_by?: string | null
          is_free?: boolean
          isbn?: string | null
          issn?: string | null
          keywords?: string[]
          language?: string
          lending_copies_total?: number | null
          license_details?: string | null
          license_type?: string
          likes_count?: number
          page_count?: number | null
          potential_duplicate_of?: string | null
          price_usd?: number | null
          price_vx?: number | null
          pricing_model?: string
          publish_status?: string
          published_date?: string | null
          publisher_id?: string | null
          rating_avg?: number | null
          rating_count?: number
          reading_level?: string | null
          reading_time_minutes?: number | null
          rental_period_days?: number | null
          rental_price_usd?: number | null
          rental_price_vx?: number | null
          review_note?: string | null
          reviews_count?: number
          scheduled_publish_at?: string | null
          search_vector?: unknown
          series_id?: string | null
          series_position?: number | null
          slug: string
          subtitle?: string | null
          subtopics?: string[]
          suggested_donation_usd?: number | null
          title: string
          topics?: string[]
          trailer_video_url?: string | null
          updated_at?: string
          views_count?: number
        }
        Update: {
          age_category?: string | null
          age_rating?: string
          author_id?: string
          auto_classified_at?: string | null
          book_type?: string
          category_id?: string | null
          content_format?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          description_long?: string | null
          difficulty_level?: string | null
          doi?: string | null
          downloads_count?: number
          duplicate_checked_at?: string | null
          edition?: string | null
          embedding?: string | null
          flash_deal_ends_at?: string | null
          id?: string
          import_source?: string | null
          imported_by?: string | null
          is_free?: boolean
          isbn?: string | null
          issn?: string | null
          keywords?: string[]
          language?: string
          lending_copies_total?: number | null
          license_details?: string | null
          license_type?: string
          likes_count?: number
          page_count?: number | null
          potential_duplicate_of?: string | null
          price_usd?: number | null
          price_vx?: number | null
          pricing_model?: string
          publish_status?: string
          published_date?: string | null
          publisher_id?: string | null
          rating_avg?: number | null
          rating_count?: number
          reading_level?: string | null
          reading_time_minutes?: number | null
          rental_period_days?: number | null
          rental_price_usd?: number | null
          rental_price_vx?: number | null
          review_note?: string | null
          reviews_count?: number
          scheduled_publish_at?: string | null
          search_vector?: unknown
          series_id?: string | null
          series_position?: number | null
          slug?: string
          subtitle?: string | null
          subtopics?: string[]
          suggested_donation_usd?: number | null
          title?: string
          topics?: string[]
          trailer_video_url?: string | null
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_books_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "library_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_books_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_books_potential_duplicate_of_fkey"
            columns: ["potential_duplicate_of"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_books_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "library_publishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_books_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "library_series"
            referencedColumns: ["id"]
          },
        ]
      }
      library_borrowed_books: {
        Row: {
          book_id: string
          borrowed_at: string
          created_at: string
          due_at: string
          id: string
          returned_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          book_id: string
          borrowed_at?: string
          created_at?: string
          due_at: string
          id?: string
          returned_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          book_id?: string
          borrowed_at?: string
          created_at?: string
          due_at?: string
          id?: string
          returned_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_borrowed_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_bundle_books: {
        Row: {
          book_id: string
          bundle_id: string
        }
        Insert: {
          book_id: string
          bundle_id: string
        }
        Update: {
          book_id?: string
          bundle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_bundle_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_bundle_books_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "library_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_bundles: {
        Row: {
          author_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          price_usd: number | null
          price_vx: number | null
          title: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          price_usd?: number | null
          price_vx?: number | null
          title: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          price_usd?: number | null
          price_vx?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_bundles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "library_authors"
            referencedColumns: ["id"]
          },
        ]
      }
      library_categories: {
        Row: {
          book_count: number
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          book_count?: number
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          book_count?: number
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      library_category_translations: {
        Row: {
          category_id: string
          description: string | null
          language_code: string
          name: string
        }
        Insert: {
          category_id: string
          description?: string | null
          language_code: string
          name: string
        }
        Update: {
          category_id?: string
          description?: string | null
          language_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      library_certificates: {
        Row: {
          certificate_number: string
          certificate_type: string
          id: string
          issued_at: string
          issuer_name: string
          recipient_name: string
          reference_id: string
          score_percent: number | null
          signature_hash: string | null
          title: string
          user_id: string
          verification_code: string
        }
        Insert: {
          certificate_number: string
          certificate_type: string
          id?: string
          issued_at?: string
          issuer_name?: string
          recipient_name: string
          reference_id: string
          score_percent?: number | null
          signature_hash?: string | null
          title: string
          user_id: string
          verification_code: string
        }
        Update: {
          certificate_number?: string
          certificate_type?: string
          id?: string
          issued_at?: string
          issuer_name?: string
          recipient_name?: string
          reference_id?: string
          score_percent?: number | null
          signature_hash?: string | null
          title?: string
          user_id?: string
          verification_code?: string
        }
        Relationships: []
      }
      library_challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          current_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          current_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          current_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "library_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      library_challenges: {
        Row: {
          author_id: string | null
          cadence: string
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          goal_target: number
          goal_type: string
          id: string
          is_active: boolean
          participant_count: number
          reward_vx: number
          scope: string
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          cadence?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal_target: number
          goal_type: string
          id?: string
          is_active?: boolean
          participant_count?: number
          reward_vx?: number
          scope?: string
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          cadence?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal_target?: number
          goal_type?: string
          id?: string
          is_active?: boolean
          participant_count?: number
          reward_vx?: number
          scope?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_challenges_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "library_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_challenges_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      library_chapter_chunks: {
        Row: {
          book_id: string
          chapter_id: string
          char_count: number
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
        }
        Insert: {
          book_id: string
          chapter_id: string
          char_count: number
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
        }
        Update: {
          book_id?: string
          chapter_id?: string
          char_count?: number
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_chapter_chunks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_chapter_chunks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_chapter_lessons: {
        Row: {
          academy_lesson_id: string
          chapter_id: string
        }
        Insert: {
          academy_lesson_id: string
          chapter_id: string
        }
        Update: {
          academy_lesson_id?: string
          chapter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_chapter_lessons_academy_lesson_id_fkey"
            columns: ["academy_lesson_id"]
            isOneToOne: true
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_chapter_lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: true
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_chapters: {
        Row: {
          book_id: string
          chapter_number: number
          content_json: Json | null
          content_search_vector: unknown
          content_text: string | null
          content_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_free_preview: boolean
          order_index: number
          page_end: number | null
          page_start: number | null
          title: string | null
        }
        Insert: {
          book_id: string
          chapter_number: number
          content_json?: Json | null
          content_search_vector?: unknown
          content_text?: string | null
          content_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_free_preview?: boolean
          order_index?: number
          page_end?: number | null
          page_start?: number | null
          title?: string | null
        }
        Update: {
          book_id?: string
          chapter_number?: number
          content_json?: Json | null
          content_search_vector?: unknown
          content_text?: string | null
          content_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_free_preview?: boolean
          order_index?: number
          page_end?: number | null
          page_start?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_club_announcements: {
        Row: {
          author_id: string
          body: string
          club_id: string
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          club_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          club_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_club_announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_club_members: {
        Row: {
          club_id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["library_club_member_role"]
          status: Database["public"]["Enums"]["library_club_member_status"]
          user_id: string
        }
        Insert: {
          club_id: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["library_club_member_role"]
          status?: Database["public"]["Enums"]["library_club_member_status"]
          user_id: string
        }
        Update: {
          club_id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["library_club_member_role"]
          status?: Database["public"]["Enums"]["library_club_member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_club_reading_schedule: {
        Row: {
          book_id: string
          club_id: string
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          is_current: boolean
          start_date: string
          target_description: string | null
        }
        Insert: {
          book_id: string
          club_id: string
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          start_date: string
          target_description?: string | null
        }
        Update: {
          book_id?: string
          club_id?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          start_date?: string
          target_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_club_reading_schedule_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_club_reading_schedule_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_clubs: {
        Row: {
          academy_course_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          learning_path_id: string | null
          member_count: number
          name: string
          owner_id: string
          rules: string | null
          slug: string
          updated_at: string
          visibility: Database["public"]["Enums"]["library_club_visibility"]
        }
        Insert: {
          academy_course_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          learning_path_id?: string | null
          member_count?: number
          name: string
          owner_id: string
          rules?: string | null
          slug: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["library_club_visibility"]
        }
        Update: {
          academy_course_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          learning_path_id?: string | null
          member_count?: number
          name?: string
          owner_id?: string
          rules?: string | null
          slug?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["library_club_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "library_clubs_academy_course_id_fkey"
            columns: ["academy_course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_clubs_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "library_learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      library_collection_books: {
        Row: {
          added_at: string
          book_id: string
          collection_id: string
          display_order: number
        }
        Insert: {
          added_at?: string
          book_id: string
          collection_id: string
          display_order?: number
        }
        Update: {
          added_at?: string
          book_id?: string
          collection_id?: string
          display_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_collection_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_collection_books_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "library_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      library_collections: {
        Row: {
          collection_type: Database["public"]["Enums"]["library_collection_type"]
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          ends_at: string | null
          id: string
          is_active: boolean
          slug: string
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          collection_type: Database["public"]["Enums"]["library_collection_type"]
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          slug: string
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          collection_type?: Database["public"]["Enums"]["library_collection_type"]
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          purchase_id: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          purchase_id?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          purchase_id?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "library_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_coupon_redemptions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "library_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      library_coupons: {
        Row: {
          book_id: string | null
          code: string
          created_at: string
          created_by: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_redemptions: number | null
          redemptions_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          book_id?: string | null
          code: string
          created_at?: string
          created_by: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemptions_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          book_id?: string | null
          code?: string
          created_at?: string
          created_by?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          redemptions_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_coupons_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_course_learning_objectives: {
        Row: {
          academy_course_id: string
          chapter_id: string | null
          id: string
          objective_text: string
          order_index: number
        }
        Insert: {
          academy_course_id: string
          chapter_id?: string | null
          id?: string
          objective_text: string
          order_index?: number
        }
        Update: {
          academy_course_id?: string
          chapter_id?: string | null
          id?: string
          objective_text?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_course_learning_objectives_academy_course_id_fkey"
            columns: ["academy_course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_course_learning_objectives_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      library_daily_reward_claims: {
        Row: {
          claim_date: string
          created_at: string
          streak_day: number
          user_id: string
          vx_awarded: number
        }
        Insert: {
          claim_date: string
          created_at?: string
          streak_day: number
          user_id: string
          vx_awarded: number
        }
        Update: {
          claim_date?: string
          created_at?: string
          streak_day?: number
          user_id?: string
          vx_awarded?: number
        }
        Relationships: []
      }
      library_discussion_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_discussion_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "library_discussion_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      library_discussion_polls: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          options: Json
          question: string
          topic_id: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          options: Json
          question: string
          topic_id: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          options?: Json
          question?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_discussion_polls_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "library_discussion_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      library_discussion_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          image_urls: string[]
          is_spoiler: boolean
          likes_count: number
          mentioned_user_ids: string[]
          parent_reply_id: string | null
          quoted_reply_id: string | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          image_urls?: string[]
          is_spoiler?: boolean
          likes_count?: number
          mentioned_user_ids?: string[]
          parent_reply_id?: string | null
          quoted_reply_id?: string | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          image_urls?: string[]
          is_spoiler?: boolean
          likes_count?: number
          mentioned_user_ids?: string[]
          parent_reply_id?: string | null
          quoted_reply_id?: string | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_discussion_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "library_discussion_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_discussion_replies_quoted_reply_id_fkey"
            columns: ["quoted_reply_id"]
            isOneToOne: false
            referencedRelation: "library_discussion_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_discussion_replies_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "library_discussion_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      library_discussion_reply_likes: {
        Row: {
          created_at: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_discussion_reply_likes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "library_discussion_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      library_discussion_topics: {
        Row: {
          author_id: string
          body: string | null
          context_id: string
          context_type: Database["public"]["Enums"]["library_discussion_context"]
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          is_spoiler: boolean
          last_activity_at: string
          reply_count: number
          search_vector: unknown
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          context_id: string
          context_type: Database["public"]["Enums"]["library_discussion_context"]
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_spoiler?: boolean
          last_activity_at?: string
          reply_count?: number
          search_vector?: unknown
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          context_id?: string
          context_type?: Database["public"]["Enums"]["library_discussion_context"]
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_spoiler?: boolean
          last_activity_at?: string
          reply_count?: number
          search_vector?: unknown
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_donations: {
        Row: {
          amount_usd: number | null
          amount_vx: number | null
          book_id: string
          created_at: string
          donor_id: string | null
          id: string
          message: string | null
        }
        Insert: {
          amount_usd?: number | null
          amount_vx?: number | null
          book_id: string
          created_at?: string
          donor_id?: string | null
          id?: string
          message?: string | null
        }
        Update: {
          amount_usd?: number | null
          amount_vx?: number | null
          book_id?: string
          created_at?: string
          donor_id?: string | null
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_donations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_downloads: {
        Row: {
          book_id: string
          downloaded_at: string
          file_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          downloaded_at?: string
          file_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          downloaded_at?: string
          file_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_downloads_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_downloads_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "library_book_files"
            referencedColumns: ["id"]
          },
        ]
      }
      library_event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          reminder_sent: boolean
          status: Database["public"]["Enums"]["library_event_rsvp_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          reminder_sent?: boolean
          status?: Database["public"]["Enums"]["library_event_rsvp_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          reminder_sent?: boolean
          status?: Database["public"]["Enums"]["library_event_rsvp_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "library_events"
            referencedColumns: ["id"]
          },
        ]
      }
      library_events: {
        Row: {
          author_id: string | null
          book_id: string | null
          club_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["library_event_type"]
          host_id: string
          id: string
          is_cancelled: boolean
          max_attendees: number | null
          organization_id: string | null
          scheduled_end: string | null
          scheduled_start: string
          title: string
          updated_at: string
          voice_room_id: string | null
        }
        Insert: {
          author_id?: string | null
          book_id?: string | null
          club_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["library_event_type"]
          host_id: string
          id?: string
          is_cancelled?: boolean
          max_attendees?: number | null
          organization_id?: string | null
          scheduled_end?: string | null
          scheduled_start: string
          title: string
          updated_at?: string
          voice_room_id?: string | null
        }
        Update: {
          author_id?: string | null
          book_id?: string | null
          club_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["library_event_type"]
          host_id?: string
          id?: string
          is_cancelled?: boolean
          max_attendees?: number | null
          organization_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          title?: string
          updated_at?: string
          voice_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_events_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "library_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_events_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_events_voice_room_id_fkey"
            columns: ["voice_room_id"]
            isOneToOne: false
            referencedRelation: "voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      library_favorite_topics: {
        Row: {
          created_at: string
          entity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_favorite_topics_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "library_kg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      library_favorites: {
        Row: {
          book_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_favorites_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_flashcard_decks: {
        Row: {
          book_id: string | null
          chapter_id: string | null
          created_at: string
          description: string | null
          id: string
          is_ai_generated: boolean
          learning_path_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          learning_path_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          chapter_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          learning_path_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_flashcard_decks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_flashcard_decks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_flashcard_decks_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "library_learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      library_flashcard_study_sessions: {
        Row: {
          cards_correct: number
          cards_reviewed: number
          deck_id: string
          ended_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          cards_correct?: number
          cards_reviewed?: number
          deck_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          cards_correct?: number
          cards_reviewed?: number
          deck_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_flashcard_study_sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "library_flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      library_flashcards: {
        Row: {
          audio_url: string | null
          back: string
          created_at: string
          deck_id: string
          difficulty: string
          due_at: string
          ease_factor: number
          front: string
          id: string
          image_url: string | null
          interval_days: number
          last_reviewed_at: string | null
          order_index: number
          repetitions: number
          source: string
        }
        Insert: {
          audio_url?: string | null
          back: string
          created_at?: string
          deck_id: string
          difficulty?: string
          due_at?: string
          ease_factor?: number
          front: string
          id?: string
          image_url?: string | null
          interval_days?: number
          last_reviewed_at?: string | null
          order_index?: number
          repetitions?: number
          source?: string
        }
        Update: {
          audio_url?: string | null
          back?: string
          created_at?: string
          deck_id?: string
          difficulty?: string
          due_at?: string
          ease_factor?: number
          front?: string
          id?: string
          image_url?: string | null
          interval_days?: number
          last_reviewed_at?: string | null
          order_index?: number
          repetitions?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "library_flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      library_follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      library_group_assignment_submissions: {
        Row: {
          assignment_id: string
          content: string | null
          file_url: string | null
          id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          content?: string | null
          file_url?: string | null
          id?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          content?: string | null
          file_url?: string | null
          id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_group_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "library_group_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      library_group_assignments: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          title: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          title: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_group_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_group_peer_reviews: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          rating: number
          reviewer_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          rating: number
          reviewer_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          rating?: number
          reviewer_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_group_peer_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "library_group_assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      library_group_shared_notes: {
        Row: {
          club_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_group_shared_notes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_group_teacher_feedback: {
        Row: {
          created_at: string
          feedback: string
          grade: string | null
          id: string
          instructor_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          feedback: string
          grade?: string | null
          id?: string
          instructor_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          feedback?: string
          grade?: string | null
          id?: string
          instructor_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_group_teacher_feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "library_group_assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      library_highlights: {
        Row: {
          book_id: string
          color: string
          created_at: string
          id: string
          is_favorite: boolean
          note: string | null
          page_number: number | null
          quoted_text: string
          user_id: string
        }
        Insert: {
          book_id: string
          color?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          note?: string | null
          page_number?: number | null
          quoted_text: string
          user_id: string
        }
        Update: {
          book_id?: string
          color?: string
          created_at?: string
          id?: string
          is_favorite?: boolean
          note?: string | null
          page_number?: number | null
          quoted_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_highlights_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_instructor_book_recommendations: {
        Row: {
          book_id: string
          created_at: string
          id: string
          instructor_id: string
          note: string | null
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          instructor_id: string
          note?: string | null
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          instructor_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_instructor_book_recommendations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_instructor_book_recommendations_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "academy_instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      library_kg_book_entities: {
        Row: {
          book_id: string
          context: string | null
          created_at: string
          entity_id: string
        }
        Insert: {
          book_id: string
          context?: string | null
          created_at?: string
          entity_id: string
        }
        Update: {
          book_id?: string
          context?: string | null
          created_at?: string
          entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_kg_book_entities_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_kg_book_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "library_kg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      library_kg_content_links: {
        Row: {
          content_id: string
          content_type: string
          context: string | null
          created_at: string
          entity_id: string
          id: string
        }
        Insert: {
          content_id: string
          content_type: string
          context?: string | null
          created_at?: string
          entity_id: string
          id?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          context?: string | null
          created_at?: string
          entity_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_kg_content_links_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "library_kg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      library_kg_entities: {
        Row: {
          created_at: string
          description: string | null
          embedding: string | null
          entity_type: Database["public"]["Enums"]["library_kg_entity_type"]
          id: string
          metadata: Json
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          entity_type: Database["public"]["Enums"]["library_kg_entity_type"]
          id?: string
          metadata?: Json
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          embedding?: string | null
          entity_type?: Database["public"]["Enums"]["library_kg_entity_type"]
          id?: string
          metadata?: Json
          name?: string
          slug?: string
        }
        Relationships: []
      }
      library_kg_entity_relations: {
        Row: {
          created_at: string
          entity_id_a: string
          entity_id_b: string
          id: string
          relation_type: string
          weight: number
        }
        Insert: {
          created_at?: string
          entity_id_a: string
          entity_id_b: string
          id?: string
          relation_type: string
          weight?: number
        }
        Update: {
          created_at?: string
          entity_id_a?: string
          entity_id_b?: string
          id?: string
          relation_type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_kg_entity_relations_entity_id_a_fkey"
            columns: ["entity_id_a"]
            isOneToOne: false
            referencedRelation: "library_kg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_kg_entity_relations_entity_id_b_fkey"
            columns: ["entity_id_b"]
            isOneToOne: false
            referencedRelation: "library_kg_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      library_learning_path_enrollments: {
        Row: {
          completed_at: string | null
          enrolled_at: string
          id: string
          path_id: string
          progress_percent: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          enrolled_at?: string
          id?: string
          path_id: string
          progress_percent?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          enrolled_at?: string
          id?: string
          path_id?: string
          progress_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_learning_path_enrollments_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "library_learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      library_learning_path_item_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          item_id: string
          score_percent: number | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          item_id: string
          score_percent?: number | null
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          item_id?: string
          score_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_learning_path_item_progress_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_learning_path_items"
            referencedColumns: ["id"]
          },
        ]
      }
      library_learning_path_items: {
        Row: {
          academy_course_id: string | null
          book_id: string | null
          created_at: string
          estimated_minutes: number | null
          id: string
          is_remedial: boolean
          is_required: boolean
          item_type: string
          order_index: number
          path_id: string
          quiz_id: string | null
          remedial_for_item_id: string | null
          remedial_threshold_percent: number
          title_override: string | null
        }
        Insert: {
          academy_course_id?: string | null
          book_id?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_remedial?: boolean
          is_required?: boolean
          item_type: string
          order_index?: number
          path_id: string
          quiz_id?: string | null
          remedial_for_item_id?: string | null
          remedial_threshold_percent?: number
          title_override?: string | null
        }
        Update: {
          academy_course_id?: string | null
          book_id?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_remedial?: boolean
          is_required?: boolean
          item_type?: string
          order_index?: number
          path_id?: string
          quiz_id?: string | null
          remedial_for_item_id?: string | null
          remedial_threshold_percent?: number
          title_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_learning_path_items_academy_course_id_fkey"
            columns: ["academy_course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_learning_path_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_learning_path_items_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "library_learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_learning_path_items_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "library_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_learning_path_items_remedial_for_item_id_fkey"
            columns: ["remedial_for_item_id"]
            isOneToOne: false
            referencedRelation: "library_learning_path_items"
            referencedColumns: ["id"]
          },
        ]
      }
      library_learning_path_prerequisites: {
        Row: {
          path_id: string
          prerequisite_path_id: string
        }
        Insert: {
          path_id: string
          prerequisite_path_id: string
        }
        Update: {
          path_id?: string
          prerequisite_path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_learning_path_prerequisites_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "library_learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_learning_path_prerequisites_prerequisite_path_id_fkey"
            columns: ["prerequisite_path_id"]
            isOneToOne: false
            referencedRelation: "library_learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      library_learning_paths: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_minutes: number | null
          id: string
          is_adaptive: boolean
          is_archived: boolean
          is_certification_track: boolean
          is_published: boolean
          level: Database["public"]["Enums"]["library_learning_path_level"]
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_adaptive?: boolean
          is_archived?: boolean
          is_certification_track?: boolean
          is_published?: boolean
          level?: Database["public"]["Enums"]["library_learning_path_level"]
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_adaptive?: boolean
          is_archived?: boolean
          is_certification_track?: boolean
          is_published?: boolean
          level?: Database["public"]["Enums"]["library_learning_path_level"]
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_librarian_daily_plans: {
        Row: {
          due_flashcard_ids: string[]
          generated_at: string
          id: string
          listening_plan: Json
          motivational_summary: string | null
          plan_date: string
          practice_questions: Json
          reading_plan: Json
          review_plan: Json
          study_plan: Json
          user_id: string
        }
        Insert: {
          due_flashcard_ids?: string[]
          generated_at?: string
          id?: string
          listening_plan?: Json
          motivational_summary?: string | null
          plan_date: string
          practice_questions?: Json
          reading_plan?: Json
          review_plan?: Json
          study_plan?: Json
          user_id: string
        }
        Update: {
          due_flashcard_ids?: string[]
          generated_at?: string
          id?: string
          listening_plan?: Json
          motivational_summary?: string | null
          plan_date?: string
          practice_questions?: Json
          reading_plan?: Json
          review_plan?: Json
          study_plan?: Json
          user_id?: string
        }
        Relationships: []
      }
      library_librarian_data_requests: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          id: string
          request_type: Database["public"]["Enums"]["library_librarian_request_type"]
          status: Database["public"]["Enums"]["library_librarian_request_status"]
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          request_type: Database["public"]["Enums"]["library_librarian_request_type"]
          status?: Database["public"]["Enums"]["library_librarian_request_status"]
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          request_type?: Database["public"]["Enums"]["library_librarian_request_type"]
          status?: Database["public"]["Enums"]["library_librarian_request_status"]
          user_id?: string
        }
        Relationships: []
      }
      library_librarian_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          goal_category: Database["public"]["Enums"]["library_librarian_goal_category"]
          id: string
          status: Database["public"]["Enums"]["library_librarian_goal_status"]
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          goal_category?: Database["public"]["Enums"]["library_librarian_goal_category"]
          id?: string
          status?: Database["public"]["Enums"]["library_librarian_goal_status"]
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          goal_category?: Database["public"]["Enums"]["library_librarian_goal_category"]
          id?: string
          status?: Database["public"]["Enums"]["library_librarian_goal_status"]
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_librarian_recommendations: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          is_dismissed: boolean
          reason: string | null
          recommendation_type: Database["public"]["Enums"]["library_librarian_recommendation_type"]
          score: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          is_dismissed?: boolean
          reason?: string | null
          recommendation_type: Database["public"]["Enums"]["library_librarian_recommendation_type"]
          score?: number
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          is_dismissed?: boolean
          reason?: string | null
          recommendation_type?: Database["public"]["Enums"]["library_librarian_recommendation_type"]
          score?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      library_librarian_summaries: {
        Row: {
          generated_at: string
          id: string
          learning_insights: string | null
          period_end: string
          period_start: string
          reading_insights: string | null
          skill_insights: string | null
          stats: Json
          summary_period: Database["public"]["Enums"]["library_summary_period"]
          summary_text: string | null
          user_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          learning_insights?: string | null
          period_end: string
          period_start: string
          reading_insights?: string | null
          skill_insights?: string | null
          stats?: Json
          summary_period: Database["public"]["Enums"]["library_summary_period"]
          summary_text?: string | null
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          learning_insights?: string | null
          period_end?: string
          period_start?: string
          reading_insights?: string | null
          skill_insights?: string | null
          stats?: Json
          summary_period?: Database["public"]["Enums"]["library_summary_period"]
          summary_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      library_license_seats: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          license_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          license_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          license_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_license_seats_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "library_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      library_licenses: {
        Row: {
          book_id: string
          created_at: string
          id: string
          license_type: Database["public"]["Enums"]["library_license_type"]
          purchase_id: string | null
          purchaser_id: string
          seat_count: number
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          license_type: Database["public"]["Enums"]["library_license_type"]
          purchase_id?: string | null
          purchaser_id: string
          seat_count?: number
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          license_type?: Database["public"]["Enums"]["library_license_type"]
          purchase_id?: string | null
          purchaser_id?: string
          seat_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_licenses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_licenses_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "library_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      library_listening_daily_stats: {
        Row: {
          avg_playback_rate: number | null
          seconds_listened: number
          stat_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_playback_rate?: number | null
          seconds_listened?: number
          stat_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_playback_rate?: number | null
          seconds_listened?: number
          stat_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_narrators: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          languages: string[]
          name: string
          photo_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          languages?: string[]
          name: string
          photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          languages?: string[]
          name?: string
          photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      library_notebooks: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          order_index: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          order_index?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          order_index?: number
          user_id?: string
        }
        Relationships: []
      }
      library_notes: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          note_type: string
          notebook_id: string | null
          page_number: number | null
          tags: string[]
          updated_at: string
          user_id: string
          voice_url: string | null
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          note_type?: string
          notebook_id?: string | null
          page_number?: number | null
          tags?: string[]
          updated_at?: string
          user_id: string
          voice_url?: string | null
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          note_type?: string
          notebook_id?: string | null
          page_number?: number | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_notes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "library_notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      library_publisher_followers: {
        Row: {
          created_at: string
          publisher_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          publisher_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          publisher_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_publisher_followers_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "library_publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      library_publishers: {
        Row: {
          banner_url: string | null
          bio: string | null
          created_at: string
          description: string | null
          follower_count: number
          id: string
          logo_url: string | null
          name: string
          slug: string
          social_links: Json
          updated_at: string
          website_url: string | null
        }
        Insert: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          social_links?: Json
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          social_links?: Json
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      library_purchases: {
        Row: {
          amount_usd: number | null
          amount_vx: number | null
          book_id: string
          bundle_id: string | null
          buyer_id: string
          created_at: string
          crypto_charge_id: string | null
          gift_message: string | null
          gifted_by: string | null
          id: string
          payment_method: string
          paypal_order_id: string | null
          purchased_at: string | null
          recipient_email: string | null
          recipient_user_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_usd?: number | null
          amount_vx?: number | null
          book_id: string
          bundle_id?: string | null
          buyer_id: string
          created_at?: string
          crypto_charge_id?: string | null
          gift_message?: string | null
          gifted_by?: string | null
          id?: string
          payment_method: string
          paypal_order_id?: string | null
          purchased_at?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_usd?: number | null
          amount_vx?: number | null
          book_id?: string
          bundle_id?: string | null
          buyer_id?: string
          created_at?: string
          crypto_charge_id?: string | null
          gift_message?: string | null
          gifted_by?: string | null
          id?: string
          payment_method?: string
          paypal_order_id?: string | null
          purchased_at?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_purchases_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_purchases_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "library_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_quiz_attempts: {
        Row: {
          answers: Json
          id: string
          needs_manual_grading: boolean
          passed: boolean | null
          quiz_id: string
          score_percent: number | null
          started_at: string
          submitted_at: string | null
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          answers?: Json
          id?: string
          needs_manual_grading?: boolean
          passed?: boolean | null
          quiz_id: string
          score_percent?: number | null
          started_at?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          answers?: Json
          id?: string
          needs_manual_grading?: boolean
          passed?: boolean | null
          quiz_id?: string
          score_percent?: number | null
          started_at?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "library_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_quiz_questions: {
        Row: {
          correct_answer: Json | null
          difficulty: string
          explanation: string | null
          id: string
          options: Json
          order_index: number
          points: number
          question_text: string
          question_type: string
          quiz_id: string
          topic: string | null
        }
        Insert: {
          correct_answer?: Json | null
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number
          points?: number
          question_text: string
          question_type: string
          quiz_id: string
          topic?: string | null
        }
        Update: {
          correct_answer?: Json | null
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json
          order_index?: number
          points?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "library_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_quizzes: {
        Row: {
          academy_lesson_id: string | null
          book_id: string | null
          chapter_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_adaptive_difficulty: boolean
          is_timed: boolean
          learning_path_item_id: string | null
          passing_score_percent: number
          scope_type: string
          time_limit_minutes: number | null
          title: string
        }
        Insert: {
          academy_lesson_id?: string | null
          book_id?: string | null
          chapter_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_adaptive_difficulty?: boolean
          is_timed?: boolean
          learning_path_item_id?: string | null
          passing_score_percent?: number
          scope_type: string
          time_limit_minutes?: number | null
          title: string
        }
        Update: {
          academy_lesson_id?: string | null
          book_id?: string | null
          chapter_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_adaptive_difficulty?: boolean
          is_timed?: boolean
          learning_path_item_id?: string | null
          passing_score_percent?: number
          scope_type?: string
          time_limit_minutes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_quizzes_academy_lesson_id_fkey"
            columns: ["academy_lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_quizzes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_quizzes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "library_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_quizzes_learning_path_item_id_fkey"
            columns: ["learning_path_item_id"]
            isOneToOne: false
            referencedRelation: "library_learning_path_items"
            referencedColumns: ["id"]
          },
        ]
      }
      library_quotes: {
        Row: {
          book_id: string
          created_at: string
          id: string
          is_approved: boolean
          likes_count: number
          page_number: number | null
          search_vector: unknown
          submitted_by: string | null
          text: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          is_approved?: boolean
          likes_count?: number
          page_number?: number | null
          search_vector?: unknown
          submitted_by?: string | null
          text: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          likes_count?: number
          page_number?: number | null
          search_vector?: unknown
          submitted_by?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_quotes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_reader_profiles: {
        Row: {
          bio: string | null
          created_at: string
          favorite_authors: string[]
          favorite_genres: string[]
          is_public: boolean
          languages: string[]
          show_followers: boolean
          show_reading_activity: boolean
          show_reading_lists: boolean
          show_reviews: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          favorite_authors?: string[]
          favorite_genres?: string[]
          is_public?: boolean
          languages?: string[]
          show_followers?: boolean
          show_reading_activity?: boolean
          show_reading_lists?: boolean
          show_reviews?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          favorite_authors?: string[]
          favorite_genres?: string[]
          is_public?: boolean
          languages?: string[]
          show_followers?: boolean
          show_reading_activity?: boolean
          show_reading_lists?: boolean
          show_reviews?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_reader_settings: {
        Row: {
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_reading_daily_activity: {
        Row: {
          activity_date: string
          minutes_read: number
          pages_read: number
          sessions: number
          user_id: string
        }
        Insert: {
          activity_date: string
          minutes_read?: number
          pages_read?: number
          sessions?: number
          user_id: string
        }
        Update: {
          activity_date?: string
          minutes_read?: number
          pages_read?: number
          sessions?: number
          user_id?: string
        }
        Relationships: []
      }
      library_reading_goals: {
        Row: {
          created_at: string
          custom_label: string | null
          goal_type: Database["public"]["Enums"]["library_goal_type"]
          id: string
          is_active: boolean
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          goal_type: Database["public"]["Enums"]["library_goal_type"]
          id?: string
          is_active?: boolean
          target: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          goal_type?: Database["public"]["Enums"]["library_goal_type"]
          id?: string
          is_active?: boolean
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_reading_list_items: {
        Row: {
          added_at: string
          book_id: string
          list_id: string
          order_index: number
        }
        Insert: {
          added_at?: string
          book_id: string
          list_id: string
          order_index?: number
        }
        Update: {
          added_at?: string
          book_id?: string
          list_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_reading_list_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_reading_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "library_reading_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      library_reading_list_shares: {
        Row: {
          created_at: string
          list_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          list_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          list_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_reading_list_shares_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "library_reading_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      library_reading_lists: {
        Row: {
          academy_course_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          list_type: string
          name: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          academy_course_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          list_type?: string
          name: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          academy_course_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          list_type?: string
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_reading_lists_academy_course_id_fkey"
            columns: ["academy_course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      library_reading_progress: {
        Row: {
          book_id: string
          completed_at: string | null
          current_page: number | null
          last_position: Json
          last_read_at: string
          percent_complete: number
          started_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          completed_at?: string | null
          current_page?: number | null
          last_position?: Json
          last_read_at?: string
          percent_complete?: number
          started_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          completed_at?: string | null
          current_page?: number | null
          last_position?: Json
          last_read_at?: string
          percent_complete?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_reading_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_recently_viewed: {
        Row: {
          book_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          book_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          book_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_recently_viewed_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_granted: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_granted?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_granted?: boolean
        }
        Relationships: []
      }
      library_regional_prices: {
        Row: {
          book_id: string
          country_code: string
          price_usd: number
          price_vx: number | null
        }
        Insert: {
          book_id: string
          country_code: string
          price_usd: number
          price_vx?: number | null
        }
        Update: {
          book_id?: string
          country_code?: string
          price_usd?: number
          price_vx?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_regional_prices_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_related_books: {
        Row: {
          book_id: string
          computed_at: string
          related_book_id: string
          similarity: number
        }
        Insert: {
          book_id: string
          computed_at?: string
          related_book_id: string
          similarity: number
        }
        Update: {
          book_id?: string
          computed_at?: string
          related_book_id?: string
          similarity?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_related_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_related_books_related_book_id_fkey"
            columns: ["related_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_research_analyses: {
        Row: {
          analysis_type: string
          author_ids: string[]
          book_ids: string[]
          created_at: string
          id: string
          result: Json
          title: string
          topic: string | null
          user_id: string
        }
        Insert: {
          analysis_type: string
          author_ids?: string[]
          book_ids?: string[]
          created_at?: string
          id?: string
          result: Json
          title: string
          topic?: string | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          author_ids?: string[]
          book_ids?: string[]
          created_at?: string
          id?: string
          result?: Json
          title?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      library_research_project_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          item_id: string | null
          project_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          item_id?: string | null
          project_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          item_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_research_project_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_research_project_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_research_project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "library_research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      library_research_project_items: {
        Row: {
          added_at: string
          added_by: string
          analysis_id: string | null
          book_id: string | null
          citation_text: string | null
          highlight_id: string | null
          id: string
          item_type: string
          note_id: string | null
          project_id: string
          saved_search_id: string | null
        }
        Insert: {
          added_at?: string
          added_by: string
          analysis_id?: string | null
          book_id?: string | null
          citation_text?: string | null
          highlight_id?: string | null
          id?: string
          item_type: string
          note_id?: string | null
          project_id: string
          saved_search_id?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string
          analysis_id?: string | null
          book_id?: string | null
          citation_text?: string | null
          highlight_id?: string | null
          id?: string
          item_type?: string
          note_id?: string | null
          project_id?: string
          saved_search_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_research_project_items_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "library_research_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_research_project_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_research_project_items_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "library_highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_research_project_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "library_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_research_project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "library_research_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_research_project_items_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "library_saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      library_research_project_members: {
        Row: {
          added_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_research_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "library_research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      library_research_project_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          project_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          project_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          project_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "library_research_project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "library_research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      library_research_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_shared: boolean
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      library_review_helpful_votes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_review_helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "library_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      library_review_likes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "library_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      library_review_media: {
        Row: {
          created_at: string
          display_order: number
          id: string
          media_type: string
          review_id: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          media_type: string
          review_id: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          media_type?: string
          review_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "library_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      library_reviews: {
        Row: {
          book_id: string
          comment: string | null
          cons: string[]
          created_at: string
          has_spoilers: boolean
          helpful_count: number
          id: string
          likes_count: number
          pros: string[]
          rating: number
          updated_at: string
          user_id: string
          verified_purchase: boolean
        }
        Insert: {
          book_id: string
          comment?: string | null
          cons?: string[]
          created_at?: string
          has_spoilers?: boolean
          helpful_count?: number
          id?: string
          likes_count?: number
          pros?: string[]
          rating: number
          updated_at?: string
          user_id: string
          verified_purchase?: boolean
        }
        Update: {
          book_id?: string
          comment?: string | null
          cons?: string[]
          created_at?: string
          has_spoilers?: boolean
          helpful_count?: number
          id?: string
          likes_count?: number
          pros?: string[]
          rating?: number
          updated_at?: string
          user_id?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "library_reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_saved_quotes: {
        Row: {
          created_at: string
          quote_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          quote_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          quote_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_saved_quotes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "library_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      library_saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      library_search_history: {
        Row: {
          id: string
          query: string
          results_count: number | null
          searched_at: string
          user_id: string
        }
        Insert: {
          id?: string
          query: string
          results_count?: number | null
          searched_at?: string
          user_id: string
        }
        Update: {
          id?: string
          query?: string
          results_count?: number | null
          searched_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_series: {
        Row: {
          author_id: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          author_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          author_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_series_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "library_authors"
            referencedColumns: ["id"]
          },
        ]
      }
      library_series_suggestions: {
        Row: {
          book_id: string
          confidence: number | null
          created_at: string
          id: string
          reasoning: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_position: number | null
          suggested_series_id: string | null
          suggested_series_title: string | null
        }
        Insert: {
          book_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_position?: number | null
          suggested_series_id?: string | null
          suggested_series_title?: string | null
        }
        Update: {
          book_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_position?: number | null
          suggested_series_id?: string | null
          suggested_series_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_series_suggestions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_series_suggestions_suggested_series_id_fkey"
            columns: ["suggested_series_id"]
            isOneToOne: false
            referencedRelation: "library_series"
            referencedColumns: ["id"]
          },
        ]
      }
      library_shelf_items: {
        Row: {
          book_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_shelf_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_skills: {
        Row: {
          created_at: string
          id: string
          proficiency_level: Database["public"]["Enums"]["library_skill_level"]
          related_certificate_id: string | null
          related_course_id: string | null
          skill_name: string
          source: Database["public"]["Enums"]["library_skill_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proficiency_level?: Database["public"]["Enums"]["library_skill_level"]
          related_certificate_id?: string | null
          related_course_id?: string | null
          skill_name: string
          source?: Database["public"]["Enums"]["library_skill_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proficiency_level?: Database["public"]["Enums"]["library_skill_level"]
          related_certificate_id?: string | null
          related_course_id?: string | null
          skill_name?: string
          source?: Database["public"]["Enums"]["library_skill_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_skills_related_certificate_id_fkey"
            columns: ["related_certificate_id"]
            isOneToOne: false
            referencedRelation: "library_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_skills_related_course_id_fkey"
            columns: ["related_course_id"]
            isOneToOne: false
            referencedRelation: "library_book_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      library_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          id: string
          plan: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          id?: string
          plan: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      library_timeline_events: {
        Row: {
          created_at: string
          description: string | null
          event_date_or_period: string
          id: string
          kg_entity_id: string | null
          order_index: number
          source_book_id: string | null
          timeline_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date_or_period: string
          id?: string
          kg_entity_id?: string | null
          order_index?: number
          source_book_id?: string | null
          timeline_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date_or_period?: string
          id?: string
          kg_entity_id?: string | null
          order_index?: number
          source_book_id?: string | null
          timeline_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_timeline_events_kg_entity_id_fkey"
            columns: ["kg_entity_id"]
            isOneToOne: false
            referencedRelation: "library_kg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_timeline_events_source_book_id_fkey"
            columns: ["source_book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_timeline_events_timeline_id_fkey"
            columns: ["timeline_id"]
            isOneToOne: false
            referencedRelation: "library_timelines"
            referencedColumns: ["id"]
          },
        ]
      }
      library_timelines: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_ai_generated: boolean
          kg_entity_id: string | null
          series_id: string | null
          timeline_type: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          kg_entity_id?: string | null
          series_id?: string | null
          timeline_type: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          kg_entity_id?: string | null
          series_id?: string | null
          timeline_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_timelines_kg_entity_id_fkey"
            columns: ["kg_entity_id"]
            isOneToOne: false
            referencedRelation: "library_kg_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_timelines_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "library_series"
            referencedColumns: ["id"]
          },
        ]
      }
      library_user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "library_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      library_user_moderation: {
        Row: {
          action: Database["public"]["Enums"]["library_moderation_action"]
          club_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          moderator_id: string
          reason: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["library_moderation_action"]
          club_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          moderator_id: string
          reason: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["library_moderation_action"]
          club_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          moderator_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_user_moderation_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_wishlist: {
        Row: {
          book_id: string
          created_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_wishlist_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_xp_events: {
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
          category_confidence: number | null
          content: string | null
          created_at: string
          description: string
          icon_name: string
          id: string
          newsletter_sent: boolean
          published: boolean
          published_at: string | null
          quality_status: string
          source_name: string | null
          source_published_at: string | null
          source_url: string | null
          title: string
          translations: Json | null
          updated_at: string
        }
        Insert: {
          category?: string
          category_confidence?: number | null
          content?: string | null
          created_at?: string
          description: string
          icon_name?: string
          id?: string
          newsletter_sent?: boolean
          published?: boolean
          published_at?: string | null
          quality_status?: string
          source_name?: string | null
          source_published_at?: string | null
          source_url?: string | null
          title: string
          translations?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string
          category_confidence?: number | null
          content?: string | null
          created_at?: string
          description?: string
          icon_name?: string
          id?: string
          newsletter_sent?: boolean
          published?: boolean
          published_at?: string | null
          quality_status?: string
          source_name?: string | null
          source_published_at?: string | null
          source_url?: string | null
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
          manage_token: string
          name: string | null
          subscribed_at: string | null
          topics: string[] | null
        }
        Insert: {
          email: string
          id?: string
          lang?: string
          last_sent_date?: string | null
          manage_token?: string
          name?: string | null
          subscribed_at?: string | null
          topics?: string[] | null
        }
        Update: {
          email?: string
          id?: string
          lang?: string
          last_sent_date?: string | null
          manage_token?: string
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
      organization_assignment_completions: {
        Row: {
          assignment_id: string
          completed_at: string
          score_percent: number | null
          user_id: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string
          score_percent?: number | null
          user_id: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string
          score_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_assignment_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "organization_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_assignments: {
        Row: {
          assigned_to_group_id: string | null
          assigned_to_user_id: string | null
          assignment_type: Database["public"]["Enums"]["organization_assignment_type"]
          created_at: string
          created_by: string
          deadline_reminder_sent: boolean
          description: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          organization_id: string
          title: string
        }
        Insert: {
          assigned_to_group_id?: string | null
          assigned_to_user_id?: string | null
          assignment_type: Database["public"]["Enums"]["organization_assignment_type"]
          created_at?: string
          created_by: string
          deadline_reminder_sent?: boolean
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          organization_id: string
          title: string
        }
        Update: {
          assigned_to_group_id?: string | null
          assigned_to_user_id?: string | null
          assignment_type?: Database["public"]["Enums"]["organization_assignment_type"]
          created_at?: string
          created_by?: string
          deadline_reminder_sent?: boolean
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          organization_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_assignments_assigned_to_group_id_fkey"
            columns: ["assigned_to_group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          group_type: Database["public"]["Enums"]["organization_group_type"]
          id: string
          linked_club_id: string | null
          name: string
          organization_id: string
          parent_group_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          group_type: Database["public"]["Enums"]["organization_group_type"]
          id?: string
          linked_club_id?: string | null
          name: string
          organization_id: string
          parent_group_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          group_type?: Database["public"]["Enums"]["organization_group_type"]
          id?: string
          linked_club_id?: string | null
          name?: string
          organization_id?: string
          parent_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_groups_linked_club_id_fkey"
            columns: ["linked_club_id"]
            isOneToOne: false
            referencedRelation: "library_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          created_at: string
          custom_role_label: string | null
          department_id: string | null
          email: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          status: Database["public"]["Enums"]["organization_invitation_status"]
        }
        Insert: {
          created_at?: string
          custom_role_label?: string | null
          department_id?: string | null
          email: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_invitation_status"]
        }
        Update: {
          created_at?: string
          custom_role_label?: string | null
          department_id?: string | null
          email?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_license_assignments: {
        Row: {
          assigned_at: string
          license_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          license_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          license_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_license_assignments_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "organization_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_licenses: {
        Row: {
          concurrent_limit: number | null
          created_at: string
          department_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          license_type: Database["public"]["Enums"]["organization_license_type"]
          organization_id: string
          seat_count: number | null
          starts_at: string
        }
        Insert: {
          concurrent_limit?: number | null
          created_at?: string
          department_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          license_type: Database["public"]["Enums"]["organization_license_type"]
          organization_id: string
          seat_count?: number | null
          starts_at?: string
        }
        Update: {
          concurrent_limit?: number | null
          created_at?: string
          department_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          license_type?: Database["public"]["Enums"]["organization_license_type"]
          organization_id?: string
          seat_count?: number | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_licenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          custom_role_label: string | null
          department_id: string | null
          invited_by: string | null
          invited_email: string | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          status: Database["public"]["Enums"]["organization_member_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custom_role_label?: string | null
          department_id?: string | null
          invited_by?: string | null
          invited_email?: string | null
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_member_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custom_role_label?: string | null
          department_id?: string | null
          invited_by?: string | null
          invited_email?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_member_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_resources: {
        Row: {
          book_id: string | null
          created_at: string
          created_by: string
          description: string | null
          group_id: string | null
          id: string
          is_confidential: boolean
          organization_id: string
          resource_type: Database["public"]["Enums"]["organization_resource_type"]
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_confidential?: boolean
          organization_id: string
          resource_type: Database["public"]["Enums"]["organization_resource_type"]
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          book_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          group_id?: string | null
          id?: string
          is_confidential?: boolean
          organization_id?: string
          resource_type?: Database["public"]["Enums"]["organization_resource_type"]
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_resources_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_resources_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_role_permissions: {
        Row: {
          organization_id: string
          permission: Database["public"]["Enums"]["organization_permission"]
          role: Database["public"]["Enums"]["organization_member_role"]
        }
        Insert: {
          organization_id: string
          permission: Database["public"]["Enums"]["organization_permission"]
          role: Database["public"]["Enums"]["organization_member_role"]
        }
        Update: {
          organization_id?: string
          permission?: Database["public"]["Enums"]["organization_permission"]
          role?: Database["public"]["Enums"]["organization_member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_scheduled_reports: {
        Row: {
          cadence: Database["public"]["Enums"]["organization_report_cadence"]
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_run_at: string | null
          organization_id: string
          recipient_emails: string[]
          report_name: string
        }
        Insert: {
          cadence: Database["public"]["Enums"]["organization_report_cadence"]
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          organization_id: string
          recipient_emails: string[]
          report_name: string
        }
        Update: {
          cadence?: Database["public"]["Enums"]["organization_report_cadence"]
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          organization_id?: string
          recipient_emails?: string[]
          report_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_scheduled_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_sessions: {
        Row: {
          ended_at: string | null
          id: string
          last_seen_at: string
          organization_id: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          organization_id: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          organization_id?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          member_count: number
          name: string
          org_type: Database["public"]["Enums"]["organization_type"]
          owner_id: string
          require_2fa: boolean
          slug: string
          sso_domain: string | null
          sso_enabled: boolean
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          member_count?: number
          name: string
          org_type: Database["public"]["Enums"]["organization_type"]
          owner_id: string
          require_2fa?: boolean
          slug: string
          sso_domain?: string | null
          sso_enabled?: boolean
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          member_count?: number
          name?: string
          org_type?: Database["public"]["Enums"]["organization_type"]
          owner_id?: string
          require_2fa?: boolean
          slug?: string
          sso_domain?: string | null
          sso_enabled?: boolean
          updated_at?: string
          website?: string | null
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
          referred_by: string | null
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
          referred_by?: string | null
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
          referred_by?: string | null
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
          consecutive_failures: number
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
          consecutive_failures?: number
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
          consecutive_failures?: number
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
          user_id?: string
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
          user_id?: string
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
          user_id?: string
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
      arcade_device_analytics_daily: {
        Row: {
          day: string | null
          device_class: string | null
          events: number | null
        }
        Relationships: []
      }
      arcade_game_analytics_daily: {
        Row: {
          completion_rate: number | null
          day: string | null
          game_id: string | null
          play_seconds: number | null
          plays: number | null
          unique_players: number | null
          wins: number | null
        }
        Relationships: []
      }
      kids_game_leaderboard_entries: {
        Row: {
          best_score: number | null
          game_id: string | null
          last_played_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "kids_games"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_stats_monthly: {
        Row: {
          book_id: string | null
          downloads: number | null
          favorites_added: number | null
          period_start: string | null
          purchases: number | null
          reading_sessions_completed: number | null
          reading_sessions_started: number | null
          reviews_added: number | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_daily_stats_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_stats_weekly: {
        Row: {
          book_id: string | null
          downloads: number | null
          favorites_added: number | null
          period_start: string | null
          purchases: number | null
          reading_sessions_completed: number | null
          reading_sessions_started: number | null
          reviews_added: number | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_daily_stats_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_stats_yearly: {
        Row: {
          book_id: string | null
          downloads: number | null
          favorites_added: number | null
          period_start: string | null
          purchases: number | null
          reading_sessions_completed: number | null
          reading_sessions_started: number | null
          reviews_added: number | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_book_daily_stats_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_tag_popularity: {
        Row: {
          name: string | null
          slug: string | null
          tag_id: string | null
          usage_count: number | null
        }
        Relationships: []
      }
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
      academy_enroll_course: {
        Args: { _course_id: string }
        Returns: {
          completed_at: string | null
          course_id: string
          current_lesson_id: string | null
          enrolled_at: string
          id: string
          last_position_seconds: number
          progress_percent: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "academy_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      activate_voice_room_ai: { Args: never; Returns: Json }
      add_kids_org_member: {
        Args: {
          _display_name?: string
          _org: string
          _role: string
          _user_id: string
        }
        Returns: undefined
      }
      add_kids_review: {
        Args: { _comment?: string; _product_id: string; _rating: number }
        Returns: undefined
      }
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
      approve_kids_subscription: { Args: { _id: string }; Returns: undefined }
      approve_library_club_join_request: {
        Args: { _approve: boolean; _club_id: string; _user_id: string }
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
      arcade_admin_operations_summary: { Args: never; Returns: Json }
      arcade_admin_upsert_content: {
        Args: { _entity: string; _payload: Json }
        Returns: string
      }
      arcade_append_vx: {
        Args: {
          _amount: number
          _category: string
          _idempotency_key: string
          _reference_id: string
          _reference_type: string
          _uid: string
        }
        Returns: number
      }
      arcade_buy_shop_item: {
        Args: { _idempotency_key: string; _item_id: string }
        Returns: Json
      }
      arcade_buy_shop_item_by_sku: {
        Args: { _idempotency_key: string; _sku: string }
        Returns: Json
      }
      arcade_claim_daily_login: { Args: never; Returns: Json }
      arcade_join_tournament: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      arcade_leaderboard: {
        Args: { _limit?: number; _metric?: string; _period?: string }
        Returns: {
          avatar_url: string
          gamer_tag: string
          rank: number
          user_id: string
          value: number
        }[]
      }
      arcade_record_game_result: {
        Args: {
          _duration_seconds: number
          _game_id: string
          _result: string
          _score: number
          _session_id: string
        }
        Returns: Json
      }
      arcade_submit_verified_result: {
        Args: {
          _duration_seconds: number
          _game_id: string
          _input_count?: number
          _integrity_hash?: string
          _replay_data?: Json
          _result: string
          _score: number
          _session_id: string
        }
        Returns: Json
      }
      arcade_update_gamer_profile: {
        Args: {
          _avatar_url: string
          _favorite_game_ids: string[]
          _gamer_tag: string
        }
        Returns: undefined
      }
      arcade_wallet_balance: { Args: { _uid: string }; Returns: number }
      assert_bazaar_shop_available: {
        Args: { _shop_id: string }
        Returns: undefined
      }
      award_academy_xp: {
        Args: { _amount: number; _reason: string }
        Returns: undefined
      }
      award_achievement: {
        Args: { _achievement_key: string }
        Returns: undefined
      }
      award_kids_achievement: { Args: { _key: string }; Returns: undefined }
      award_kids_coins: {
        Args: { _amount: number; _reason: string }
        Returns: undefined
      }
      award_kids_explorer_stamp: {
        Args: { _world_slug: string }
        Returns: boolean
      }
      award_kids_universe_visit: {
        Args: { _city_slug: string }
        Returns: boolean
      }
      award_kids_xp: {
        Args: { _amount: number; _reason: string }
        Returns: undefined
      }
      award_library_xp: {
        Args: { _amount: number; _reason: string }
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
      bulk_invite_organization_member: {
        Args: {
          _custom_role_label?: string
          _department_id?: string
          _email: string
          _organization_id: string
          _role?: Database["public"]["Enums"]["organization_member_role"]
        }
        Returns: string
      }
      bump_kids_social_challenge_score: {
        Args: { _challenge_id: string; _increment: number }
        Returns: number
      }
      bump_library_daily_dimension_stat: {
        Args: { _book_id: string; _dimension: string; _value: string }
        Returns: undefined
      }
      bump_library_daily_stat: {
        Args: { _book_id: string; _column: string; _delta?: number }
        Returns: undefined
      }
      bump_library_daily_stat_numeric: {
        Args: { _book_id: string; _column: string; _delta: number }
        Returns: undefined
      }
      buy_kids_item: { Args: { _item_slug: string }; Returns: Json }
      can_access_library_book_content: {
        Args: { _book_id: string }
        Returns: boolean
      }
      can_access_library_discussion_reply: {
        Args: { _reply_id: string }
        Returns: boolean
      }
      can_access_library_discussion_topic: {
        Args: { _topic_id: string }
        Returns: boolean
      }
      can_edit_library_book: { Args: { _book_id: string }; Returns: boolean }
      cancel_kids_subscription: { Args: { _id: string }; Returns: undefined }
      career_decrypt: {
        Args: { _ciphertext: string; _key: string }
        Returns: string
      }
      career_encrypt: {
        Args: { _key: string; _plaintext: string }
        Returns: string
      }
      charge_file_conversion: {
        Args: {
          _file_size_bytes: number
          _job_id: string
          _module_type: string
          _target_format: string
        }
        Returns: number
      }
      check_ai_rate_limit: {
        Args: { _function_name: string; _user_id: string }
        Returns: boolean
      }
      check_and_award_library_achievement: {
        Args: { _code: string; _user_id: string }
        Returns: undefined
      }
      check_career_usage_allowed: {
        Args: { _company_id: string; _metric: string }
        Returns: boolean
      }
      claim_kids_gift: { Args: { _id: string }; Returns: undefined }
      claim_kids_limited_reward: {
        Args: { _reward_id: string }
        Returns: boolean
      }
      claim_library_daily_reward: {
        Args: never
        Returns: {
          streak_day: number
          vx_awarded: number
        }[]
      }
      claim_organization_invite: {
        Args: { _organization_id: string }
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
      complete_kids_experiment: {
        Args: { _experiment_id: string; _quiz_score?: number }
        Returns: Json
      }
      complete_kids_healthy_challenge: {
        Args: { _challenge_id: string }
        Returns: boolean
      }
      complete_kids_skill: { Args: { _skill_slug: string }; Returns: boolean }
      complete_kids_track_module: {
        Args: { _module_id: string }
        Returns: Json
      }
      complete_kids_world_quest: {
        Args: { _activity_id: string }
        Returns: Json
      }
      complete_library_learning_path_item: {
        Args: { _item_id: string; _score_percent?: number }
        Returns: undefined
      }
      convert_library_book_to_course: {
        Args: { _book_id: string; _level?: string; _title: string }
        Returns: string
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
      create_bazaar_shop: {
        Args: {
          _country?: string
          _description?: string
          _email_notifications?: boolean
          _name: string
          _sign_style?: string
          _theme_color?: string
          _tier: string
          _whatsapp_notifications?: boolean
          _whatsapp_number?: string
        }
        Returns: string
      }
      create_bazaar_vx_order: {
        Args: { _buyer_note?: string; _items: Json; _shop_id: string }
        Returns: string
      }
      create_kids_gift: {
        Args: {
          _amount: number
          _kind: string
          _message?: string
          _ref_slug: string
          _to_id: string
        }
        Returns: string
      }
      create_kids_incident: {
        Args: {
          _area?: string
          _description: string
          _severity: string
          _title: string
        }
        Returns: string
      }
      create_kids_org: {
        Args: { _kind: string; _name: string; _slug: string }
        Returns: string
      }
      create_library_book_edition: {
        Args: {
          _book_id: string
          _change_summary: string
          _edition_label: string
        }
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
      decide_kids_event_registration: {
        Args: { _approve: boolean; _registration_id: string }
        Returns: undefined
      }
      decide_kids_review: {
        Args: { _approve: boolean; _id: string; _notes?: string }
        Returns: undefined
      }
      delete_library_librarian_category: {
        Args: { _category: string }
        Returns: undefined
      }
      device_trial_used: { Args: { _device_id: string }; Returns: boolean }
      donate_kids: {
        Args: { _amount: number; _cause: string }
        Returns: undefined
      }
      end_organization_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      enqueue_due_organization_reports: { Args: never; Returns: undefined }
      enqueue_library_background_job: {
        Args: { _job_type: string; _payload: Json }
        Returns: string
      }
      enroll_in_library_learning_path: {
        Args: { _path_id: string }
        Returns: {
          completed_at: string | null
          enrolled_at: string
          id: string
          path_id: string
          progress_percent: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "library_learning_path_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_kids_family: { Args: never; Returns: string }
      finalize_bazaar_cash_order: {
        Args: {
          _checkout_session_id: string
          _order_id: string
          _payment_intent_id: string
        }
        Returns: undefined
      }
      find_potential_duplicate_book: {
        Args: { _author_id: string; _isbn: string; _title: string }
        Returns: string
      }
      find_similar_library_discussion_topics: {
        Args: {
          _context_id: string
          _context_type: Database["public"]["Enums"]["library_discussion_context"]
          _match_limit?: number
          _title: string
        }
        Returns: {
          id: string
          similarity: number
          title: string
        }[]
      }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      fuzzy_search_library_books: {
        Args: { _match_count?: number; _query: string }
        Returns: {
          book_id: string
          similarity_score: number
        }[]
      }
      generate_kids_parent_link_code: { Args: never; Returns: string }
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
      get_kids_creator_stats: { Args: never; Returns: Json }
      get_kids_economy_summary: { Args: never; Returns: Json }
      get_kids_financial_reports: { Args: never; Returns: Json }
      get_kids_ops_overview: { Args: never; Returns: Json }
      get_kids_org_analytics: { Args: { _org: string }; Returns: Json }
      get_kids_platform_stats: { Args: never; Returns: Json }
      get_kids_school_dashboard: { Args: { _org: string }; Returns: Json }
      get_kids_stem_stats: { Args: never; Returns: Json }
      get_kids_talent_stats: { Args: never; Returns: Json }
      get_kids_usage_today: {
        Args: { _child_user_id?: string }
        Returns: {
          daily_limit_minutes: number
          is_over_limit: boolean
          minutes_used_today: number
        }[]
      }
      get_kids_wellness_stats: { Args: never; Returns: Json }
      get_kids_world_stats: { Args: never; Returns: Json }
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
      get_library_categories_with_stats: {
        Args: never
        Returns: {
          author_count: number
          book_count: number
          description: string
          display_order: number
          icon: string
          id: string
          image_url: string
          name: string
          parent_id: string
          slug: string
          updated_at: string
        }[]
      }
      get_library_category_stats: {
        Args: { _category_id: string }
        Returns: {
          author_count: number
          total_views: number
        }[]
      }
      get_library_club_reading_progress: {
        Args: { _club_id: string }
        Returns: {
          avatar_url: string
          completed_at: string
          display_name: string
          percent_complete: number
          user_id: string
        }[]
      }
      get_library_due_flashcards: {
        Args: { _deck_id: string }
        Returns: {
          audio_url: string | null
          back: string
          created_at: string
          deck_id: string
          difficulty: string
          due_at: string
          ease_factor: number
          front: string
          id: string
          image_url: string | null
          interval_days: number
          last_reviewed_at: string | null
          order_index: number
          repetitions: number
          source: string
        }[]
        SetofOptions: {
          from: "*"
          to: "library_flashcards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_library_due_flashcards_for_user: {
        Args: { _limit?: number }
        Returns: {
          audio_url: string | null
          back: string
          created_at: string
          deck_id: string
          difficulty: string
          due_at: string
          ease_factor: number
          front: string
          id: string
          image_url: string | null
          interval_days: number
          last_reviewed_at: string | null
          order_index: number
          repetitions: number
          source: string
        }[]
        SetofOptions: {
          from: "*"
          to: "library_flashcards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_library_home_stats: {
        Args: never
        Returns: {
          total_audiobooks: number
          total_authors: number
          total_books: number
          total_categories: number
          total_pages: number
          total_readers: number
          total_reviews: number
        }[]
      }
      get_library_knowledge_map: {
        Args: { _max_depth?: number; _root_entity_id: string }
        Returns: {
          depth: number
          entity_id: string
          entity_type: string
          is_unlocked: boolean
          name: string
          relation_type: string
        }[]
      }
      get_library_leaderboard: {
        Args: { _metric: string; _period?: string }
        Returns: {
          entity_id: string
          image_url: string
          name: string
          score: number
        }[]
      }
      get_library_learning_analytics: {
        Args: { _book_id?: string }
        Returns: {
          avg_quiz_score_percent: number
          current_streak: number
          flashcards_due: number
          knowledge_retention_percent: number
          quizzes_taken: number
          reading_speed_wpm: number
          study_time_minutes: number
        }[]
      }
      get_library_learning_path_progress: {
        Args: { _path_id: string }
        Returns: {
          completed: boolean
          completed_at: string
          is_remedial: boolean
          is_required: boolean
          is_skipped: boolean
          is_unlocked: boolean
          item_id: string
          item_type: string
          order_index: number
          score_percent: number
          title: string
        }[]
      }
      get_library_listening_stats: {
        Args: never
        Returns: {
          avg_playback_rate: number
          current_streak_days: number
          total_books_completed: number
          total_seconds_listened: number
        }[]
      }
      get_library_most_listened_books: {
        Args: { _limit?: number }
        Returns: {
          book_id: string
          listen_count: number
        }[]
      }
      get_library_narrator_stats: {
        Args: { _narrator_id: string }
        Returns: {
          book_count: number
          rating_avg: number
          rating_count: number
        }[]
      }
      get_library_popular_searches: {
        Args: { _limit?: number }
        Returns: {
          query: string
          search_count: number
        }[]
      }
      get_library_public_profile_summaries: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_library_quiz_for_attempt: {
        Args: { _quiz_id: string }
        Returns: {
          difficulty: string
          id: string
          options: Json
          order_index: number
          points: number
          question_text: string
          question_type: string
          topic: string
        }[]
      }
      get_library_reader_analytics_summary: {
        Args: { _book_id: string }
        Returns: {
          last_activity_at: string
          pages_read: number
          reading_time_seconds: number
          sessions_count: number
        }[]
      }
      get_library_reader_profile_stats: {
        Args: { _target_user_id: string }
        Returns: {
          books_read_count: number
          books_reading_count: number
          followers_count: number
          following_count: number
          reviews_count: number
          wishlist_count: number
        }[]
      }
      get_library_readers_also_read: {
        Args: { _book_id: string; _limit?: number }
        Returns: {
          age_category: string | null
          age_rating: string
          author_id: string
          auto_classified_at: string | null
          book_type: string
          category_id: string | null
          content_format: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          description_long: string | null
          difficulty_level: string | null
          doi: string | null
          downloads_count: number
          duplicate_checked_at: string | null
          edition: string | null
          embedding: string | null
          flash_deal_ends_at: string | null
          id: string
          import_source: string | null
          imported_by: string | null
          is_free: boolean
          isbn: string | null
          issn: string | null
          keywords: string[]
          language: string
          lending_copies_total: number | null
          license_details: string | null
          license_type: string
          likes_count: number
          page_count: number | null
          potential_duplicate_of: string | null
          price_usd: number | null
          price_vx: number | null
          pricing_model: string
          publish_status: string
          published_date: string | null
          publisher_id: string | null
          rating_avg: number | null
          rating_count: number
          reading_level: string | null
          reading_time_minutes: number | null
          rental_period_days: number | null
          rental_price_usd: number | null
          rental_price_vx: number | null
          review_note: string | null
          reviews_count: number
          scheduled_publish_at: string | null
          search_vector: unknown
          series_id: string | null
          series_position: number | null
          slug: string
          subtitle: string | null
          subtopics: string[]
          suggested_donation_usd: number | null
          title: string
          topics: string[]
          trailer_video_url: string | null
          updated_at: string
          views_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "library_books"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_library_reading_coach_stats: {
        Args: { _book_id: string }
        Returns: {
          active_goals: Json
          current_page: number
          days_reading: number
          estimated_days_left: number
          pages_per_day: number
          percent_complete: number
          total_pages: number
        }[]
      }
      get_library_reading_streak: {
        Args: { _user_id: string }
        Returns: number
      }
      get_library_search_suggestions: {
        Args: { _limit?: number; _prefix: string }
        Returns: {
          suggestion: string
          suggestion_type: string
        }[]
      }
      get_library_trending_books: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          age_category: string | null
          age_rating: string
          author_id: string
          auto_classified_at: string | null
          book_type: string
          category_id: string | null
          content_format: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          description_long: string | null
          difficulty_level: string | null
          doi: string | null
          downloads_count: number
          duplicate_checked_at: string | null
          edition: string | null
          embedding: string | null
          flash_deal_ends_at: string | null
          id: string
          import_source: string | null
          imported_by: string | null
          is_free: boolean
          isbn: string | null
          issn: string | null
          keywords: string[]
          language: string
          lending_copies_total: number | null
          license_details: string | null
          license_type: string
          likes_count: number
          page_count: number | null
          potential_duplicate_of: string | null
          price_usd: number | null
          price_vx: number | null
          pricing_model: string
          publish_status: string
          published_date: string | null
          publisher_id: string | null
          rating_avg: number | null
          rating_count: number
          reading_level: string | null
          reading_time_minutes: number | null
          rental_period_days: number | null
          rental_price_usd: number | null
          rental_price_vx: number | null
          review_note: string | null
          reviews_count: number
          scheduled_publish_at: string | null
          search_vector: unknown
          series_id: string | null
          series_position: number | null
          slug: string
          subtitle: string | null
          subtopics: string[]
          suggested_donation_usd: number | null
          title: string
          topics: string[]
          trailer_video_url: string | null
          updated_at: string
          views_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "library_books"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_library_trending_topics: {
        Args: { _limit?: number }
        Returns: {
          entity_id: string
          entity_type: string
          growth_ratio: number
          name: string
          recent_mentions: number
        }[]
      }
      get_library_weak_topics: {
        Args: { _user_id?: string }
        Returns: {
          accuracy_percent: number
          attempts_count: number
          topic: string
        }[]
      }
      get_my_voice_room_ids: { Args: never; Returns: string[] }
      get_organization_certificates_earned: {
        Args: { _organization_id: string }
        Returns: number
      }
      get_organization_concurrent_count: {
        Args: { _organization_id: string }
        Returns: number
      }
      get_organization_department_activity: {
        Args: { _organization_id: string }
        Returns: {
          department_id: string
          department_name: string
          member_count: number
          total_reading_minutes: number
        }[]
      }
      get_organization_member_engagement: {
        Args: { _limit?: number; _organization_id: string }
        Returns: {
          assignments_completed: number
          books_completed: number
          last_active_at: string
          reading_minutes: number
          user_id: string
        }[]
      }
      get_organization_popular_books: {
        Args: { _limit?: number; _organization_id: string }
        Returns: {
          book_id: string
          reader_count: number
          title: string
        }[]
      }
      get_organization_reading_stats: {
        Args: { _organization_id: string }
        Returns: {
          active_member_count: number
          avg_completion_rate: number
          total_books_completed: number
          total_reading_hours: number
        }[]
      }
      get_organization_seat_usage: {
        Args: { _organization_id: string }
        Returns: {
          license_id: string
          license_type: Database["public"]["Enums"]["organization_license_type"]
          seat_count: number
          seats_used: number
        }[]
      }
      get_organization_training_completion: {
        Args: { _organization_id: string }
        Returns: {
          assigned_count: number
          assignment_id: string
          assignment_type: Database["public"]["Enums"]["organization_assignment_type"]
          completed_count: number
          title: string
        }[]
      }
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
      has_active_library_borrow: {
        Args: { _book_id: string }
        Returns: boolean
      }
      has_active_library_license_seat: {
        Args: { _book_id: string }
        Returns: boolean
      }
      has_active_library_subscription: { Args: never; Returns: boolean }
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
      has_purchased_library_book: {
        Args: { _book_id: string }
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
      increment_kids_event_reaction: {
        Args: { _emoji: string; _event_id: string }
        Returns: undefined
      }
      increment_kids_replay_view: {
        Args: { _replay_id: string }
        Returns: undefined
      }
      increment_kids_story_views: {
        Args: { _story_id: string }
        Returns: undefined
      }
      install_kids_plugin: { Args: { _slug: string }; Returns: undefined }
      invite_to_library_club: {
        Args: { _club_id: string; _email: string }
        Returns: boolean
      }
      invite_to_library_research_project: {
        Args: { _email: string; _project_id: string; _role?: string }
        Returns: boolean
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
      is_kids_guardian_of: {
        Args: { _child: string; _guardian: string }
        Returns: boolean
      }
      is_kids_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_kids_org_admin: {
        Args: { _org: string; _uid: string }
        Returns: boolean
      }
      is_kids_org_member: {
        Args: { _org: string; _uid: string }
        Returns: boolean
      }
      is_kids_org_staff: {
        Args: { _org: string; _uid: string }
        Returns: boolean
      }
      is_kids_user_restricted: {
        Args: { _scope_id?: string; _scope_type?: string; _user_id: string }
        Returns: boolean
      }
      is_library_academy_instructor: { Args: never; Returns: boolean }
      is_library_book_collaborator: {
        Args: {
          _book_id: string
          _roles?: Database["public"]["Enums"]["library_collaborator_role"][]
        }
        Returns: boolean
      }
      is_library_book_free: { Args: { _book_id: string }; Returns: boolean }
      is_library_book_owner: { Args: { _book_id: string }; Returns: boolean }
      is_library_book_published: {
        Args: { _book_id: string }
        Returns: boolean
      }
      is_library_club_member: { Args: { _club_id: string }; Returns: boolean }
      is_library_club_moderator: {
        Args: { _club_id: string }
        Returns: boolean
      }
      is_library_learning_path_owner: {
        Args: { _path_id: string }
        Returns: boolean
      }
      is_library_reading_list_owner: {
        Args: { _list_id: string }
        Returns: boolean
      }
      is_library_reading_list_visible: {
        Args: { _list_id: string }
        Returns: boolean
      }
      is_library_research_project_editor: {
        Args: { _project_id: string }
        Returns: boolean
      }
      is_library_research_project_member: {
        Args: { _project_id: string }
        Returns: boolean
      }
      is_library_user_muted: {
        Args: { _club_id?: string; _user_id: string }
        Returns: boolean
      }
      is_organization_admin: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      issue_kids_certificate: {
        Args: {
          _description?: string
          _org: string
          _student_id: string
          _student_name: string
          _title: string
        }
        Returns: Json
      }
      join_library_club: { Args: { _club_id: string }; Returns: string }
      kids_coin_balance: { Args: { _uid: string }; Returns: number }
      kids_enterprise_rate_ok: {
        Args: { _action: string; _max: number }
        Returns: boolean
      }
      kids_habit_streak: { Args: { _user_id: string }; Returns: number }
      kids_has_achievement: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      kids_is_admin: { Args: never; Returns: boolean }
      kids_level_for_xp: { Args: { _xp: number }; Returns: number }
      kids_market_rate_ok: {
        Args: { _action: string; _max: number }
        Returns: boolean
      }
      kids_org_role: { Args: { _org: string; _uid: string }; Returns: string }
      kids_platform_rate_ok: {
        Args: { _action: string; _max: number }
        Returns: boolean
      }
      kids_world_rate_ok: {
        Args: { _action: string; _max: number }
        Returns: boolean
      }
      leave_library_club: { Args: { _club_id: string }; Returns: undefined }
      library_immutable_array_to_string: {
        Args: { _arr: string[]; _sep: string }
        Returns: string
      }
      like_kids_review: { Args: { _review_id: string }; Returns: Json }
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
      log_kids_habit: {
        Args: { _date?: string; _habit_slug: string }
        Returns: Json
      }
      log_kids_mood: {
        Args: { _color?: string; _mood: string; _note?: string }
        Returns: boolean
      }
      log_kids_sleep: {
        Args: {
          _bedtime: string
          _duration_minutes: number
          _quality?: string
          _wake_time: string
        }
        Returns: boolean
      }
      log_kids_sync_event: {
        Args: {
          _detail: Json
          _device_key: string
          _entity: string
          _kind: string
        }
        Returns: undefined
      }
      log_kids_wellness_session: {
        Args: { _kind: string; _minutes: number; _ref_slug: string }
        Returns: undefined
      }
      log_library_audit_event: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
        }
        Returns: undefined
      }
      log_library_reading_activity: {
        Args: { _minutes?: number; _pages?: number }
        Returns: undefined
      }
      mark_kids_attendance: {
        Args: {
          _class_id: string
          _date: string
          _status: string
          _student_id: string
        }
        Returns: undefined
      }
      mark_kids_notification_read: {
        Args: { _id?: string }
        Returns: undefined
      }
      mark_kids_research_read: {
        Args: { _article_id: string }
        Returns: boolean
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
      match_library_books_semantic: {
        Args: { _match_count?: number; _query_embedding: string }
        Returns: {
          book_id: string
          similarity: number
        }[]
      }
      match_library_chapter_chunks: {
        Args: {
          _book_id: string
          _chapter_id?: string
          _match_count?: number
          _query_embedding: string
        }
        Returns: {
          chapter_id: string
          chapter_title: string
          chunk_id: string
          content: string
          similarity: number
        }[]
      }
      match_library_kg_entities_semantic: {
        Args: { _match_count?: number; _query_embedding: string }
        Returns: {
          entity_id: string
          similarity: number
        }[]
      }
      maybe_revoke_trial: {
        Args: { _device_id: string; _user_id: string }
        Returns: undefined
      }
      moderate_kids_product: {
        Args: { _approve: boolean; _notes?: string; _product_id: string }
        Returns: undefined
      }
      notify_self: {
        Args: { _body: string; _title: string; _type?: string }
        Returns: undefined
      }
      organization_member_has_permission: {
        Args: {
          _organization_id: string
          _permission: Database["public"]["Enums"]["organization_permission"]
        }
        Returns: boolean
      }
      pause_library_ai_memory: { Args: never; Returns: undefined }
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
      ping_kids_usage: {
        Args: { _category: string }
        Returns: {
          daily_limit_minutes: number
          is_over_limit: boolean
          minutes_used_today: number
        }[]
      }
      publish_scheduled_library_books: { Args: never; Returns: undefined }
      purchase_kids_product: { Args: { _product_id: string }; Returns: Json }
      radio_cleanup_expired: { Args: never; Returns: undefined }
      recompute_kids_story_count: {
        Args: { _column: string; _story_id: string }
        Returns: undefined
      }
      record_career_login_attempt: {
        Args: { _identifier: string; _ip_hash?: string; _success: boolean }
        Returns: undefined
      }
      record_device_fingerprint: {
        Args: { _device_id: string; _user_agent?: string; _user_id: string }
        Returns: undefined
      }
      record_kids_product_view: {
        Args: { _product_id: string }
        Returns: undefined
      }
      record_library_listening_heartbeat: {
        Args: { _rate?: number; _seconds_delta: number }
        Returns: undefined
      }
      record_tv_watch: {
        Args: { _channel_id: string; _seconds: number }
        Returns: undefined
      }
      redeem_kids_parent_link_code: {
        Args: { _code: string }
        Returns: boolean
      }
      redeem_kids_reward: { Args: { _slug: string }; Returns: undefined }
      refresh_library_monthly_stats: { Args: never; Returns: undefined }
      refund_stale_file_conversions: { Args: never; Returns: number }
      register_for_kids_event: {
        Args: { _event_id: string }
        Returns: {
          decided_at: string | null
          event_id: string
          id: string
          parental_approval_status: string
          registered_at: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kids_event_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_kids_device: {
        Args: {
          _app_version: string
          _device_key: string
          _name: string
          _platform: string
        }
        Returns: string
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
      release_library_coupon: {
        Args: { _coupon_id: string; _user_id: string }
        Returns: undefined
      }
      report_kids_review: {
        Args: { _reason: string; _review_id: string }
        Returns: undefined
      }
      reserve_library_coupon: {
        Args: { _coupon_id: string; _user_id: string }
        Returns: boolean
      }
      resolve_kids_error: { Args: { _id: string }; Returns: undefined }
      respond_to_library_club_invite: {
        Args: { _accept: boolean; _club_id: string }
        Returns: undefined
      }
      resume_library_ai_memory: { Args: never; Returns: undefined }
      review_library_flashcard: {
        Args: { _flashcard_id: string; _quality: number; _session_id?: string }
        Returns: {
          audio_url: string | null
          back: string
          created_at: string
          deck_id: string
          difficulty: string
          due_at: string
          ease_factor: number
          front: string
          id: string
          image_url: string | null
          interval_days: number
          last_reviewed_at: string | null
          order_index: number
          repetitions: number
          source: string
        }
        SetofOptions: {
          from: "*"
          to: "library_flashcards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rsvp_library_event: {
        Args: {
          _event_id: string
          _status: Database["public"]["Enums"]["library_event_rsvp_status"]
        }
        Returns: undefined
      }
      run_kids_auto_moderation: { Args: { _product_id: string }; Returns: Json }
      save_kids_home: {
        Args: { _name: string; _rooms: Json; _theme: string }
        Returns: undefined
      }
      save_kids_preferences: {
        Args: {
          _audio_guidance: boolean
          _auto_download: boolean
          _low_data: boolean
          _tv_mode: boolean
          _wifi_only: boolean
        }
        Returns: undefined
      }
      save_kids_project: {
        Args: {
          _data: Json
          _description: string
          _emoji: string
          _is_public?: boolean
          _kind: string
          _lab: string
          _title: string
        }
        Returns: string
      }
      search_inside_library_book: {
        Args: { _book_id: string; _query: string }
        Returns: {
          chapter_id: string
          chapter_number: number
          chapter_title: string
          rank: number
          snippet: string
        }[]
      }
      search_library_books: {
        Args: { _limit?: number; _offset?: number; _query: string }
        Returns: {
          age_category: string | null
          age_rating: string
          author_id: string
          auto_classified_at: string | null
          book_type: string
          category_id: string | null
          content_format: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          description_long: string | null
          difficulty_level: string | null
          doi: string | null
          downloads_count: number
          duplicate_checked_at: string | null
          edition: string | null
          embedding: string | null
          flash_deal_ends_at: string | null
          id: string
          import_source: string | null
          imported_by: string | null
          is_free: boolean
          isbn: string | null
          issn: string | null
          keywords: string[]
          language: string
          lending_copies_total: number | null
          license_details: string | null
          license_type: string
          likes_count: number
          page_count: number | null
          potential_duplicate_of: string | null
          price_usd: number | null
          price_vx: number | null
          pricing_model: string
          publish_status: string
          published_date: string | null
          publisher_id: string | null
          rating_avg: number | null
          rating_count: number
          reading_level: string | null
          reading_time_minutes: number | null
          rental_period_days: number | null
          rental_price_usd: number | null
          rental_price_vx: number | null
          review_note: string | null
          reviews_count: number
          scheduled_publish_at: string | null
          search_vector: unknown
          series_id: string | null
          series_position: number | null
          slug: string
          subtitle: string | null
          subtopics: string[]
          suggested_donation_usd: number | null
          title: string
          topics: string[]
          trailer_video_url: string | null
          updated_at: string
          views_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "library_books"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_library_notes: {
        Args: { _notebook_id?: string; _query: string; _tag?: string }
        Returns: {
          book_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          note_type: string
          notebook_id: string | null
          page_number: number | null
          tags: string[]
          updated_at: string
          user_id: string
          voice_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "library_notes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      send_organization_announcement: {
        Args: { _body: string; _organization_id: string; _title: string }
        Returns: number
      }
      set_kids_dashboard: { Args: { _widgets: Json }; Returns: undefined }
      set_kids_maintenance: {
        Args: {
          _admins_bypass: boolean
          _enabled: boolean
          _message: string
          _mode: string
        }
        Returns: undefined
      }
      set_kids_theme: { Args: { _slug: string }; Returns: undefined }
      set_kids_voice_room_recording: {
        Args: { _active: boolean; _room_id: string }
        Returns: boolean
      }
      set_library_club_member_ban: {
        Args: { _banned: boolean; _club_id: string; _user_id: string }
        Returns: undefined
      }
      set_library_club_member_role: {
        Args: {
          _club_id: string
          _role: Database["public"]["Enums"]["library_club_member_role"]
          _user_id: string
        }
        Returns: undefined
      }
      settle_file_conversion: {
        Args: { _job_id: string; _succeeded: boolean }
        Returns: string
      }
      share_library_reading_list: {
        Args: { _email: string; _list_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sign_out_all_kids_devices: {
        Args: { _keep_device_key?: string }
        Returns: undefined
      }
      sign_out_kids_device: { Args: { _device_id: string }; Returns: undefined }
      snapshot_library_research_project: {
        Args: { _note?: string; _project_id: string }
        Returns: string
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
      start_library_event_voice_room: {
        Args: { _event_id: string }
        Returns: string
      }
      start_library_quiz_attempt: {
        Args: { _quiz_id: string }
        Returns: {
          answers: Json
          id: string
          needs_manual_grading: boolean
          passed: boolean | null
          quiz_id: string
          score_percent: number | null
          started_at: string
          submitted_at: string | null
          time_spent_seconds: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "library_quiz_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_kids_innovation: {
        Args: {
          _challenge_id: string
          _data: Json
          _description: string
          _is_public?: boolean
          _title: string
        }
        Returns: string
      }
      submit_kids_product: { Args: { _product_id: string }; Returns: Json }
      submit_kids_talent_assessment: {
        Args: { _domain_scores: Json; _top_domains: string[] }
        Returns: boolean
      }
      submit_library_quiz_attempt: {
        Args: {
          _answers: Json
          _attempt_id: string
          _time_spent_seconds?: number
        }
        Returns: {
          correct_answer: Json
          explanation: string
          is_correct: boolean
          needs_manual_grading: boolean
          passed: boolean
          question_id: string
          score_percent: number
        }[]
      }
      subscribe_kids_plan: {
        Args: { _org_id?: string; _plan_slug: string }
        Returns: Json
      }
      subscribe_radio: { Args: { _plan_id: string }; Returns: Json }
      subscribe_tv: { Args: { _plan_id: string }; Returns: Json }
      suspend_user: {
        Args: { _reason: string; _until: string; _user_id: string }
        Returns: undefined
      }
      sync_library_progress_to_academy: {
        Args: { _chapter_id: string; _completed?: boolean }
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
      toggle_kids_flag: {
        Args: { _enabled: boolean; _key: string }
        Returns: undefined
      }
      toggle_kids_plugin: {
        Args: { _enabled: boolean; _slug: string }
        Returns: undefined
      }
      toggle_kids_project_like: { Args: { _project_id: string }; Returns: Json }
      toggle_kids_wishlist: { Args: { _product_id: string }; Returns: boolean }
      toggle_tv_favorite: { Args: { _channel_id: string }; Returns: Json }
      toggle_user_feature: {
        Args: { _enabled: boolean; _feature_key: string; _user_id: string }
        Returns: undefined
      }
      touch_kids_device: { Args: { _device_key: string }; Returns: undefined }
      touch_organization_session: {
        Args: { _organization_id: string; _user_agent?: string }
        Returns: string
      }
      tv_cleanup_expired: { Args: never; Returns: undefined }
      unban_device: { Args: { _device_id: string }; Returns: undefined }
      unban_user: { Args: { _user_id: string }; Returns: undefined }
      uninstall_kids_plugin: { Args: { _slug: string }; Returns: undefined }
      unlock_kids_transport: {
        Args: { _transport_slug: string }
        Returns: boolean
      }
      update_kids_incident: {
        Args: { _assignee?: string; _id: string; _status: string }
        Returns: undefined
      }
      update_source_reliability: {
        Args: { _reliability: number; _source_id: string }
        Returns: undefined
      }
      verify_kids_certificate: {
        Args: { _certificate_number: string }
        Returns: {
          certificate_type: string
          is_valid: boolean
          issued_at: string
          issuer_name: string
          recipient_name: string
          score_percent: number
          signature_hash: string
          title: string
          verification_code: string
        }[]
      }
      verify_kids_creator: {
        Args: { _approve: boolean; _note?: string; _user_id: string }
        Returns: undefined
      }
      verify_kids_org_certificate: { Args: { _code: string }; Returns: Json }
      verify_library_certificate: {
        Args: { _certificate_number: string }
        Returns: {
          certificate_type: string
          is_valid: boolean
          issued_at: string
          issuer_name: string
          recipient_name: string
          score_percent: number
          signature_hash: string
          title: string
          verification_code: string
        }[]
      }
      visit_kids_region: { Args: { _region_slug: string }; Returns: boolean }
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
      library_club_member_role: "owner" | "moderator" | "member"
      library_club_member_status: "active" | "invited" | "requested" | "banned"
      library_club_visibility: "public" | "private" | "invite_only"
      library_collaborator_role:
        | "owner"
        | "editor"
        | "proofreader"
        | "translator"
        | "designer"
        | "reviewer"
      library_collaborator_status: "invited" | "active" | "revoked"
      library_collection_type:
        | "editors_choice"
        | "staff_pick"
        | "award_winner"
        | "seasonal"
        | "curated"
      library_discussion_context: "book" | "club"
      library_event_rsvp_status: "going" | "interested" | "declined"
      library_event_type:
        | "author_qa"
        | "book_launch"
        | "reading_session"
        | "live_audio"
        | "webinar"
        | "workshop"
        | "meetup"
      library_goal_type:
        | "books_per_month"
        | "pages_per_day"
        | "listening_minutes_per_day"
        | "minutes_per_day"
        | "sessions_per_week"
        | "custom"
      library_kg_entity_type:
        | "author"
        | "topic"
        | "character"
        | "historical_event"
        | "scientific_concept"
        | "location"
        | "organization"
        | "person"
        | "technology"
        | "language"
        | "skill"
        | "publisher"
      library_learning_path_level:
        | "beginner"
        | "intermediate"
        | "advanced"
        | "professional"
        | "certification"
        | "custom"
      library_librarian_goal_category:
        | "learning"
        | "study"
        | "career"
        | "custom"
      library_librarian_goal_status: "active" | "completed" | "abandoned"
      library_librarian_recommendation_type:
        | "book"
        | "audiobook"
        | "article"
        | "course"
        | "author"
        | "book_club"
        | "learning_path"
        | "challenge"
        | "event"
        | "research_topic"
      library_librarian_request_status: "pending" | "completed" | "failed"
      library_librarian_request_type:
        | "export"
        | "delete_all"
        | "delete_category"
        | "pause"
        | "resume"
      library_license_type:
        | "individual"
        | "corporate"
        | "educational"
        | "family"
      library_moderation_action: "warning" | "mute" | "ban"
      library_skill_level: "beginner" | "intermediate" | "advanced" | "expert"
      library_skill_source: "manual" | "certificate" | "course"
      library_summary_period: "daily" | "weekly" | "monthly" | "yearly"
      mentor_booking_status:
        | "requested"
        | "confirmed"
        | "completed"
        | "cancelled"
      organization_assignment_type:
        | "book"
        | "audiobook"
        | "course"
        | "reading_list"
        | "quiz"
        | "assignment"
      organization_group_type:
        | "department"
        | "class"
        | "team"
        | "project"
        | "research_group"
        | "book_club"
        | "learning_group"
      organization_invitation_status: "pending" | "accepted" | "failed"
      organization_license_type:
        | "seat"
        | "concurrent"
        | "subscription"
        | "time_limited"
        | "department"
        | "educational"
        | "corporate"
      organization_member_role:
        | "owner"
        | "admin"
        | "manager"
        | "teacher"
        | "student"
        | "employee"
        | "researcher"
        | "guest"
        | "custom"
      organization_member_status: "invited" | "active" | "suspended"
      organization_permission:
        | "view"
        | "download"
        | "print"
        | "share"
        | "edit"
        | "publish"
        | "delete"
        | "approve"
        | "audit"
      organization_report_cadence: "weekly" | "monthly"
      organization_resource_type:
        | "collection"
        | "internal_document"
        | "training_manual"
        | "policy"
        | "employee_handbook"
        | "course_library"
        | "confidential_resource"
      organization_type:
        | "school"
        | "university"
        | "training_center"
        | "company"
        | "government"
        | "ngo"
        | "public_library"
        | "private_library"
        | "research_center"
        | "medical_institution"
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
      library_club_member_role: ["owner", "moderator", "member"],
      library_club_member_status: ["active", "invited", "requested", "banned"],
      library_club_visibility: ["public", "private", "invite_only"],
      library_collaborator_role: [
        "owner",
        "editor",
        "proofreader",
        "translator",
        "designer",
        "reviewer",
      ],
      library_collaborator_status: ["invited", "active", "revoked"],
      library_collection_type: [
        "editors_choice",
        "staff_pick",
        "award_winner",
        "seasonal",
        "curated",
      ],
      library_discussion_context: ["book", "club"],
      library_event_rsvp_status: ["going", "interested", "declined"],
      library_event_type: [
        "author_qa",
        "book_launch",
        "reading_session",
        "live_audio",
        "webinar",
        "workshop",
        "meetup",
      ],
      library_goal_type: [
        "books_per_month",
        "pages_per_day",
        "listening_minutes_per_day",
        "minutes_per_day",
        "sessions_per_week",
        "custom",
      ],
      library_kg_entity_type: [
        "author",
        "topic",
        "character",
        "historical_event",
        "scientific_concept",
        "location",
        "organization",
        "person",
        "technology",
        "language",
        "skill",
        "publisher",
      ],
      library_learning_path_level: [
        "beginner",
        "intermediate",
        "advanced",
        "professional",
        "certification",
        "custom",
      ],
      library_librarian_goal_category: [
        "learning",
        "study",
        "career",
        "custom",
      ],
      library_librarian_goal_status: ["active", "completed", "abandoned"],
      library_librarian_recommendation_type: [
        "book",
        "audiobook",
        "article",
        "course",
        "author",
        "book_club",
        "learning_path",
        "challenge",
        "event",
        "research_topic",
      ],
      library_librarian_request_status: ["pending", "completed", "failed"],
      library_librarian_request_type: [
        "export",
        "delete_all",
        "delete_category",
        "pause",
        "resume",
      ],
      library_license_type: [
        "individual",
        "corporate",
        "educational",
        "family",
      ],
      library_moderation_action: ["warning", "mute", "ban"],
      library_skill_level: ["beginner", "intermediate", "advanced", "expert"],
      library_skill_source: ["manual", "certificate", "course"],
      library_summary_period: ["daily", "weekly", "monthly", "yearly"],
      mentor_booking_status: [
        "requested",
        "confirmed",
        "completed",
        "cancelled",
      ],
      organization_assignment_type: [
        "book",
        "audiobook",
        "course",
        "reading_list",
        "quiz",
        "assignment",
      ],
      organization_group_type: [
        "department",
        "class",
        "team",
        "project",
        "research_group",
        "book_club",
        "learning_group",
      ],
      organization_invitation_status: ["pending", "accepted", "failed"],
      organization_license_type: [
        "seat",
        "concurrent",
        "subscription",
        "time_limited",
        "department",
        "educational",
        "corporate",
      ],
      organization_member_role: [
        "owner",
        "admin",
        "manager",
        "teacher",
        "student",
        "employee",
        "researcher",
        "guest",
        "custom",
      ],
      organization_member_status: ["invited", "active", "suspended"],
      organization_permission: [
        "view",
        "download",
        "print",
        "share",
        "edit",
        "publish",
        "delete",
        "approve",
        "audit",
      ],
      organization_report_cadence: ["weekly", "monthly"],
      organization_resource_type: [
        "collection",
        "internal_document",
        "training_manual",
        "policy",
        "employee_handbook",
        "course_library",
        "confidential_resource",
      ],
      organization_type: [
        "school",
        "university",
        "training_center",
        "company",
        "government",
        "ngo",
        "public_library",
        "private_library",
        "research_center",
        "medical_institution",
      ],
      review_target_type: ["mentor", "company", "freelancer"],
    },
  },
} as const
