"use client";

import { useState, useEffect } from "react";
import { useTranslations } from 'next-intl';
import { type Talent } from "@/lib/supabase";
import { TalentCard } from "./TalentCard";
import { TalentFilter, FilterState } from "./TalentFilter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TalentGridProps {
  type: "singer" | "voice_actor";
  selectedTalentId?: string | null;
  onTalentSelect?: (talentId: string, price: number) => void;
}

export function TalentGrid({
  type,
  selectedTalentId,
  onTalentSelect,
}: TalentGridProps) {
  const t = useTranslations('talent');
  const [talents, setTalents] = useState<Talent[]>([]);
  const [filteredTalents, setFilteredTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    languages: [],
    tags: [],
    genders: [],
  });
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "in_house" | "featured"
  >("all");

  useEffect(() => {
    fetchTalents();
  }, [type]);

  useEffect(() => {
    applyFilters();
  }, [talents, filters, categoryFilter]);

  const fetchTalents = async () => {
    try {
      const response = await fetch(`/api/talents?type=${type}`);
      if (!response.ok) throw new Error('Failed to fetch talents');
      const data = await response.json();
      setTalents(data || []);
    } catch (error) {
      console.error("Error fetching talents:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...talents];

    if (categoryFilter !== "all") {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    if (filters.languages.length > 0) {
      filtered = filtered.filter((t) =>
        filters.languages.some((lang) => t.languages.includes(lang))
      );
    }

    if (filters.tags.length > 0) {
      filtered = filtered.filter((t) =>
        filters.tags.some((tag) => t.tags.includes(tag))
      );
    }

    if (filters.genders.length > 0) {
      filtered = filtered.filter((t) =>
        filters.genders.some((g) => t.tags?.some((tag: string) => tag.toLowerCase() === g.toLowerCase()))
      );
    }

    setFilteredTalents(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg">{t('loadingTalents')}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <div className="sticky top-20">
          <TalentFilter onFilterChange={setFilters} />
        </div>
      </div>

      <div className="lg:col-span-3">
        <div className="mb-6">
          <Tabs
            value={categoryFilter}
            onValueChange={(value) =>
              setCategoryFilter(value as "all" | "in_house" | "featured")
            }
          >
            <TabsList>
              <TabsTrigger value="all">{t('allTalents')}</TabsTrigger>
              <TabsTrigger value="in_house">{t('inHouse')}</TabsTrigger>
              <TabsTrigger value="featured">{t('featured')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredTalents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {t('noTalentsFound')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredTalents.map((talent) => (
              <TalentCard
                key={talent.id}
                talent={talent}
                selected={selectedTalentId === talent.id}
                onSelect={onTalentSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
