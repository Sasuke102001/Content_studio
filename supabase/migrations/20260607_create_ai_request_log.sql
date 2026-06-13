create extension if not exists pgcrypto;

create table if not exists public.ai_request_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('chat_completion')),
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_request_log_user_created_at_idx
  on public.ai_request_log (user_id, created_at desc);

alter table public.ai_request_log enable row level security;

create policy "Users can view their own AI usage"
  on public.ai_request_log
  for select
  using (auth.uid() = user_id);
