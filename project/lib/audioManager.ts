type StopCallback = () => void;

class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentStopCallback: StopCallback | null = null;

  play(audio: HTMLAudioElement, onStop: StopCallback) {
    if (this.currentAudio && this.currentAudio !== audio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentStopCallback?.();
    }
    this.currentAudio = audio;
    this.currentStopCallback = onStop;
  }

  stop(audio: HTMLAudioElement) {
    if (this.currentAudio === audio) {
      this.currentAudio = null;
      this.currentStopCallback = null;
    }
  }
}

export const audioManager = new AudioManager();
