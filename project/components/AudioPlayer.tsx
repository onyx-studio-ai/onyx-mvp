'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, ThumbsUp, ThumbsDown, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase';
import FeedbackModal from './FeedbackModal';

interface AudioPlayerProps {
  audioUrl: string;
  orderId: string;
  tier: string;
  voiceModel: string;
}

export default function AudioPlayer({ audioUrl, orderId, tier, voiceModel }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [generationLogId, setGenerationLogId] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', () => setIsPlaying(false));

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleThumbsUp = async () => {
    if (feedbackGiven !== null) return;

    setFeedbackGiven(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let logId = generationLogId;
      if (!logId) {
        const { data: logData, error: logError } = await supabase
          .from('generation_logs')
          .insert({
            user_id: user.id,
            tier: tier,
            voice_model_id: voiceModel,
            status: 'success',
            processing_time_ms: 0,
            cost_estimated: 0,
          })
          .select()
          .single();

        if (logError) throw logError;
        logId = logData.id;
        setGenerationLogId(logId);
      }

      await supabase.from('feedback_logs').insert({
        generation_id: logId,
        rating: true,
      });
    } catch (error) {
      console.error('Error logging thumbs up:', error);
      setFeedbackGiven(null);
    }
  };

  const handleThumbsDown = async () => {
    if (feedbackGiven !== null) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let logId = generationLogId;
      if (!logId) {
        const { data: logData, error: logError } = await supabase
          .from('generation_logs')
          .insert({
            user_id: user.id,
            tier: tier,
            voice_model_id: voiceModel,
            status: 'success',
            processing_time_ms: 0,
            cost_estimated: 0,
          })
          .select()
          .single();

        if (logError) throw logError;
        logId = logData.id;
        setGenerationLogId(logId);
      }

      setShowFeedbackModal(true);
    } catch (error) {
      console.error('Error preparing thumbs down:', error);
    }
  };

  const handleFeedbackSubmit = async (reason: string, comment?: string) => {
    try {
      await supabase.from('feedback_logs').insert({
        generation_id: generationLogId,
        rating: false,
        reason,
        comment: comment || null,
      });

      setFeedbackGiven(false);
      setShowFeedbackModal(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center gap-4 mb-4">
        <Button
          onClick={togglePlay}
          size="icon"
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>

        <div className="flex-1 space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={toggleMute}
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gray-400 hover:text-white"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-20 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <p className="text-sm text-gray-400">How does this sound?</p>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleThumbsUp}
            size="sm"
            variant="ghost"
            disabled={feedbackGiven !== null}
            className={`h-8 w-8 p-0 transition-all ${
              feedbackGiven === true
                ? 'text-green-400 bg-green-950/30 scale-110'
                : 'text-gray-400 hover:text-green-400 hover:bg-green-950/20'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleThumbsDown}
            size="sm"
            variant="ghost"
            disabled={feedbackGiven !== null}
            className={`h-8 w-8 p-0 transition-all ${
              feedbackGiven === false
                ? 'text-red-400 bg-red-950/30 scale-110'
                : 'text-gray-400 hover:text-red-400 hover:bg-red-950/20'
            }`}
          >
            <ThumbsDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {generationLogId && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </div>
  );
}
