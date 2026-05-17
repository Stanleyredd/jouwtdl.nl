alter table "profiles"
add column if not exists "password_hash" text;

create unique index if not exists "profiles_email_key"
on "profiles" ("email");
