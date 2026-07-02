-- Drop legacy open dev policies
DROP POLICY IF EXISTS "DevMode" ON public.family_branches;
DROP POLICY IF EXISTS "DevMode" ON public.people;
DROP POLICY IF EXISTS "DevMode" ON public.relationships;

DROP POLICY IF EXISTS "Allow authenticated user full access to their branches" ON public.family_branches;
DROP POLICY IF EXISTS "Allow authenticated user full access to people in their branches" ON public.people;
DROP POLICY IF EXISTS "Allow authenticated user full access to relationships in their branches" ON public.relationships;

-- Drop previous policies to avoid duplication errors
DROP POLICY IF EXISTS "Allow branch owners and shared users to read shares" ON public.branch_shares;
DROP POLICY IF EXISTS "Allow branch owners to manage shares" ON public.branch_shares;
DROP POLICY IF EXISTS "Allow users to read their own or shared branches" ON public.family_branches;
DROP POLICY IF EXISTS "Allow branch owners to update branch details" ON public.family_branches;
DROP POLICY IF EXISTS "Allow authenticated users to create branches" ON public.family_branches;
DROP POLICY IF EXISTS "Allow branch owners to delete branches" ON public.family_branches;
DROP POLICY IF EXISTS "Allow read access to people in accessible branches" ON public.people;
DROP POLICY IF EXISTS "Allow owners and editors to modify people" ON public.people;
DROP POLICY IF EXISTS "Allow read access to relationships in accessible branches" ON public.relationships;
DROP POLICY IF EXISTS "Allow owners and editors to modify relationships" ON public.relationships;

-- Enable Row Level Security (RLS)
ALTER TABLE public.family_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

-- 1. Create branch_shares table if not exists
CREATE TABLE IF NOT EXISTS public.branch_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.family_branches(id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(branch_id, shared_with_email)
);

ALTER TABLE public.branch_shares ENABLE ROW LEVEL SECURITY;

-- 2. Create Security Definer function to check branch ownership without recursion
CREATE OR REPLACE FUNCTION public.is_branch_owner(branch_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_branches
    WHERE id = branch_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Policies for branch_shares
CREATE POLICY "Allow branch owners and shared users to read shares"
ON public.branch_shares
FOR SELECT
TO authenticated
USING (
    public.is_branch_owner(branch_id) OR 
    (shared_with_email = auth.jwt() ->> 'email')
);

CREATE POLICY "Allow branch owners to manage shares"
ON public.branch_shares
FOR ALL
TO authenticated
USING (
    public.is_branch_owner(branch_id)
)
WITH CHECK (
    public.is_branch_owner(branch_id)
);

-- 4. Policies for family_branches
CREATE POLICY "Allow users to read their own or shared branches"
ON public.family_branches
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.branch_shares s
        WHERE s.branch_id = family_branches.id AND s.shared_with_email = auth.jwt() ->> 'email'
    )
);

CREATE POLICY "Allow branch owners to update branch details"
ON public.family_branches
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow authenticated users to create branches"
ON public.family_branches
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow branch owners to delete branches"
ON public.family_branches
FOR DELETE
TO authenticated
USING (user_id = auth.uid());


-- 5. Policies for people
CREATE POLICY "Allow read access to people in accessible branches"
ON public.people
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.family_branches b
        WHERE b.id = people.branch_id AND (
            b.user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.branch_shares s
                WHERE s.branch_id = b.id AND s.shared_with_email = auth.jwt() ->> 'email'
            )
        )
    )
);

CREATE POLICY "Allow owners and editors to modify people"
ON public.people
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.family_branches b
        WHERE b.id = people.branch_id AND (
            b.user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.branch_shares s
                WHERE s.branch_id = b.id AND s.shared_with_email = auth.jwt() ->> 'email' AND s.role = 'editor'
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.family_branches b
        WHERE b.id = people.branch_id AND (
            b.user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.branch_shares s
                WHERE s.branch_id = b.id AND s.shared_with_email = auth.jwt() ->> 'email' AND s.role = 'editor'
            )
        )
    )
);


-- 6. Policies for relationships
CREATE POLICY "Allow read access to relationships in accessible branches"
ON public.relationships
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.people p
        JOIN public.family_branches b ON p.branch_id = b.id
        WHERE p.id = relationships.person_a AND (
            b.user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.branch_shares s
                WHERE s.branch_id = b.id AND s.shared_with_email = auth.jwt() ->> 'email'
            )
        )
    )
);

CREATE POLICY "Allow owners and editors to modify relationships"
ON public.relationships
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.people p
        JOIN public.family_branches b ON p.branch_id = b.id
        WHERE p.id = relationships.person_a AND (
            b.user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.branch_shares s
                WHERE s.branch_id = b.id AND s.shared_with_email = auth.jwt() ->> 'email' AND s.role = 'editor'
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.people p
        JOIN public.family_branches b ON p.branch_id = b.id
        WHERE p.id = relationships.person_a AND (
            b.user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.branch_shares s
                WHERE s.branch_id = b.id AND s.shared_with_email = auth.jwt() ->> 'email' AND s.role = 'editor'
            )
        )
    )
);
