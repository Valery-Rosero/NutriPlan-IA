
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_generations": {
                  Row: {
                    "created_at": string,"id": number,"input_tokens": number | null,"kind": Database["public"]['Enums']["ai_kind"],"latency_ms": number | null,"model": string,"output_tokens": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"input_tokens"?: number | null,"kind": Database["public"]['Enums']["ai_kind"],"latency_ms"?: number | null,"model": string,"output_tokens"?: number | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"input_tokens"?: number | null,"kind"?: Database["public"]['Enums']["ai_kind"],"latency_ms"?: number | null,"model"?: string,"output_tokens"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_generations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"allergens": {
                  Row: {
                    "code": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: never,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"analytics_events": {
                  Row: {
                    "anonymous_id": string,"app_version": string | null,"event_type": Database["public"]['Enums']["analytics_event"],"id": number,"occurred_at": string,"platform": Database["public"]['Enums']["device_platform"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymous_id": string,"app_version"?: string | null,"event_type": Database["public"]['Enums']["analytics_event"],"id"?: never,"occurred_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"] | null
                  }
                  Update: {
                    "anonymous_id"?: string,"app_version"?: string | null,"event_type"?: Database["public"]['Enums']["analytics_event"],"id"?: never,"occurred_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"] | null
                  }
                  Relationships: [
                    
                  ]
                },"assistant_conversations": {
                  Row: {
                    "created_at": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistant_conversations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assistant_messages": {
                  Row: {
                    "applied_at": string | null,"content": string,"conversation_id": string,"created_at": string,"id": number,"role": Database["public"]['Enums']["chat_role"],"suggested_recipe_id": string | null,"target_planned_meal_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string | null,"content": string,"conversation_id": string,"created_at"?: string,"id"?: never,"role": Database["public"]['Enums']["chat_role"],"suggested_recipe_id"?: string | null,"target_planned_meal_id"?: string | null
                  }
                  Update: {
                    "applied_at"?: string | null,"content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: never,"role"?: Database["public"]['Enums']["chat_role"],"suggested_recipe_id"?: string | null,"target_planned_meal_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistant_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "assistant_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assistant_messages_suggested_recipe_id_fkey"
      columns: ["suggested_recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "assistant_messages_suggested_recipe_id_fkey"
      columns: ["suggested_recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "assistant_messages_suggested_recipe_id_fkey"
      columns: ["suggested_recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assistant_messages_target_planned_meal_id_fkey"
      columns: ["target_planned_meal_id"]
isOneToOne: false
      referencedRelation: "my_plan_conflicts"
      referencedColumns: ["planned_meal_id"]
    },{
      foreignKeyName: "assistant_messages_target_planned_meal_id_fkey"
      columns: ["target_planned_meal_id"]
isOneToOne: false
      referencedRelation: "planned_meals"
      referencedColumns: ["id"]
    }
                  ]
                },"content_reports": {
                  Row: {
                    "comment_id": string | null,"created_at": string,"details": string | null,"id": string,"reason": Database["public"]['Enums']["report_reason"],"recipe_id": string | null,"reporter_id": string,"resolved_at": string | null,"resolved_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "comment_id"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"reason": Database["public"]['Enums']["report_reason"],"recipe_id"?: string | null,"reporter_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null
                  }
                  Update: {
                    "comment_id"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: Database["public"]['Enums']["report_reason"],"recipe_id"?: string | null,"reporter_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_reports_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "recipe_comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_reports_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "content_reports_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "content_reports_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "content_reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"countries": {
                  Row: {
                    "code": string,"currency_code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"currency_code": string,"name": string
                  }
                  Update: {
                    "code"?: string,"currency_code"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cuisines": {
                  Row: {
                    "code": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: never,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"diet_excluded_allergens": {
                  Row: {
                    "allergen_id": number,"diet_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "allergen_id": number,"diet_id": number
                  }
                  Update: {
                    "allergen_id"?: number,"diet_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "diet_excluded_allergens_allergen_id_fkey"
      columns: ["allergen_id"]
isOneToOne: false
      referencedRelation: "allergens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diet_excluded_allergens_diet_id_fkey"
      columns: ["diet_id"]
isOneToOne: false
      referencedRelation: "diets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diet_excluded_allergens_diet_id_fkey"
      columns: ["diet_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["diet_id"]
    }
                  ]
                },"diet_excluded_food_groups": {
                  Row: {
                    "diet_id": number,"food_group_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "diet_id": number,"food_group_id": number
                  }
                  Update: {
                    "diet_id"?: number,"food_group_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "diet_excluded_food_groups_diet_id_fkey"
      columns: ["diet_id"]
isOneToOne: false
      referencedRelation: "diets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diet_excluded_food_groups_diet_id_fkey"
      columns: ["diet_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["diet_id"]
    },{
      foreignKeyName: "diet_excluded_food_groups_food_group_id_fkey"
      columns: ["food_group_id"]
isOneToOne: false
      referencedRelation: "food_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"diets": {
                  Row: {
                    "code": string,"description": string | null,"id": number,"kind": Database["public"]['Enums']["diet_kind"],"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description"?: string | null,"id"?: never,"kind": Database["public"]['Enums']["diet_kind"],"name": string
                  }
                  Update: {
                    "code"?: string,"description"?: string | null,"id"?: never,"kind"?: Database["public"]['Enums']["diet_kind"],"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"favorite_recipes": {
                  Row: {
                    "created_at": string,"recipe_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"recipe_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"recipe_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorite_recipes_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "favorite_recipes_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "favorite_recipes_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorite_recipes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"food_groups": {
                  Row: {
                    "code": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: never,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ingredient_allergens": {
                  Row: {
                    "allergen_id": number,"ingredient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allergen_id": number,"ingredient_id": string
                  }
                  Update: {
                    "allergen_id"?: number,"ingredient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredient_allergens_allergen_id_fkey"
      columns: ["allergen_id"]
isOneToOne: false
      referencedRelation: "allergens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingredient_allergens_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    }
                  ]
                },"ingredient_categories": {
                  Row: {
                    "code": string,"id": number,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: never,"name": string,"sort_order": number
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ingredient_nutrition": {
                  Row: {
                    "carbs_g": number,"fat_g": number,"fiber_g": number,"ingredient_id": string,"kcal": number,"protein_g": number,"reference_url": string | null,"sodium_mg": number,"source": string,"sugar_g": number,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g": number,"fat_g": number,"fiber_g": number,"ingredient_id": string,"kcal": number,"protein_g": number,"reference_url"?: string | null,"sodium_mg": number,"source": string,"sugar_g": number,"verified_at"?: string | null
                  }
                  Update: {
                    "carbs_g"?: number,"fat_g"?: number,"fiber_g"?: number,"ingredient_id"?: string,"kcal"?: number,"protein_g"?: number,"reference_url"?: string | null,"sodium_mg"?: number,"source"?: string,"sugar_g"?: number,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredient_nutrition_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: true
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    }
                  ]
                },"ingredient_prices": {
                  Row: {
                    "id": number,"ingredient_id": string,"observed_on": string,"price_per_kg": number,"region_id": number,"source_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"ingredient_id": string,"observed_on": string,"price_per_kg": number,"region_id": number,"source_id": number
                  }
                  Update: {
                    "id"?: never,"ingredient_id"?: string,"observed_on"?: string,"price_per_kg"?: number,"region_id"?: number,"source_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredient_prices_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingredient_prices_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingredient_prices_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "price_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"ingredient_substitutions": {
                  Row: {
                    "ingredient_id": string,"note": string | null,"ratio": number,"substitute_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ingredient_id": string,"note"?: string | null,"ratio"?: number,"substitute_id": string
                  }
                  Update: {
                    "ingredient_id"?: string,"note"?: string | null,"ratio"?: number,"substitute_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredient_substitutions_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingredient_substitutions_substitute_id_fkey"
      columns: ["substitute_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    }
                  ]
                },"ingredient_unit_weights": {
                  Row: {
                    "grams": number,"ingredient_id": string,"unit_dimension": Database["public"]['Enums']["units_dimension"],"unit_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "grams": number,"ingredient_id": string,"unit_dimension"?: Database["public"]['Enums']["units_dimension"],"unit_id": number
                  }
                  Update: {
                    "grams"?: number,"ingredient_id"?: string,"unit_dimension"?: Database["public"]['Enums']["units_dimension"],"unit_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredient_unit_weights_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingredient_unit_weights_unit_id_unit_dimension_fkey"
      columns: ["unit_id","unit_dimension"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id","dimension"]
    }
                  ]
                },"ingredients": {
                  Row: {
                    "allergens_reviewed_at": string | null,"created_at": string,"density_g_per_ml": number,"food_group_id": number,"heat_level": number,"id": string,"is_staple": boolean,"name": string,"rounding_step": number | null,"shelf_life_days": number | null,"store_category_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "allergens_reviewed_at"?: string | null,"created_at"?: string,"density_g_per_ml"?: number,"food_group_id": number,"heat_level"?: number,"id"?: string,"is_staple"?: boolean,"name": string,"rounding_step"?: number | null,"shelf_life_days"?: number | null,"store_category_id": number
                  }
                  Update: {
                    "allergens_reviewed_at"?: string | null,"created_at"?: string,"density_g_per_ml"?: number,"food_group_id"?: number,"heat_level"?: number,"id"?: string,"is_staple"?: boolean,"name"?: string,"rounding_step"?: number | null,"shelf_life_days"?: number | null,"store_category_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredients_food_group_id_fkey"
      columns: ["food_group_id"]
isOneToOne: false
      referencedRelation: "food_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingredients_store_category_id_fkey"
      columns: ["store_category_id"]
isOneToOne: false
      referencedRelation: "ingredient_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"legal_documents": {
                  Row: {
                    "content_sha256": string | null,"content_url": string | null,"id": number,"kind": Database["public"]['Enums']["legal_doc_kind"],"published_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content_sha256"?: string | null,"content_url"?: string | null,"id"?: never,"kind": Database["public"]['Enums']["legal_doc_kind"],"published_at"?: string,"version": number
                  }
                  Update: {
                    "content_sha256"?: string | null,"content_url"?: string | null,"id"?: never,"kind"?: Database["public"]['Enums']["legal_doc_kind"],"published_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"meal_pantry_deductions": {
                  Row: {
                    "grams": number,"pantry_item_id": string,"planned_meal_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "grams": number,"pantry_item_id": string,"planned_meal_id": string
                  }
                  Update: {
                    "grams"?: number,"pantry_item_id"?: string,"planned_meal_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_pantry_deductions_pantry_item_id_fkey"
      columns: ["pantry_item_id"]
isOneToOne: false
      referencedRelation: "pantry_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_pantry_deductions_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "my_plan_conflicts"
      referencedColumns: ["planned_meal_id"]
    },{
      foreignKeyName: "meal_pantry_deductions_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "planned_meals"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_plans": {
                  Row: {
                    "budget_limit": number | null,"created_at": string,"end_date": string,"id": string,"start_date": string,"status": Database["public"]['Enums']["plan_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_limit"?: number | null,"created_at"?: string,"end_date": string,"id"?: string,"start_date": string,"status"?: Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "budget_limit"?: number | null,"created_at"?: string,"end_date"?: string,"id"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["plan_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_plans_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"medical_conditions": {
                  Row: {
                    "code": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: never,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notification_preferences": {
                  Row: {
                    "expiry_alerts_enabled": boolean,"frequency": Database["public"]['Enums']["notification_frequency"],"meal_reminder_lead_minutes": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expiry_alerts_enabled"?: boolean,"frequency"?: Database["public"]['Enums']["notification_frequency"],"meal_reminder_lead_minutes"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "expiry_alerts_enabled"?: boolean,"frequency"?: Database["public"]['Enums']["notification_frequency"],"meal_reminder_lead_minutes"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "id": number,"kind": Database["public"]['Enums']["notification_kind"],"pantry_item_id": string | null,"planned_meal_id": string | null,"scheduled_for": string,"sent_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"kind": Database["public"]['Enums']["notification_kind"],"pantry_item_id"?: string | null,"planned_meal_id"?: string | null,"scheduled_for": string,"sent_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "id"?: never,"kind"?: Database["public"]['Enums']["notification_kind"],"pantry_item_id"?: string | null,"planned_meal_id"?: string | null,"scheduled_for"?: string,"sent_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_pantry_item_id_fkey"
      columns: ["pantry_item_id"]
isOneToOne: false
      referencedRelation: "pantry_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "my_plan_conflicts"
      referencedColumns: ["planned_meal_id"]
    },{
      foreignKeyName: "notifications_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "planned_meals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"nutritionist_reviews": {
                  Row: {
                    "id": string,"notes": string | null,"outcome": Database["public"]['Enums']["review_outcome"],"recipe_id": string,"reviewed_at": string,"reviewer_id": string | null,"reviewer_license": string | null,"reviewer_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"notes"?: string | null,"outcome": Database["public"]['Enums']["review_outcome"],"recipe_id": string,"reviewed_at"?: string,"reviewer_id"?: string | null,"reviewer_license"?: string | null,"reviewer_name": string
                  }
                  Update: {
                    "id"?: string,"notes"?: string | null,"outcome"?: Database["public"]['Enums']["review_outcome"],"recipe_id"?: string,"reviewed_at"?: string,"reviewer_id"?: string | null,"reviewer_license"?: string | null,"reviewer_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nutritionist_reviews_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "nutritionist_reviews_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "nutritionist_reviews_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nutritionist_reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pantry_items": {
                  Row: {
                    "created_at": string,"expires_on": string | null,"id": string,"ingredient_id": string,"quantity_g": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_on"?: string | null,"id"?: string,"ingredient_id": string,"quantity_g": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_on"?: string | null,"id"?: string,"ingredient_id"?: string,"quantity_g"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pantry_items_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pantry_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"planned_meal_choices": {
                  Row: {
                    "group_key": number,"ingredient_id": string,"is_auto": boolean,"planned_meal_id": string,"recipe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_key": number,"ingredient_id": string,"is_auto"?: boolean,"planned_meal_id": string,"recipe_id": string
                  }
                  Update: {
                    "group_key"?: number,"ingredient_id"?: string,"is_auto"?: boolean,"planned_meal_id"?: string,"recipe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_meal_choices_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "my_plan_conflicts"
      referencedColumns: ["planned_meal_id"]
    },{
      foreignKeyName: "planned_meal_choices_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "planned_meals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meal_choices_recipe_id_group_key_ingredient_id_fkey"
      columns: ["recipe_id","group_key","ingredient_id"]
isOneToOne: false
      referencedRelation: "recipe_flex_options"
      referencedColumns: ["recipe_id","group_key","ingredient_id"]
    }
                  ]
                },"planned_meals": {
                  Row: {
                    "cooked_at": string | null,"created_at": string,"id": string,"meal_date": string,"plan_id": string,"reason_code": string | null,"reason_ingredient_id": string | null,"recipe_id": string,"replaced_recipe_id": string | null,"servings": number,"slot": Database["public"]['Enums']["meal_slot"],"status": Database["public"]['Enums']["meal_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cooked_at"?: string | null,"created_at"?: string,"id"?: string,"meal_date": string,"plan_id": string,"reason_code"?: string | null,"reason_ingredient_id"?: string | null,"recipe_id": string,"replaced_recipe_id"?: string | null,"servings": number,"slot": Database["public"]['Enums']["meal_slot"],"status"?: Database["public"]['Enums']["meal_status"],"updated_at"?: string
                  }
                  Update: {
                    "cooked_at"?: string | null,"created_at"?: string,"id"?: string,"meal_date"?: string,"plan_id"?: string,"reason_code"?: string | null,"reason_ingredient_id"?: string | null,"recipe_id"?: string,"replaced_recipe_id"?: string | null,"servings"?: number,"slot"?: Database["public"]['Enums']["meal_slot"],"status"?: Database["public"]['Enums']["meal_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_meals_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meals_reason_code_fkey"
      columns: ["reason_code"]
isOneToOne: false
      referencedRelation: "recommendation_reasons"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "planned_meals_reason_ingredient_id_fkey"
      columns: ["reason_ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meals_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "planned_meals_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "planned_meals_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meals_replaced_recipe_id_fkey"
      columns: ["replaced_recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "planned_meals_replaced_recipe_id_fkey"
      columns: ["replaced_recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "planned_meals_replaced_recipe_id_fkey"
      columns: ["replaced_recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"price_sources": {
                  Row: {
                    "id": number,"license_notes": string | null,"name": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"license_notes"?: string | null,"name": string,"url"?: string | null
                  }
                  Update: {
                    "id"?: never,"license_notes"?: string | null,"name"?: string,"url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profile_health": {
                  Row: {
                    "activity_level": Database["public"]['Enums']["activity_level"] | null,"birth_year": number | null,"goal": Database["public"]['Enums']["health_goal"] | null,"height_cm": number | null,"sex": Database["public"]['Enums']["sex"] | null,"updated_at": string,"user_id": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"birth_year"?: number | null,"goal"?: Database["public"]['Enums']["health_goal"] | null,"height_cm"?: number | null,"sex"?: Database["public"]['Enums']["sex"] | null,"updated_at"?: string,"user_id": string,"weight_kg"?: number | null
                  }
                  Update: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"birth_year"?: number | null,"goal"?: Database["public"]['Enums']["health_goal"] | null,"height_cm"?: number | null,"sex"?: Database["public"]['Enums']["sex"] | null,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_health_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "adult_declared_at": string | null,"analytics_enabled": boolean,"batch_cooking": boolean,"budget_amount": number | null,"budget_period": Database["public"]['Enums']["budget_period"] | null,"created_at": string,"daily_kcal_target": number | null,"display_name": string | null,"household_size": number,"id": string,"max_cook_minutes": number | null,"onboarding_completed_at": string | null,"prioritize_pantry": boolean,"region_id": number | null,"spice_tolerance": number,"target_protein_pct": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adult_declared_at"?: string | null,"analytics_enabled"?: boolean,"batch_cooking"?: boolean,"budget_amount"?: number | null,"budget_period"?: Database["public"]['Enums']["budget_period"] | null,"created_at"?: string,"daily_kcal_target"?: number | null,"display_name"?: string | null,"household_size"?: number,"id": string,"max_cook_minutes"?: number | null,"onboarding_completed_at"?: string | null,"prioritize_pantry"?: boolean,"region_id"?: number | null,"spice_tolerance"?: number,"target_protein_pct"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "adult_declared_at"?: string | null,"analytics_enabled"?: boolean,"batch_cooking"?: boolean,"budget_amount"?: number | null,"budget_period"?: Database["public"]['Enums']["budget_period"] | null,"created_at"?: string,"daily_kcal_target"?: number | null,"display_name"?: string | null,"household_size"?: number,"id"?: string,"max_cook_minutes"?: number | null,"onboarding_completed_at"?: string | null,"prioritize_pantry"?: boolean,"region_id"?: number | null,"spice_tolerance"?: number,"target_protein_pct"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"protein_sources": {
                  Row: {
                    "code": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: never,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"purchase_items": {
                  Row: {
                    "id": string,"ingredient_id": string | null,"line_amount": number,"purchase_id": string,"quantity_g": number | null,"raw_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"ingredient_id"?: string | null,"line_amount": number,"purchase_id": string,"quantity_g"?: number | null,"raw_text"?: string | null
                  }
                  Update: {
                    "id"?: string,"ingredient_id"?: string | null,"line_amount"?: number,"purchase_id"?: string,"quantity_g"?: number | null,"raw_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_items_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_items_purchase_id_fkey"
      columns: ["purchase_id"]
isOneToOne: false
      referencedRelation: "purchases"
      referencedColumns: ["id"]
    }
                  ]
                },"purchases": {
                  Row: {
                    "created_at": string,"id": string,"purchased_on": string,"shopping_list_id": string | null,"store_name": string | null,"total_amount": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"purchased_on"?: string,"shopping_list_id"?: string | null,"store_name"?: string | null,"total_amount": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"purchased_on"?: string,"shopping_list_id"?: string | null,"store_name"?: string | null,"total_amount"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchases_shopping_list_id_fkey"
      columns: ["shopping_list_id"]
isOneToOne: false
      referencedRelation: "shopping_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchases_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_devices": {
                  Row: {
                    "created_at": string,"expo_push_token": string,"id": string,"last_seen_at": string,"platform": Database["public"]['Enums']["device_platform"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expo_push_token": string,"id"?: string,"last_seen_at"?: string,"platform": Database["public"]['Enums']["device_platform"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expo_push_token"?: string,"id"?: string,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rating_tags": {
                  Row: {
                    "code": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: never,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_comments": {
                  Row: {
                    "body": string,"created_at": string,"hidden_at": string | null,"id": string,"recipe_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"hidden_at"?: string | null,"id"?: string,"recipe_id": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"hidden_at"?: string | null,"id"?: string,"recipe_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_comments_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_comments_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_comments_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_diet_tags": {
                  Row: {
                    "diet_id": number,"diet_kind": Database["public"]['Enums']["diet_kind"],"recipe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "diet_id": number,"diet_kind"?: Database["public"]['Enums']["diet_kind"],"recipe_id": string
                  }
                  Update: {
                    "diet_id"?: number,"diet_kind"?: Database["public"]['Enums']["diet_kind"],"recipe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_diet_tags_diet_id_diet_kind_fkey"
      columns: ["diet_id","diet_kind"]
isOneToOne: false
      referencedRelation: "diets"
      referencedColumns: ["id","kind"]
    },{
      foreignKeyName: "recipe_diet_tags_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_diet_tags_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_diet_tags_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_flex_groups": {
                  Row: {
                    "group_key": number,"label": string,"max_choices": number,"min_choices": number,"recipe_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_key": number,"label": string,"max_choices"?: number,"min_choices"?: number,"recipe_id": string,"sort_order"?: number
                  }
                  Update: {
                    "group_key"?: number,"label"?: string,"max_choices"?: number,"min_choices"?: number,"recipe_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_flex_groups_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_flex_groups_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_flex_groups_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_flex_options": {
                  Row: {
                    "group_key": number,"ingredient_id": string,"is_default": boolean,"notes": string | null,"quantity": number,"recipe_id": string,"scaling_exponent": number,"unit_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_key": number,"ingredient_id": string,"is_default"?: boolean,"notes"?: string | null,"quantity": number,"recipe_id": string,"scaling_exponent"?: number,"unit_id": number
                  }
                  Update: {
                    "group_key"?: number,"ingredient_id"?: string,"is_default"?: boolean,"notes"?: string | null,"quantity"?: number,"recipe_id"?: string,"scaling_exponent"?: number,"unit_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_flex_options_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_flex_options_recipe_id_group_key_fkey"
      columns: ["recipe_id","group_key"]
isOneToOne: false
      referencedRelation: "recipe_flex_groups"
      referencedColumns: ["recipe_id","group_key"]
    },{
      foreignKeyName: "recipe_flex_options_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "ingredient_id": string,"is_optional": boolean,"notes": string | null,"quantity": number,"recipe_id": string,"scaling_exponent": number,"sort_order": number,"unit_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ingredient_id": string,"is_optional"?: boolean,"notes"?: string | null,"quantity": number,"recipe_id": string,"scaling_exponent"?: number,"sort_order"?: number,"unit_id": number
                  }
                  Update: {
                    "ingredient_id"?: string,"is_optional"?: boolean,"notes"?: string | null,"quantity"?: number,"recipe_id"?: string,"scaling_exponent"?: number,"sort_order"?: number,"unit_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_meal_slots": {
                  Row: {
                    "recipe_id": string,"slot": Database["public"]['Enums']["meal_slot"]
                  }
                  ComputedFields: never
                  Insert: {
                    "recipe_id": string,"slot": Database["public"]['Enums']["meal_slot"]
                  }
                  Update: {
                    "recipe_id"?: string,"slot"?: Database["public"]['Enums']["meal_slot"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_meal_slots_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_meal_slots_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_meal_slots_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_rating_tag_links": {
                  Row: {
                    "rating_id": string,"tag_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "rating_id": string,"tag_id": number
                  }
                  Update: {
                    "rating_id"?: string,"tag_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_rating_tag_links_rating_id_fkey"
      columns: ["rating_id"]
isOneToOne: false
      referencedRelation: "recipe_ratings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_rating_tag_links_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "rating_tags"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_ratings": {
                  Row: {
                    "comment": string | null,"id": string,"planned_meal_id": string | null,"rated_at": string,"rating": number,"recipe_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"id"?: string,"planned_meal_id"?: string | null,"rated_at"?: string,"rating": number,"recipe_id": string,"user_id": string
                  }
                  Update: {
                    "comment"?: string | null,"id"?: string,"planned_meal_id"?: string | null,"rated_at"?: string,"rating"?: number,"recipe_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ratings_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: true
      referencedRelation: "my_plan_conflicts"
      referencedColumns: ["planned_meal_id"]
    },{
      foreignKeyName: "recipe_ratings_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: true
      referencedRelation: "planned_meals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ratings_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ratings_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ratings_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ratings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_steps": {
                  Row: {
                    "instruction": string,"recipe_id": string,"step_number": number,"timer_seconds": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "instruction": string,"recipe_id": string,"step_number": number,"timer_seconds"?: number | null
                  }
                  Update: {
                    "instruction"?: string,"recipe_id"?: string,"step_number"?: number,"timer_seconds"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_steps_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_steps_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_steps_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "author_id": string | null,"base_servings": number,"cook_minutes": number,"created_at": string,"cuisine_id": number | null,"description": string | null,"difficulty": number,"id": string,"image_path": string | null,"keeps_days": number | null,"main_protein_id": number | null,"prep_minutes": number,"published_at": string | null,"search_tsv": unknown,"status": Database["public"]['Enums']["recipe_status"],"storage_notes": string | null,"title": string,"total_minutes": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"base_servings": number,"cook_minutes"?: number,"created_at"?: string,"cuisine_id"?: number | null,"description"?: string | null,"difficulty"?: number,"id"?: string,"image_path"?: string | null,"keeps_days"?: number | null,"main_protein_id"?: number | null,"prep_minutes": number,"published_at"?: string | null,"search_tsv"?: never,"status"?: Database["public"]['Enums']["recipe_status"],"storage_notes"?: string | null,"title": string,"total_minutes"?: never,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"base_servings"?: number,"cook_minutes"?: number,"created_at"?: string,"cuisine_id"?: number | null,"description"?: string | null,"difficulty"?: number,"id"?: string,"image_path"?: string | null,"keeps_days"?: number | null,"main_protein_id"?: number | null,"prep_minutes"?: number,"published_at"?: string | null,"search_tsv"?: never,"status"?: Database["public"]['Enums']["recipe_status"],"storage_notes"?: string | null,"title"?: string,"total_minutes"?: never,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_cuisine_id_fkey"
      columns: ["cuisine_id"]
isOneToOne: false
      referencedRelation: "cuisines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_main_protein_id_fkey"
      columns: ["main_protein_id"]
isOneToOne: false
      referencedRelation: "protein_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"recommendation_reasons": {
                  Row: {
                    "code": string,"description": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description": string
                  }
                  Update: {
                    "code"?: string,"description"?: string
                  }
                  Relationships: [
                    
                  ]
                },"regions": {
                  Row: {
                    "code": string,"country_code": string,"id": number,"name": string,"parent_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"country_code": string,"id"?: never,"name": string,"parent_id"?: number | null
                  }
                  Update: {
                    "code"?: string,"country_code"?: string,"id"?: never,"name"?: string,"parent_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "regions_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "regions_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_list_items": {
                  Row: {
                    "checked_at": string | null,"created_at": string,"custom_name": string | null,"id": string,"ingredient_id": string | null,"is_checked": boolean,"list_id": string,"needed_g": number | null,"pantry_g": number,"source": Database["public"]['Enums']["shopping_item_source"],"store_category_id": number | null,"to_buy_g": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string | null,"created_at"?: string,"custom_name"?: string | null,"id"?: string,"ingredient_id"?: string | null,"is_checked"?: boolean,"list_id": string,"needed_g"?: number | null,"pantry_g"?: number,"source"?: Database["public"]['Enums']["shopping_item_source"],"store_category_id"?: number | null,"to_buy_g"?: never
                  }
                  Update: {
                    "checked_at"?: string | null,"created_at"?: string,"custom_name"?: string | null,"id"?: string,"ingredient_id"?: string | null,"is_checked"?: boolean,"list_id"?: string,"needed_g"?: number | null,"pantry_g"?: number,"source"?: Database["public"]['Enums']["shopping_item_source"],"store_category_id"?: number | null,"to_buy_g"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_list_items_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "shopping_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_list_items_store_category_id_fkey"
      columns: ["store_category_id"]
isOneToOne: false
      referencedRelation: "ingredient_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_lists": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"plan_id": string | null,"status": Database["public"]['Enums']["list_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name"?: string,"plan_id"?: string | null,"status"?: Database["public"]['Enums']["list_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"plan_id"?: string | null,"status"?: Database["public"]['Enums']["list_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_lists_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_lists_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "app_version": string | null,"category": Database["public"]['Enums']["ticket_category"],"created_at": string,"device_model": string | null,"id": string,"message": string,"screenshot_path": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"category": Database["public"]['Enums']["ticket_category"],"created_at"?: string,"device_model"?: string | null,"id"?: string,"message": string,"screenshot_path"?: string | null,"user_id": string
                  }
                  Update: {
                    "app_version"?: string | null,"category"?: Database["public"]['Enums']["ticket_category"],"created_at"?: string,"device_model"?: string | null,"id"?: string,"message"?: string,"screenshot_path"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"units": {
                  Row: {
                    "code": string,"dimension": Database["public"]['Enums']["units_dimension"],"factor": number,"id": number,"name": string,"rounding_step": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"dimension": Database["public"]['Enums']["units_dimension"],"factor": number,"id"?: never,"name": string,"rounding_step": number
                  }
                  Update: {
                    "code"?: string,"dimension"?: Database["public"]['Enums']["units_dimension"],"factor"?: number,"id"?: never,"name"?: string,"rounding_step"?: number
                  }
                  Relationships: [
                    
                  ]
                },"user_allergens": {
                  Row: {
                    "allergen_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allergen_id": number,"user_id": string
                  }
                  Update: {
                    "allergen_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_allergens_allergen_id_fkey"
      columns: ["allergen_id"]
isOneToOne: false
      referencedRelation: "allergens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_allergens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_conditions": {
                  Row: {
                    "condition_id": number,"declared_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "condition_id": number,"declared_at"?: string,"user_id": string
                  }
                  Update: {
                    "condition_id"?: number,"declared_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_conditions_condition_id_fkey"
      columns: ["condition_id"]
isOneToOne: false
      referencedRelation: "medical_conditions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_conditions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_consents": {
                  Row: {
                    "accepted_at": string,"document_id": number,"revoked_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"document_id": number,"revoked_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string,"document_id"?: number,"revoked_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_consents_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "legal_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_consents_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "my_pending_consents"
      referencedColumns: ["document_id"]
    },{
      foreignKeyName: "user_consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_cuisines": {
                  Row: {
                    "cuisine_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cuisine_id": number,"user_id": string
                  }
                  Update: {
                    "cuisine_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_cuisines_cuisine_id_fkey"
      columns: ["cuisine_id"]
isOneToOne: false
      referencedRelation: "cuisines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_cuisines_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_diets": {
                  Row: {
                    "diet_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "diet_id": number,"user_id": string
                  }
                  Update: {
                    "diet_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_diets_diet_id_fkey"
      columns: ["diet_id"]
isOneToOne: false
      referencedRelation: "diets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_diets_diet_id_fkey"
      columns: ["diet_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["diet_id"]
    },{
      foreignKeyName: "user_diets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_disliked_ingredients": {
                  Row: {
                    "ingredient_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ingredient_id": string,"user_id": string
                  }
                  Update: {
                    "ingredient_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_disliked_ingredients_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_disliked_ingredients_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_section_order": {
                  Row: {
                    "position": number,"store_category_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "position": number,"store_category_id": number,"user_id": string
                  }
                  Update: {
                    "position"?: number,"store_category_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_section_order_store_category_id_fkey"
      columns: ["store_category_id"]
isOneToOne: false
      referencedRelation: "ingredient_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_section_order_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "my_monthly_spend": {
                  Row: {
                    "month": string | null,"purchases": number | null,"spent": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "purchases_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"my_pending_consents": {
                  Row: {
                    "document_id": number | null,"kind": Database["public"]['Enums']["legal_doc_kind"] | null,"version": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "document_id"?: number | null,"kind"?: Database["public"]['Enums']["legal_doc_kind"] | null,"version"?: number | null
                         }
                        Update: {
                           "document_id"?: number | null,"kind"?: Database["public"]['Enums']["legal_doc_kind"] | null,"version"?: number | null
                         }
                        Relationships: [
                    
                  ]
                },"my_plan_conflicts": {
                  Row: {
                    "conflict": string | null,"meal_date": string | null,"plan_id": string | null,"planned_meal_id": string | null,"recipe_id": string | null,"slot": Database["public"]['Enums']["meal_slot"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "planned_meals_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meals_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "planned_meals_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "planned_meals_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_allergens": {
                  Row: {
                    "allergen_id": number | null,"only_in_options": boolean | null,"recipe_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"recipe_diets": {
                  Row: {
                    "diet_id": number | null,"recipe_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"recipe_max_heat": {
                  Row: {
                    "heat_level": number | null,"recipe_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_nutrition": {
                  Row: {
                    "carbs_g_per_serving": number | null,"fat_g_per_serving": number | null,"fiber_g_per_serving": number | null,"ingredients_missing_nutrition": number | null,"kcal_per_serving": number | null,"protein_g_per_serving": number | null,"recipe_id": string | null,"sodium_mg_per_serving": number | null,"sugar_g_per_serving": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"recipe_rating_stats": {
                  Row: {
                    "avg_rating": number | null,"ratings_count": number | null,"recipe_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "recipe_ratings_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_diets"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ratings_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ratings_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_consent":
{ Args: { "p_document_id": number }; Returns: undefined
                           },
"add_to_pantry":
{ Args: { "p_expires_on"?: string,"p_ingredient_id": string,"p_quantity": number,"p_unit_id": number }; Returns: {
              "created_at": string,
"expires_on": string | null,
"id": string,
"ingredient_id": string,
"quantity_g": number,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "pantry_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"apply_assistant_suggestion":
{ Args: { "p_message_id": number }; Returns: string
                           },
"cook_now":
{ Args: { "p_choices"?: Json,"p_recipe_id": string,"p_servings": number,"p_slot": Database["public"]['Enums']["meal_slot"] }; Returns: Json
                           },
"cook_with_what_i_have":
{ Args: { "p_limit"?: number,"p_servings"?: number,"p_slot"?: Database["public"]['Enums']["meal_slot"] }; Returns: {
              "coverage": number,"missing": Json,"missing_count": number,"recipe_id": string,"title": string,"total_minutes": number,"uses_expiring": boolean
            }[]
                           },
"eligible_recipes":
{ Args: { "p_max_minutes"?: number,"p_slot"?: Database["public"]['Enums']["meal_slot"] }; Returns: {
              "author_id": string | null,
"base_servings": number,
"cook_minutes": number,
"created_at": string,
"cuisine_id": number | null,
"description": string | null,
"difficulty": number,
"id": string,
"image_path": string | null,
"keeps_days": number | null,
"main_protein_id": number | null,
"prep_minutes": number,
"published_at": string | null,
"search_tsv": unknown,
"status": Database["public"]['Enums']["recipe_status"],
"storage_notes": string | null,
"title": string,
"total_minutes": number | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "recipes"
        isOneToOne: false
        isSetofReturn: true
      } },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"generate_shopping_list":
{ Args: { "p_plan_id": string }; Returns: string
                           },
"mark_meal_cooked":
{ Args: { "p_planned_meal_id": string }; Returns: Json
                           },
"plan_budget_status":
{ Args: { "p_plan_id": string }; Returns: {
              "budget_limit": number,"currency_code": string,"estimated_cost": number,"estimated_prices": number,"missing_prices": number,"over_by": number
            }[]
                           },
"preview_recipe":
{ Args: { "p_choices"?: Json,"p_recipe_id": string,"p_servings": number }; Returns: Json
                           },
"recipe_cost":
{ Args: { "p_recipe_id": string,"p_region_id": number,"p_servings"?: number }; Returns: {
              "cost": number,"currency_code": string,"estimated_prices": number,"missing_prices": number
            }[]
                           },
"recipe_flex_menu":
{ Args: { "p_planned_meal_id"?: string,"p_recipe_id": string }; Returns: {
              "group_key": number,"group_label": string,"in_pantry": boolean,"ingredient_id": string,"ingredient_name": string,"is_default": boolean,"max_choices": number,"min_choices": number,"selected": boolean
            }[]
                           },
"recipe_pantry_match":
{ Args: { "p_recipe_id": string }; Returns: {
              "coverage": number,"matched_ingredients": number,"total_ingredients": number
            }[]
                           },
"recipes_using_expiring_ingredients":
{ Args: { "p_within_days"?: number }; Returns: {
              "days_left": number,"expires_on": string,"ingredient_id": string,"ingredient_name": string,"pantry_item_id": string,"recipe_id": string,"recipe_title": string
            }[]
                           },
"revoke_consent":
{ Args: { "p_kind": Database["public"]['Enums']["legal_doc_kind"] }; Returns: Json
                           },
"save_generated_plan":
{ Args: { "p_budget_limit"?: number,"p_end": string,"p_meals": Json,"p_start": string }; Returns: string
                           },
"scale_planned_meal":
{ Args: { "p_planned_meal_id": string }; Returns: {
              "grams": number,"group_key": number,"group_label": string,"ingredient_id": string,"ingredient_name": string,"is_optional": boolean,"quantity": number,"unit_code": string,"unit_id": number
            }[]
                           },
"scale_recipe":
{ Args: { "p_recipe_id": string,"p_servings": number }; Returns: {
              "grams": number,"group_key": number,"group_label": string,"ingredient_id": string,"ingredient_name": string,"is_optional": boolean,"quantity": number,"unit_code": string,"unit_id": number
            }[]
                           },
"search_ingredients":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "allergens_reviewed_at": string | null,
"created_at": string,
"density_g_per_ml": number,
"food_group_id": number,
"heat_level": number,
"id": string,
"is_staple": boolean,
"name": string,
"rounding_step": number | null,
"shelf_life_days": number | null,
"store_category_id": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "ingredients"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_meal_choices":
{ Args: { "p_group_key": number,"p_ingredient_ids": (string)[],"p_planned_meal_id": string }; Returns: undefined
                           },
"set_my_restrictions":
{ Args: { "p_allergen_ids": (number)[],"p_diet_ids": (number)[] }; Returns: undefined
                           },
"suggest_substitutes":
{ Args: { "p_ingredient_id": string }; Returns: {
              "note": string,"ratio": number,"substitute_id": string,"substitute_name": string
            }[]
                           },
"undo_meal_cooked":
{ Args: { "p_planned_meal_id": string,"p_window"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "activity_level": "sedentary"|"light"|"moderate"|"active"|"very_active","ai_kind": "plan"|"swap"|"chat","analytics_event": "onboarding_completed"|"plan_generated"|"shopping_list_generated"|"meal_cooked","app_role": "moderator"|"nutritionist"|"admin","budget_period": "week"|"month","chat_role": "user"|"assistant","device_platform": "ios"|"android","diet_kind": "rule_based"|"curated","health_goal": "lose_weight"|"maintain"|"gain_muscle"|"eat_healthier"|"save_time","legal_doc_kind": "privacy_policy"|"terms"|"health_disclaimer"|"community_sharing"|"sensitive_data_authorization","list_status": "active"|"completed","meal_slot": "breakfast"|"lunch"|"dinner"|"snack","meal_status": "planned"|"cooked"|"skipped","notification_frequency": "none"|"weekly_summary"|"daily","notification_kind": "meal_reminder"|"expiry_alert"|"weekly_summary","plan_status": "draft"|"confirmed"|"archived","recipe_status": "draft"|"in_review"|"published"|"rejected","report_reason": "spam"|"dangerous_advice"|"offensive"|"other","review_outcome": "approved"|"rejected","sex": "female"|"male"|"prefer_not_say","shopping_item_source": "plan"|"manual","ticket_category": "bug"|"suggestion","units_dimension": "mass"|"volume"|"count"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "activity_level": ["sedentary", "light", "moderate", "active", "very_active"],"ai_kind": ["plan", "swap", "chat"],"analytics_event": ["onboarding_completed", "plan_generated", "shopping_list_generated", "meal_cooked"],"app_role": ["moderator", "nutritionist", "admin"],"budget_period": ["week", "month"],"chat_role": ["user", "assistant"],"device_platform": ["ios", "android"],"diet_kind": ["rule_based", "curated"],"health_goal": ["lose_weight", "maintain", "gain_muscle", "eat_healthier", "save_time"],"legal_doc_kind": ["privacy_policy", "terms", "health_disclaimer", "community_sharing", "sensitive_data_authorization"],"list_status": ["active", "completed"],"meal_slot": ["breakfast", "lunch", "dinner", "snack"],"meal_status": ["planned", "cooked", "skipped"],"notification_frequency": ["none", "weekly_summary", "daily"],"notification_kind": ["meal_reminder", "expiry_alert", "weekly_summary"],"plan_status": ["draft", "confirmed", "archived"],"recipe_status": ["draft", "in_review", "published", "rejected"],"report_reason": ["spam", "dangerous_advice", "offensive", "other"],"review_outcome": ["approved", "rejected"],"sex": ["female", "male", "prefer_not_say"],"shopping_item_source": ["plan", "manual"],"ticket_category": ["bug", "suggestion"],"units_dimension": ["mass", "volume", "count"]
          }
        }
} as const
