let archipelagoPaused = false;

export function pauseArchipelagoGeneration(): void {
  archipelagoPaused = true;
}

export function resumeArchipelagoGeneration(): void {
  archipelagoPaused = false;
}

export function isArchipelagoGenerationPaused(): boolean {
  return archipelagoPaused;
}
