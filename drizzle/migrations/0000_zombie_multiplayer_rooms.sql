CREATE TABLE public.zombie_rooms (code text PRIMARY KEY, host_token text NOT NULL, started boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.zombie_rooms TO service_role;
ALTER TABLE public.zombie_rooms ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.zombie_room_members (room_code text NOT NULL REFERENCES public.zombie_rooms(code) ON DELETE CASCADE, token_hash text NOT NULL, player_id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, seen_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_code, token_hash));
GRANT ALL ON public.zombie_room_members TO service_role;
ALTER TABLE public.zombie_room_members ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.zombie_room_action(action text, room text, token text, player_name text DEFAULT 'Sopravvissuto') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.zombie_rooms; h text; result jsonb;
BEGIN
 IF length(token) < 64 OR length(token) > 200 THEN RAISE EXCEPTION 'Sessione non valida'; END IF;
 h := md5(token);
 IF action = 'create' THEN
  room := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.zombie_rooms(code,host_token) VALUES(room,h);
 END IF;
 SELECT * INTO r FROM public.zombie_rooms WHERE code=upper(room) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stanza non trovata'; END IF;
 room := r.code;
 DELETE FROM public.zombie_room_members WHERE room_code=room AND seen_at < now()-interval '45 seconds';
 IF action IN ('create','join') THEN
  IF r.started THEN RAISE EXCEPTION 'Partita già iniziata'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.zombie_room_members WHERE room_code=room AND token_hash=h) THEN
   IF (SELECT count(*) FROM public.zombie_room_members WHERE room_code=room) >= 3 THEN RAISE EXCEPTION 'Stanza piena: massimo 3 giocatori'; END IF;
   INSERT INTO public.zombie_room_members(room_code,token_hash,name) VALUES(room,h,left(coalesce(nullif(trim(player_name),''),'Sopravvissuto'),20));
  END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.zombie_room_members WHERE room_code=room AND token_hash=h) THEN RAISE EXCEPTION 'Sessione scaduta'; END IF;
 IF action='leave' THEN
  DELETE FROM public.zombie_room_members WHERE room_code=room AND token_hash=h;
  IF r.host_token=h THEN UPDATE public.zombie_rooms SET started=false WHERE code=room; END IF;
  RETURN jsonb_build_object('left',true);
 END IF;
 UPDATE public.zombie_room_members SET seen_at=now() WHERE room_code=room AND token_hash=h;
 IF action='start' THEN
  IF r.host_token<>h THEN RAISE EXCEPTION 'Solo il creatore può avviare'; END IF;
  IF (SELECT count(*) FROM public.zombie_room_members WHERE room_code=room) < 2 THEN RAISE EXCEPTION 'Servono almeno 2 giocatori'; END IF;
  UPDATE public.zombie_rooms SET started=true WHERE code=room;
  r.started:=true;
 END IF;
 SELECT jsonb_build_object('code',room,'started',r.started,'id',(SELECT player_id FROM public.zombie_room_members WHERE room_code=room AND token_hash=h),'hostId',(SELECT player_id FROM public.zombie_room_members WHERE room_code=room AND token_hash=r.host_token),'members',coalesce(jsonb_agg(jsonb_build_object('id',player_id,'name',name) ORDER BY player_id),'[]'::jsonb)) INTO result FROM public.zombie_room_members WHERE room_code=room;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.zombie_room_action(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zombie_room_action(text,text,text,text) TO anon, authenticated, service_role;