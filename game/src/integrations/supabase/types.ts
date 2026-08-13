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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ace_assets: {
        Row: {
          alt_text: string | null
          asset_url: string | null
          created_at: string
          id: string
          slot: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          asset_url?: string | null
          created_at?: string
          id?: string
          slot: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          asset_url?: string | null
          created_at?: string
          id?: string
          slot?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ace_audio: {
        Row: {
          active: boolean
          audio_url: string | null
          created_at: string
          event_key: string
          id: string
          label: string | null
          storage_path: string | null
          transcript: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          audio_url?: string | null
          created_at?: string
          event_key: string
          id?: string
          label?: string | null
          storage_path?: string | null
          transcript?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          audio_url?: string | null
          created_at?: string
          event_key?: string
          id?: string
          label?: string | null
          storage_path?: string | null
          transcript?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      ace_cards: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          description: string
          effect_key: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          description: string
          effect_key: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          description?: string
          effect_key?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_key: string
          game_pack_id: string | null
          id: string
          properties: Json
          room_id: string | null
        }
        Insert: {
          created_at?: string
          event_key: string
          game_pack_id?: string | null
          id?: string
          properties?: Json
          room_id?: string | null
        }
        Update: {
          created_at?: string
          event_key?: string
          game_pack_id?: string | null
          id?: string
          properties?: Json
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_game_pack_id_fkey"
            columns: ["game_pack_id"]
            isOneToOne: false
            referencedRelation: "game_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      character_assets: {
        Row: {
          alt_text: string | null
          asset_url: string | null
          character_id: string
          created_at: string
          id: string
          state: Database["public"]["Enums"]["character_state"]
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          asset_url?: string | null
          character_id: string
          created_at?: string
          id?: string
          state: Database["public"]["Enums"]["character_state"]
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          asset_url?: string | null
          character_id?: string
          created_at?: string
          id?: string
          state?: Database["public"]["Enums"]["character_state"]
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_assets_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          accent_color: string
          accessory: string
          active: boolean
          created_at: string
          id: string
          name: string
          personality: string
          slug: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color: string
          accessory: string
          active?: boolean
          created_at?: string
          id?: string
          name: string
          personality: string
          slug: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          accessory?: string
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          personality?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pack_entitlements: {
        Row: {
          id: string
          user_id: string
          game_pack_id: string
          purchase_id: string | null
          granted_at: string
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          game_pack_id: string
          purchase_id?: string | null
          granted_at?: string
          revoked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          game_pack_id?: string
          purchase_id?: string | null
          granted_at?: string
          revoked_at?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "pack_entitlements_game_pack_id_fkey"; columns: ["game_pack_id"]; isOneToOne: false; referencedRelation: "game_packs"; referencedColumns: ["id"] },
          { foreignKeyName: "pack_entitlements_purchase_id_fkey"; columns: ["purchase_id"]; isOneToOne: false; referencedRelation: "purchases"; referencedColumns: ["id"] },
        ]
      }
      game_packs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          is_free: boolean
          price_nzd_cents: number
          question_count_target: number
          slug: string
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean
          price_nzd_cents?: number
          question_count_target?: number
          slug: string
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean
          price_nzd_cents?: number
          question_count_target?: number
          slug?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      showdown_game_sessions: {
        Row: {
          created_at: string
          current_index: number
          current_round: Database["public"]["Enums"]["round_type"] | null
          ended_at: string | null
          game_pack_id: string
          id: string
          phase: string
          room_id: string
          started_at: string | null
          state: Json
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_index?: number
          current_round?: Database["public"]["Enums"]["round_type"] | null
          ended_at?: string | null
          game_pack_id: string
          id?: string
          phase?: string
          room_id: string
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_index?: number
          current_round?: Database["public"]["Enums"]["round_type"] | null
          ended_at?: string | null
          game_pack_id?: string
          id?: string
          phase?: string
          room_id?: string
          started_at?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showdown_game_sessions_game_pack_id_fkey"
            columns: ["game_pack_id"]
            isOneToOne: false
            referencedRelation: "game_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showdown_game_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_answers: {
        Row: {
          answer: Json | null
          id: string
          is_correct: boolean | null
          locked_at: string
          points_awarded: number
          response_ms: number | null
          risk_multiplier: number | null
          room_player_id: string
          session_question_id: string
        }
        Insert: {
          answer?: Json | null
          id?: string
          is_correct?: boolean | null
          locked_at?: string
          points_awarded?: number
          response_ms?: number | null
          risk_multiplier?: number | null
          room_player_id: string
          session_question_id: string
        }
        Update: {
          answer?: Json | null
          id?: string
          is_correct?: boolean | null
          locked_at?: string
          points_awarded?: number
          response_ms?: number | null
          risk_multiplier?: number | null
          room_player_id?: string
          session_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_answers_room_player_id_fkey"
            columns: ["room_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_answers_session_question_id_fkey"
            columns: ["session_question_id"]
            isOneToOne: false
            referencedRelation: "session_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_cards: {
        Row: {
          ace_card_id: string
          earned_at: string
          id: string
          room_player_id: string
          session_id: string
          used_at: string | null
        }
        Insert: {
          ace_card_id: string
          earned_at?: string
          id?: string
          room_player_id: string
          session_id: string
          used_at?: string | null
        }
        Update: {
          ace_card_id?: string
          earned_at?: string
          id?: string
          room_player_id?: string
          session_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_cards_ace_card_id_fkey"
            columns: ["ace_card_id"]
            isOneToOne: false
            referencedRelation: "ace_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_cards_room_player_id_fkey"
            columns: ["room_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_cards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "showdown_game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_risks: {
        Row: {
          auto_assigned: boolean
          id: string
          locked_at: string
          risk_key: string
          room_player_id: string
          session_question_id: string
        }
        Insert: {
          auto_assigned?: boolean
          id?: string
          locked_at?: string
          risk_key: string
          room_player_id: string
          session_question_id: string
        }
        Update: {
          auto_assigned?: boolean
          id?: string
          locked_at?: string
          risk_key?: string
          room_player_id?: string
          session_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_risks_room_player_id_fkey"
            columns: ["room_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_risks_session_question_id_fkey"
            columns: ["session_question_id"]
            isOneToOne: false
            referencedRelation: "session_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_nzd_cents: number
          created_at: string
          game_pack_id: string
          id: string
          paid_at: string | null
          provider: string
          provider_payment_intent: string | null
          provider_reference: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_nzd_cents: number
          created_at?: string
          game_pack_id: string
          id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_intent?: string | null
          provider_reference?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_nzd_cents?: number
          created_at?: string
          game_pack_id?: string
          id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_intent?: string | null
          provider_reference?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_game_pack_id_fkey"
            columns: ["game_pack_id"]
            isOneToOne: false
            referencedRelation: "game_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      question_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          media_url: string | null
          option_key: string
          option_text: string
          question_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          media_url?: string | null
          option_key: string
          option_text: string
          question_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          media_url?: string | null
          option_key?: string
          option_text?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          active: boolean
          answer_options: Json
          category: string | null
          challenge_format: string | null
          correct_answer: Json
          created_at: string
          difficulty: number
          explanation: string | null
          game_pack_id: string
          id: string
          last_verified: string | null
          media_url: string | null
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          round_type: Database["public"]["Enums"]["round_type"]
          source: string | null
          timer_seconds: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer_options?: Json
          category?: string | null
          challenge_format?: string | null
          correct_answer: Json
          created_at?: string
          difficulty?: number
          explanation?: string | null
          game_pack_id: string
          id?: string
          last_verified?: string | null
          media_url?: string | null
          question_text: string
          question_type?: Database["public"]["Enums"]["question_type"]
          round_type: Database["public"]["Enums"]["round_type"]
          source?: string | null
          timer_seconds?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer_options?: Json
          category?: string | null
          challenge_format?: string | null
          correct_answer?: Json
          created_at?: string
          difficulty?: number
          explanation?: string | null
          game_pack_id?: string
          id?: string
          last_verified?: string | null
          media_url?: string | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          round_type?: Database["public"]["Enums"]["round_type"]
          source?: string | null
          timer_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_game_pack_id_fkey"
            columns: ["game_pack_id"]
            isOneToOne: false
            referencedRelation: "game_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      room_players: {
        Row: {
          character_id: string | null
          id: string
          is_host: boolean
          joined_at: string
          last_seen_at: string
          nickname: string
          player_token_hash: string
          room_id: string
          score: number
          status: Database["public"]["Enums"]["player_status"]
          streak: number
          updated_at: string
        }
        Insert: {
          character_id?: string | null
          id?: string
          is_host?: boolean
          joined_at?: string
          last_seen_at?: string
          nickname: string
          player_token_hash: string
          room_id: string
          score?: number
          status?: Database["public"]["Enums"]["player_status"]
          streak?: number
          updated_at?: string
        }
        Update: {
          character_id?: string | null
          id?: string
          is_host?: boolean
          joined_at?: string
          last_seen_at?: string
          nickname?: string
          player_token_hash?: string
          room_id?: string
          score?: number
          status?: Database["public"]["Enums"]["player_status"]
          streak?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          display_connected: boolean
          expires_at: string
          game_pack_id: string
          host_token_hash: string
          host_user_id: string | null
          id: string
          max_players: number
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_connected?: boolean
          expires_at?: string
          game_pack_id: string
          host_token_hash: string
          host_user_id?: string | null
          id?: string
          max_players?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_connected?: boolean
          expires_at?: string
          game_pack_id?: string
          host_token_hash?: string
          host_user_id?: string | null
          id?: string
          max_players?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_game_pack_id_fkey"
            columns: ["game_pack_id"]
            isOneToOne: false
            referencedRelation: "game_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      score_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          points: number
          room_player_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          points: number
          room_player_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          points?: number
          room_player_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_events_room_player_id_fkey"
            columns: ["room_player_id"]
            isOneToOne: false
            referencedRelation: "room_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "showdown_game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_questions: {
        Row: {
          asked_at: string | null
          closed_at: string | null
          created_at: string
          id: string
          question_id: string
          revealed: boolean
          round_type: Database["public"]["Enums"]["round_type"]
          sequence: number
          session_id: string
        }
        Insert: {
          asked_at?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          question_id: string
          revealed?: boolean
          round_type: Database["public"]["Enums"]["round_type"]
          sequence: number
          session_id: string
        }
        Update: {
          asked_at?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          question_id?: string
          revealed?: boolean
          round_type?: Database["public"]["Enums"]["round_type"]
          sequence?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "showdown_game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
      character_state: "neutral" | "winning" | "shocked" | "defeated"
      player_status: "joining" | "ready" | "playing" | "disconnected" | "left"
      purchase_status: "pending" | "paid" | "refunded" | "failed"
      question_type:
        | "multiple_choice"
        | "yeah_nah"
        | "ordering"
        | "image"
        | "two_choice"
        | "audio"
        | "location"
      room_status: "lobby" | "in_progress" | "finished" | "expired"
      round_type:
        | "sweet_as"
        | "choice_bro"
        | "yeah_nah"
        | "mana"
        | "showdown"
        | "quickie"
        | "sudden_death"
      session_status: "pending" | "active" | "paused" | "complete" | "abandoned"
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
      app_role: ["owner", "admin", "user"],
      character_state: ["neutral", "winning", "shocked", "defeated"],
      player_status: ["joining", "ready", "playing", "disconnected", "left"],
      purchase_status: ["pending", "paid", "refunded", "failed"],
      question_type: [
        "multiple_choice",
        "yeah_nah",
        "ordering",
        "image",
        "two_choice",
        "audio",
        "location",
      ],
      room_status: ["lobby", "in_progress", "finished", "expired"],
      round_type: [
        "sweet_as",
        "choice_bro",
        "yeah_nah",
        "mana",
        "showdown",
        "quickie",
        "sudden_death",
      ],
      session_status: ["pending", "active", "paused", "complete", "abandoned"],
    },
  },
} as const
