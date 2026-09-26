CREATE TABLE `pace_suggestion` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`week_start` text NOT NULL,
	`delta_kcal` integer NOT NULL,
	`answer` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `meal_entry` ADD `photo_uri` text;--> statement-breakpoint
ALTER TABLE `meal_entry` ADD `input_type` text DEFAULT 'search' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `goal_weight_kg` real;--> statement-breakpoint
ALTER TABLE `profile` ADD `week_adjust_kcal` integer DEFAULT 0 NOT NULL;