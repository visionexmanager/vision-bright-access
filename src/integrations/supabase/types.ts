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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          subscribed_at: string
          topics: string[]
        }
        Insert: {
          email: string
          id?: string
          subscribed_at?: string
          topics?: string[]
        }
        Update: {
          email?: string
          id?: string
          subscribed_at?: string
          topics?: string[]
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
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
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
          score: number
          simulation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_step?: number
          decisions?: Json
          id?: string
          score?: number
          simulation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_step?: number
          decisions?: Json
          id?: string
          score?: number
          simulation_id?: string
          updated_at?: string
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
      voice_room_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
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
          cost_vx: number
          created_at: string
          id: string
          is_active: boolean
          max_users: number
          owner_id: string
          room_name: string
          room_type: string
          updated_at: string
        }
        Insert: {
          cost_vx?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_users?: number
          owner_id: string
          room_name?: string
          room_type?: string
          updated_at?: string
        }
        Update: {
          cost_vx?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_users?: number
          owner_id?: string
          room_name?: string
          room_type?: string
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      award_achievement: {
        Args: { _achievement_key: string }
        Returns: undefined
      }
      award_points: {
        Args: { _points: number; _reason: string }
        Returns: undefined
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
