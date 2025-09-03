export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      attendance: {
        Row: {
          assigned_class: string | null
          created_at: string
          date: string | null
          department: string | null
          department_id: string | null
          event_id: string | null
          id: string
          status: boolean
          student_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_class?: string | null
          created_at?: string
          date?: string | null
          department?: string | null
          department_id?: string | null
          event_id?: string | null
          id?: string
          status?: boolean
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_class?: string | null
          created_at?: string
          date?: string | null
          department?: string | null
          department_id?: string | null
          event_id?: string | null
          id?: string
          status?: boolean
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          auto_save: boolean | null
          compact_view: boolean | null
          congregation_name: string | null
          created_at: string
          dark_mode: boolean | null
          id: number
          logo_url: string | null
          name: string
          notifications: boolean | null
          show_attendance_history: boolean | null
          show_name: boolean | null
          show_profile_images: boolean | null
          updated_at: string
        }
        Insert: {
          auto_save?: boolean | null
          compact_view?: boolean | null
          congregation_name?: string | null
          created_at?: string
          dark_mode?: boolean | null
          id?: number
          logo_url?: string | null
          name: string
          notifications?: boolean | null
          show_attendance_history?: boolean | null
          show_name?: boolean | null
          show_profile_images?: boolean | null
          updated_at?: string
        }
        Update: {
          auto_save?: boolean | null
          compact_view?: boolean | null
          congregation_name?: string | null
          created_at?: string
          dark_mode?: boolean | null
          id?: number
          logo_url?: string | null
          name?: string
          notifications?: boolean | null
          show_attendance_history?: boolean | null
          show_name?: boolean | null
          show_profile_images?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      db_version: {
        Row: {
          applied_at: string | null
          environment: string
          id: number
          version: string
        }
        Insert: {
          applied_at?: string | null
          environment: string
          id?: number
          version: string
        }
        Update: {
          applied_at?: string | null
          environment?: string
          id?: number
          version?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          classes: string[] | null
          created_at: string
          description: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          classes?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          classes?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_recipients: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          read: boolean
          read_at: string | null
          recipient_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          read?: boolean
          read_at?: string | null
          recipient_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          read?: boolean
          read_at?: string | null
          recipient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_class: string | null
          department_id: string | null
          departments: string[] | null
          first_name: string | null
          id: string
          last_name: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          assigned_class?: string | null
          department_id?: string | null
          departments?: string[] | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          assigned_class?: string | null
          department_id?: string | null
          departments?: string[] | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_authorizations: {
        Row: {
          class: string | null
          created_at: string | null
          department_id: string | null
          id: string
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          class?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          class?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_authorizations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_authorizations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "active_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_authorizations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          assigned_class: string | null
          birthdate: string | null
          created_at: string
          deleted_at: string | null
          department: string | null
          department_id: string | null
          document_number: string | null
          first_name: string
          gender: string
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_class?: string | null
          birthdate?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          department_id?: string | null
          document_number?: string | null
          first_name: string
          gender?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_class?: string | null
          birthdate?: string | null
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          department_id?: string | null
          document_number?: string | null
          first_name?: string
          gender?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_students: {
        Row: {
          address: string | null
          assigned_class: string | null
          birthdate: string | null
          created_at: string | null
          deleted_at: string | null
          department: string | null
          department_id: string | null
          document_number: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_class?: string | null
          birthdate?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          department_id?: string | null
          document_number?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_class?: string | null
          birthdate?: string | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          department_id?: string | null
          document_number?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_environment: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_department_ids: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "lider" | "director" | "maestro" | "secretaria" | "secr.-calendario"
      department_type:
        | "escuelita"
        | "adolescentes"
        | "jovenes"
        | "adultos"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "lider", "director", "maestro", "secretaria"],
      department_type: [
        "escuelita_central",
        "pre_adolescentes",
        "adolescentes",
        "jovenes",
        "jovenes_adultos",
        "adultos",
      ],
    },
  },
} as const
