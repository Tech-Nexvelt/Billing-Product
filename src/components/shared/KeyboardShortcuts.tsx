import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const shortcuts = [
  { category: 'Navigation', items: [
    { keys: ['Alt', 'D'], description: 'Go to Dashboard' },
    { keys: ['Alt', 'T'], description: 'Go to Tables' },
    { keys: ['Alt', 'M'], description: 'Go to Menu' },
    { keys: ['Alt', 'O'], description: 'Go to Orders' },
  ]},
  { category: 'General', items: [
    { keys: ['Ctrl', 'K'], description: 'Open search' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
    { keys: ['Esc'], description: 'Close dialog / Cancel' },
  ]},
  { category: 'Tables', items: [
    { keys: ['Ctrl', 'N'], description: 'New table' },
    { keys: ['Ctrl', 'F'], description: 'Add floor' },
  ]},
  { category: 'Menu', items: [
    { keys: ['Ctrl', 'N'], description: 'New menu item' },
    { keys: ['Ctrl', 'Shift', 'C'], description: 'New category' },
  ]},
];

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <kbd className="inline-flex items-center px-2 py-1 rounded-md border border-border bg-muted text-xs font-mono font-medium text-foreground">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Trigger button to show in the Topbar or Footer
export function KeyboardShortcutsTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="w-4 h-4" />
      </Button>
      <KeyboardShortcuts open={open} onOpenChange={setOpen} />
    </>
  );
}
