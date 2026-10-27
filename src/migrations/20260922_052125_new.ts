import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('guest', 'partner', 'admin');
  CREATE TYPE "public"."enum_users_partner_profile_payout_method" AS ENUM('bkash', 'nagad', 'bank');
  CREATE TYPE "public"."enum_media_purpose" AS ENUM('property_photo', 'room_photo', 'avatar', 'locality_hero', 'branding', 'payment_proof', 'invoice');
  CREATE TYPE "public"."enum_properties_trust_badges" AS ENUM('platform_serviced', 'listing_network', 'new_listing', 'free_cancellation', 'breakfast_included', 'flagged');
  CREATE TYPE "public"."enum_properties_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'suspended');
  CREATE TYPE "public"."enum_properties_property_type" AS ENUM('hotel', 'resort');
  CREATE TYPE "public"."enum_properties_tier" AS ENUM('budget', 'standard', 'premium', 'flagship');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending_payment', 'confirmed', 'checked_in', 'checked_out', 'cancelled_by_guest', 'cancelled_by_partner', 'no_show');
  CREATE TYPE "public"."enum_payments_purpose" AS ENUM('booking_payment', 'subscription_payment', 'refund');
  CREATE TYPE "public"."enum_payments_gateway" AS ENUM('bkash', 'nagad', 'sslcommerz', 'aamarpay', 'bank_transfer', 'manual');
  CREATE TYPE "public"."enum_payments_status" AS ENUM('initiated', 'pending', 'success', 'failed', 'cancelled', 'refunded');
  CREATE TYPE "public"."enum_payouts_status" AS ENUM('requested', 'approved', 'processing', 'paid', 'rejected');
  CREATE TYPE "public"."enum_payouts_method" AS ENUM('bkash', 'nagad', 'bank');
  CREATE TYPE "public"."enum_coupons_discount_type" AS ENUM('percent', 'fixed');
  CREATE TYPE "public"."enum_coupons_scope" AS ENUM('all_properties', 'specific_properties', 'tier', 'city');
  CREATE TYPE "public"."enum_coupons_scope_tier" AS ENUM('budget', 'standard', 'premium', 'flagship');
  CREATE TYPE "public"."enum_loyalty_points_type" AS ENUM('earn', 'redeem', 'expire', 'reverse', 'adjust');
  CREATE TYPE "public"."enum_property_subscriptions_status" AS ENUM('pending_payment', 'active', 'expired', 'cancelled');
  CREATE TYPE "public"."enum_sms_logs_purpose" AS ENUM('otp_verification', 'booking_confirmation', 'booking_cancellation', 'payment_status', 'partner_notification', 'balance_alert');
  CREATE TYPE "public"."enum_sms_logs_delivery_status" AS ENUM('queued', 'pending', 'sent', 'delivered', 'failed', 'unknown');
  CREATE TYPE "public"."enum_email_logs_status" AS ENUM('sent', 'delivered', 'bounced', 'complained', 'failed');
  CREATE TYPE "public"."enum_pages_blocks_hero_links_style" AS ENUM('primary', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_rich_text_width" AS ENUM('prose', 'wide');
  CREATE TYPE "public"."enum_pages_blocks_property_grid_source" AS ENUM('featured', 'city', 'manual');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_links_style" AS ENUM('primary', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_rich_text_width" AS ENUM('prose', 'wide');
  CREATE TYPE "public"."enum__pages_v_blocks_property_grid_source" AS ENUM('featured', 'city', 'manual');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'expireAbandonedBookings', 'expirePoints', 'expireSubscriptions', 'recomputeSocialProof', 'updateNewListingBadges', 'pollSmsDeliveryStatus', 'checkSmsBalance', 'syncSearchIndex', 'generateAndSendInvoice');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'expireAbandonedBookings', 'expirePoints', 'expireSubscriptions', 'recomputeSocialProof', 'updateNewListingBadges', 'pollSmsDeliveryStatus', 'checkSmsBalance', 'syncSearchIndex', 'generateAndSendInvoice');
  CREATE TYPE "public"."enum_platform_settings_payment_gateways_bkash_mode" AS ENUM('sandbox', 'live');
  CREATE TYPE "public"."enum_platform_settings_payment_gateways_nagad_mode" AS ENUM('sandbox', 'live');
  CREATE TYPE "public"."enum_platform_settings_payment_gateways_sslcommerz_mode" AS ENUM('sandbox', 'live');
  CREATE TYPE "public"."enum_platform_settings_payment_gateways_aamarpay_mode" AS ENUM('sandbox', 'live');
  CREATE TYPE "public"."enum_integration_settings_email_provider" AS ENUM('resend');
  CREATE TYPE "public"."enum_integration_settings_sms_provider" AS ENUM('smsbd');
  CREATE TYPE "public"."enum_analytics_settings_external_scripts_strategy" AS ENUM('afterInteractive', 'lazyOnload', 'beforeInteractive');
  CREATE TYPE "public"."enum_analytics_settings_inline_snippets_strategy" AS ENUM('afterInteractive', 'lazyOnload', 'beforeInteractive');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"role" "enum_users_role" DEFAULT 'guest' NOT NULL,
  	"points_balance" numeric DEFAULT 0,
  	"avatar_id" integer,
  	"partner_profile_business_name" varchar,
  	"partner_profile_nid_number" varchar,
  	"partner_profile_payout_method" "enum_users_partner_profile_payout_method",
  	"partner_profile_payout_account_number" varchar,
  	"partner_profile_bank_details_bank_name" varchar,
  	"partner_profile_bank_details_account_name" varchar,
  	"partner_profile_bank_details_account_number" varchar,
  	"partner_profile_bank_details_branch_name" varchar,
  	"partner_profile_bank_details_routing_number" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media_purpose" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_media_purpose",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"uploaded_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "amenities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"icon" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "localities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"city" varchar NOT NULL,
  	"description" varchar,
  	"location" geometry(Point),
  	"is_popular" boolean DEFAULT false,
  	"hero_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "properties_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "properties_videos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL,
  	"title" varchar
  );
  
  CREATE TABLE "properties_trust_badges" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_properties_trust_badges",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "properties" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"description" jsonb,
  	"partner_id" integer NOT NULL,
  	"status" "enum_properties_status" DEFAULT 'draft',
  	"property_type" "enum_properties_property_type" DEFAULT 'hotel',
  	"tier" "enum_properties_tier" DEFAULT 'standard',
  	"star_rating" numeric,
  	"hero_image_id" integer,
  	"address_street_address" varchar,
  	"address_area" varchar,
  	"address_city" varchar NOT NULL,
  	"address_postcode" varchar,
  	"address_country" varchar DEFAULT 'Bangladesh',
  	"locality_id" integer,
  	"location" geometry(Point),
  	"contact_phone" varchar,
  	"contact_email" varchar,
  	"policies_check_in_time" varchar DEFAULT '14:00',
  	"policies_check_out_time" varchar DEFAULT '12:00',
  	"policies_cancellation_policy" varchar,
  	"commission_rate_override" numeric,
  	"flagged_warning_note" varchar,
  	"social_proof_bookings_today" numeric DEFAULT 0,
  	"social_proof_bookings_last6_hours" numeric DEFAULT 0,
  	"is_featured" boolean DEFAULT false,
  	"featured_priority" numeric DEFAULT 0,
  	"featured_until" timestamp(3) with time zone,
  	"avg_rating" numeric DEFAULT 0,
  	"review_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "properties_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"amenities_id" integer
  );
  
  CREATE TABLE "room_types_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "room_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"property_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"base_price" numeric NOT NULL,
  	"compare_at_price" numeric,
  	"max_occupancy" numeric DEFAULT 2,
  	"bed_configuration" varchar,
  	"size_sqft" numeric,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "room_types_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"amenities_id" integer
  );
  
  CREATE TABLE "rooms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"property_id" integer NOT NULL,
  	"room_type_id" integer NOT NULL,
  	"room_number" varchar NOT NULL,
  	"floor" numeric,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"room_type_id" integer NOT NULL,
  	"room_id" integer NOT NULL,
  	"nightly_rate" numeric,
  	"nights" numeric,
  	"line_subtotal" numeric
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_ref" varchar,
  	"guest_id" integer NOT NULL,
  	"property_id" integer NOT NULL,
  	"room_type_id" integer,
  	"room_id" integer,
  	"check_in_date" timestamp(3) with time zone NOT NULL,
  	"check_out_date" timestamp(3) with time zone NOT NULL,
  	"adults" numeric DEFAULT 2,
  	"children" numeric DEFAULT 0,
  	"status" "enum_bookings_status" DEFAULT 'pending_payment',
  	"currency" varchar,
  	"pricing_nights" numeric,
  	"pricing_subtotal" numeric,
  	"pricing_commission_rate" numeric,
  	"pricing_commission_amount" numeric,
  	"pricing_partner_payout_amount" numeric,
  	"pricing_coupon_discount_amount" numeric,
  	"pricing_points_discount_amount" numeric,
  	"pricing_total_amount" numeric,
  	"coupon_applied_id" integer,
  	"points_redeemed" numeric DEFAULT 0,
  	"guest_phone" varchar,
  	"special_requests" varchar,
  	"invoice_pdf_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"purpose" "enum_payments_purpose" NOT NULL,
  	"gateway" "enum_payments_gateway" NOT NULL,
  	"status" "enum_payments_status" DEFAULT 'initiated' NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" varchar DEFAULT 'BDT',
  	"booking_id" integer,
  	"property_subscription_id" integer,
  	"transaction_id" varchar,
  	"gateway_request_id" varchar,
  	"gateway_metadata" jsonb,
  	"bank_transfer_details_sender_name" varchar,
  	"bank_transfer_details_sender_account_number" varchar,
  	"bank_transfer_details_transfer_reference" varchar,
  	"bank_transfer_details_receipt_id" integer,
  	"bank_transfer_details_paid_at" timestamp(3) with time zone,
  	"verified_by_id" integer,
  	"verified_at" timestamp(3) with time zone,
  	"refunded_amount" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payouts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"partner_id" integer NOT NULL,
  	"amount" numeric NOT NULL,
  	"status" "enum_payouts_status" DEFAULT 'requested' NOT NULL,
  	"method" "enum_payouts_method" NOT NULL,
  	"destination_account_number" varchar,
  	"destination_account_name" varchar,
  	"destination_bank_name" varchar,
  	"destination_branch_name" varchar,
  	"destination_routing_number" varchar,
  	"balance_at_request" numeric,
  	"requested_at" timestamp(3) with time zone,
  	"reference" varchar,
  	"paid_at" timestamp(3) with time zone,
  	"processed_at" timestamp(3) with time zone,
  	"processed_by_id" integer,
  	"notes" varchar,
  	"admin_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_id" integer NOT NULL,
  	"guest_id" integer NOT NULL,
  	"property_id" integer NOT NULL,
  	"rating" numeric NOT NULL,
  	"cleanliness_rating" numeric,
  	"location_rating" numeric,
  	"service_rating" numeric,
  	"title" varchar,
  	"comment" varchar,
  	"partner_reply" varchar,
  	"replied_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"description" varchar,
  	"active" boolean DEFAULT true,
  	"valid_from" timestamp(3) with time zone,
  	"valid_until" timestamp(3) with time zone,
  	"discount_type" "enum_coupons_discount_type" DEFAULT 'percent' NOT NULL,
  	"discount_value" numeric NOT NULL,
  	"max_discount_amount" numeric,
  	"min_booking_amount" numeric,
  	"usage_limit_total" numeric,
  	"uses_per_user" numeric DEFAULT 1,
  	"first_booking_only" boolean DEFAULT false,
  	"scope" "enum_coupons_scope" DEFAULT 'all_properties' NOT NULL,
  	"scope_tier" "enum_coupons_scope_tier",
  	"scope_city" varchar,
  	"current_usage_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"properties_id" integer
  );
  
  CREATE TABLE "loyalty_points" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"type" "enum_loyalty_points_type" NOT NULL,
  	"amount" numeric NOT NULL,
  	"source_booking_id" integer,
  	"expires_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscription_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"price" numeric NOT NULL,
  	"duration_days" numeric DEFAULT 30 NOT NULL,
  	"benefits_priority_score" numeric DEFAULT 10 NOT NULL,
  	"benefits_is_featured" boolean DEFAULT true,
  	"benefits_badge_text" varchar,
  	"active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "property_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"property_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"status" "enum_property_subscriptions_status" DEFAULT 'pending_payment' NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sms_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"purpose" "enum_sms_logs_purpose" NOT NULL,
  	"gateway_request_id" varchar,
  	"delivery_status" "enum_sms_logs_delivery_status" DEFAULT 'queued',
  	"error_code" numeric,
  	"error_message" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"related_booking_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"to" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"template" varchar,
  	"resend_email_id" varchar,
  	"status" "enum_email_logs_status" DEFAULT 'sent',
  	"last_event_at" timestamp(3) with time zone,
  	"error" varchar,
  	"related_booking_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wishlist" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"guest_id" integer NOT NULL,
  	"property_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"style" "enum_pages_blocks_hero_links_style" DEFAULT 'primary'
  );
  
  CREATE TABLE "pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"content" jsonb,
  	"width" "enum_pages_blocks_rich_text_width" DEFAULT 'prose',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "pages_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Frequently asked questions',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"label" varchar,
  	"href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_property_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Stays to consider',
  	"subheading" varchar,
  	"source" "enum_pages_blocks_property_grid_source" DEFAULT 'featured',
  	"city" varchar,
  	"limit" numeric DEFAULT 6,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"show_title" boolean DEFAULT true,
  	"show_in_footer" boolean DEFAULT false,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"seo_noindex" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"properties_id" integer
  );
  
  CREATE TABLE "_pages_v_blocks_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"style" "enum__pages_v_blocks_hero_links_style" DEFAULT 'primary',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"content" jsonb,
  	"width" "enum__pages_v_blocks_rich_text_width" DEFAULT 'prose',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Frequently asked questions',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"label" varchar,
  	"href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_property_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Stays to consider',
  	"subheading" varchar,
  	"source" "enum__pages_v_blocks_property_grid_source" DEFAULT 'featured',
  	"city" varchar,
  	"limit" numeric DEFAULT 6,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_show_title" boolean DEFAULT true,
  	"version_show_in_footer" boolean DEFAULT false,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"properties_id" integer
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"amenities_id" integer,
  	"localities_id" integer,
  	"properties_id" integer,
  	"room_types_id" integer,
  	"rooms_id" integer,
  	"bookings_id" integer,
  	"payments_id" integer,
  	"payouts_id" integer,
  	"reviews_id" integer,
  	"coupons_id" integer,
  	"loyalty_points_id" integer,
  	"subscription_plans_id" integer,
  	"property_subscriptions_id" integer,
  	"sms_logs_id" integer,
  	"email_logs_id" integer,
  	"wishlist_id" integer,
  	"pages_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "platform_settings_bank_transfer_accounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"bank_name" varchar NOT NULL,
  	"account_name" varchar NOT NULL,
  	"account_number" varchar NOT NULL,
  	"branch_name" varchar,
  	"routing_number" varchar
  );
  
  CREATE TABLE "platform_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"platform_name" varchar DEFAULT 'Hotel Booking Platform',
  	"branding_header_logo_id" integer,
  	"branding_footer_logo_id" integer,
  	"branding_logo_alt" varchar,
  	"default_commission_rate" numeric DEFAULT 10 NOT NULL,
  	"currency" varchar DEFAULT 'BDT',
  	"loyalty_program_enabled" boolean DEFAULT true,
  	"loyalty_program_earn_rate_per100_spent" numeric DEFAULT 1,
  	"loyalty_program_redeem_rate" numeric DEFAULT 0.5,
  	"loyalty_program_points_expire_after_days" numeric DEFAULT 365,
  	"loyalty_program_min_redeem_points" numeric DEFAULT 100,
  	"loyalty_program_max_redeem_percent_of_booking" numeric DEFAULT 50,
  	"payment_gateways_bkash_enabled" boolean DEFAULT false,
  	"payment_gateways_bkash_mode" "enum_platform_settings_payment_gateways_bkash_mode" DEFAULT 'sandbox',
  	"payment_gateways_nagad_enabled" boolean DEFAULT false,
  	"payment_gateways_nagad_mode" "enum_platform_settings_payment_gateways_nagad_mode" DEFAULT 'sandbox',
  	"payment_gateways_sslcommerz_enabled" boolean DEFAULT false,
  	"payment_gateways_sslcommerz_mode" "enum_platform_settings_payment_gateways_sslcommerz_mode" DEFAULT 'sandbox',
  	"payment_gateways_aamarpay_enabled" boolean DEFAULT false,
  	"payment_gateways_aamarpay_mode" "enum_platform_settings_payment_gateways_aamarpay_mode" DEFAULT 'sandbox',
  	"booking_hold_grace_minutes" numeric DEFAULT 30,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "integration_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bkash_base_url" varchar,
  	"bkash_app_key" varchar,
  	"bkash_app_secret" varchar,
  	"bkash_username" varchar,
  	"bkash_password" varchar,
  	"nagad_base_url" varchar,
  	"nagad_merchant_id" varchar,
  	"nagad_callback_url" varchar,
  	"nagad_private_key_pem" varchar,
  	"nagad_public_key_pem" varchar,
  	"sslcommerz_base_url" varchar,
  	"sslcommerz_store_id" varchar,
  	"sslcommerz_store_password" varchar,
  	"aamarpay_base_url" varchar,
  	"aamarpay_store_id" varchar,
  	"aamarpay_signature_key" varchar,
  	"email_provider" "enum_integration_settings_email_provider" DEFAULT 'resend',
  	"email_api_key" varchar,
  	"email_from_address" varchar,
  	"email_from_name" varchar,
  	"email_webhook_secret" varchar,
  	"sms_provider" "enum_integration_settings_sms_provider" DEFAULT 'smsbd',
  	"sms_api_key" varchar,
  	"sms_base_url" varchar,
  	"sms_sender_id" varchar,
  	"sms_balance_threshold" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "analytics_settings_external_scripts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"src" varchar NOT NULL,
  	"strategy" "enum_analytics_settings_external_scripts_strategy" DEFAULT 'afterInteractive'
  );
  
  CREATE TABLE "analytics_settings_inline_snippets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"code" varchar NOT NULL,
  	"strategy" "enum_analytics_settings_inline_snippets_strategy" DEFAULT 'afterInteractive'
  );
  
  CREATE TABLE "analytics_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"google_tag_manager_id" varchar,
  	"google_analytics_id" varchar,
  	"meta_pixel_id" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media_purpose" ADD CONSTRAINT "media_purpose_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "localities" ADD CONSTRAINT "localities_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_images" ADD CONSTRAINT "properties_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_images" ADD CONSTRAINT "properties_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_videos" ADD CONSTRAINT "properties_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_trust_badges" ADD CONSTRAINT "properties_trust_badges_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties" ADD CONSTRAINT "properties_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties" ADD CONSTRAINT "properties_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties" ADD CONSTRAINT "properties_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_rels" ADD CONSTRAINT "properties_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_rels" ADD CONSTRAINT "properties_rels_amenities_fk" FOREIGN KEY ("amenities_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "room_types_images" ADD CONSTRAINT "room_types_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "room_types_images" ADD CONSTRAINT "room_types_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "room_types" ADD CONSTRAINT "room_types_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "room_types_rels" ADD CONSTRAINT "room_types_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "room_types_rels" ADD CONSTRAINT "room_types_rels_amenities_fk" FOREIGN KEY ("amenities_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings_items" ADD CONSTRAINT "bookings_items_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings_items" ADD CONSTRAINT "bookings_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings_items" ADD CONSTRAINT "bookings_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coupon_applied_id_coupons_id_fk" FOREIGN KEY ("coupon_applied_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_invoice_pdf_id_media_id_fk" FOREIGN KEY ("invoice_pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_property_subscription_id_property_subscriptions_id_fk" FOREIGN KEY ("property_subscription_id") REFERENCES "public"."property_subscriptions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_transfer_details_receipt_id_media_id_fk" FOREIGN KEY ("bank_transfer_details_receipt_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payouts" ADD CONSTRAINT "payouts_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payouts" ADD CONSTRAINT "payouts_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_source_booking_id_bookings_id_fk" FOREIGN KEY ("source_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "property_subscriptions" ADD CONSTRAINT "property_subscriptions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "property_subscriptions" ADD CONSTRAINT "property_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_related_booking_id_bookings_id_fk" FOREIGN KEY ("related_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_related_booking_id_bookings_id_fk" FOREIGN KEY ("related_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_links" ADD CONSTRAINT "pages_blocks_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_rich_text" ADD CONSTRAINT "pages_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_block" ADD CONSTRAINT "pages_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_block" ADD CONSTRAINT "pages_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_gallery" ADD CONSTRAINT "pages_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_items" ADD CONSTRAINT "pages_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq" ADD CONSTRAINT "pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_property_grid" ADD CONSTRAINT "pages_blocks_property_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_links" ADD CONSTRAINT "_pages_v_blocks_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_rich_text" ADD CONSTRAINT "_pages_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_block" ADD CONSTRAINT "_pages_v_blocks_image_block_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_block" ADD CONSTRAINT "_pages_v_blocks_image_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_gallery_images" ADD CONSTRAINT "_pages_v_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_gallery_images" ADD CONSTRAINT "_pages_v_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_gallery" ADD CONSTRAINT "_pages_v_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_items" ADD CONSTRAINT "_pages_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq" ADD CONSTRAINT "_pages_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta" ADD CONSTRAINT "_pages_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_property_grid" ADD CONSTRAINT "_pages_v_blocks_property_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_amenities_fk" FOREIGN KEY ("amenities_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_localities_fk" FOREIGN KEY ("localities_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_room_types_fk" FOREIGN KEY ("room_types_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rooms_fk" FOREIGN KEY ("rooms_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payments_fk" FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payouts_fk" FOREIGN KEY ("payouts_id") REFERENCES "public"."payouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_loyalty_points_fk" FOREIGN KEY ("loyalty_points_id") REFERENCES "public"."loyalty_points"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscription_plans_fk" FOREIGN KEY ("subscription_plans_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_property_subscriptions_fk" FOREIGN KEY ("property_subscriptions_id") REFERENCES "public"."property_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sms_logs_fk" FOREIGN KEY ("sms_logs_id") REFERENCES "public"."sms_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_logs_fk" FOREIGN KEY ("email_logs_id") REFERENCES "public"."email_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wishlist_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlist"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "platform_settings_bank_transfer_accounts" ADD CONSTRAINT "platform_settings_bank_transfer_accounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."platform_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_branding_header_logo_id_media_id_fk" FOREIGN KEY ("branding_header_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_branding_footer_logo_id_media_id_fk" FOREIGN KEY ("branding_footer_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "analytics_settings_external_scripts" ADD CONSTRAINT "analytics_settings_external_scripts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings_inline_snippets" ADD CONSTRAINT "analytics_settings_inline_snippets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_purpose_order_idx" ON "media_purpose" USING btree ("order");
  CREATE INDEX "media_purpose_parent_idx" ON "media_purpose" USING btree ("parent_id");
  CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE UNIQUE INDEX "amenities_name_idx" ON "amenities" USING btree ("name");
  CREATE INDEX "amenities_updated_at_idx" ON "amenities" USING btree ("updated_at");
  CREATE INDEX "amenities_created_at_idx" ON "amenities" USING btree ("created_at");
  CREATE INDEX "localities_city_idx" ON "localities" USING btree ("city");
  CREATE INDEX "localities_hero_image_idx" ON "localities" USING btree ("hero_image_id");
  CREATE INDEX "localities_updated_at_idx" ON "localities" USING btree ("updated_at");
  CREATE INDEX "localities_created_at_idx" ON "localities" USING btree ("created_at");
  CREATE INDEX "properties_images_order_idx" ON "properties_images" USING btree ("_order");
  CREATE INDEX "properties_images_parent_id_idx" ON "properties_images" USING btree ("_parent_id");
  CREATE INDEX "properties_images_image_idx" ON "properties_images" USING btree ("image_id");
  CREATE INDEX "properties_videos_order_idx" ON "properties_videos" USING btree ("_order");
  CREATE INDEX "properties_videos_parent_id_idx" ON "properties_videos" USING btree ("_parent_id");
  CREATE INDEX "properties_trust_badges_order_idx" ON "properties_trust_badges" USING btree ("order");
  CREATE INDEX "properties_trust_badges_parent_idx" ON "properties_trust_badges" USING btree ("parent_id");
  CREATE UNIQUE INDEX "properties_slug_idx" ON "properties" USING btree ("slug");
  CREATE INDEX "properties_partner_idx" ON "properties" USING btree ("partner_id");
  CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status");
  CREATE INDEX "properties_property_type_idx" ON "properties" USING btree ("property_type");
  CREATE INDEX "properties_tier_idx" ON "properties" USING btree ("tier");
  CREATE INDEX "properties_hero_image_idx" ON "properties" USING btree ("hero_image_id");
  CREATE INDEX "properties_address_address_city_idx" ON "properties" USING btree ("address_city");
  CREATE INDEX "properties_locality_idx" ON "properties" USING btree ("locality_id");
  CREATE INDEX "properties_updated_at_idx" ON "properties" USING btree ("updated_at");
  CREATE INDEX "properties_created_at_idx" ON "properties" USING btree ("created_at");
  CREATE INDEX "properties_rels_order_idx" ON "properties_rels" USING btree ("order");
  CREATE INDEX "properties_rels_parent_idx" ON "properties_rels" USING btree ("parent_id");
  CREATE INDEX "properties_rels_path_idx" ON "properties_rels" USING btree ("path");
  CREATE INDEX "properties_rels_amenities_id_idx" ON "properties_rels" USING btree ("amenities_id");
  CREATE INDEX "room_types_images_order_idx" ON "room_types_images" USING btree ("_order");
  CREATE INDEX "room_types_images_parent_id_idx" ON "room_types_images" USING btree ("_parent_id");
  CREATE INDEX "room_types_images_image_idx" ON "room_types_images" USING btree ("image_id");
  CREATE INDEX "room_types_property_idx" ON "room_types" USING btree ("property_id");
  CREATE INDEX "room_types_updated_at_idx" ON "room_types" USING btree ("updated_at");
  CREATE INDEX "room_types_created_at_idx" ON "room_types" USING btree ("created_at");
  CREATE INDEX "room_types_rels_order_idx" ON "room_types_rels" USING btree ("order");
  CREATE INDEX "room_types_rels_parent_idx" ON "room_types_rels" USING btree ("parent_id");
  CREATE INDEX "room_types_rels_path_idx" ON "room_types_rels" USING btree ("path");
  CREATE INDEX "room_types_rels_amenities_id_idx" ON "room_types_rels" USING btree ("amenities_id");
  CREATE INDEX "rooms_property_idx" ON "rooms" USING btree ("property_id");
  CREATE INDEX "rooms_room_type_idx" ON "rooms" USING btree ("room_type_id");
  CREATE INDEX "rooms_updated_at_idx" ON "rooms" USING btree ("updated_at");
  CREATE INDEX "rooms_created_at_idx" ON "rooms" USING btree ("created_at");
  CREATE INDEX "bookings_items_order_idx" ON "bookings_items" USING btree ("_order");
  CREATE INDEX "bookings_items_parent_id_idx" ON "bookings_items" USING btree ("_parent_id");
  CREATE INDEX "bookings_items_room_type_idx" ON "bookings_items" USING btree ("room_type_id");
  CREATE INDEX "bookings_items_room_idx" ON "bookings_items" USING btree ("room_id");
  CREATE UNIQUE INDEX "bookings_booking_ref_idx" ON "bookings" USING btree ("booking_ref");
  CREATE INDEX "bookings_guest_idx" ON "bookings" USING btree ("guest_id");
  CREATE INDEX "bookings_property_idx" ON "bookings" USING btree ("property_id");
  CREATE INDEX "bookings_room_type_idx" ON "bookings" USING btree ("room_type_id");
  CREATE INDEX "bookings_room_idx" ON "bookings" USING btree ("room_id");
  CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
  CREATE INDEX "bookings_coupon_applied_idx" ON "bookings" USING btree ("coupon_applied_id");
  CREATE INDEX "bookings_invoice_pdf_idx" ON "bookings" USING btree ("invoice_pdf_id");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "payments_purpose_idx" ON "payments" USING btree ("purpose");
  CREATE INDEX "payments_gateway_idx" ON "payments" USING btree ("gateway");
  CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");
  CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");
  CREATE INDEX "payments_property_subscription_idx" ON "payments" USING btree ("property_subscription_id");
  CREATE INDEX "payments_gateway_request_id_idx" ON "payments" USING btree ("gateway_request_id");
  CREATE INDEX "payments_bank_transfer_details_bank_transfer_details_rec_idx" ON "payments" USING btree ("bank_transfer_details_receipt_id");
  CREATE INDEX "payments_verified_by_idx" ON "payments" USING btree ("verified_by_id");
  CREATE INDEX "payments_updated_at_idx" ON "payments" USING btree ("updated_at");
  CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");
  CREATE INDEX "payouts_partner_idx" ON "payouts" USING btree ("partner_id");
  CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");
  CREATE INDEX "payouts_reference_idx" ON "payouts" USING btree ("reference");
  CREATE INDEX "payouts_processed_by_idx" ON "payouts" USING btree ("processed_by_id");
  CREATE INDEX "payouts_updated_at_idx" ON "payouts" USING btree ("updated_at");
  CREATE INDEX "payouts_created_at_idx" ON "payouts" USING btree ("created_at");
  CREATE UNIQUE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");
  CREATE INDEX "reviews_guest_idx" ON "reviews" USING btree ("guest_id");
  CREATE INDEX "reviews_property_idx" ON "reviews" USING btree ("property_id");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");
  CREATE INDEX "coupons_updated_at_idx" ON "coupons" USING btree ("updated_at");
  CREATE INDEX "coupons_created_at_idx" ON "coupons" USING btree ("created_at");
  CREATE INDEX "coupons_rels_order_idx" ON "coupons_rels" USING btree ("order");
  CREATE INDEX "coupons_rels_parent_idx" ON "coupons_rels" USING btree ("parent_id");
  CREATE INDEX "coupons_rels_path_idx" ON "coupons_rels" USING btree ("path");
  CREATE INDEX "coupons_rels_properties_id_idx" ON "coupons_rels" USING btree ("properties_id");
  CREATE INDEX "loyalty_points_user_idx" ON "loyalty_points" USING btree ("user_id");
  CREATE INDEX "loyalty_points_source_booking_idx" ON "loyalty_points" USING btree ("source_booking_id");
  CREATE INDEX "loyalty_points_updated_at_idx" ON "loyalty_points" USING btree ("updated_at");
  CREATE INDEX "loyalty_points_created_at_idx" ON "loyalty_points" USING btree ("created_at");
  CREATE INDEX "subscription_plans_updated_at_idx" ON "subscription_plans" USING btree ("updated_at");
  CREATE INDEX "subscription_plans_created_at_idx" ON "subscription_plans" USING btree ("created_at");
  CREATE INDEX "property_subscriptions_property_idx" ON "property_subscriptions" USING btree ("property_id");
  CREATE INDEX "property_subscriptions_plan_idx" ON "property_subscriptions" USING btree ("plan_id");
  CREATE INDEX "property_subscriptions_status_idx" ON "property_subscriptions" USING btree ("status");
  CREATE INDEX "property_subscriptions_updated_at_idx" ON "property_subscriptions" USING btree ("updated_at");
  CREATE INDEX "property_subscriptions_created_at_idx" ON "property_subscriptions" USING btree ("created_at");
  CREATE INDEX "sms_logs_phone_idx" ON "sms_logs" USING btree ("phone");
  CREATE INDEX "sms_logs_gateway_request_id_idx" ON "sms_logs" USING btree ("gateway_request_id");
  CREATE INDEX "sms_logs_related_booking_idx" ON "sms_logs" USING btree ("related_booking_id");
  CREATE INDEX "sms_logs_updated_at_idx" ON "sms_logs" USING btree ("updated_at");
  CREATE INDEX "sms_logs_created_at_idx" ON "sms_logs" USING btree ("created_at");
  CREATE INDEX "email_logs_to_idx" ON "email_logs" USING btree ("to");
  CREATE INDEX "email_logs_resend_email_id_idx" ON "email_logs" USING btree ("resend_email_id");
  CREATE INDEX "email_logs_related_booking_idx" ON "email_logs" USING btree ("related_booking_id");
  CREATE INDEX "email_logs_updated_at_idx" ON "email_logs" USING btree ("updated_at");
  CREATE INDEX "email_logs_created_at_idx" ON "email_logs" USING btree ("created_at");
  CREATE INDEX "wishlist_guest_idx" ON "wishlist" USING btree ("guest_id");
  CREATE INDEX "wishlist_property_idx" ON "wishlist" USING btree ("property_id");
  CREATE INDEX "wishlist_updated_at_idx" ON "wishlist" USING btree ("updated_at");
  CREATE INDEX "wishlist_created_at_idx" ON "wishlist" USING btree ("created_at");
  CREATE INDEX "pages_blocks_hero_links_order_idx" ON "pages_blocks_hero_links" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_links_parent_id_idx" ON "pages_blocks_hero_links" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_image_idx" ON "pages_blocks_hero" USING btree ("image_id");
  CREATE INDEX "pages_blocks_rich_text_order_idx" ON "pages_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_rich_text_parent_id_idx" ON "pages_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_rich_text_path_idx" ON "pages_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_block_order_idx" ON "pages_blocks_image_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_block_parent_id_idx" ON "pages_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_block_path_idx" ON "pages_blocks_image_block" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_block_image_idx" ON "pages_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "pages_blocks_gallery_images_order_idx" ON "pages_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "pages_blocks_gallery_images_parent_id_idx" ON "pages_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_gallery_images_image_idx" ON "pages_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "pages_blocks_gallery_order_idx" ON "pages_blocks_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_gallery_parent_id_idx" ON "pages_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_gallery_path_idx" ON "pages_blocks_gallery" USING btree ("_path");
  CREATE INDEX "pages_blocks_faq_items_order_idx" ON "pages_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_items_parent_id_idx" ON "pages_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_order_idx" ON "pages_blocks_faq" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_parent_id_idx" ON "pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_path_idx" ON "pages_blocks_faq" USING btree ("_path");
  CREATE INDEX "pages_blocks_cta_order_idx" ON "pages_blocks_cta" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_parent_id_idx" ON "pages_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_path_idx" ON "pages_blocks_cta" USING btree ("_path");
  CREATE INDEX "pages_blocks_property_grid_order_idx" ON "pages_blocks_property_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_property_grid_parent_id_idx" ON "pages_blocks_property_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_property_grid_path_idx" ON "pages_blocks_property_grid" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_seo_seo_image_idx" ON "pages" USING btree ("seo_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_properties_id_idx" ON "pages_rels" USING btree ("properties_id");
  CREATE INDEX "_pages_v_blocks_hero_links_order_idx" ON "_pages_v_blocks_hero_links" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_links_parent_id_idx" ON "_pages_v_blocks_hero_links" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_image_idx" ON "_pages_v_blocks_hero" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_rich_text_order_idx" ON "_pages_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_rich_text_parent_id_idx" ON "_pages_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_rich_text_path_idx" ON "_pages_v_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_image_block_order_idx" ON "_pages_v_blocks_image_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_block_parent_id_idx" ON "_pages_v_blocks_image_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_block_path_idx" ON "_pages_v_blocks_image_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_image_block_image_idx" ON "_pages_v_blocks_image_block" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_gallery_images_order_idx" ON "_pages_v_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_gallery_images_parent_id_idx" ON "_pages_v_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_gallery_images_image_idx" ON "_pages_v_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_gallery_order_idx" ON "_pages_v_blocks_gallery" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_gallery_parent_id_idx" ON "_pages_v_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_gallery_path_idx" ON "_pages_v_blocks_gallery" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_faq_items_order_idx" ON "_pages_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_items_parent_id_idx" ON "_pages_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_order_idx" ON "_pages_v_blocks_faq" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_parent_id_idx" ON "_pages_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_path_idx" ON "_pages_v_blocks_faq" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_cta_order_idx" ON "_pages_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_parent_id_idx" ON "_pages_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_path_idx" ON "_pages_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_property_grid_order_idx" ON "_pages_v_blocks_property_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_property_grid_parent_id_idx" ON "_pages_v_blocks_property_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_property_grid_path_idx" ON "_pages_v_blocks_property_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_seo_version_seo_image_idx" ON "_pages_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_rels_order_idx" ON "_pages_v_rels" USING btree ("order");
  CREATE INDEX "_pages_v_rels_parent_idx" ON "_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_pages_v_rels_path_idx" ON "_pages_v_rels" USING btree ("path");
  CREATE INDEX "_pages_v_rels_properties_id_idx" ON "_pages_v_rels" USING btree ("properties_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_amenities_id_idx" ON "payload_locked_documents_rels" USING btree ("amenities_id");
  CREATE INDEX "payload_locked_documents_rels_localities_id_idx" ON "payload_locked_documents_rels" USING btree ("localities_id");
  CREATE INDEX "payload_locked_documents_rels_properties_id_idx" ON "payload_locked_documents_rels" USING btree ("properties_id");
  CREATE INDEX "payload_locked_documents_rels_room_types_id_idx" ON "payload_locked_documents_rels" USING btree ("room_types_id");
  CREATE INDEX "payload_locked_documents_rels_rooms_id_idx" ON "payload_locked_documents_rels" USING btree ("rooms_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("payments_id");
  CREATE INDEX "payload_locked_documents_rels_payouts_id_idx" ON "payload_locked_documents_rels" USING btree ("payouts_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_loyalty_points_id_idx" ON "payload_locked_documents_rels" USING btree ("loyalty_points_id");
  CREATE INDEX "payload_locked_documents_rels_subscription_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("subscription_plans_id");
  CREATE INDEX "payload_locked_documents_rels_property_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("property_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_sms_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("sms_logs_id");
  CREATE INDEX "payload_locked_documents_rels_email_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("email_logs_id");
  CREATE INDEX "payload_locked_documents_rels_wishlist_id_idx" ON "payload_locked_documents_rels" USING btree ("wishlist_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "platform_settings_bank_transfer_accounts_order_idx" ON "platform_settings_bank_transfer_accounts" USING btree ("_order");
  CREATE INDEX "platform_settings_bank_transfer_accounts_parent_id_idx" ON "platform_settings_bank_transfer_accounts" USING btree ("_parent_id");
  CREATE INDEX "platform_settings_branding_branding_header_logo_idx" ON "platform_settings" USING btree ("branding_header_logo_id");
  CREATE INDEX "platform_settings_branding_branding_footer_logo_idx" ON "platform_settings" USING btree ("branding_footer_logo_id");
  CREATE INDEX "analytics_settings_external_scripts_order_idx" ON "analytics_settings_external_scripts" USING btree ("_order");
  CREATE INDEX "analytics_settings_external_scripts_parent_id_idx" ON "analytics_settings_external_scripts" USING btree ("_parent_id");
  CREATE INDEX "analytics_settings_inline_snippets_order_idx" ON "analytics_settings_inline_snippets" USING btree ("_order");
  CREATE INDEX "analytics_settings_inline_snippets_parent_id_idx" ON "analytics_settings_inline_snippets" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media_purpose" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "amenities" CASCADE;
  DROP TABLE "localities" CASCADE;
  DROP TABLE "properties_images" CASCADE;
  DROP TABLE "properties_videos" CASCADE;
  DROP TABLE "properties_trust_badges" CASCADE;
  DROP TABLE "properties" CASCADE;
  DROP TABLE "properties_rels" CASCADE;
  DROP TABLE "room_types_images" CASCADE;
  DROP TABLE "room_types" CASCADE;
  DROP TABLE "room_types_rels" CASCADE;
  DROP TABLE "rooms" CASCADE;
  DROP TABLE "bookings_items" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "payments" CASCADE;
  DROP TABLE "payouts" CASCADE;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "coupons" CASCADE;
  DROP TABLE "coupons_rels" CASCADE;
  DROP TABLE "loyalty_points" CASCADE;
  DROP TABLE "subscription_plans" CASCADE;
  DROP TABLE "property_subscriptions" CASCADE;
  DROP TABLE "sms_logs" CASCADE;
  DROP TABLE "email_logs" CASCADE;
  DROP TABLE "wishlist" CASCADE;
  DROP TABLE "pages_blocks_hero_links" CASCADE;
  DROP TABLE "pages_blocks_hero" CASCADE;
  DROP TABLE "pages_blocks_rich_text" CASCADE;
  DROP TABLE "pages_blocks_image_block" CASCADE;
  DROP TABLE "pages_blocks_gallery_images" CASCADE;
  DROP TABLE "pages_blocks_gallery" CASCADE;
  DROP TABLE "pages_blocks_faq_items" CASCADE;
  DROP TABLE "pages_blocks_faq" CASCADE;
  DROP TABLE "pages_blocks_cta" CASCADE;
  DROP TABLE "pages_blocks_property_grid" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_links" CASCADE;
  DROP TABLE "_pages_v_blocks_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_rich_text" CASCADE;
  DROP TABLE "_pages_v_blocks_image_block" CASCADE;
  DROP TABLE "_pages_v_blocks_gallery_images" CASCADE;
  DROP TABLE "_pages_v_blocks_gallery" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_items" CASCADE;
  DROP TABLE "_pages_v_blocks_faq" CASCADE;
  DROP TABLE "_pages_v_blocks_cta" CASCADE;
  DROP TABLE "_pages_v_blocks_property_grid" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "platform_settings_bank_transfer_accounts" CASCADE;
  DROP TABLE "platform_settings" CASCADE;
  DROP TABLE "integration_settings" CASCADE;
  DROP TABLE "analytics_settings_external_scripts" CASCADE;
  DROP TABLE "analytics_settings_inline_snippets" CASCADE;
  DROP TABLE "analytics_settings" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_partner_profile_payout_method";
  DROP TYPE "public"."enum_media_purpose";
  DROP TYPE "public"."enum_properties_trust_badges";
  DROP TYPE "public"."enum_properties_status";
  DROP TYPE "public"."enum_properties_property_type";
  DROP TYPE "public"."enum_properties_tier";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_payments_purpose";
  DROP TYPE "public"."enum_payments_gateway";
  DROP TYPE "public"."enum_payments_status";
  DROP TYPE "public"."enum_payouts_status";
  DROP TYPE "public"."enum_payouts_method";
  DROP TYPE "public"."enum_coupons_discount_type";
  DROP TYPE "public"."enum_coupons_scope";
  DROP TYPE "public"."enum_coupons_scope_tier";
  DROP TYPE "public"."enum_loyalty_points_type";
  DROP TYPE "public"."enum_property_subscriptions_status";
  DROP TYPE "public"."enum_sms_logs_purpose";
  DROP TYPE "public"."enum_sms_logs_delivery_status";
  DROP TYPE "public"."enum_email_logs_status";
  DROP TYPE "public"."enum_pages_blocks_hero_links_style";
  DROP TYPE "public"."enum_pages_blocks_rich_text_width";
  DROP TYPE "public"."enum_pages_blocks_property_grid_source";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_hero_links_style";
  DROP TYPE "public"."enum__pages_v_blocks_rich_text_width";
  DROP TYPE "public"."enum__pages_v_blocks_property_grid_source";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_platform_settings_payment_gateways_bkash_mode";
  DROP TYPE "public"."enum_platform_settings_payment_gateways_nagad_mode";
  DROP TYPE "public"."enum_platform_settings_payment_gateways_sslcommerz_mode";
  DROP TYPE "public"."enum_platform_settings_payment_gateways_aamarpay_mode";
  DROP TYPE "public"."enum_integration_settings_email_provider";
  DROP TYPE "public"."enum_integration_settings_sms_provider";
  DROP TYPE "public"."enum_analytics_settings_external_scripts_strategy";
  DROP TYPE "public"."enum_analytics_settings_inline_snippets_strategy";`)
}
