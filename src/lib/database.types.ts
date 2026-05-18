export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      menu_items: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sell_price: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sell_price?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sell_price?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_item_components: {
        Row: {
          id: string;
          menu_item_id: string;
          component_type: 'recipe' | 'ingredient';
          recipe_id: string | null;
          ingredient_id: string | null;
          amount: number;
          amount_unit: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          component_type: 'recipe' | 'ingredient';
          recipe_id?: string | null;
          ingredient_id?: string | null;
          amount: number;
          amount_unit: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          component_type?: 'recipe' | 'ingredient';
          recipe_id?: string | null;
          ingredient_id?: string | null;
          amount?: number;
          amount_unit?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_components_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_item_components_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_item_components_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          id: string;
          name: string;
          default_purchase_price: number;
          purchase_unit: string;
          grams_per_purchase_unit: number;
          cost_per_gram: number;
          recommended_source: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          default_purchase_price?: number;
          purchase_unit: string;
          grams_per_purchase_unit: number;
          recommended_source?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          default_purchase_price?: number;
          purchase_unit?: string;
          grams_per_purchase_unit?: number;
          recommended_source?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          yield_amount: number | null;
          yield_unit: string | null;
          servings: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          yield_amount?: number | null;
          yield_unit?: string | null;
          servings?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          yield_amount?: number | null;
          yield_unit?: string | null;
          servings?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          ingredient_id: string;
          amount: number;
          amount_unit: string;
          grams_used: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          ingredient_id: string;
          amount: number;
          amount_unit: string;
          grams_used: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          ingredient_id?: string;
          amount?: number;
          amount_unit?: string;
          grams_used?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends { Row: infer R }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never;

export type TablesInsert<TableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TableName] extends { Insert: infer I } ? I : never;

export type TablesUpdate<TableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TableName] extends { Update: infer U } ? U : never;
