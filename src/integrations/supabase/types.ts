export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      conversation_reads: {
        Row: {
          creative_workspace_id: string;
          last_read_at: string;
          project_id: string;
          user_id: string;
        };
        Insert: {
          creative_workspace_id: string;
          last_read_at?: string;
          project_id: string;
          user_id: string;
        };
        Update: {
          creative_workspace_id?: string;
          last_read_at?: string;
          project_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_reads_creative_workspace_id_fkey";
            columns: ["creative_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      deliverables: {
        Row: {
          external_url: string | null;
          feedback: string | null;
          file_name: string | null;
          file_path: string | null;
          id: string;
          note: string | null;
          project_id: string;
          reviewed_at: string | null;
          status: string;
          submitted_at: string;
          title: string;
        };
        Insert: {
          external_url?: string | null;
          feedback?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          id?: string;
          note?: string | null;
          project_id: string;
          reviewed_at?: string | null;
          status?: string;
          submitted_at?: string;
          title: string;
        };
        Update: {
          external_url?: string | null;
          feedback?: string | null;
          file_name?: string | null;
          file_path?: string | null;
          id?: string;
          note?: string | null;
          project_id?: string;
          reviewed_at?: string | null;
          status?: string;
          submitted_at?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          creative_workspace_id: string;
          id: string;
          project_id: string;
          sender_user_id: string;
          sender_workspace_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          creative_workspace_id: string;
          id?: string;
          project_id: string;
          sender_user_id: string;
          sender_workspace_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          creative_workspace_id?: string;
          id?: string;
          project_id?: string;
          sender_user_id?: string;
          sender_workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_creative_workspace_id_fkey";
            columns: ["creative_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_workspace_id_fkey";
            columns: ["sender_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          reference_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          reference_id?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          reference_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          confirmed_at: string | null;
          contract_id: string;
          created_at: string;
          currency: string;
          id: string;
          note: string | null;
          payee_workspace_id: string;
          payer_workspace_id: string;
          platform_fee: number;
          project_id: string;
          provider: string;
          provider_reference: string | null;
          reported_at: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          confirmed_at?: string | null;
          contract_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          note?: string | null;
          payee_workspace_id: string;
          payer_workspace_id: string;
          platform_fee?: number;
          project_id: string;
          provider?: string;
          provider_reference?: string | null;
          reported_at?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          confirmed_at?: string | null;
          contract_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          note?: string | null;
          payee_workspace_id?: string;
          payer_workspace_id?: string;
          platform_fee?: number;
          project_id?: string;
          provider?: string;
          provider_reference?: string | null;
          reported_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "project_contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_payee_workspace_id_fkey";
            columns: ["payee_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_payer_workspace_id_fkey";
            columns: ["payer_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolio_items: {
        Row: {
          created_at: string;
          description: string | null;
          external_url: string | null;
          id: string;
          media_url: string | null;
          title: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          media_url?: string | null;
          title: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          external_url?: string | null;
          id?: string;
          media_url?: string | null;
          title?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portfolio_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active_workspace_id: string | null;
          avatar_url: string | null;
          created_at: string;
          full_name: string;
          id: string;
        };
        Insert: {
          active_workspace_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
        };
        Update: {
          active_workspace_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      project_contracts: {
        Row: {
          agreed_deadline: string | null;
          agreed_price: number;
          brand_workspace_id: string;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          creative_workspace_id: string;
          currency: string;
          id: string;
          project_id: string;
          proposal_id: string;
          scope: string;
          started_at: string | null;
        };
        Insert: {
          agreed_deadline?: string | null;
          agreed_price: number;
          brand_workspace_id: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          creative_workspace_id: string;
          currency?: string;
          id?: string;
          project_id: string;
          proposal_id: string;
          scope?: string;
          started_at?: string | null;
        };
        Update: {
          agreed_deadline?: string | null;
          agreed_price?: number;
          brand_workspace_id?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          creative_workspace_id?: string;
          currency?: string;
          id?: string;
          project_id?: string;
          proposal_id?: string;
          scope?: string;
          started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_contracts_brand_workspace_id_fkey";
            columns: ["brand_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_contracts_creative_workspace_id_fkey";
            columns: ["creative_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_contracts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_contracts_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      project_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          id: string;
          message: string;
          project_id: string;
          type: string;
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          project_id: string;
          type: string;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          project_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          attachments: string[];
          brand_workspace_id: string;
          budget_max: number | null;
          budget_min: number | null;
          budget_type: string;
          category: string;
          completed_at: string | null;
          created_at: string;
          currency: string;
          deadline: string | null;
          deliverables: string[];
          description: string;
          hired_at: string | null;
          hired_creative_workspace_id: string | null;
          id: string;
          image_url: string | null;
          is_demo: boolean;
          is_remote: boolean;
          location: string | null;
          preferred_experience: string | null;
          proposal_deadline: string | null;
          skills: string[];
          status: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          attachments?: string[];
          brand_workspace_id: string;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: string;
          category: string;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          deadline?: string | null;
          deliverables?: string[];
          description?: string;
          hired_at?: string | null;
          hired_creative_workspace_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_demo?: boolean;
          is_remote?: boolean;
          location?: string | null;
          preferred_experience?: string | null;
          proposal_deadline?: string | null;
          skills?: string[];
          status?: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          attachments?: string[];
          brand_workspace_id?: string;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: string;
          category?: string;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          deadline?: string | null;
          deliverables?: string[];
          description?: string;
          hired_at?: string | null;
          hired_creative_workspace_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_demo?: boolean;
          is_remote?: boolean;
          location?: string | null;
          preferred_experience?: string | null;
          proposal_deadline?: string | null;
          skills?: string[];
          status?: Database["public"]["Enums"]["project_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_brand_workspace_id_fkey";
            columns: ["brand_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_hired_creative_workspace_id_fkey";
            columns: ["hired_creative_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: {
          approach: string;
          cover_message: string;
          created_at: string;
          creative_workspace_id: string;
          delivery_time: string | null;
          id: string;
          is_demo: boolean;
          milestones: string | null;
          portfolio_links: string[];
          price: number;
          project_id: string;
          status: Database["public"]["Enums"]["proposal_status"];
          updated_at: string;
        };
        Insert: {
          approach?: string;
          cover_message?: string;
          created_at?: string;
          creative_workspace_id: string;
          delivery_time?: string | null;
          id?: string;
          is_demo?: boolean;
          milestones?: string | null;
          portfolio_links?: string[];
          price: number;
          project_id: string;
          status?: Database["public"]["Enums"]["proposal_status"];
          updated_at?: string;
        };
        Update: {
          approach?: string;
          cover_message?: string;
          created_at?: string;
          creative_workspace_id?: string;
          delivery_time?: string | null;
          id?: string;
          is_demo?: boolean;
          milestones?: string | null;
          portfolio_links?: string[];
          price?: number;
          project_id?: string;
          status?: Database["public"]["Enums"]["proposal_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_creative_workspace_id_fkey";
            columns: ["creative_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          admin_note: string | null;
          created_at: string;
          details: string | null;
          id: string;
          reason: string;
          reporter_id: string;
          resolved_at: string | null;
          status: string;
          target_id: string;
          target_type: string;
        };
        Insert: {
          admin_note?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: string;
          reporter_id?: string;
          resolved_at?: string | null;
          status?: string;
          target_id: string;
          target_type: string;
        };
        Update: {
          admin_note?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: string;
          reporter_id?: string;
          resolved_at?: string | null;
          status?: string;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          comment: string | null;
          communication: number | null;
          created_at: string;
          id: string;
          project_id: string;
          quality: number | null;
          rating: number;
          reliability: number | null;
          reviewee_workspace_id: string;
          reviewer_workspace_id: string;
        };
        Insert: {
          comment?: string | null;
          communication?: number | null;
          created_at?: string;
          id?: string;
          project_id: string;
          quality?: number | null;
          rating: number;
          reliability?: number | null;
          reviewee_workspace_id: string;
          reviewer_workspace_id: string;
        };
        Update: {
          comment?: string | null;
          communication?: number | null;
          created_at?: string;
          id?: string;
          project_id?: string;
          quality?: number | null;
          rating?: number;
          reliability?: number | null;
          reviewee_workspace_id?: string;
          reviewer_workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewee_workspace_id_fkey";
            columns: ["reviewee_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewer_workspace_id_fkey";
            columns: ["reviewer_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_projects: {
        Row: {
          created_at: string;
          creative_workspace_id: string;
          id: string;
          project_id: string;
        };
        Insert: {
          created_at?: string;
          creative_workspace_id: string;
          id?: string;
          project_id: string;
        };
        Update: {
          created_at?: string;
          creative_workspace_id?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_projects_creative_workspace_id_fkey";
            columns: ["creative_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_projects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          availability: string;
          avatar_url: string | null;
          cover_url: string | null;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          industry: string | null;
          is_demo: boolean;
          location: string | null;
          logo_url: string | null;
          name: string;
          open_to_projects: boolean;
          owner_id: string;
          published: boolean;
          rating: number;
          reviews_count: number;
          services: string[];
          skills: string[];
          slug: string;
          starting_price: number | null;
          suspended: boolean;
          tagline: string | null;
          type: Database["public"]["Enums"]["workspace_type"];
          updated_at: string;
          verified: boolean;
          website_url: string | null;
        };
        Insert: {
          availability?: string;
          avatar_url?: string | null;
          cover_url?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          industry?: string | null;
          is_demo?: boolean;
          location?: string | null;
          logo_url?: string | null;
          name: string;
          open_to_projects?: boolean;
          owner_id: string;
          published?: boolean;
          rating?: number;
          reviews_count?: number;
          services?: string[];
          skills?: string[];
          slug: string;
          starting_price?: number | null;
          suspended?: boolean;
          tagline?: string | null;
          type: Database["public"]["Enums"]["workspace_type"];
          updated_at?: string;
          verified?: boolean;
          website_url?: string | null;
        };
        Update: {
          availability?: string;
          avatar_url?: string | null;
          cover_url?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          industry?: string | null;
          is_demo?: boolean;
          location?: string | null;
          logo_url?: string | null;
          name?: string;
          open_to_projects?: boolean;
          owner_id?: string;
          published?: boolean;
          rating?: number;
          reviews_count?: number;
          services?: string[];
          skills?: string[];
          slug?: string;
          starting_price?: number | null;
          suspended?: boolean;
          tagline?: string | null;
          type?: Database["public"]["Enums"]["workspace_type"];
          updated_at?: string;
          verified?: boolean;
          website_url?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_resolve_report: {
        Args: { p_report_id: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      admin_set_payment_status: {
        Args: { p_project_id: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      admin_set_workspace_suspended: {
        Args: { p_workspace_id: string; p_suspended: boolean };
        Returns: undefined;
      };
      approve_project: {
        Args: { p_project_id: string };
        Returns: undefined;
      };
      confirm_payment: {
        Args: { p_project_id: string };
        Returns: undefined;
      };
      hire_creative: {
        Args: {
          p_proposal_id: string;
          p_agreed_price: number;
          p_agreed_deadline: string;
          p_scope: string;
        };
        Returns: string;
      };
      mark_conversation_read: {
        Args: { p_project_id: string; p_creative_workspace_id: string };
        Returns: undefined;
      };
      my_conversations: {
        Args: never;
        Returns: {
          project_id: string;
          project_title: string;
          project_status: Database["public"]["Enums"]["project_status"];
          creative_workspace_id: string;
          brand_workspace_id: string;
          other_name: string;
          other_avatar: string | null;
          i_am_brand: boolean;
          last_body: string | null;
          last_at: string;
          unread: number;
        }[];
      };
      report_payment: {
        Args: { p_project_id: string; p_reference: string; p_note: string };
        Returns: undefined;
      };
      request_revision: {
        Args: { p_project_id: string; p_feedback: string };
        Returns: undefined;
      };
      resubmit_proposal: {
        Args: { p_proposal_id: string };
        Returns: undefined;
      };
      send_message: {
        Args: { p_project_id: string; p_creative_workspace_id: string; p_body: string };
        Returns: string;
      };
      set_project_status: {
        Args: { p_project_id: string; p_status: Database["public"]["Enums"]["project_status"] };
        Returns: undefined;
      };
      set_proposal_status: {
        Args: { p_proposal_id: string; p_status: Database["public"]["Enums"]["proposal_status"] };
        Returns: undefined;
      };
      submit_deliverable: {
        Args: {
          p_project_id: string;
          p_title: string;
          p_note: string;
          p_file_path: string;
          p_file_name: string;
          p_url: string;
        };
        Returns: string;
      };
      submit_review: {
        Args: {
          p_project_id: string;
          p_rating: number;
          p_communication: number;
          p_quality: number;
          p_reliability: number;
          p_comment: string;
        };
        Returns: string;
      };
      withdraw_proposal: {
        Args: { p_proposal_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin";
      project_status:
        | "draft"
        | "published"
        | "in_discussion"
        | "hired"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "in_review"
        | "revision_requested";
      proposal_status: "submitted" | "shortlisted" | "accepted" | "declined" | "withdrawn";
      workspace_type: "creative" | "brand";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      project_status: [
        "draft",
        "published",
        "in_discussion",
        "hired",
        "in_progress",
        "completed",
        "cancelled",
      ],
      proposal_status: ["submitted", "shortlisted", "accepted", "declined", "withdrawn"],
      workspace_type: ["creative", "brand"],
    },
  },
} as const;
