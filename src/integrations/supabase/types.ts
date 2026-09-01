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
      admin_fids: {
        Row: {
          created_at: string
          fid: number
          label: string | null
        }
        Insert: {
          created_at?: string
          fid: number
          label?: string | null
        }
        Update: {
          created_at?: string
          fid?: number
          label?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      daily_claims: {
        Row: {
          amount: number
          campaign_ids: string | null
          claim_day: string
          created_at: string
          id: string
          tx_hash: string | null
          wallet: string
        }
        Insert: {
          amount?: number
          campaign_ids?: string | null
          claim_day?: string
          created_at?: string
          id?: string
          tx_hash?: string | null
          wallet: string
        }
        Update: {
          amount?: number
          campaign_ids?: string | null
          claim_day?: string
          created_at?: string
          id?: string
          tx_hash?: string | null
          wallet?: string
        }
        Relationships: []
      }
      energy_purchases: {
        Row: {
          amount_facts: number
          created_at: string
          energy: number
          fighter_id: string
          id: string
          item_id: string
          tx_hash: string
          wallet: string
        }
        Insert: {
          amount_facts?: number
          created_at?: string
          energy: number
          fighter_id: string
          id?: string
          item_id: string
          tx_hash: string
          wallet: string
        }
        Update: {
          amount_facts?: number
          created_at?: string
          energy?: number
          fighter_id?: string
          id?: string
          item_id?: string
          tx_hash?: string
          wallet?: string
        }
        Relationships: []
      }
      fighter_energy: {
        Row: {
          bonus_energy: number
          created_at: string
          fighter_id: string
          id: string
          updated_at: string
          wallet: string
        }
        Insert: {
          bonus_energy?: number
          created_at?: string
          fighter_id: string
          id?: string
          updated_at?: string
          wallet: string
        }
        Update: {
          bonus_energy?: number
          created_at?: string
          fighter_id?: string
          id?: string
          updated_at?: string
          wallet?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        Insert: {
          arena?: string
          created_at?: string
          difficulty?: number
          host_deck?: Json
          host_fid?: number | null
          host_fighter_id?: string
          host_handle: string
          host_paid?: boolean
          host_ready?: boolean
          host_revealed?: number
          host_round_wins?: number
          host_wallet?: string | null
          id?: string
          invited_fid?: number | null
          invited_username?: string | null
          joiner_deck?: Json
          joiner_fid?: number | null
          joiner_fighter_id?: string | null
          joiner_handle?: string | null
          joiner_paid?: boolean
          joiner_ready?: boolean
          joiner_revealed?: number
          joiner_round_wins?: number
          joiner_wallet?: string | null
          match_id: string
          mode?: string
          round?: number
          settle_tx?: string | null
          settled_at?: string | null
          stake?: number
          staked?: boolean
          status?: string
          token?: string
          tournament_id?: string | null
          updated_at?: string
          winner_wallet?: string | null
        }
        Update: {
          arena?: string
          created_at?: string
          difficulty?: number
          host_deck?: Json
          host_fid?: number | null
          host_fighter_id?: string
          host_handle?: string
          host_paid?: boolean
          host_ready?: boolean
          host_revealed?: number
          host_round_wins?: number
          host_wallet?: string | null
          id?: string
          invited_fid?: number | null
          invited_username?: string | null
          joiner_deck?: Json
          joiner_fid?: number | null
          joiner_fighter_id?: string | null
          joiner_handle?: string | null
          joiner_paid?: boolean
          joiner_ready?: boolean
          joiner_revealed?: number
          joiner_round_wins?: number
          joiner_wallet?: string | null
          match_id?: string
          mode?: string
          round?: number
          settle_tx?: string | null
          settled_at?: string | null
          stake?: number
          staked?: boolean
          status?: string
          token?: string
          tournament_id?: string | null
          updated_at?: string
          winner_wallet?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          created_at: string
          event_key: string
        }
        Insert: {
          created_at?: string
          event_key: string
        }
        Update: {
          created_at?: string
          event_key?: string
        }
        Relationships: []
      }
      notification_tokens: {
        Row: {
          created_at: string
          enabled: boolean
          fid: number
          id: string
          last_event: string | null
          token: string
          updated_at: string
          url: string
          username: string | null
          wallet: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          fid: number
          id?: string
          last_event?: string | null
          token: string
          updated_at?: string
          url: string
          username?: string | null
          wallet?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          fid?: number
          id?: string
          last_event?: string | null
          token?: string
          updated_at?: string
          url?: string
          username?: string | null
          wallet?: string | null
        }
        Relationships: []
      }
      onchain_events: {
        Row: {
          address: string
          args: Json
          block_number: number | null
          contract: string
          created_at: string
          event_name: string
          id: string
          log_index: number
          tx_hash: string
          wallet: string | null
        }
        Insert: {
          address: string
          args?: Json
          block_number?: number | null
          contract: string
          created_at?: string
          event_name: string
          id?: string
          log_index?: number
          tx_hash: string
          wallet?: string | null
        }
        Update: {
          address?: string
          args?: Json
          block_number?: number | null
          contract?: string
          created_at?: string
          event_name?: string
          id?: string
          log_index?: number
          tx_hash?: string
          wallet?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          beneficiary: string
          created_at: string
          id: string
          kind: string
          payer: string
          payment_ref: string
          sku: string
          status: string
          token: string
          tx_hash: string | null
          updated_at: string
          usd_value: number | null
        }
        Insert: {
          amount: number
          beneficiary: string
          created_at?: string
          id?: string
          kind: string
          payer: string
          payment_ref: string
          sku: string
          status?: string
          token?: string
          tx_hash?: string | null
          updated_at?: string
          usd_value?: number | null
        }
        Update: {
          amount?: number
          beneficiary?: string
          created_at?: string
          id?: string
          kind?: string
          payer?: string
          payment_ref?: string
          sku?: string
          status?: string
          token?: string
          tx_hash?: string | null
          updated_at?: string
          usd_value?: number | null
        }
        Relationships: []
      }
      pending_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          label: string
          source: string
          status: string
          tx_hash: string | null
          updated_at: string
          wallet: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          label: string
          source: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
          wallet: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          label?: string
          source?: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
          wallet?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          facts_earned: number
          fid: number | null
          fp: number
          handle: string | null
          id: string
          losses: number
          notif_bonus_at: string | null
          pass_expires_at: string | null
          pfp_url: string | null
          tp: number
          updated_at: string
          wallet: string
          wins: number
        }
        Insert: {
          created_at?: string
          facts_earned?: number
          fid?: number | null
          fp?: number
          handle?: string | null
          id?: string
          losses?: number
          notif_bonus_at?: string | null
          pass_expires_at?: string | null
          pfp_url?: string | null
          tp?: number
          updated_at?: string
          wallet: string
          wins?: number
        }
        Update: {
          created_at?: string
          facts_earned?: number
          fid?: number | null
          fp?: number
          handle?: string | null
          id?: string
          losses?: number
          notif_bonus_at?: string | null
          pass_expires_at?: string | null
          pfp_url?: string | null
          tp?: number
          updated_at?: string
          wallet?: string
          wins?: number
        }
        Relationships: []
      }
      reward_allocations: {
        Row: {
          amount: number
          campaign_id: number
          created_at: string
          id: string
          rank: number | null
          tx_hash: string | null
          wallet: string
        }
        Insert: {
          amount: number
          campaign_id: number
          created_at?: string
          id?: string
          rank?: number | null
          tx_hash?: string | null
          wallet: string
        }
        Update: {
          amount?: number
          campaign_id?: number
          created_at?: string
          id?: string
          rank?: number | null
          tx_hash?: string | null
          wallet?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          asset: string
          campaign_id: number | null
          created_at: string
          id: string
          source: string
          status: string
          tx_hash: string | null
          wallet: string
        }
        Insert: {
          amount?: number
          asset?: string
          campaign_id?: number | null
          created_at?: string
          id?: string
          source: string
          status?: string
          tx_hash?: string | null
          wallet: string
        }
        Update: {
          amount?: number
          asset?: string
          campaign_id?: number | null
          created_at?: string
          id?: string
          source?: string
          status?: string
          tx_hash?: string | null
          wallet?: string
        }
        Relationships: []
      }
      staked_matches: {
        Row: {
          asset: string
          create_tx: string | null
          created_at: string
          creator: string
          id: string
          join_tx: string | null
          match_id: string
          match_key: string
          opponent: string | null
          settle_tx: string | null
          stake: number
          status: string
          updated_at: string
          winner: string | null
        }
        Insert: {
          asset?: string
          create_tx?: string | null
          created_at?: string
          creator: string
          id?: string
          join_tx?: string | null
          match_id: string
          match_key: string
          opponent?: string | null
          settle_tx?: string | null
          stake: number
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Update: {
          asset?: string
          create_tx?: string | null
          created_at?: string
          creator?: string
          id?: string
          join_tx?: string | null
          match_id?: string
          match_key?: string
          opponent?: string | null
          settle_tx?: string | null
          stake?: number
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          created_at: string
          fid: number | null
          handle: string | null
          id: string
          losses: number
          points: number
          tournament_id: string
          updated_at: string
          wallet: string
          wins: number
        }
        Insert: {
          created_at?: string
          fid?: number | null
          handle?: string | null
          id?: string
          losses?: number
          points?: number
          tournament_id: string
          updated_at?: string
          wallet: string
          wins?: number
        }
        Update: {
          created_at?: string
          fid?: number | null
          handle?: string | null
          id?: string
          losses?: number
          points?: number
          tournament_id?: string
          updated_at?: string
          wallet?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_points: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          points: number
          reason: string
          tournament_id: string
          wallet: string
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id?: string
          points?: number
          reason?: string
          tournament_id: string
          wallet: string
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          points?: number
          reason?: string
          tournament_id?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_points_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_results: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          points: number
          prize: number
          rank: number
          tournament_id: string
          wallet: string
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id?: string
          points?: number
          prize?: number
          rank: number
          tournament_id: string
          wallet: string
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          points?: number
          prize?: number
          rank?: number
          tournament_id?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by_fid: number | null
          description: string
          ends_at: string
          id: string
          prize_pool: number
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status: string
          title: string
          tp_per_loss: number
          tp_per_win: number
          updated_at: string
          winner_count: number
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by_fid?: number | null
          description?: string
          ends_at?: string
          id?: string
          prize_pool?: number
          registration_closes_at?: string
          registration_opens_at?: string
          starts_at?: string
          status?: string
          title: string
          tp_per_loss?: number
          tp_per_win?: number
          updated_at?: string
          winner_count?: number
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by_fid?: number | null
          description?: string
          ends_at?: string
          id?: string
          prize_pool?: number
          registration_closes_at?: string
          registration_opens_at?: string
          starts_at?: string
          status?: string
          title?: string
          tp_per_loss?: number
          tp_per_win?: number
          updated_at?: string
          winner_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_season_pass: {
        Args: { p_days: number; p_wallet: string }
        Returns: string
      }
      admin_adjust_tournament_points: {
        Args: {
          p_admin_key: string
          p_fid: number
          p_points: number
          p_reason: string
          p_tournament_id: string
          p_wallet: string
        }
        Returns: {
          created_at: string
          fid: number | null
          handle: string | null
          id: string
          losses: number
          points: number
          tournament_id: string
          updated_at: string
          wallet: string
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "tournament_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_tournaments: {
        Args: { p_admin_key: string; p_fid: number }
        Returns: {
          banner_url: string | null
          created_at: string
          created_by_fid: number | null
          description: string
          ends_at: string
          id: string
          prize_pool: number
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status: string
          title: string
          tp_per_loss: number
          tp_per_win: number
          updated_at: string
          winner_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "tournaments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_set_tournament_status: {
        Args: {
          p_admin_key: string
          p_fid: number
          p_id: string
          p_status: string
        }
        Returns: {
          banner_url: string | null
          created_at: string
          created_by_fid: number | null
          description: string
          ends_at: string
          id: string
          prize_pool: number
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status: string
          title: string
          tp_per_loss: number
          tp_per_win: number
          updated_at: string
          winner_count: number
        }
        SetofOptions: {
          from: "*"
          to: "tournaments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_tournament: {
        Args: {
          p_admin_key: string
          p_banner_url: string
          p_description: string
          p_ends: string
          p_fid: number
          p_id: string
          p_prize: number
          p_reg_closes: string
          p_reg_opens: string
          p_starts: string
          p_status: string
          p_title: string
          p_tp_loss: number
          p_tp_win: number
          p_winner_count: number
        }
        Returns: {
          banner_url: string | null
          created_at: string
          created_by_fid: number | null
          description: string
          ends_at: string
          id: string
          prize_pool: number
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status: string
          title: string
          tp_per_loss: number
          tp_per_win: number
          updated_at: string
          winner_count: number
        }
        SetofOptions: {
          from: "*"
          to: "tournaments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_match_round: {
        Args: { p_host_wins: number; p_joiner_wins: number; p_match_id: string }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_admin: {
        Args: { p_admin_key: string; p_fid: number }
        Returns: undefined
      }
      award_notification_bonus: {
        Args: { p_fid: number; p_handle: string; p_wallet: string }
        Returns: {
          awarded: boolean
          fp: number
        }[]
      }
      claim_notification_slot: { Args: { p_key: string }; Returns: boolean }
      create_match: {
        Args: {
          p_difficulty: number
          p_host_fid: number
          p_host_fighter_id: string
          p_host_handle: string
          p_host_wallet: string
          p_invited_fid: number
          p_invited_username: string
          p_match_id: string
          p_mode: string
          p_stake: number
          p_staked: boolean
          p_token: string
        }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      disable_notification_tokens: {
        Args: { p_event: string; p_fid: number }
        Returns: undefined
      }
      get_match: {
        Args: { p_match_id: string }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_player: {
        Args: { p_wallet: string }
        Returns: {
          fp: number
          handle: string
          losses: number
          notif_bonus: boolean
          tp: number
          wallet: string
          wins: number
        }[]
      }
      is_admin_fid: { Args: { p_fid: number }; Returns: boolean }
      join_match: {
        Args: {
          p_fid: number
          p_fighter_id: string
          p_handle: string
          p_match_id: string
          p_wallet: string
        }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_staked_match: {
        Args: { p_match_id: string; p_tx_hash: string; p_wallet: string }
        Returns: undefined
      }
      leaderboard_global: {
        Args: { p_limit?: number }
        Returns: {
          fp: number
          handle: string
          losses: number
          pfp_url: string
          wallet: string
          wins: number
        }[]
      }
      leaderboard_ranked: {
        Args: { p_limit?: number }
        Returns: {
          fp: number
          handle: string
          losses: number
          wallet: string
          wins: number
        }[]
      }
      list_daily_claims: {
        Args: { p_wallet: string }
        Returns: {
          amount: number
          claim_day: string
          created_at: string
          tx_hash: string
        }[]
      }
      list_fighter_energy: {
        Args: { p_wallet: string }
        Returns: {
          bonus_energy: number
          fighter_id: string
        }[]
      }
      list_my_matches: {
        Args: { p_handle: string }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_notification_fids: {
        Args: never
        Returns: {
          fid: number
        }[]
      }
      list_open_ranked_matches: {
        Args: { p_limit?: number }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_tournaments: {
        Args: { p_limit?: number }
        Returns: {
          banner_url: string | null
          created_at: string
          created_by_fid: number | null
          description: string
          ends_at: string
          id: string
          prize_pool: number
          registration_closes_at: string
          registration_opens_at: string
          starts_at: string
          status: string
          title: string
          tp_per_loss: number
          tp_per_win: number
          updated_at: string
          winner_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "tournaments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      record_battle_result: {
        Args: {
          p_fp: number
          p_handle: string
          p_ranked: boolean
          p_tournament_id: string
          p_tp: number
          p_wallet: string
          p_won: boolean
        }
        Returns: {
          fp: number
          tp: number
        }[]
      }
      record_chain_event: {
        Args: {
          p_address: string
          p_args: Json
          p_block: number
          p_contract: string
          p_event_name: string
          p_tx_hash: string
          p_wallet: string
        }
        Returns: undefined
      }
      record_daily_claim: {
        Args: {
          p_amount: number
          p_campaign_ids: string
          p_tx_hash: string
          p_wallet: string
        }
        Returns: undefined
      }
      record_energy_purchase: {
        Args: {
          p_amount: number
          p_energy: number
          p_fighter_id: string
          p_item_id: string
          p_tx_hash: string
          p_wallet: string
        }
        Returns: number
      }
      record_payment_receipt: {
        Args: {
          p_amount: number
          p_beneficiary: string
          p_kind: string
          p_payer: string
          p_payment_ref: string
          p_sku: string
          p_token: string
          p_tx_hash: string
          p_usd_value: number
        }
        Returns: {
          created_at: string
          id: string
        }[]
      }
      record_ranked_result: {
        Args: {
          p_fp: number
          p_handle: string
          p_wallet: string
          p_won: boolean
        }
        Returns: number
      }
      record_reward_claim: {
        Args: {
          p_amount: number
          p_asset: string
          p_source: string
          p_tx_hash: string
          p_wallet: string
        }
        Returns: undefined
      }
      reveal_match_slot: {
        Args: { p_match_id: string; p_role: string; p_slot: number }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_notification_token: {
        Args: { p_event: string; p_fid: number; p_token: string; p_url: string }
        Returns: undefined
      }
      set_match_arena: {
        Args: { p_arena: string; p_match_id: string }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_match_loadout: {
        Args: {
          p_deck: Json
          p_fighter_id: string
          p_match_id: string
          p_ready: boolean
          p_role: string
        }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_match_paid: {
        Args: { p_match_id: string; p_role: string }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_match_status: {
        Args: { p_match_id: string; p_status: string }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      settle_match_result: {
        Args: {
          p_match_id: string
          p_settle_tx: string
          p_winner_wallet: string
        }
        Returns: {
          arena: string
          created_at: string
          difficulty: number
          host_deck: Json
          host_fid: number | null
          host_fighter_id: string
          host_handle: string
          host_paid: boolean
          host_ready: boolean
          host_revealed: number
          host_round_wins: number
          host_wallet: string | null
          id: string
          invited_fid: number | null
          invited_username: string | null
          joiner_deck: Json
          joiner_fid: number | null
          joiner_fighter_id: string | null
          joiner_handle: string | null
          joiner_paid: boolean
          joiner_ready: boolean
          joiner_revealed: number
          joiner_round_wins: number
          joiner_wallet: string | null
          match_id: string
          mode: string
          round: number
          settle_tx: string | null
          settled_at: string | null
          stake: number
          staked: boolean
          status: string
          token: string
          tournament_id: string | null
          updated_at: string
          winner_wallet: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tournament_register: {
        Args: {
          p_fid: number
          p_handle: string
          p_tournament_id: string
          p_wallet: string
        }
        Returns: {
          created_at: string
          fid: number | null
          handle: string | null
          id: string
          losses: number
          points: number
          tournament_id: string
          updated_at: string
          wallet: string
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "tournament_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tournament_standings: {
        Args: { p_limit?: number; p_tournament_id: string }
        Returns: {
          handle: string
          losses: number
          points: number
          wallet: string
          wins: number
        }[]
      }
      upsert_staked_match: {
        Args: {
          p_asset: string
          p_creator: string
          p_match_id: string
          p_match_key: string
          p_stake: number
          p_tx_hash: string
        }
        Returns: undefined
      }
      upsert_wallet_profile: {
        Args: { p_handle?: string; p_wallet: string }
        Returns: undefined
      }
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
