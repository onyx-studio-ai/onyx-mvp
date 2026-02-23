"use client";

import { Suspense, useState } from "react";
import { TalentGrid } from "@/components/TalentGrid";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

function MusicTalentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTalentId, setSelectedTalentId] = useState<string | null>(null);
  const [selectedTalentPrice, setSelectedTalentPrice] = useState<number>(0);

  const handleTalentSelect = (talentId: string, price: number) => {
    setSelectedTalentId(talentId);
    setSelectedTalentPrice(price);
  };

  const handleProceedToCreate = () => {
    const tier = searchParams.get("tier");
    const vibe = searchParams.get("vibe");
    const ref = searchParams.get("ref");

    const params = new URLSearchParams({
      talentId: selectedTalentId || "",
      talentPrice: selectedTalentPrice.toString(),
    });

    if (tier) params.set("tier", tier);
    if (vibe) params.set("vibe", vibe);
    if (ref) params.set("ref", ref);

    router.push(`/music/create?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="mb-4 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                Select a Singer
              </h1>
              <p className="text-xl text-gray-400 mt-2">
                Choose from our professional music talent roster
              </p>
            </div>
            {selectedTalentId && (
              <Button
                onClick={handleProceedToCreate}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              >
                Continue to Order
              </Button>
            )}
          </div>

          <TalentGrid
            type="singer"
            selectedTalentId={selectedTalentId}
            onTalentSelect={handleTalentSelect}
          />
        </div>
      </section>
    </main>
  );
}

export default function MusicTalentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <MusicTalentsContent />
    </Suspense>
  );
}
