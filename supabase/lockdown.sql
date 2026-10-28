-- ══════════════════════════════════════════════════════════════════════════
--  GoodDoctor's Shop — Verrouillage Supabase (à exécuter dans SQL Editor)
--  Dashboard Supabase → SQL Editor → New query → coller → Run
-- ══════════════════════════════════════════════════════════════════════════
--  POURQUOI : la clé "anon" est publique par conception (n'importe qui la voit
--  dans la console F12 d'un site qui l'utilise). Seules les permissions Supabase
--  décident de ce qu'elle peut faire. Une fois le site passé par l'Edge Function
--  (clé service_role côté serveur), on retire à "anon" tout accès aux données.
--
--  ⚠ AVANT D'EXÉCUTER LA PARTIE 3 :
--    - Le NOUVEAU site (D:\ProjetGd) n'utilise plus la clé anon : OK.
--    - Les ANCIENS sites (D:\Ecom site web, D:\Site web e-commerce luxe,
--      gooddoctorsshop.com s'il tourne encore) appellent Supabase depuis le
--      navigateur avec la clé anon : ils CESSERONT de charger les produits
--      tant qu'ils ne sont pas migrés ou arrêtés.
--    - Le back-office qui utilise des comptes connectés ("authenticated") reste
--      fonctionnel : on ne touche pas à ce rôle.
-- ══════════════════════════════════════════════════════════════════════════


-- ── PARTIE 1 : DIAGNOSTIC (lecture seule, sans risque) ───────────────────

-- 1a. Tables du schéma public SANS Row Level Security (doivent être vides)
select schemaname, tablename
from pg_tables
where schemaname = 'public' and not rowsecurity;

-- 1b. Tables sur lesquelles "anon" a des droits (doit être vide ou justifié)
select table_name, string_agg(privilege_type, ', ') as droits_anon
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
group by table_name;

-- 1c. Fonctions (RPC) que "anon" peut appeler (idéalement : aucune)
select p.proname as fonction,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by 1;


-- ── PARTIE 2 : RLS activé partout (sans effet sur service_role) ──────────
-- service_role contourne toujours le RLS : l'Edge Function continue de marcher.
-- Une table avec RLS activé et AUCUNE policy est invisible pour anon/authenticated.
-- ⚠ Si votre back-office lit des tables via des comptes "authenticated", vérifiez
--   qu'elles ont déjà une policy avant de lancer ce bloc.

do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;


-- ── PARTIE 3 : retirer l'accès "anon" aux deux RPC du catalogue ──────────
-- Ce sont les seules fonctions appelées par le site. Après ce bloc, un
-- appel avec la clé anon depuis la console renvoie 401/403.

revoke execute on function public.get_public_products()   from public, anon;
revoke execute on function public.get_catalog2_articles() from public, anon;

grant  execute on function public.get_public_products()   to service_role, authenticated;
grant  execute on function public.get_catalog2_articles() to service_role, authenticated;


-- ── PARTIE 4 : (optionnel) tout fermer à anon sur le schéma public ───────
-- Décommentez seulement si la partie 1b/1c montre d'autres accès anon inutiles.

-- revoke all on all tables    in schema public from anon;
-- revoke all on all sequences in schema public from anon;
-- alter default privileges in schema public revoke all on tables    from anon;
-- alter default privileges in schema public revoke all on sequences from anon;


-- ── PARTIE 5 : vérification finale (relancer 1c : doit être vide) ────────
-- Test depuis un terminal (doit répondre 401 ou 403, plus 200) :
--   curl -X POST "https://<projet>.supabase.co/rest/v1/rpc/get_public_products" \
--        -H "apikey: <clé anon>" -H "Content-Type: application/json" -d "{}"
