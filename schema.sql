-- Kinship: MyHeritage-Style Database Schema
CREATE TABLE IF NOT EXISTS public.family_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    birth_date DATE,
    death_date DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    photo_url TEXT,
    notes TEXT,
    x FLOAT DEFAULT NULL, -- Position Memory
    y FLOAT DEFAULT NULL,
    branch_id UUID REFERENCES public.family_branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_a UUID REFERENCES public.people(id) ON DELETE CASCADE,
    person_b UUID REFERENCES public.people(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'parent' CHECK (type IN ('parent', 'spouse', 'sibling')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Permissive Dev Policies
ALTER TABLE public.family_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DevMode" ON public.family_branches FOR ALL USING (true);
CREATE POLICY "DevMode" ON public.people FOR ALL USING (true);
CREATE POLICY "DevMode" ON public.relationships FOR ALL USING (true);

-- Seed Default Branch
INSERT INTO public.family_branches (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'The Smith Family')
ON CONFLICT (id) DO NOTHING;
