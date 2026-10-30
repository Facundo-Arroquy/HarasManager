-- La función solo consulta la membresía del propio auth.uid(), que la RLS de
-- membresia ya permite leer. No necesita elevar privilegios.
ALTER FUNCTION public.puede_gestionar_polo(UUID) SECURITY INVOKER;
