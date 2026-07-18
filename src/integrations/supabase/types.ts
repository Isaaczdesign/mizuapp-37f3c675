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
      appointments: {
        Row: {
          created_at: string
          customer_id: string | null
          date_time: string
          id: string
          notes: string | null
          restaurant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          date_time: string
          id?: string
          notes?: string | null
          restaurant_id: string
          title: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          date_time?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message_template: string
          restaurant_id: string
          send_window_end: string | null
          send_window_start: string | null
          trigger: Database["public"]["Enums"]["automation_trigger"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_template: string
          restaurant_id: string
          send_window_end?: string | null
          send_window_start?: string | null
          trigger: Database["public"]["Enums"]["automation_trigger"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message_template?: string
          restaurant_id?: string
          send_window_end?: string | null
          send_window_start?: string | null
          trigger?: Database["public"]["Enums"]["automation_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          coupon_id: string
          customer_id: string
          id: string
          order_id: string | null
          used_at: string
        }
        Insert: {
          coupon_id: string
          customer_id: string
          id?: string
          order_id?: string | null
          used_at?: string
        }
        Update: {
          coupon_id?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          restaurant_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          restaurant_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          restaurant_id?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          consent_marketing: boolean
          created_at: string
          id: string
          last_order_at: string | null
          name: string
          opt_in_at: string | null
          opt_in_text_version: string | null
          opt_out_token: string
          restaurant_id: string
          total_orders: number
          total_spent: number
          whatsapp: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          consent_marketing?: boolean
          created_at?: string
          id?: string
          last_order_at?: string | null
          name: string
          opt_in_at?: string | null
          opt_in_text_version?: string | null
          opt_out_token?: string
          restaurant_id: string
          total_orders?: number
          total_spent?: number
          whatsapp: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          consent_marketing?: boolean
          created_at?: string
          id?: string
          last_order_at?: string | null
          name?: string
          opt_in_at?: string | null
          opt_in_text_version?: string | null
          opt_out_token?: string
          restaurant_id?: string
          total_orders?: number
          total_spent?: number
          whatsapp?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_import_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          file_url: string
          id: string
          parsed_result: Json | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_url: string
          id?: string
          parsed_result?: Json | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_url?: string
          id?: string
          parsed_result?: Json | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_import_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_import_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_addons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          menu_item_id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          menu_item_id: string
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          menu_item_id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_addons_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_variations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          menu_item_id: string
          name: string
          price_delta: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          menu_item_id: string
          name: string
          price_delta?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          menu_item_id?: string
          name?: string
          price_delta?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_variations_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string | null
          category_id: string
          cost_estimate: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_active: boolean
          margin_percent: number | null
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          allergens?: string | null
          category_id: string
          cost_estimate?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean
          margin_percent?: number | null
          name: string
          price?: number
          restaurant_id: string
          sort_order?: number
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          allergens?: string | null
          category_id?: string
          cost_estimate?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean
          margin_percent?: number | null
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          automation_rule_id: string | null
          customer_id: string
          id: string
          message: string
          provider_message_id: string | null
          restaurant_id: string
          sent_at: string
          status: string | null
          trigger: Database["public"]["Enums"]["automation_trigger"]
        }
        Insert: {
          automation_rule_id?: string | null
          customer_id: string
          id?: string
          message: string
          provider_message_id?: string | null
          restaurant_id: string
          sent_at?: string
          status?: string | null
          trigger: Database["public"]["Enums"]["automation_trigger"]
        }
        Update: {
          automation_rule_id?: string | null
          customer_id?: string
          id?: string
          message?: string
          provider_message_id?: string | null
          restaurant_id?: string
          sent_at?: string
          status?: string | null
          trigger?: Database["public"]["Enums"]["automation_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string | null
          name: string
          notes: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          menu_item_id?: string | null
          name: string
          notes?: string | null
          order_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          id?: string
          menu_item_id?: string | null
          name?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          total: number
          tracking_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
          tracking_token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
          tracking_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_complete: boolean
          restaurant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_complete?: boolean
          restaurant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_complete?: boolean
          restaurant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          number: number
          restaurant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          number: number
          restaurant_id: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          number?: number
          restaurant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          dine_in_enabled: boolean
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          payment_methods: Json | null
          pickup_dine_in_note: string | null
          pickup_enabled: boolean
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          dine_in_enabled?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          payment_methods?: Json | null
          pickup_dine_in_note?: string | null
          pickup_enabled?: boolean
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          dine_in_enabled?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          payment_methods?: Json | null
          pickup_dine_in_note?: string | null
          pickup_enabled?: boolean
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          operating_hours: Json | null
          restaurant_id: string
          updated_at: string
          whatsapp_api_key: string | null
          whatsapp_provider: string | null
          whatsapp_sender_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          operating_hours?: Json | null
          restaurant_id: string
          updated_at?: string
          whatsapp_api_key?: string | null
          whatsapp_provider?: string | null
          whatsapp_sender_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          operating_hours?: Json | null
          restaurant_id?: string
          updated_at?: string
          whatsapp_api_key?: string | null
          whatsapp_provider?: string | null
          whatsapp_sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: string
          restaurant_id: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          restaurant_id: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          restaurant_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      restaurants_public: {
        Row: {
          banner_url: string | null
          description: string | null
          dine_in_enabled: boolean | null
          id: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          owner_phone: string | null
          payment_methods: Json | null
          pickup_dine_in_note: string | null
          pickup_enabled: boolean | null
          primary_color: string | null
          slug: string | null
        }
        Insert: {
          banner_url?: string | null
          description?: string | null
          dine_in_enabled?: boolean | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          owner_phone?: string | null
          payment_methods?: Json | null
          pickup_dine_in_note?: string | null
          pickup_enabled?: boolean | null
          primary_color?: string | null
          slug?: string | null
        }
        Update: {
          banner_url?: string | null
          description?: string | null
          dine_in_enabled?: boolean | null
          id?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          owner_phone?: string | null
          payment_methods?: Json | null
          pickup_dine_in_note?: string | null
          pickup_enabled?: boolean | null
          primary_color?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          _bucket: string
          _identifier: string
          _max_events: number
          _window_seconds: number
        }
        Returns: boolean
      }
      find_or_create_customer: {
        Args: {
          _consent?: boolean
          _name: string
          _restaurant_id: string
          _whatsapp: string
        }
        Returns: string
      }
      get_public_order: {
        Args: { _token: string }
        Returns: {
          created_at: string
          id: string
          items: Json
          notes: string
          status: string
          total: number
        }[]
      }
      get_user_restaurant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff" | "kitchen"
      automation_trigger: "post_purchase_d1" | "inactive_7d" | "inactive_30d"
      customer_segment: "new" | "frequent" | "inactive_7d" | "inactive_30d"
      order_status: "new" | "preparing" | "ready" | "completed" | "canceled"
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
      app_role: ["owner", "manager", "staff", "kitchen"],
      automation_trigger: ["post_purchase_d1", "inactive_7d", "inactive_30d"],
      customer_segment: ["new", "frequent", "inactive_7d", "inactive_30d"],
      order_status: ["new", "preparing", "ready", "completed", "canceled"],
    },
  },
} as const
