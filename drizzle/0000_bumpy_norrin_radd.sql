CREATE TABLE `body_log` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`body_fat_pct` real,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `body_log_date_idx` ON `body_log` (`date`);--> statement-breakpoint
CREATE TABLE `day_target` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`day_type` text NOT NULL,
	`kcal` real NOT NULL,
	`p` real NOT NULL,
	`f` real NOT NULL,
	`c` real NOT NULL,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `day_target_date_idx` ON `day_target` (`date`);--> statement-breakpoint
CREATE TABLE `exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`part` text NOT NULL,
	`coef` real NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `food` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`search` text NOT NULL,
	`kcal` real NOT NULL,
	`p` real NOT NULL,
	`f` real NOT NULL,
	`c` real NOT NULL,
	`source` text NOT NULL,
	`code` text,
	`unit_g` real,
	`default_g` real
);
--> statement-breakpoint
CREATE INDEX `food_source_idx` ON `food` (`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `food_code_idx` ON `food` (`code`);--> statement-breakpoint
CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meal_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`food_id` text,
	`group_id` text NOT NULL,
	`group_name` text NOT NULL,
	`name` text NOT NULL,
	`grams` real,
	`kcal` real NOT NULL,
	`p` real NOT NULL,
	`f` real NOT NULL,
	`c` real NOT NULL,
	`ai` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_entry_date_idx` ON `meal_entry` (`date`);--> statement-breakpoint
CREATE TABLE `meal_set` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`items` text NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`slot_hint` text
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sex` text NOT NULL,
	`birth_year` integer NOT NULL,
	`height_cm` real NOT NULL,
	`activity` real NOT NULL,
	`goal` text NOT NULL,
	`pace_kg_per_week` real NOT NULL,
	`pk` real NOT NULL,
	`coef_high` real NOT NULL,
	`coef_normal` real NOT NULL,
	`coef_off` real NOT NULL,
	`tdee` real NOT NULL,
	`tdee_week` text,
	`onboarded` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `week_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`weekday` integer NOT NULL,
	`template_id` text
);
--> statement-breakpoint
CREATE TABLE `workout_session` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`template_id` text,
	`name` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`volume_score` real NOT NULL,
	`day_type` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workout_session_date_idx` ON `workout_session` (`date`);--> statement-breakpoint
CREATE TABLE `workout_set` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`weight_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`rir` integer,
	`order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workout_set_session_idx` ON `workout_set` (`session_id`);--> statement-breakpoint
CREATE INDEX `workout_set_exercise_idx` ON `workout_set` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workout_template` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`exercises` text NOT NULL,
	`default_day_type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
