export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          role: string
          avatar_color: string
          responsibilities: string | null
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          role?: string
          avatar_color?: string
          responsibilities?: string | null
          created_at?: string
        }
        Update: {
          name?: string | null
          role?: string
          avatar_color?: string
          responsibilities?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          user_id: string
          name: string
          niche: string
          tone_of_voice: string | null
          forbidden_words: string[] | null
          domain_framework: string | null
          status: string
          monthly_value: number | null
          phone: string | null
          email: string | null
          instagram: string | null
          cnpj: string | null
          city: string | null
          logo_url: string | null
          drive_link: string | null
          contract_start: string | null
          contract_end: string | null
          payment_day: number | null
          services: string[] | null
          context: string | null
          passwords: string | null
          pain_points: string | null
          competitors: string | null
          expectations: string | null
          responsible_ids: string[] | null
          approval_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          niche?: string
          tone_of_voice?: string | null
          forbidden_words?: string[] | null
          domain_framework?: string | null
          status?: string
          monthly_value?: number | null
          phone?: string | null
          email?: string | null
          instagram?: string | null
          cnpj?: string | null
          city?: string | null
          logo_url?: string | null
          drive_link?: string | null
          contract_start?: string | null
          contract_end?: string | null
          payment_day?: number | null
          services?: string[] | null
          context?: string | null
          passwords?: string | null
          pain_points?: string | null
          competitors?: string | null
          expectations?: string | null
          responsible_ids?: string[] | null
          approval_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          niche?: string
          tone_of_voice?: string | null
          forbidden_words?: string[] | null
          domain_framework?: string | null
          status?: string
          monthly_value?: number | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          client_id: string | null
          assignee_id: string | null
          created_by: string | null
          status: string
          priority: string
          start_date: string | null
          due_date: string | null
          due_time: string | null
          recurrence: string | null
          approval_notes: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          client_id?: string | null
          assignee_id?: string | null
          created_by?: string | null
          status?: string
          priority?: string
          start_date?: string | null
          due_date?: string | null
          due_time?: string | null
          recurrence?: string | null
          approval_notes?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          client_id?: string | null
          assignee_id?: string | null
          status?: string
          priority?: string
          start_date?: string | null
          due_date?: string | null
          due_time?: string | null
          recurrence?: string | null
          approval_notes?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          id: string
          title: string
          description: string | null
          priority: string
          assignee_id: string | null
          created_by: string | null
          created_at: string
          cadencia_ativa: boolean
          cadencia_dia: number | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          priority?: string
          assignee_id?: string | null
          created_by?: string | null
          created_at?: string
          cadencia_ativa?: boolean
          cadencia_dia?: number | null
        }
        Update: {
          title?: string
          description?: string | null
          priority?: string
          assignee_id?: string | null
          cadencia_ativa?: boolean
          cadencia_dia?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          client_id: string
          description: string
          amount: number
          status: string
          due_date: string | null
          paid_at: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          description: string
          amount: number
          status?: string
          due_date?: string | null
          paid_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          description?: string
          amount?: number
          status?: string
          due_date?: string | null
          paid_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          description: string
          category: string
          amount: number
          date: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          description: string
          category?: string
          amount: number
          date?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          description?: string
          category?: string
          amount?: number
          date?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          id: string
          client_id: string
          user_id: string
          topic: string | null
          mode: string
          status: string
          current_step: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          user_id: string
          topic?: string | null
          mode: string
          status?: string
          current_step?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          current_step?: number
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          id: string
          client_id: string | null
          title: string
          date: string
          attendees: string[] | null
          notes: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string | null
          title: string
          date: string
          attendees?: string[] | null
          notes?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          date?: string
          attendees?: string[] | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      run_steps: {
        Row: {
          id: string
          run_id: string
          step_number: number
          step_name: string
          agent_name: string
          input: Json | null
          output: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          run_id: string
          step_number: number
          step_name: string
          agent_name: string
          input?: Json | null
          output?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          output?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      objectives: {
        Row: {
          id: string
          title: string
          description: string | null
          owner_id: string | null
          period: string
          status: string
          due_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          owner_id?: string | null
          period?: string
          status?: string
          due_date?: string | null
          created_by?: string | null
        }
        Update: {
          title?: string
          description?: string | null
          owner_id?: string | null
          period?: string
          status?: string
          due_date?: string | null
        }
        Relationships: []
      }
      key_results: {
        Row: {
          id: string
          objective_id: string
          title: string
          current_value: number
          target_value: number
          unit: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          objective_id: string
          title: string
          current_value?: number
          target_value?: number
          unit?: string | null
          status?: string
        }
        Update: {
          title?: string
          current_value?: number
          target_value?: number
          unit?: string | null
          status?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number | null
          price_type: string | null
          category: string | null
          active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price?: number | null
          price_type?: string | null
          category?: string | null
          active?: boolean
          created_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          price?: number | null
          price_type?: string | null
          category?: string | null
          active?: boolean
        }
        Relationships: []
      }
      payment_schedules: {
        Row: {
          id: string
          client_id: string
          description: string
          amount: number
          payment_day: number
          active: boolean
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          description?: string
          amount: number
          payment_day: number
          active?: boolean
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          description?: string
          amount?: number
          payment_day?: number
          active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          title: string
          status: string
          client_id: string | null
          platform: string | null
          format: string | null
          due_date: string | null
          publish_date: string | null
          post_date: string | null
          assignee_ids: string[] | null
          created_by: string | null
          notes: string | null
          files: { name: string; url: string; type: string; size: number }[] | null
          approval_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          status?: string
          client_id?: string | null
          platform?: string | null
          format?: string | null
          due_date?: string | null
          publish_date?: string | null
          post_date?: string | null
          assignee_ids?: string[] | null
          created_by?: string | null
          notes?: string | null
          files?: { name: string; url: string; type: string; size: number }[] | null
          approval_notes?: string | null
        }
        Update: {
          title?: string
          status?: string
          client_id?: string | null
          platform?: string | null
          format?: string | null
          due_date?: string | null
          publish_date?: string | null
          post_date?: string | null
          assignee_ids?: string[] | null
          notes?: string | null
          files?: { name: string; url: string; type: string; size: number }[] | null
          approval_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type Run = Database['public']['Tables']['runs']['Row']
export type RunStep = Database['public']['Tables']['run_steps']['Row']
export type Objective = Database['public']['Tables']['objectives']['Row']
export type KeyResult = Database['public']['Tables']['key_results']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type PaymentSchedule = Database['public']['Tables']['payment_schedules']['Row']
export type TaskTemplate = Database['public']['Tables']['task_templates']['Row']
