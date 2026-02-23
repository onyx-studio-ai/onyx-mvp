"use client";

import { useState } from "react";
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TalentFilterProps {
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  languages: string[];
  tags: string[];
  genders: string[];
}

const AVAILABLE_LANGUAGES = [
  "English (US)",
  "English (UK)",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
];

const AVAILABLE_TAGS = [
  "Warm",
  "Corporate",
  "Friendly",
  "Professional",
  "Energetic",
  "Calm",
  "Conversational",
  "Authoritative",
  "Rock",
  "Pop",
  "Jazz",
  "Classical",
  "High-range",
  "Deep",
  "Smooth",
  "Powerful",
];

const AVAILABLE_GENDERS = ["Male", "Female", "Non-binary"];

export function TalentFilter({ onFilterChange }: TalentFilterProps) {
  const t = useTranslations('talent');
  const [filters, setFilters] = useState<FilterState>({
    languages: [],
    tags: [],
    genders: [],
  });

  const updateFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleLanguage = (language: string) => {
    const newLanguages = filters.languages.includes(language)
      ? filters.languages.filter((l) => l !== language)
      : [...filters.languages, language];
    updateFilters({ ...filters, languages: newLanguages });
  };

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    updateFilters({ ...filters, tags: newTags });
  };

  const toggleGender = (gender: string) => {
    const genderValue = gender.toLowerCase().replace("-", "_");
    const newGenders = filters.genders.includes(genderValue)
      ? filters.genders.filter((g) => g !== genderValue)
      : [...filters.genders, genderValue];
    updateFilters({ ...filters, genders: newGenders });
  };

  const clearFilters = () => {
    updateFilters({ languages: [], tags: [], genders: [] });
  };

  const hasActiveFilters =
    filters.languages.length > 0 ||
    filters.tags.length > 0 ||
    filters.genders.length > 0;

  return (
    <div className="space-y-4">
      {hasActiveFilters && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{t('activeFilters')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-xs"
              >
                {t('clearAll')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filters.languages.map((lang) => (
                <Badge
                  key={lang}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => toggleLanguage(lang)}
                >
                  {lang}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
              {filters.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
              {filters.genders.map((gender) => (
                <Badge
                  key={gender}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() =>
                    toggleGender(
                      gender.charAt(0).toUpperCase() +
                        gender.slice(1).replace("_", "-")
                    )
                  }
                >
                  {gender.charAt(0).toUpperCase() +
                    gender.slice(1).replace("_", "-")}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {AVAILABLE_LANGUAGES.map((language) => (
              <div key={language} className="flex items-center space-x-2">
                <Checkbox
                  id={`lang-${language}`}
                  checked={filters.languages.includes(language)}
                  onCheckedChange={() => toggleLanguage(language)}
                />
                <Label
                  htmlFor={`lang-${language}`}
                  className="text-sm cursor-pointer"
                >
                  {language}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('styleTone')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {AVAILABLE_TAGS.map((tag) => (
              <div key={tag} className="flex items-center space-x-2">
                <Checkbox
                  id={`tag-${tag}`}
                  checked={filters.tags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                />
                <Label htmlFor={`tag-${tag}`} className="text-sm cursor-pointer">
                  {tag}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('gender')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {AVAILABLE_GENDERS.map((gender) => (
              <div key={gender} className="flex items-center space-x-2">
                <Checkbox
                  id={`gender-${gender}`}
                  checked={filters.genders.includes(
                    gender.toLowerCase().replace("-", "_")
                  )}
                  onCheckedChange={() => toggleGender(gender)}
                />
                <Label
                  htmlFor={`gender-${gender}`}
                  className="text-sm cursor-pointer"
                >
                  {gender}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
