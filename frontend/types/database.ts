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
  public: {
    Tables: {
      activity: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          is_take_home: boolean
          target_text: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          is_take_home?: boolean
          target_text: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean
          is_take_home?: boolean
          target_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_score: {
        Row: {
          baseline_alignment_band: Database["public"]["Enums"]["score_band"]
          baseline_alignment_score: number | null
          created_at: string
          graded_by: string
          id: string
          letter_formation_band: Database["public"]["Enums"]["score_band"]
          letter_formation_score: number | null
          size_consistency_band: Database["public"]["Enums"]["score_band"]
          size_consistency_score: number | null
          slant_band: Database["public"]["Enums"]["score_band"]
          slant_score: number | null
          spacing_band: Database["public"]["Enums"]["score_band"]
          spacing_score: number | null
          submission_id: string
        }
        Insert: {
          baseline_alignment_band: Database["public"]["Enums"]["score_band"]
          baseline_alignment_score?: number | null
          created_at?: string
          graded_by: string
          id?: string
          letter_formation_band: Database["public"]["Enums"]["score_band"]
          letter_formation_score?: number | null
          size_consistency_band: Database["public"]["Enums"]["score_band"]
          size_consistency_score?: number | null
          slant_band: Database["public"]["Enums"]["score_band"]
          slant_score?: number | null
          spacing_band: Database["public"]["Enums"]["score_band"]
          spacing_score?: number | null
          submission_id: string
        }
        Update: {
          baseline_alignment_band?: Database["public"]["Enums"]["score_band"]
          baseline_alignment_score?: number | null
          created_at?: string
          graded_by?: string
          id?: string
          letter_formation_band?: Database["public"]["Enums"]["score_band"]
          letter_formation_score?: number | null
          size_consistency_band?: Database["public"]["Enums"]["score_band"]
          size_consistency_score?: number | null
          slant_band?: Database["public"]["Enums"]["score_band"]
          slant_score?: number | null
          spacing_band?: Database["public"]["Enums"]["score_band"]
          spacing_score?: number | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_score_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_score_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submission"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement: {
        Row: {
          baseline_alignment_score: number | null
          baseline_deviation_mean: number | null
          baseline_deviation_std: number | null
          composite_score: number | null
          created_at: string
          id: string
          letter_formation_mean: number | null
          letter_formation_score: number | null
          letter_formation_std: number | null
          letter_spacing_mean: number | null
          letter_spacing_std: number | null
          overlay: Json | null
          raw_output: Json
          size_consistency_mean: number | null
          size_consistency_score: number | null
          size_consistency_std: number | null
          slant_mean: number | null
          slant_score: number | null
          slant_std: number | null
          spacing_score: number | null
          submission_id: string
          word_spacing_mean: number | null
          word_spacing_std: number | null
        }
        Insert: {
          baseline_alignment_score?: number | null
          baseline_deviation_mean?: number | null
          baseline_deviation_std?: number | null
          composite_score?: number | null
          created_at?: string
          id?: string
          letter_formation_mean?: number | null
          letter_formation_score?: number | null
          letter_formation_std?: number | null
          letter_spacing_mean?: number | null
          letter_spacing_std?: number | null
          overlay?: Json | null
          raw_output: Json
          size_consistency_mean?: number | null
          size_consistency_score?: number | null
          size_consistency_std?: number | null
          slant_mean?: number | null
          slant_score?: number | null
          slant_std?: number | null
          spacing_score?: number | null
          submission_id: string
          word_spacing_mean?: number | null
          word_spacing_std?: number | null
        }
        Update: {
          baseline_alignment_score?: number | null
          baseline_deviation_mean?: number | null
          baseline_deviation_std?: number | null
          composite_score?: number | null
          created_at?: string
          id?: string
          letter_formation_mean?: number | null
          letter_formation_score?: number | null
          letter_formation_std?: number | null
          letter_spacing_mean?: number | null
          letter_spacing_std?: number | null
          overlay?: Json | null
          raw_output?: Json
          size_consistency_mean?: number | null
          size_consistency_score?: number | null
          size_consistency_std?: number | null
          slant_mean?: number | null
          slant_score?: number | null
          slant_std?: number | null
          spacing_score?: number | null
          submission_id?: string
          word_spacing_mean?: number | null
          word_spacing_std?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submission"
            referencedColumns: ["id"]
          },
        ]
      }
      parent: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      student: {
        Row: {
          created_at: string
          full_name: string
          id: string
          parent_email: string | null
          parent_status: string | null
          section: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          parent_email?: string | null
          parent_status?: string | null
          section: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          parent_email?: string | null
          parent_status?: string | null
          section?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_parent: {
        Row: {
          created_at: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parent_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parent_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      submission: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          image_path: string
          rejection_code: string | null
          rejection_details: Json | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          updated_at: string
          uploader_id: string
          uploader_role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          image_path: string
          rejection_code?: string | null
          rejection_details?: Json | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          updated_at?: string
          uploader_id: string
          uploader_role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          image_path?: string
          rejection_code?: string | null
          rejection_details?: Json | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          updated_at?: string
          uploader_id?: string
          uploader_role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "submission_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      teacher_student: {
        Row: {
          created_at: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_parent_of_student: {
        Args: { target_student_id: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { target_student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      score_band:
        | "needs_improvement"
        | "developing"
        | "satisfactory"
        | "excellent"
      submission_status: "processing" | "completed" | "rejected"
      user_role: "teacher" | "parent"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      score_band: [
        "needs_improvement",
        "developing",
        "satisfactory",
        "excellent",
      ],
      submission_status: ["processing", "completed", "rejected"],
      user_role: ["teacher", "parent"],
    },
  },
} as const
