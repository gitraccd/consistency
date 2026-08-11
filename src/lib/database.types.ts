export type TestLiftMode = 'raw_epley' | 'rpe_based' | 'manual_e1rm' | 'manual_week1_weight'

type LiftFk = {
  foreignKeyName: 'lift_id_fkey'
  columns: ['lift_id']
  isOneToOne: false
  referencedRelation: 'lifts'
  referencedColumns: ['id']
}

type ProgramFk = {
  foreignKeyName: 'program_id_fkey'
  columns: ['program_id']
  isOneToOne: false
  referencedRelation: 'programs'
  referencedColumns: ['id']
}

export interface Database {
  public: {
    Tables: {
      lifts: {
        Row: {
          id: string
          name: string
          default_week1_percentage: number | null
          default_increments: [number, number, number, number]
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          default_week1_percentage?: number | null
          default_increments?: [number, number, number, number]
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['lifts']['Insert']>
        Relationships: []
      }
      programs: {
        Row: {
          id: string
          start_date: string
          created_at: string
        }
        Insert: {
          id?: string
          start_date: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['programs']['Insert']>
        Relationships: []
      }
      test_lifts: {
        Row: {
          id: string
          program_id: string
          lift_id: string
          mode: TestLiftMode
          input_weight: number | null
          input_reps: number | null
          input_rpe: number | null
          manual_e1rm: number | null
          manual_week1_weight: number | null
          week1_percentage: number | null
          computed_e1rm: number | null
          created_at: string
        }
        Insert: {
          id?: string
          program_id: string
          lift_id: string
          mode: TestLiftMode
          input_weight?: number | null
          input_reps?: number | null
          input_rpe?: number | null
          manual_e1rm?: number | null
          manual_week1_weight?: number | null
          week1_percentage?: number | null
          computed_e1rm?: number | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['test_lifts']['Insert']>
        Relationships: [LiftFk, ProgramFk]
      }
      weekly_targets: {
        Row: {
          id: string
          program_id: string
          lift_id: string
          week_number: number
          target_weight: number
          created_at: string
        }
        Insert: {
          id?: string
          program_id: string
          lift_id: string
          week_number: number
          target_weight: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['weekly_targets']['Insert']>
        Relationships: [LiftFk, ProgramFk]
      }
      logged_sets: {
        Row: {
          id: string
          program_id: string
          lift_id: string
          week_number: number
          weight: number
          reps: number
          rpe: number | null
          is_max_effort: boolean
          logged_at: string
        }
        Insert: {
          id?: string
          program_id: string
          lift_id: string
          week_number: number
          weight: number
          reps: number
          rpe?: number | null
          is_max_effort?: boolean
          logged_at?: string
        }
        Update: Partial<Database['public']['Tables']['logged_sets']['Insert']>
        Relationships: [LiftFk, ProgramFk]
      }
      calibrations: {
        Row: {
          id: string
          lift_id: string
          correction_factor: number
          data_point_count: number
          updated_at: string
        }
        Insert: {
          id?: string
          lift_id: string
          correction_factor?: number
          data_point_count?: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['calibrations']['Insert']>
        Relationships: [LiftFk]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
