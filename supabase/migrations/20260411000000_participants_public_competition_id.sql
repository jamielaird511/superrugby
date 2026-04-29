-- Expose competition_id on participants_public for client-side filtering (e.g. World Cup login).
DROP VIEW IF EXISTS public.participants_public;

CREATE VIEW public.participants_public AS
 SELECT p.id,
    p.team_name,
    p.business_name,
    p.category,
    l.competition_id
   FROM public.participants p
   JOIN public.leagues l ON l.id = p.league_id
  WHERE (p.team_name !~~* '%(admin)%'::text);

ALTER VIEW public.participants_public OWNER TO postgres;

GRANT ALL ON TABLE public.participants_public TO anon;
GRANT ALL ON TABLE public.participants_public TO authenticated;
GRANT ALL ON TABLE public.participants_public TO service_role;
