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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          restaurant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          restaurant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          restaurant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          prep_time_minutes: number
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
          prep_time_minutes?: number
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
          prep_time_minutes?: number
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
      notification_preferences: {
        Row: {
          browser_push_enabled: boolean
          created_at: string
          id: string
          popup_enabled: boolean
          popup_position: string
          sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          browser_push_enabled?: boolean
          created_at?: string
          id?: string
          popup_enabled?: boolean
          popup_position?: string
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          browser_push_enabled?: boolean
          created_at?: string
          id?: string
          popup_enabled?: boolean
          popup_position?: string
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          delivery_address: Json | null
          delivery_eta: string | null
          delivery_fee: number
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          mp_qr_code: string | null
          mp_qr_code_base64: string | null
          mp_ticket_url: string | null
          notes: string | null
          order_type: string
          payment_change_for: number | null
          payment_expires_at: string | null
          payment_method: string | null
          payment_status: string | null
          pickup_time: string | null
          preparing_started_at: string | null
          ready_at: string | null
          restaurant_id: string
          shift_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string | null
          total: number
          tracking_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_eta?: string | null
          delivery_fee?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          mp_ticket_url?: string | null
          notes?: string | null
          order_type?: string
          payment_change_for?: number | null
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pickup_time?: string | null
          preparing_started_at?: string | null
          ready_at?: string | null
          restaurant_id: string
          shift_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string | null
          total?: number
          tracking_token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_eta?: string | null
          delivery_fee?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          mp_ticket_url?: string | null
          notes?: string | null
          order_type?: string
          payment_change_for?: number | null
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pickup_time?: string | null
          preparing_started_at?: string | null
          ready_at?: string | null
          restaurant_id?: string
          shift_id?: string | null
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
            foreignKeyName: "orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
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
          accepting_orders: boolean
          address: string | null
          banner_url: string | null
          closed_message: string | null
          created_at: string
          delivery_enabled: boolean
          delivery_fee: number
          description: string | null
          dine_in_enabled: boolean
          id: string
          is_active: boolean
          logo_url: string | null
          mp_access_token: string | null
          mp_enabled: boolean
          mp_public_key: string | null
          name: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          payment_methods: Json | null
          pickup_dine_in_note: string | null
          pickup_enabled: boolean
          primary_color: string | null
          short_code: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          address?: string | null
          banner_url?: string | null
          closed_message?: string | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: number
          description?: string | null
          dine_in_enabled?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mp_access_token?: string | null
          mp_enabled?: boolean
          mp_public_key?: string | null
          name: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          payment_methods?: Json | null
          pickup_dine_in_note?: string | null
          pickup_enabled?: boolean
          primary_color?: string | null
          short_code?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          address?: string | null
          banner_url?: string | null
          closed_message?: string | null
          created_at?: string
          delivery_enabled?: boolean
          delivery_fee?: number
          description?: string | null
          dine_in_enabled?: boolean
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mp_access_token?: string | null
          mp_enabled?: boolean
          mp_public_key?: string | null
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          payment_methods?: Json | null
          pickup_dine_in_note?: string | null
          pickup_enabled?: boolean
          primary_color?: string | null
          short_code?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          avg_delivery_minutes: number
          avg_prep_minutes: number
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
          avg_delivery_minutes?: number
          avg_prep_minutes?: number
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
          avg_delivery_minutes?: number
          avg_prep_minutes?: number
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
      shift_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          restaurant_id: string
          shift_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          restaurant_id: string
          shift_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          restaurant_id?: string
          shift_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_audit_logs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_cash_counts: {
        Row: {
          created_at: string
          diff: number
          expected: number
          id: string
          informed: number
          justification: string | null
          orders_count: number
          payment_method: string
          restaurant_id: string
          shift_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          diff?: number
          expected?: number
          id?: string
          informed?: number
          justification?: string | null
          orders_count?: number
          payment_method: string
          restaurant_id: string
          shift_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          diff?: number
          expected?: number
          id?: string
          informed?: number
          justification?: string | null
          orders_count?: number
          payment_method?: string
          restaurant_id?: string
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_cash_counts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_cash_counts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_cash_counts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_cash_movements: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          movement_type: string
          restaurant_id: string
          shift_id: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          movement_type: string
          restaurant_id: string
          shift_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          movement_type?: string
          restaurant_id?: string
          shift_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_cash_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_cash_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_cash_movements_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
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
      work_shifts: {
        Row: {
          cash_diff: number
          created_at: string
          divergence_justification: string | null
          expected_cash: number
          financial_closed_at: string | null
          financial_closed_by: string | null
          id: string
          informed_cash: number
          notes: string | null
          opened_at: string
          opened_by: string | null
          pending_orders_justification: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          responsible_name: string | null
          restaurant_id: string
          service_closed_at: string | null
          service_closed_by: string | null
          status: string
          totals: Json
          updated_at: string
        }
        Insert: {
          cash_diff?: number
          created_at?: string
          divergence_justification?: string | null
          expected_cash?: number
          financial_closed_at?: string | null
          financial_closed_by?: string | null
          id?: string
          informed_cash?: number
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          pending_orders_justification?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          responsible_name?: string | null
          restaurant_id: string
          service_closed_at?: string | null
          service_closed_by?: string | null
          status?: string
          totals?: Json
          updated_at?: string
        }
        Update: {
          cash_diff?: number
          created_at?: string
          divergence_justification?: string | null
          expected_cash?: number
          financial_closed_at?: string | null
          financial_closed_by?: string | null
          id?: string
          informed_cash?: number
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          pending_orders_justification?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          responsible_name?: string | null
          restaurant_id?: string
          service_closed_at?: string | null
          service_closed_by?: string | null
          status?: string
          totals?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_shifts_restaurant_id_fkey"
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
      cancel_expired_pending_payments: { Args: never; Returns: number }
      check_rate_limit: {
        Args: {
          _bucket: string
          _identifier: string
          _max_events: number
          _window_seconds: number
        }
        Returns: boolean
      }
      check_slug_available: {
        Args: { _restaurant_id?: string; _slug: string }
        Returns: boolean
      }
      create_public_order: {
        Args: {
          _coupon_code?: string
          _customer_id: string
          _delivery_address: Json
          _delivery_fee: number
          _items: Json
          _notes: string
          _order_type: string
          _payment_change_for: number
          _payment_method: string
          _restaurant_id: string
          _table_id: string
          _total: number
        }
        Returns: {
          discount_applied: number
          final_total: number
          order_id: string
          tracking_token: string
        }[]
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
      generate_restaurant_short_code: { Args: never; Returns: string }
      get_current_shift: {
        Args: { _restaurant_id: string }
        Returns: {
          cash_diff: number
          created_at: string
          divergence_justification: string | null
          expected_cash: number
          financial_closed_at: string | null
          financial_closed_by: string | null
          id: string
          informed_cash: number
          notes: string | null
          opened_at: string
          opened_by: string | null
          pending_orders_justification: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          responsible_name: string | null
          restaurant_id: string
          service_closed_at: string | null
          service_closed_by: string | null
          status: string
          totals: Json
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "work_shifts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_order_payment_status: {
        Args: { _token: string }
        Returns: {
          id: string
          mp_public_key: string
          mp_qr_code: string
          mp_qr_code_base64: string
          mp_ticket_url: string
          payment_expires_at: string
          payment_method: string
          payment_status: string
          status: string
          total: number
        }[]
      }
      get_public_order: {
        Args: { _token: string }
        Returns: {
          created_at: string
          delivery_address: Json
          delivery_eta: string
          id: string
          items: Json
          notes: string
          order_type: string
          restaurant_address: string
          restaurant_slug: string
          status: string
          total: number
        }[]
      }
      get_public_restaurant_by_slug: {
        Args: { _slug: string }
        Returns: {
          accepting_orders: boolean
          banner_url: string
          closed_message: string
          delivery_enabled: boolean
          delivery_fee: number
          description: string
          dine_in_enabled: boolean
          id: string
          is_active: boolean
          logo_url: string
          mp_enabled: boolean
          name: string
          operating_hours: Json
          owner_phone: string
          payment_methods: Json
          pickup_dine_in_note: string
          pickup_enabled: boolean
          primary_color: string
          short_code: string
          slug: string
        }[]
      }
      get_public_tables: {
        Args: { _restaurant_id: string }
        Returns: {
          id: string
          number: number
        }[]
      }
      get_restaurant_mp_credentials: {
        Args: { _restaurant_id: string }
        Returns: {
          access_token: string
          enabled: boolean
          public_key: string
        }[]
      }
      get_table_by_token: {
        Args: { _token: string }
        Returns: {
          id: string
          number: number
          restaurant_id: string
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
      is_public_restaurant_active: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      is_restaurant_open_now: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      recalc_customer_stats: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      resolve_short_code: {
        Args: { _code: string }
        Returns: {
          slug: string
        }[]
      }
      validate_public_coupon: {
        Args: { _code: string; _restaurant_id: string }
        Returns: {
          code: string
          description: string
          discount_type: string
          discount_value: number
          id: string
          is_valid: boolean
          reason: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff" | "kitchen"
      automation_trigger: "post_purchase_d1" | "inactive_7d" | "inactive_30d"
      customer_segment: "new" | "frequent" | "inactive_7d" | "inactive_30d"
      order_status:
        | "new"
        | "preparing"
        | "ready"
        | "completed"
        | "canceled"
        | "out_for_delivery"
        | "delivered"
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
      order_status: [
        "new",
        "preparing",
        "ready",
        "completed",
        "canceled",
        "out_for_delivery",
        "delivered",
      ],
    },
  },
} as const
