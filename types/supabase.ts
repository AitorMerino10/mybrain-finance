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
      gnp_fct_entries: {
        Row: {
          ds_title: string
          dt_created: string
          dt_event: string
          dt_updated: string
          id_entry: string
          id_section: string
          id_user: string
        }
        Insert: {
          ds_title: string
          dt_created?: string
          dt_event: string
          dt_updated?: string
          id_entry?: string
          id_section: string
          id_user: string
        }
        Update: {
          ds_title?: string
          dt_created?: string
          dt_event?: string
          dt_updated?: string
          id_entry?: string
          id_section?: string
          id_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "gnp_fct_entries_id_section_fkey"
            columns: ["id_section"]
            isOneToOne: false
            referencedRelation: "pml_dim_section"
            referencedColumns: ["id_section"]
          },
          {
            foreignKeyName: "gnp_fct_entries_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      gnp_fct_entry_values: {
        Row: {
          ds_value: string | null
          dt_created: string
          dt_updated: string
          id_entry: string
          id_entry_value: string
          id_field: string
        }
        Insert: {
          ds_value?: string | null
          dt_created?: string
          dt_updated?: string
          id_entry: string
          id_entry_value?: string
          id_field: string
        }
        Update: {
          ds_value?: string | null
          dt_created?: string
          dt_updated?: string
          id_entry?: string
          id_entry_value?: string
          id_field?: string
        }
        Relationships: [
          {
            foreignKeyName: "gnp_fct_entry_values_id_entry_fkey"
            columns: ["id_entry"]
            isOneToOne: false
            referencedRelation: "gnp_fct_entries"
            referencedColumns: ["id_entry"]
          },
          {
            foreignKeyName: "gnp_fct_entry_values_id_field_fkey"
            columns: ["id_field"]
            isOneToOne: false
            referencedRelation: "pml_dim_section_field"
            referencedColumns: ["id_field"]
          },
        ]
      }
      gnp_fct_fund_movements: {
        Row: {
          ds_comments: string | null
          ds_movement_type: string
          dt_created: string
          dt_movement: string
          dt_updated: string
          ft_amount: number
          id_fund: string
          id_fund_movement: string
          id_monthly_close: string | null
          id_rel_transaction_user: string | null
          id_transaction: string | null
          id_transfer_group: string | null
          id_user: string | null
          id_user_creator: string | null
        }
        Insert: {
          ds_comments?: string | null
          ds_movement_type: string
          dt_created?: string
          dt_movement?: string
          dt_updated?: string
          ft_amount: number
          id_fund: string
          id_fund_movement?: string
          id_monthly_close?: string | null
          id_rel_transaction_user?: string | null
          id_transaction?: string | null
          id_transfer_group?: string | null
          id_user?: string | null
          id_user_creator?: string | null
        }
        Update: {
          ds_comments?: string | null
          ds_movement_type?: string
          dt_created?: string
          dt_movement?: string
          dt_updated?: string
          ft_amount?: number
          id_fund?: string
          id_fund_movement?: string
          id_monthly_close?: string | null
          id_rel_transaction_user?: string | null
          id_transaction?: string | null
          id_transfer_group?: string | null
          id_user?: string | null
          id_user_creator?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gnp_fct_fund_movements_id_fund_fkey"
            columns: ["id_fund"]
            isOneToOne: false
            referencedRelation: "pml_dim_fund"
            referencedColumns: ["id_fund"]
          },
          {
            foreignKeyName: "gnp_fct_fund_movements_id_monthly_close_fkey"
            columns: ["id_monthly_close"]
            isOneToOne: false
            referencedRelation: "gnp_fct_monthly_budget_close"
            referencedColumns: ["id_monthly_close"]
          },
          {
            foreignKeyName: "gnp_fct_fund_movements_id_rel_transaction_user_fkey"
            columns: ["id_rel_transaction_user"]
            isOneToOne: false
            referencedRelation: "pml_rel_transaction_user"
            referencedColumns: ["id_rel_transaction_user"]
          },
          {
            foreignKeyName: "gnp_fct_fund_movements_id_transaction_fkey"
            columns: ["id_transaction"]
            isOneToOne: false
            referencedRelation: "gnp_fct_transactions"
            referencedColumns: ["id_transaction"]
          },
          {
            foreignKeyName: "gnp_fct_fund_movements_id_user_creator_fkey"
            columns: ["id_user_creator"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
          {
            foreignKeyName: "gnp_fct_fund_movements_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      gnp_fct_monthly_budget_close: {
        Row: {
          ds_comments: string | null
          ds_status: string
          dt_confirmed: string | null
          dt_created: string
          dt_month: string
          dt_updated: string
          ft_monthly_actual_amount: number
          ft_monthly_budget_amount: number
          ft_monthly_delta_amount: number
          id_family: string
          id_monthly_close: string
          id_user: string
          id_user_confirmed_by: string | null
        }
        Insert: {
          ds_comments?: string | null
          ds_status?: string
          dt_confirmed?: string | null
          dt_created?: string
          dt_month: string
          dt_updated?: string
          ft_monthly_actual_amount?: number
          ft_monthly_budget_amount?: number
          ft_monthly_delta_amount?: number
          id_family: string
          id_monthly_close?: string
          id_user: string
          id_user_confirmed_by?: string | null
        }
        Update: {
          ds_comments?: string | null
          ds_status?: string
          dt_confirmed?: string | null
          dt_created?: string
          dt_month?: string
          dt_updated?: string
          ft_monthly_actual_amount?: number
          ft_monthly_budget_amount?: number
          ft_monthly_delta_amount?: number
          id_family?: string
          id_monthly_close?: string
          id_user?: string
          id_user_confirmed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gnp_fct_monthly_budget_close_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "gnp_fct_monthly_budget_close_id_user_confirmed_by_fkey"
            columns: ["id_user_confirmed_by"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
          {
            foreignKeyName: "gnp_fct_monthly_budget_close_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      gnp_fct_monthly_budget_close_detail: {
        Row: {
          dt_created: string
          dt_updated: string
          ft_actual_amount: number
          ft_budget_amount: number
          ft_delta_amount: number
          id_budget_type: string
          id_monthly_close: string
          id_monthly_close_detail: string
        }
        Insert: {
          dt_created?: string
          dt_updated?: string
          ft_actual_amount?: number
          ft_budget_amount?: number
          ft_delta_amount?: number
          id_budget_type: string
          id_monthly_close: string
          id_monthly_close_detail?: string
        }
        Update: {
          dt_created?: string
          dt_updated?: string
          ft_actual_amount?: number
          ft_budget_amount?: number
          ft_delta_amount?: number
          id_budget_type?: string
          id_monthly_close?: string
          id_monthly_close_detail?: string
        }
        Relationships: [
          {
            foreignKeyName: "gnp_fct_monthly_budget_close_detail_id_budget_type_fkey"
            columns: ["id_budget_type"]
            isOneToOne: false
            referencedRelation: "pml_dim_budget_type"
            referencedColumns: ["id_budget_type"]
          },
          {
            foreignKeyName: "gnp_fct_monthly_budget_close_detail_id_monthly_close_fkey"
            columns: ["id_monthly_close"]
            isOneToOne: false
            referencedRelation: "gnp_fct_monthly_budget_close"
            referencedColumns: ["id_monthly_close"]
          },
        ]
      }
      gnp_fct_income_allocation: {
        Row: {
          dt_created: string
          ft_amount: number
          id_budget_subtype: string | null
          id_budget_type: string | null
          id_family: string
          id_income_allocation: string
          id_transaction: string
        }
        Insert: {
          dt_created?: string
          ft_amount: number
          id_budget_subtype?: string | null
          id_budget_type?: string | null
          id_family: string
          id_income_allocation?: string
          id_transaction: string
        }
        Update: {
          dt_created?: string
          ft_amount?: number
          id_budget_subtype?: string | null
          id_budget_type?: string | null
          id_family?: string
          id_income_allocation?: string
          id_transaction?: string
        }
        Relationships: []
      }
      gnp_fct_transactions: {
        Row: {
          ds_comments: string | null
          ds_month_declared: string
          dt_created: string | null
          dt_date: string
          dt_updated: string | null
          ft_amount: number
          id_budget_type: string | null
          id_budget_subtype: string | null
          id_category: string | null
          id_family: string | null
          id_subcategory: string | null
          id_transaction: string
          id_type: string | null
          id_user_creator: string | null
        }
        Insert: {
          ds_comments?: string | null
          ds_month_declared: string
          dt_created?: string | null
          dt_date: string
          dt_updated?: string | null
          ft_amount: number
          id_budget_type?: string | null
          id_budget_subtype?: string | null
          id_category?: string | null
          id_family?: string | null
          id_subcategory?: string | null
          id_transaction?: string
          id_type?: string | null
          id_user_creator?: string | null
        }
        Update: {
          ds_comments?: string | null
          ds_month_declared?: string
          dt_created?: string | null
          dt_date?: string
          dt_updated?: string | null
          ft_amount?: number
          id_budget_type?: string | null
          id_budget_subtype?: string | null
          id_category?: string | null
          id_family?: string | null
          id_subcategory?: string | null
          id_transaction?: string
          id_type?: string | null
          id_user_creator?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gnp_fct_transactions_id_budget_type_fkey"
            columns: ["id_budget_type"]
            isOneToOne: false
            referencedRelation: "pml_dim_budget_type"
            referencedColumns: ["id_budget_type"]
          },
          {
            foreignKeyName: "gnp_fct_transactions_id_category_fkey"
            columns: ["id_category"]
            isOneToOne: false
            referencedRelation: "pml_dim_category"
            referencedColumns: ["id_category"]
          },
          {
            foreignKeyName: "gnp_fct_transactions_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "gnp_fct_transactions_id_subcategory_fkey"
            columns: ["id_subcategory"]
            isOneToOne: false
            referencedRelation: "pml_dim_subcategory"
            referencedColumns: ["id_subcategory"]
          },
          {
            foreignKeyName: "gnp_fct_transactions_id_type_fkey"
            columns: ["id_type"]
            isOneToOne: false
            referencedRelation: "pml_dim_transaction_type"
            referencedColumns: ["id_type"]
          },
          {
            foreignKeyName: "gnp_fct_transactions_id_user_creator_fkey"
            columns: ["id_user_creator"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      pml_cfg_budget_close: {
        Row: {
          dt_close_month: string
          dt_created: string
          ft_balance: number
          ft_carried: number
          ft_to_savings: number
          id_budget_close: string
          id_budget_type: string | null
          id_family: string
          id_user: string
        }
        Insert: {
          dt_close_month: string
          dt_created?: string
          ft_balance?: number
          ft_carried?: number
          ft_to_savings?: number
          id_budget_close?: string
          id_budget_type?: string | null
          id_family: string
          id_user: string
        }
        Update: {
          dt_close_month?: string
          dt_created?: string
          ft_balance?: number
          ft_carried?: number
          ft_to_savings?: number
          id_budget_close?: string
          id_budget_type?: string | null
          id_family?: string
          id_user?: string
        }
        Relationships: []
      }
      pml_cfg_budget_plan: {
        Row: {
          dt_created: string
          dt_start_month: string
          dt_updated: string
          id_budget_plan: string
          id_family: string
          id_user: string
          js_plan: Json
        }
        Insert: {
          dt_created?: string
          dt_start_month: string
          dt_updated?: string
          id_budget_plan?: string
          id_family: string
          id_user: string
          js_plan: Json
        }
        Update: {
          dt_created?: string
          dt_start_month?: string
          dt_updated?: string
          id_budget_plan?: string
          id_family?: string
          id_user?: string
          js_plan?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pml_cfg_budget_plan_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "pml_cfg_budget_plan_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      pml_cfg_spending_goal: {
        Row: {
          ds_comments: string | null
          ds_periodicity: string
          dt_created: string
          dt_end_month: string
          dt_start_month: string
          dt_updated: string
          ft_goal_amount: number
          id_category: string | null
          id_family: string
          id_spending_goal: string
          id_subcategory: string | null
          id_user: string
          is_active: boolean
        }
        Insert: {
          ds_comments?: string | null
          ds_periodicity: string
          dt_created?: string
          dt_end_month: string
          dt_start_month: string
          dt_updated?: string
          ft_goal_amount: number
          id_category?: string | null
          id_family: string
          id_spending_goal?: string
          id_subcategory?: string | null
          id_user: string
          is_active?: boolean
        }
        Update: {
          ds_comments?: string | null
          ds_periodicity?: string
          dt_created?: string
          dt_end_month?: string
          dt_start_month?: string
          dt_updated?: string
          ft_goal_amount?: number
          id_category?: string | null
          id_family?: string
          id_spending_goal?: string
          id_subcategory?: string | null
          id_user?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pml_cfg_spending_goal_id_category_fkey"
            columns: ["id_category"]
            isOneToOne: false
            referencedRelation: "pml_dim_category"
            referencedColumns: ["id_category"]
          },
          {
            foreignKeyName: "pml_cfg_spending_goal_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "pml_cfg_spending_goal_id_subcategory_fkey"
            columns: ["id_subcategory"]
            isOneToOne: false
            referencedRelation: "pml_dim_subcategory"
            referencedColumns: ["id_subcategory"]
          },
          {
            foreignKeyName: "pml_cfg_spending_goal_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      pml_cfg_user_budget: {
        Row: {
          ds_comments: string | null
          dt_created: string
          dt_end_month: string | null
          dt_start_month: string
          dt_updated: string
          ft_budget_amount: number
          id_budget_type: string
          id_family: string
          id_user: string
          id_user_budget: string
          is_active: boolean
          is_period_amount: boolean
        }
        Insert: {
          ds_comments?: string | null
          dt_created?: string
          dt_end_month?: string | null
          dt_start_month: string
          dt_updated?: string
          ft_budget_amount: number
          id_budget_type: string
          id_family: string
          id_user: string
          id_user_budget?: string
          is_active?: boolean
          is_period_amount?: boolean
        }
        Update: {
          ds_comments?: string | null
          dt_created?: string
          dt_end_month?: string | null
          dt_start_month?: string
          dt_updated?: string
          ft_budget_amount?: number
          id_budget_type?: string
          id_family?: string
          id_user?: string
          id_user_budget?: string
          is_active?: boolean
          is_period_amount?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pml_cfg_user_budget_id_budget_type_fkey"
            columns: ["id_budget_type"]
            isOneToOne: false
            referencedRelation: "pml_dim_budget_type"
            referencedColumns: ["id_budget_type"]
          },
          {
            foreignKeyName: "pml_cfg_user_budget_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "pml_cfg_user_budget_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      pml_dim_budget_subtype: {
        Row: {
          ds_budget_subtype: string
          dt_created: string
          dt_updated: string
          id_budget_subtype: string
          id_budget_type: string
          id_family: string
          id_order: number
          is_archived: boolean
        }
        Insert: {
          ds_budget_subtype: string
          dt_created?: string
          dt_updated?: string
          id_budget_subtype?: string
          id_budget_type: string
          id_family: string
          id_order?: number
          is_archived?: boolean
        }
        Update: {
          ds_budget_subtype?: string
          dt_created?: string
          dt_updated?: string
          id_budget_subtype?: string
          id_budget_type?: string
          id_family?: string
          id_order?: number
          is_archived?: boolean
        }
        Relationships: []
      }
      pml_dim_budget_type: {
        Row: {
          ds_budget_type: string
          ds_budget_type_key: string
          ds_periodicity: string
          dt_created: string
          dt_updated: string
          id_budget_type: string
          id_family: string | null
          id_order: number
          id_user: string | null
          is_archived: boolean
        }
        Insert: {
          ds_budget_type: string
          ds_budget_type_key: string
          ds_periodicity: string
          dt_created?: string
          dt_updated?: string
          id_budget_type?: string
          id_family?: string | null
          id_order?: number
          id_user?: string | null
          is_archived?: boolean
        }
        Update: {
          ds_budget_type?: string
          ds_budget_type_key?: string
          ds_periodicity?: string
          dt_created?: string
          dt_updated?: string
          id_budget_type?: string
          id_family?: string | null
          id_order?: number
          id_user?: string | null
          is_archived?: boolean
        }
        Relationships: []
      }
      pml_dim_category: {
        Row: {
          ds_category: string
          ds_color: string | null
          ds_icon: string | null
          dt_created: string | null
          dt_updated: string | null
          id_category: string
          id_family: string | null
          id_order: number | null
          is_expense: boolean | null
          is_income: boolean | null
        }
        Insert: {
          ds_category: string
          ds_color?: string | null
          ds_icon?: string | null
          dt_created?: string | null
          dt_updated?: string | null
          id_category?: string
          id_family?: string | null
          id_order?: number | null
          is_expense?: boolean | null
          is_income?: boolean | null
        }
        Update: {
          ds_category?: string
          ds_color?: string | null
          ds_icon?: string | null
          dt_created?: string | null
          dt_updated?: string | null
          id_category?: string
          id_family?: string | null
          id_order?: number | null
          is_expense?: boolean | null
          is_income?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pml_dim_category_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
        ]
      }
      pml_dim_family: {
        Row: {
          ds_family: string
          dt_created: string | null
          dt_updated: string | null
          id_family: string
        }
        Insert: {
          ds_family: string
          dt_created?: string | null
          dt_updated?: string | null
          id_family?: string
        }
        Update: {
          ds_family?: string
          dt_created?: string | null
          dt_updated?: string | null
          id_family?: string
        }
        Relationships: []
      }
      pml_dim_family_request: {
        Row: {
          ds_comment: string | null
          ds_family_name: string | null
          ds_request_type: string
          ds_status: string
          dt_created: string
          dt_updated: string
          id_approved_by: string | null
          id_family: string | null
          id_request: string
          id_user: string
          js_requested_users: Json
        }
        Insert: {
          ds_comment?: string | null
          ds_family_name?: string | null
          ds_request_type: string
          ds_status?: string
          dt_created?: string
          dt_updated?: string
          id_approved_by?: string | null
          id_family?: string | null
          id_request?: string
          id_user: string
          js_requested_users?: Json
        }
        Update: {
          ds_comment?: string | null
          ds_family_name?: string | null
          ds_request_type?: string
          ds_status?: string
          dt_created?: string
          dt_updated?: string
          id_approved_by?: string | null
          id_family?: string | null
          id_request?: string
          id_user?: string
          js_requested_users?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pml_dim_family_request_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
        ]
      }
      pml_dim_fund: {
        Row: {
          ds_color: string | null
          ds_fund: string
          ds_icon: string | null
          ds_scope: string
          dt_created: string
          dt_end_date: string | null
          dt_start_date: string
          dt_updated: string
          ft_monthly_recommended_amount: number | null
          ft_target_amount: number | null
          id_budget_type: string | null
          id_family: string
          id_fund: string
          id_user_owner: string | null
          is_active: boolean
        }
        Insert: {
          ds_color?: string | null
          ds_fund: string
          ds_icon?: string | null
          ds_scope: string
          dt_created?: string
          dt_end_date?: string | null
          dt_start_date: string
          dt_updated?: string
          ft_monthly_recommended_amount?: number | null
          ft_target_amount?: number | null
          id_budget_type?: string | null
          id_family: string
          id_fund?: string
          id_user_owner?: string | null
          is_active?: boolean
        }
        Update: {
          ds_color?: string | null
          ds_fund?: string
          ds_icon?: string | null
          ds_scope?: string
          dt_created?: string
          dt_end_date?: string | null
          dt_start_date?: string
          dt_updated?: string
          ft_monthly_recommended_amount?: number | null
          ft_target_amount?: number | null
          id_budget_type?: string | null
          id_family?: string
          id_fund?: string
          id_user_owner?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pml_dim_fund_id_budget_type_fkey"
            columns: ["id_budget_type"]
            isOneToOne: false
            referencedRelation: "pml_dim_budget_type"
            referencedColumns: ["id_budget_type"]
          },
          {
            foreignKeyName: "pml_dim_fund_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "pml_dim_fund_id_user_owner_fkey"
            columns: ["id_user_owner"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      pml_dim_section: {
        Row: {
          ds_brain_region: string
          ds_color: string | null
          ds_logo: string | null
          ds_section: string
          ds_system_key: string | null
          dt_created: string
          dt_updated: string
          ft_brain_position_x: number | null
          ft_brain_position_y: number | null
          id_section: string
          id_user: string
          is_system_section: boolean
        }
        Insert: {
          ds_brain_region?: string
          ds_color?: string | null
          ds_logo?: string | null
          ds_section: string
          ds_system_key?: string | null
          dt_created?: string
          dt_updated?: string
          ft_brain_position_x?: number | null
          ft_brain_position_y?: number | null
          id_section?: string
          id_user: string
          is_system_section?: boolean
        }
        Update: {
          ds_brain_region?: string
          ds_color?: string | null
          ds_logo?: string | null
          ds_section?: string
          ds_system_key?: string | null
          dt_created?: string
          dt_updated?: string
          ft_brain_position_x?: number | null
          ft_brain_position_y?: number | null
          id_section?: string
          id_user?: string
          is_system_section?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pml_dim_section_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      pml_dim_section_field: {
        Row: {
          ds_field_description: string | null
          ds_field_options: string | null
          ds_field_type: string
          ds_section_field: string
          dt_created: string
          dt_updated: string
          id_field: string
          id_order: number
          id_section: string
        }
        Insert: {
          ds_field_description?: string | null
          ds_field_options?: string | null
          ds_field_type: string
          ds_section_field: string
          dt_created?: string
          dt_updated?: string
          id_field?: string
          id_order?: number
          id_section: string
        }
        Update: {
          ds_field_description?: string | null
          ds_field_options?: string | null
          ds_field_type?: string
          ds_section_field?: string
          dt_created?: string
          dt_updated?: string
          id_field?: string
          id_order?: number
          id_section?: string
        }
        Relationships: [
          {
            foreignKeyName: "pml_dim_section_field_id_section_fkey"
            columns: ["id_section"]
            isOneToOne: false
            referencedRelation: "pml_dim_section"
            referencedColumns: ["id_section"]
          },
        ]
      }
      pml_dim_subcategory: {
        Row: {
          ds_color: string | null
          ds_icon: string | null
          ds_subcategory: string
          dt_created: string | null
          dt_updated: string | null
          id_category: string | null
          id_subcategory: string
        }
        Insert: {
          ds_color?: string | null
          ds_icon?: string | null
          ds_subcategory: string
          dt_created?: string | null
          dt_updated?: string | null
          id_category?: string | null
          id_subcategory?: string
        }
        Update: {
          ds_color?: string | null
          ds_icon?: string | null
          ds_subcategory?: string
          dt_created?: string | null
          dt_updated?: string | null
          id_category?: string | null
          id_subcategory?: string
        }
        Relationships: [
          {
            foreignKeyName: "pml_dim_subcategory_id_category_fkey"
            columns: ["id_category"]
            isOneToOne: false
            referencedRelation: "pml_dim_category"
            referencedColumns: ["id_category"]
          },
        ]
      }
      pml_dim_tag: {
        Row: {
          ds_color: string | null
          ds_icon: string | null
          ds_tag: string
          dt_created: string | null
          dt_updated: string | null
          id_family: string | null
          id_tag: string
          is_hidden: boolean
        }
        Insert: {
          ds_color?: string | null
          ds_icon?: string | null
          ds_tag: string
          dt_created?: string | null
          dt_updated?: string | null
          id_family?: string | null
          id_tag?: string
          is_hidden?: boolean
        }
        Update: {
          ds_color?: string | null
          ds_icon?: string | null
          ds_tag?: string
          dt_created?: string | null
          dt_updated?: string | null
          id_family?: string | null
          id_tag?: string
          is_hidden?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pml_dim_tag_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
        ]
      }
      pml_dim_transaction_type: {
        Row: {
          ds_type: string
          dt_created: string | null
          id_type: string
        }
        Insert: {
          ds_type: string
          dt_created?: string | null
          id_type?: string
        }
        Update: {
          ds_type?: string
          dt_created?: string | null
          id_type?: string
        }
        Relationships: []
      }
      pml_dim_user: {
        Row: {
          ds_email: string
          ds_user: string | null
          dt_created: string | null
          dt_last_login: string | null
          dt_updated: string | null
          id_user: string
          is_onboarding_completed: boolean | null
        }
        Insert: {
          ds_email: string
          ds_user?: string | null
          dt_created?: string | null
          dt_last_login?: string | null
          dt_updated?: string | null
          id_user: string
          is_onboarding_completed?: boolean | null
        }
        Update: {
          ds_email?: string
          ds_user?: string | null
          dt_created?: string | null
          dt_last_login?: string | null
          dt_updated?: string | null
          id_user?: string
          is_onboarding_completed?: boolean | null
        }
        Relationships: []
      }
      pml_log_transaction_changes: {
        Row: {
          ds_change_type: string | null
          dt_change: string | null
          id_log: string
          id_transaction: string
          id_user: string | null
          js_new_data: Json | null
          js_old_data: Json | null
        }
        Insert: {
          ds_change_type?: string | null
          dt_change?: string | null
          id_log?: string
          id_transaction: string
          id_user?: string | null
          js_new_data?: Json | null
          js_old_data?: Json | null
        }
        Update: {
          ds_change_type?: string | null
          dt_change?: string | null
          id_log?: string
          id_transaction?: string
          id_user?: string | null
          js_new_data?: Json | null
          js_old_data?: Json | null
        }
        Relationships: []
      }
      pml_rel_fund_link: {
        Row: {
          dt_created: string
          id_budget_type: string | null
          id_category: string | null
          id_family: string
          id_fund: string
          id_fund_link: string
          id_subcategory: string | null
        }
        Insert: {
          dt_created?: string
          id_budget_type?: string | null
          id_category?: string | null
          id_family: string
          id_fund: string
          id_fund_link?: string
          id_subcategory?: string | null
        }
        Update: {
          dt_created?: string
          id_budget_type?: string | null
          id_category?: string | null
          id_family?: string
          id_fund?: string
          id_fund_link?: string
          id_subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pml_rel_fund_link_id_fund_fkey"
            columns: ["id_fund"]
            isOneToOne: false
            referencedRelation: "pml_dim_fund"
            referencedColumns: ["id_fund"]
          },
        ]
      }
      pml_rel_subcategory_budget_type: {
        Row: {
          dt_created: string
          dt_updated: string
          id_budget_type: string
          id_family: string
          id_rel_subcategory_budget_type: string
          id_subcategory: string
        }
        Insert: {
          dt_created?: string
          dt_updated?: string
          id_budget_type: string
          id_family: string
          id_rel_subcategory_budget_type?: string
          id_subcategory: string
        }
        Update: {
          dt_created?: string
          dt_updated?: string
          id_budget_type?: string
          id_family?: string
          id_rel_subcategory_budget_type?: string
          id_subcategory?: string
        }
        Relationships: [
          {
            foreignKeyName: "pml_rel_subcategory_budget_type_id_budget_type_fkey"
            columns: ["id_budget_type"]
            isOneToOne: false
            referencedRelation: "pml_dim_budget_type"
            referencedColumns: ["id_budget_type"]
          },
          {
            foreignKeyName: "pml_rel_subcategory_budget_type_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "pml_rel_subcategory_budget_type_id_subcategory_fkey"
            columns: ["id_subcategory"]
            isOneToOne: false
            referencedRelation: "pml_dim_subcategory"
            referencedColumns: ["id_subcategory"]
          },
        ]
      }
      pml_rel_transaction_tag: {
        Row: {
          dt_created: string | null
          id_rel_transaction_tag: string
          id_tag: string | null
          id_transaction: string | null
        }
        Insert: {
          dt_created?: string | null
          id_rel_transaction_tag?: string
          id_tag?: string | null
          id_transaction?: string | null
        }
        Update: {
          dt_created?: string | null
          id_rel_transaction_tag?: string
          id_tag?: string | null
          id_transaction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pml_rel_transaction_tag_id_tag_fkey"
            columns: ["id_tag"]
            isOneToOne: false
            referencedRelation: "pml_dim_tag"
            referencedColumns: ["id_tag"]
          },
          {
            foreignKeyName: "pml_rel_transaction_tag_id_transaction_fkey"
            columns: ["id_transaction"]
            isOneToOne: false
            referencedRelation: "gnp_fct_transactions"
            referencedColumns: ["id_transaction"]
          },
        ]
      }
      pml_rel_transaction_user: {
        Row: {
          dt_created: string | null
          ft_amount_user: number
          id_rel_transaction_user: string
          id_transaction: string | null
          id_user: string | null
        }
        Insert: {
          dt_created?: string | null
          ft_amount_user: number
          id_rel_transaction_user?: string
          id_transaction?: string | null
          id_user?: string | null
        }
        Update: {
          dt_created?: string | null
          ft_amount_user?: number
          id_rel_transaction_user?: string
          id_transaction?: string | null
          id_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pml_rel_transaction_user_id_transaction_fkey"
            columns: ["id_transaction"]
            isOneToOne: false
            referencedRelation: "gnp_fct_transactions"
            referencedColumns: ["id_transaction"]
          },
          {
            foreignKeyName: "pml_rel_transaction_user_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
      pml_rel_user_family: {
        Row: {
          dt_inclusion: string | null
          id_family: string
          id_user: string
        }
        Insert: {
          dt_inclusion?: string | null
          id_family: string
          id_user: string
        }
        Update: {
          dt_inclusion?: string | null
          id_family?: string
          id_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "pml_rel_user_family_id_family_fkey"
            columns: ["id_family"]
            isOneToOne: false
            referencedRelation: "pml_dim_family"
            referencedColumns: ["id_family"]
          },
          {
            foreignKeyName: "pml_rel_user_family_id_user_fkey"
            columns: ["id_user"]
            isOneToOne: false
            referencedRelation: "pml_dim_user"
            referencedColumns: ["id_user"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
