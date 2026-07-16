import { Toaster } from "@/components/ui/toaster"

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
