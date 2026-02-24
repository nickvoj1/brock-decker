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
      api_settings: {
        Row: {
          created_at: string
          id: string
          is_configured: boolean
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_configured?: boolean
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_configured?: boolean
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      bullhorn_tokens: {
        Row: {
          access_token: string
          bh_rest_token: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          rest_url: string
          updated_at: string
        }
        Insert: {
          access_token: string
          bh_rest_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          rest_url: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          bh_rest_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          rest_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_profiles: {
        Row: {
          apollo_contacts_count: number | null
          bullhorn_status: string | null
          candidate_id: string
          created_at: string
          current_title: string | null
          education: Json | null
          email: string | null
          id: string
          location: string | null
          match_score: number | null
          name: string
          phone: string | null
          profile_name: string
          skills: Json | null
          summary: string | null
          updated_at: string
          work_history: Json | null
        }
        Insert: {
          apollo_contacts_count?: number | null
          bullhorn_status?: string | null
          candidate_id: string
          created_at?: string
          current_title?: string | null
          education?: Json | null
          email?: string | null
          id?: string
          location?: string | null
          match_score?: number | null
          name: string
          phone?: string | null
          profile_name?: string
          skills?: Json | null
          summary?: string | null
          updated_at?: string
          work_history?: Json | null
        }
        Update: {
          apollo_contacts_count?: number | null
          bullhorn_status?: string | null
          candidate_id?: string
          created_at?: string
          current_title?: string | null
          education?: Json | null
          email?: string | null
          id?: string
          location?: string | null
          match_score?: number | null
          name?: string
          phone?: string | null
          profile_name?: string
          skills?: Json | null
          summary?: string | null
          updated_at?: string
          work_history?: Json | null
        }
        Relationships: []
      }
      enrichment_runs: {
        Row: {
          bullhorn_enabled: boolean
          bullhorn_errors: Json | null
          bullhorn_exported_at: string | null
          bullhorn_list_id: number | null
          bullhorn_list_name: string | null
          candidates_count: number
          candidates_data: Json | null
          created_at: string
          enriched_csv_url: string | null
          enriched_data: Json | null
          error_message: string | null
          id: string
          preferences_count: number
          preferences_data: Json | null
          processed_count: number
          search_counter: number
          status: Database["public"]["Enums"]["run_status"]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bullhorn_enabled?: boolean
          bullhorn_errors?: Json | null
          bullhorn_exported_at?: string | null
          bullhorn_list_id?: number | null
          bullhorn_list_name?: string | null
          candidates_count?: number
          candidates_data?: Json | null
          created_at?: string
          enriched_csv_url?: string | null
          enriched_data?: Json | null
          error_message?: string | null
          id?: string
          preferences_count?: number
          preferences_data?: Json | null
          processed_count?: number
          search_counter?: number
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bullhorn_enabled?: boolean
          bullhorn_errors?: Json | null
          bullhorn_exported_at?: string | null
          bullhorn_list_id?: number | null
          bullhorn_list_name?: string | null
          candidates_count?: number
          candidates_data?: Json | null
          created_at?: string
          enriched_csv_url?: string | null
          enriched_data?: Json | null
          error_message?: string | null
          id?: string
          preferences_count?: number
          preferences_data?: Json | null
          processed_count?: number
          search_counter?: number
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      feedback_log: {
        Row: {
          action: string
          created_at: string
          id: string
          reason: string | null
          recruiter: string
          signal_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          reason?: string | null
          recruiter: string
          signal_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          reason?: string | null
          recruiter?: string
          signal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_log_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_pitches: {
        Row: {
          body: string
          candidate_name: string
          candidate_title: string | null
          created_at: string
          id: string
          industries: string[] | null
          locations: string[] | null
          profile_name: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          body: string
          candidate_name: string
          candidate_title?: string | null
          created_at?: string
          id?: string
          industries?: string[] | null
          locations?: string[] | null
          profile_name: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string
          candidate_name?: string
          candidate_title?: string | null
          created_at?: string
          id?: string
          industries?: string[] | null
          locations?: string[] | null
          profile_name?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_pitches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pitch_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_signals: {
        Row: {
          bullhorn_note_added: boolean | null
          company: string
          company_apollo_id: string | null
          contacts: Json | null
          contacts_count: number | null
          created_at: string
          dismissed_by: string | null
          id: string
          is_dismissed: boolean | null
          job_description: string | null
          job_title: string
          job_url: string | null
          location: string | null
          parent_signal_id: string | null
          posted_at: string | null
          region: string
          score: number | null
          signal_type: string | null
          source: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          bullhorn_note_added?: boolean | null
          company: string
          company_apollo_id?: string | null
          contacts?: Json | null
          contacts_count?: number | null
          created_at?: string
          dismissed_by?: string | null
          id?: string
          is_dismissed?: boolean | null
          job_description?: string | null
          job_title: string
          job_url?: string | null
          location?: string | null
          parent_signal_id?: string | null
          posted_at?: string | null
          region: string
          score?: number | null
          signal_type?: string | null
          source?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          bullhorn_note_added?: boolean | null
          company?: string
          company_apollo_id?: string | null
          contacts?: Json | null
          contacts_count?: number | null
          created_at?: string
          dismissed_by?: string | null
          id?: string
          is_dismissed?: boolean | null
          job_description?: string | null
          job_title?: string
          job_url?: string | null
          location?: string | null
          parent_signal_id?: string | null
          posted_at?: string | null
          region?: string
          score?: number | null
          signal_type?: string | null
          source?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_signals_parent_signal_id_fkey"
            columns: ["parent_signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_templates: {
        Row: {
          body_template: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          profile_name: string
          subject_template: string | null
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          profile_name: string
          subject_template?: string | null
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          profile_name?: string
          subject_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profile_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          profile_name: string
          reset_requested_at: string | null
          salt: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          profile_name: string
          reset_requested_at?: string | null
          salt?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          profile_name?: string
          reset_requested_at?: string | null
          salt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      signal_accuracy_metrics: {
        Row: {
          accuracy_percentage: number | null
          correct_predictions: number | null
          created_at: string
          date: string
          id: string
          region: string
          tier_1_accuracy: number | null
          tier_2_accuracy: number | null
          tier_3_accuracy: number | null
          total_signals: number | null
        }
        Insert: {
          accuracy_percentage?: number | null
          correct_predictions?: number | null
          created_at?: string
          date?: string
          id?: string
          region: string
          tier_1_accuracy?: number | null
          tier_2_accuracy?: number | null
          tier_3_accuracy?: number | null
          total_signals?: number | null
        }
        Update: {
          accuracy_percentage?: number | null
          correct_predictions?: number | null
          created_at?: string
          date?: string
          id?: string
          region?: string
          tier_1_accuracy?: number | null
          tier_2_accuracy?: number | null
          tier_3_accuracy?: number | null
          total_signals?: number | null
        }
        Relationships: []
      }
      signal_feedback: {
        Row: {
          confidence_delta: number | null
          correct_signal_type: string | null
          correct_tier: string | null
          created_at: string
          created_by: string
          feedback_note: string | null
          id: string
          signal_id: string
          user_label: string
        }
        Insert: {
          confidence_delta?: number | null
          correct_signal_type?: string | null
          correct_tier?: string | null
          created_at?: string
          created_by: string
          feedback_note?: string | null
          id?: string
          signal_id: string
          user_label: string
        }
        Update: {
          confidence_delta?: number | null
          correct_signal_type?: string | null
          correct_tier?: string | null
          created_at?: string
          created_by?: string
          feedback_note?: string | null
          id?: string
          signal_id?: string
          user_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_feedback_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_source_runs: {
        Row: {
          avg_geo_confidence: number
          candidates: number
          created_at: string
          duplicates: number
          errors: number
          geo_validated: number
          id: string
          inserted: number
          pending: number
          pipeline: string
          quality_passed: number
          region: string
          rejected: number
          source_name: string
          source_url: string
          updated_at: string
          validated: number
        }
        Insert: {
          avg_geo_confidence?: number
          candidates?: number
          created_at?: string
          duplicates?: number
          errors?: number
          geo_validated?: number
          id?: string
          inserted?: number
          pending?: number
          pipeline: string
          quality_passed?: number
          region: string
          rejected?: number
          source_name: string
          source_url: string
          updated_at?: string
          validated?: number
        }
        Update: {
          avg_geo_confidence?: number
          candidates?: number
          created_at?: string
          duplicates?: number
          errors?: number
          geo_validated?: number
          id?: string
          inserted?: number
          pending?: number
          pipeline?: string
          quality_passed?: number
          region?: string
          rejected?: number
          source_name?: string
          source_url?: string
          updated_at?: string
          validated?: number
        }
        Relationships: []
      }
      signals: {
        Row: {
          ai_confidence: number | null
          ai_enriched_at: string | null
          ai_insight: string | null
          ai_pitch: string | null
          amount: number | null
          bullhorn_note_added: boolean | null
          company: string | null
          contacts_found: number | null
          contacts_url: string | null
          created_at: string
          currency: string | null
          cv_matches: number | null
          description: string | null
          details: Json | null
          detected_region: string | null
          dismissed_by: string | null
          feedback_count: number | null
          id: string
          is_dismissed: boolean | null
          is_high_intent: boolean | null
          keywords: string[] | null
          keywords_count: number | null
          published_at: string | null
          raw_content: string | null
          region: string
          retrain_flag: boolean | null
          score: number | null
          signal_type: string | null
          source: string | null
          source_urls: string[] | null
          tier: string | null
          title: string
          updated_at: string
          url: string | null
          user_feedback: string | null
          validated_region: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_enriched_at?: string | null
          ai_insight?: string | null
          ai_pitch?: string | null
          amount?: number | null
          bullhorn_note_added?: boolean | null
          company?: string | null
          contacts_found?: number | null
          contacts_url?: string | null
          created_at?: string
          currency?: string | null
          cv_matches?: number | null
          description?: string | null
          details?: Json | null
          detected_region?: string | null
          dismissed_by?: string | null
          feedback_count?: number | null
          id?: string
          is_dismissed?: boolean | null
          is_high_intent?: boolean | null
          keywords?: string[] | null
          keywords_count?: number | null
          published_at?: string | null
          raw_content?: string | null
          region: string
          retrain_flag?: boolean | null
          score?: number | null
          signal_type?: string | null
          source?: string | null
          source_urls?: string[] | null
          tier?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_feedback?: string | null
          validated_region?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_enriched_at?: string | null
          ai_insight?: string | null
          ai_pitch?: string | null
          amount?: number | null
          bullhorn_note_added?: boolean | null
          company?: string | null
          contacts_found?: number | null
          contacts_url?: string | null
          created_at?: string
          currency?: string | null
          cv_matches?: number | null
          description?: string | null
          details?: Json | null
          detected_region?: string | null
          dismissed_by?: string | null
          feedback_count?: number | null
          id?: string
          is_dismissed?: boolean | null
          is_high_intent?: boolean | null
          keywords?: string[] | null
          keywords_count?: number | null
          published_at?: string | null
          raw_content?: string | null
          region?: string
          retrain_flag?: boolean | null
          score?: number | null
          signal_type?: string | null
          source?: string | null
          source_urls?: string[] | null
          tier?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_feedback?: string | null
          validated_region?: string | null
        }
        Relationships: []
      }
      skill_patterns: {
        Row: {
          confidence: number
          created_at: string
          frequency: number
          id: string
          last_analyzed_at: string
          pattern_type: string
          pattern_value: string
          skills: string[]
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          frequency?: number
          id?: string
          last_analyzed_at?: string
          pattern_type: string
          pattern_value: string
          skills?: string[]
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          frequency?: number
          id?: string
          last_analyzed_at?: string
          pattern_type?: string
          pattern_value?: string
          skills?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      used_contacts: {
        Row: {
          added_at: string
          company: string | null
          email: string
          id: string
          name: string | null
        }
        Insert: {
          added_at?: string
          company?: string | null
          email: string
          id?: string
          name?: string | null
        }
        Update: {
          added_at?: string
          company?: string | null
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      team_dashboard_stats: {
        Row: {
          avg_score: number | null
          bullhorn_error: number | null
          bullhorn_pending: number | null
          bullhorn_uploaded: number | null
          cvs_today: number | null
          cvs_week: number | null
          profile_name: string | null
          total_apollo_contacts: number | null
          total_cvs: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      run_status: "pending" | "running" | "success" | "partial" | "failed"
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
      run_status: ["pending", "running", "success", "partial", "failed"],
    },
  },
} as const
