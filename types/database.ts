export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          language: string;
          theme: string;
          show_tomorrow: boolean;
          journal_sections_enabled: Json;
          onboarding_completed: boolean;
          journal_preset: string | null;
          journal_config: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          language?: string;
          theme?: string;
          show_tomorrow?: boolean;
          journal_sections_enabled?: Json;
          onboarding_completed?: boolean;
          journal_preset?: string | null;
          journal_config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          language?: string;
          theme?: string;
          show_tomorrow?: boolean;
          journal_sections_enabled?: Json;
          onboarding_completed?: boolean;
          journal_preset?: string | null;
          journal_config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          language: string;
          raw_transcript: string;
          edited_transcript: string;
          ai_summary: string;
          ai_summary_error: string | null;
          ai_summary_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_date: string;
          language?: string;
          raw_transcript?: string;
          edited_transcript?: string;
          ai_summary?: string;
          ai_summary_error?: string | null;
          ai_summary_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entry_date?: string;
          language?: string;
          raw_transcript?: string;
          edited_transcript?: string;
          ai_summary?: string;
          ai_summary_error?: string | null;
          ai_summary_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      journal_sections: {
        Row: {
          id: string;
          journal_entry_id: string;
          user_id: string;
          section_key: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          journal_entry_id: string;
          user_id: string;
          section_key: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          journal_entry_id?: string;
          user_id?: string;
          section_key?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tomorrow_setups: {
        Row: {
          id: string;
          journal_entry_id: string;
          user_id: string;
          focus: string;
          top_tasks: string[];
          watch_out_for: string;
          intention: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          journal_entry_id: string;
          user_id: string;
          focus?: string;
          top_tasks?: string[];
          watch_out_for?: string;
          intention?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          journal_entry_id?: string;
          user_id?: string;
          focus?: string;
          top_tasks?: string[];
          watch_out_for?: string;
          intention?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monthly_goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          month: number;
          year: number;
          life_area: string;
          status: string;
          progress: number;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          month: number;
          year: number;
          life_area: string;
          status?: string;
          progress?: number;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          month?: number;
          year?: number;
          life_area?: string;
          status?: string;
          progress?: number;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weekly_goals: {
        Row: {
          id: string;
          user_id: string;
          monthly_goal_id: string | null;
          title: string;
          description: string;
          week_number: number;
          start_date: string;
          end_date: string;
          life_area: string;
          status: string;
          progress: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          monthly_goal_id?: string | null;
          title: string;
          description?: string;
          week_number: number;
          start_date: string;
          end_date: string;
          life_area: string;
          status?: string;
          progress?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          monthly_goal_id?: string | null;
          title?: string;
          description?: string;
          week_number?: number;
          start_date?: string;
          end_date?: string;
          life_area?: string;
          status?: string;
          progress?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_tasks: {
        Row: {
          id: string;
          user_id: string;
          weekly_goal_id: string | null;
          title: string;
          note: string;
          date: string;
          priority: string;
          life_area: string;
          completed: boolean;
          carry_over_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          weekly_goal_id?: string | null;
          title: string;
          note?: string;
          date: string;
          priority?: string;
          life_area: string;
          completed?: boolean;
          carry_over_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          weekly_goal_id?: string | null;
          title?: string;
          note?: string;
          date?: string;
          priority?: string;
          life_area?: string;
          completed?: boolean;
          carry_over_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_focuses: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          main_focus: string;
          secondary_focuses: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          date: string;
          main_focus?: string;
          secondary_focuses?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          main_focus?: string;
          secondary_focuses?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
