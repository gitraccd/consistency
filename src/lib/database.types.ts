export type ExerciseTestMode = 'raw_epley' | 'rpe_based' | 'manual_e1rm'

type ExerciseFk = {
  foreignKeyName: 'exercise_id_fkey'
  columns: ['exercise_id']
  isOneToOne: false
  referencedRelation: 'exercises'
  referencedColumns: ['id']
}

type DayFk = {
  foreignKeyName: 'day_id_fkey'
  columns: ['day_id']
  isOneToOne: false
  referencedRelation: 'days'
  referencedColumns: ['id']
}

type DayExerciseFk = {
  foreignKeyName: 'day_exercise_id_fkey'
  columns: ['day_exercise_id']
  isOneToOne: false
  referencedRelation: 'day_exercises'
  referencedColumns: ['id']
}

type SetGroupFk = {
  foreignKeyName: 'set_group_id_fkey'
  columns: ['set_group_id']
  isOneToOne: false
  referencedRelation: 'set_groups'
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
      exercises: {
        Row: {
          id: string
          name: string
          requires_test: boolean
          e1rm_source_exercise_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          requires_test?: boolean
          e1rm_source_exercise_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>
        Relationships: []
      }
      days: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: Partial<Database['public']['Tables']['days']['Insert']>
        Relationships: []
      }
      day_exercises: {
        Row: {
          id: string
          day_id: string
          exercise_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          day_id: string
          exercise_id: string
          sort_order?: number
        }
        Update: Partial<Database['public']['Tables']['day_exercises']['Insert']>
        Relationships: [DayFk, ExerciseFk]
      }
      set_groups: {
        Row: {
          id: string
          day_exercise_id: string
          reps: number
          num_sets: number
          is_freeform: boolean
          intensity_note: string | null
          week1_percentage: number | null
          increments: [number, number, number, number] | null
          sort_order: number
        }
        Insert: {
          id?: string
          day_exercise_id: string
          reps: number
          num_sets: number
          is_freeform?: boolean
          intensity_note?: string | null
          week1_percentage?: number | null
          increments?: [number, number, number, number] | null
          sort_order?: number
        }
        Update: Partial<Database['public']['Tables']['set_groups']['Insert']>
        Relationships: [DayExerciseFk]
      }
      exercise_tests: {
        Row: {
          id: string
          program_id: string
          exercise_id: string
          mode: ExerciseTestMode
          input_weight: number | null
          input_reps: number | null
          input_rpe: number | null
          manual_e1rm: number | null
          computed_e1rm: number | null
          created_at: string
        }
        Insert: {
          id?: string
          program_id: string
          exercise_id: string
          mode: ExerciseTestMode
          input_weight?: number | null
          input_reps?: number | null
          input_rpe?: number | null
          manual_e1rm?: number | null
          computed_e1rm?: number | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['exercise_tests']['Insert']>
        Relationships: [ExerciseFk, ProgramFk]
      }
      weekly_targets: {
        Row: {
          id: string
          program_id: string
          set_group_id: string
          week_number: number
          target_weight: number
          created_at: string
        }
        Insert: {
          id?: string
          program_id: string
          set_group_id: string
          week_number: number
          target_weight: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['weekly_targets']['Insert']>
        Relationships: [SetGroupFk, ProgramFk]
      }
      logged_sets: {
        Row: {
          id: string
          program_id: string
          set_group_id: string
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
          set_group_id: string
          week_number: number
          weight: number
          reps: number
          rpe?: number | null
          is_max_effort?: boolean
          logged_at?: string
        }
        Update: Partial<Database['public']['Tables']['logged_sets']['Insert']>
        Relationships: [SetGroupFk, ProgramFk]
      }
      calibrations: {
        Row: {
          id: string
          exercise_id: string
          correction_factor: number
          data_point_count: number
          updated_at: string
        }
        Insert: {
          id?: string
          exercise_id: string
          correction_factor?: number
          data_point_count?: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['calibrations']['Insert']>
        Relationships: [ExerciseFk]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
