"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Talent } from "@/lib/supabase";
import { VOCALIST_FLAT_PRICE } from "@/lib/config/pricing.config";

interface TalentCardProps {
  talent: Talent;
  selected?: boolean;
  onSelect?: (talentId: string, price: number) => void;
}

const getLanguageFlag = (language: string): string => {
  const flagMap: { [key: string]: string } = {
    "English (US)": "🇺🇸",
    "English (UK)": "🇬🇧",
    "Chinese (Mandarin)": "🇨🇳",
    "Chinese (Cantonese)": "🇭🇰",
    Japanese: "🇯🇵",
    Korean: "🇰🇷",
    Spanish: "🇪🇸",
    French: "🇫🇷",
    German: "🇩🇪",
    Italian: "🇮🇹",
    Portuguese: "🇵🇹",
  };
  return flagMap[language] || "🌐";
};

export function TalentCard({ talent, selected, onSelect }: TalentCardProps) {
  const [showBio, setShowBio] = useState(false);
  const [currentDemo, setCurrentDemo] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const displayPrice = VOCALIST_FLAT_PRICE;
  const demos = (talent.demo_urls || []) as Array<{ name?: string; url: string }>;

  const handlePlayPause = () => {
    if (!demos[currentDemo]) return;

    if (audio) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    } else {
      const newAudio = new Audio(demos[currentDemo].url);
      newAudio.addEventListener("ended", () => setIsPlaying(false));
      newAudio.play();
      setAudio(newAudio);
      setIsPlaying(true);
    }
  };

  const handleDemoChange = (index: number) => {
    if (audio) {
      audio.pause();
      setIsPlaying(false);
    }
    setCurrentDemo(index);
    setAudio(null);
  };

  const handleSelect = () => {
    if (onSelect) {
      onSelect(talent.id, displayPrice);
    }
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer",
        selected && "ring-2 ring-blue-500"
      )}
      onMouseEnter={() => setShowBio(true)}
      onMouseLeave={() => setShowBio(false)}
      onClick={handleSelect}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square">
          {talent.headshot_url ? (
            <img
              src={talent.headshot_url}
              alt={talent.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <span className="text-6xl text-gray-400">
                {talent.name[0]}
              </span>
            </div>
          )}

          {showBio && talent.bio && (
            <div className="absolute inset-0 bg-black bg-opacity-90 p-4 overflow-y-auto">
              <h3 className="text-white font-semibold mb-2">{talent.name}</h3>
              <p className="text-white text-sm">{talent.bio}</p>
            </div>
          )}

          {selected && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white p-2 rounded-full">
              <Check className="w-5 h-5" />
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-lg">{talent.name}</h3>
            <span className="text-sm font-medium text-blue-600">
              +${displayPrice.toFixed(0)}
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {talent.languages.map((lang) => (
              <span key={lang} className="text-lg" title={lang}>
                {getLanguageFlag(lang)}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {talent.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {talent.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{talent.tags.length - 3}
              </Badge>
            )}
          </div>

          {demos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-10 h-10 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPause();
                  }}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="text-xs text-gray-600">
                    {demos[currentDemo]?.name || "Demo"}
                  </div>
                </div>
              </div>

              {demos.length > 1 && (
                <div className="flex gap-1">
                  {demos.map((_, index) => (
                    <button
                      key={index}
                      className={cn(
                        "h-1 flex-1 rounded",
                        index === currentDemo ? "bg-blue-500" : "bg-gray-200"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDemoChange(index);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
