-- Drop and recreate participants_public view to exclude admin participants
DROP VIEW IF EXISTS public.participants_public;

CREATE VIEW public.participants_public AS
 SELECT "id",
    "team_name",
    "business_name",
    "category"
   FROM public.participants
  WHERE ("team_name" !~~* '%(admin)%'::text);

ALTER VIEW public.participants_public OWNER TO postgres;
