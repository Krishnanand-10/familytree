-- Drop legacy open dev policies
DROP POLICY IF EXISTS "DevMode" ON public.family_branches;
DROP POLICY IF EXISTS "DevMode" ON public.people;
DROP POLICY IF EXISTS "DevMode" ON public.relationships;

-- Enable Row Level Security (RLS)
ALTER TABLE public.family_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

-- 1. Policies for family_branches
CREATE POLICY "Allow authenticated user full access to their branches"
ON public.family_branches
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Policies for people
-- Users can manage people that belong to a branch they own
CREATE POLICY "Allow authenticated user full access to people in their branches"
ON public.people
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.family_branches b 
        WHERE b.id = people.branch_id AND b.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.family_branches b 
        WHERE b.id = people.branch_id AND b.user_id = auth.uid()
    )
);

-- 3. Policies for relationships
-- Users can manage relationships for people belonging to a branch they own
CREATE POLICY "Allow authenticated user full access to relationships in their branches"
ON public.relationships
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.people p
        JOIN public.family_branches b ON p.branch_id = b.id
        WHERE p.id = relationships.person_a AND b.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.people p
        JOIN public.family_branches b ON p.branch_id = b.id
        WHERE p.id = relationships.person_a AND b.user_id = auth.uid()
    )
);
