export function getElapsedSeconds(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / 1000);
}

export function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }
  
  return `${minutes}m`;
}
