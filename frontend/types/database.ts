export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activity: {
        Row: {
          close_after_due: boolean
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions: string | null
          is_archived: boolean
          is_take_home: boolean
          points_possible: number | null
          points_revision: number
          target_text: string
          title: string
        }
        Insert: {
          close_after_due?: boolean
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean
          is_take_home?: boolean
          points_possible?: number | null
          points_revision?: number
          target_text: string
          title: string
        }
        Update: {
          close_after_due?: boolean
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean
          is_take_home?: boolean
          points_possible?: number | null
          points_revision?: number
          target_text?: string
          title?: string
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
      activity_assignment: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          section_id: string | null
          student_id: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          section_id?: string | null
          student_id?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          section_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_assignment_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assignment_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assignment_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          claim_attempts: number | null
          claim_token: string | null
          created_at: string
          due_at: string | null
          first_attempt_at: string | null
          id: string
          last_error: string | null
          lease_expires_at: string | null
          next_attempt_at: string
          notification_id: string
          payload_sha256: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          claim_attempts?: number | null
          claim_token?: string | null
          created_at?: string
          due_at?: string | null
          first_attempt_at?: string | null
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          next_attempt_at?: string
          notification_id: string
          payload_sha256?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          claim_attempts?: number | null
          claim_token?: string | null
          created_at?: string
          due_at?: string | null
          first_attempt_at?: string | null
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          next_attempt_at?: string
          notification_id?: string
          payload_sha256?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notification"
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
            referencedRelation: "active_submission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_score_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "activity_work_state"
            referencedColumns: ["active_submission_id"]
          },
          {
            foreignKeyName: "manual_score_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "activity_work_state"
            referencedColumns: ["latest_submission_id"]
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
            referencedRelation: "active_submission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "activity_work_state"
            referencedColumns: ["active_submission_id"]
          },
          {
            foreignKeyName: "measurement_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "activity_work_state"
            referencedColumns: ["latest_submission_id"]
          },
          {
            foreignKeyName: "measurement_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submission"
            referencedColumns: ["id"]
          },
        ]
      }
      notification: {
        Row: {
          activity_id: string
          created_at: string
          dedupe_key: string
          id: string
          read_at: string | null
          recipient_id: string
          student_id: string
          submission_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          activity_id: string
          created_at?: string
          dedupe_key: string
          id?: string
          read_at?: string | null
          recipient_id: string
          student_id: string
          submission_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          activity_id?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          student_id?: string
          submission_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "active_submission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["active_submission_id"]
          },
          {
            foreignKeyName: "notification_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["latest_submission_id"]
          },
          {
            foreignKeyName: "notification_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submission"
            referencedColumns: ["id"]
          },
        ]
      }
      parent: {
        Row: {
          created_at: string
          email: string
          email_notifications: boolean
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          email_notifications?: boolean
          full_name: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          email_notifications?: boolean
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      section: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
      student: {
        Row: {
          created_at: string
          full_name: string
          id: string
          parent_email: string | null
          parent_status: string | null
          section: string
          section_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          parent_email?: string | null
          parent_status?: string | null
          section: string
          section_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          parent_email?: string | null
          parent_status?: string | null
          section?: string
          section_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
        ]
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
      student_work: {
        Row: {
          activity_id: string
          due_at_override: string | null
          excused: boolean
          pinned_submission_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          due_at_override?: string | null
          excused?: boolean
          pinned_submission_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          due_at_override?: string | null
          excused?: boolean
          pinned_submission_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_work_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "active_submission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["active_submission_id"]
          },
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["latest_submission_id"]
          },
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "submission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_work_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      student_work_grade: {
        Row: {
          activity_id: string
          id: string
          points_override: number | null
          released_at: string | null
          released_revision: number | null
          revision: number
          source_signature: string
          source_submission_id: string | null
          student_id: string
        }
        Insert: {
          activity_id: string
          id?: string
          points_override?: number | null
          released_at?: string | null
          released_revision?: number | null
          revision?: number
          source_signature: string
          source_submission_id?: string | null
          student_id: string
        }
        Update: {
          activity_id?: string
          id?: string
          points_override?: number | null
          released_at?: string | null
          released_revision?: number | null
          revision?: number
          source_signature?: string
          source_submission_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_work_grade_activity_id_student_id_fkey"
            columns: ["activity_id", "student_id"]
            isOneToOne: true
            referencedRelation: "student_work"
            referencedColumns: ["activity_id", "student_id"]
          },
          {
            foreignKeyName: "student_work_grade_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "active_submission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_work_grade_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["active_submission_id"]
          },
          {
            foreignKeyName: "student_work_grade_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["latest_submission_id"]
          },
          {
            foreignKeyName: "student_work_grade_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "submission"
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
          released_at: string | null
          return_note: string | null
          return_reason: Database["public"]["Enums"]["return_reason"] | null
          returned_at: string | null
          returned_by: string | null
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
          released_at?: string | null
          return_note?: string | null
          return_reason?: Database["public"]["Enums"]["return_reason"] | null
          returned_at?: string | null
          returned_by?: string | null
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
          released_at?: string | null
          return_note?: string | null
          return_reason?: Database["public"]["Enums"]["return_reason"] | null
          returned_at?: string | null
          returned_by?: string | null
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
            foreignKeyName: "submission_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "teacher"
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
          email_notifications: boolean
          full_name: string
          id: string
          school_name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_notifications?: boolean
          full_name: string
          id: string
          school_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_notifications?: boolean
          full_name?: string
          id?: string
          school_name?: string | null
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
      active_submission: {
        Row: {
          activity_id: string | null
          created_at: string | null
          id: string | null
          image_path: string | null
          rejection_code: string | null
          rejection_details: Json | null
          released_at: string | null
          return_note: string | null
          return_reason: Database["public"]["Enums"]["return_reason"] | null
          returned_at: string | null
          returned_by: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          student_id: string | null
          updated_at: string | null
          uploader_id: string | null
          uploader_role: Database["public"]["Enums"]["user_role"] | null
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
            foreignKeyName: "submission_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "teacher"
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
      activity_work_state: {
        Row: {
          active_created_at: string | null
          active_submission_id: string | null
          activity_id: string | null
          due_at_override: string | null
          effective_due_at: string | null
          late: boolean | null
          latest_rejection_code: string | null
          latest_status: Database["public"]["Enums"]["submission_status"] | null
          latest_submission_id: string | null
          pinned_submission_id: string | null
          released_at: string | null
          return_note: string | null
          return_reason: Database["public"]["Enums"]["return_reason"] | null
          returned_at: string | null
          student_id: string | null
          work_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "active_submission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["active_submission_id"]
          },
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "activity_work_state"
            referencedColumns: ["latest_submission_id"]
          },
          {
            foreignKeyName: "student_work_pinned_submission_id_fkey"
            columns: ["pinned_submission_id"]
            isOneToOne: false
            referencedRelation: "submission"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      authorize_email_delivery: {
        Args: {
          expected_claim_token: string
          payload_recipient: string
          payload_sha256: string
          target_outbox_id: string
        }
        Returns: Json
      }
      claim_email_delivery: { Args: never; Returns: Json }
      complete_student_submission: {
        Args: { actor_id: string; target_submission_id: string }
        Returns: Json
      }
      create_assigned_activity: {
        Args: { actor_id: string; payload: Json }
        Returns: Json
      }
      finish_email_delivery: {
        Args: {
          delivery_outcome: string
          error_code: string
          expected_claim_token: string
          provider_id: string
          retry_at: string
          target_outbox_id: string
        }
        Returns: boolean
      }
      is_assigned: {
        Args: { target_activity_id: string; target_student_id: string }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { target_student_id: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { target_student_id: string }
        Returns: boolean
      }
      mark_all_notifications_read: { Args: { actor_id: string }; Returns: Json }
      mark_notification_read: {
        Args: { actor_id: string; target_notification_id: string }
        Returns: Json
      }
      mutate_student_work: {
        Args: {
          actor_id: string
          operation: string
          payload: Json
          target_activity_id: string
          target_student_id: string
        }
        Returns: Json
      }
      prepare_email_delivery: {
        Args: { expected_claim_token: string; target_outbox_id: string }
        Returns: Json
      }
      read_child_gradebook: {
        Args: { target_student_id: string }
        Returns: Json
      }
      read_section_gradebook: {
        Args: { target_section_id: string }
        Returns: Json
      }
      record_student_submission: {
        Args: {
          actor_id: string
          payload: Json
          target_activity_id: string
          target_student_id: string
        }
        Returns: Json
      }
      release_activity_results: {
        Args: { actor_id: string; target_activity_id: string }
        Returns: Json
      }
      save_manual_submission_score: {
        Args: { actor_id: string; payload: Json; target_submission_id: string }
        Returns: Json
      }
      update_assigned_activity: {
        Args: { actor_id: string; payload: Json; target_activity_id: string }
        Returns: Json
      }
    }
    Enums: {
      notification_type:
        | "activity_assigned"
        | "due_soon"
        | "submission_returned"
        | "submission_rejected"
        | "score_released"
        | "activity_missing"
        | "resubmitted_after_return"
      return_reason:
        | "wrong_worksheet"
        | "blurry_or_cropped"
        | "wrong_target_text"
        | "incomplete"
        | "other"
      score_band:
        | "needs_improvement"
        | "developing"
        | "satisfactory"
        | "excellent"
      submission_status: "processing" | "completed" | "rejected" | "returned"
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
      notification_type: [
        "activity_assigned",
        "due_soon",
        "submission_returned",
        "submission_rejected",
        "score_released",
        "activity_missing",
        "resubmitted_after_return",
      ],
      return_reason: [
        "wrong_worksheet",
        "blurry_or_cropped",
        "wrong_target_text",
        "incomplete",
        "other",
      ],
      score_band: [
        "needs_improvement",
        "developing",
        "satisfactory",
        "excellent",
      ],
      submission_status: ["processing", "completed", "rejected", "returned"],
      user_role: ["teacher", "parent"],
    },
  },
} as const

