import { useState, useEffect } from "react";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { addMiniApp, notificationsEnabled, isInMiniApp } from "@/lib/miniapp";
import { sfx } from "@/lib/sound";

export function NotificationOptIn() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [inMiniApp, setInMiniApp] = useState(false);

  useEffect(() => {
    void isInMiniApp().then(setInMiniApp);
    void notificationsEnabled().then(setEnabled);
  }, []);

  const handleToggle = async () => {
    if (enabled) return;
    setLoading(true);
    try {
      sfx.tap();
      const success = await addMiniApp();
      if (success) {
        // Give it a moment for the context to update
        setTimeout(async () => {
          const nowEnabled = await notificationsEnabled();
          setEnabled(nowEnabled);
          if (nowEnabled) sfx.bell();
          setLoading(false);
        }, 1000);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to enable notifications", error);
      setLoading(false);
    }
  };

  if (!inMiniApp) return null;

  return (
    <div className="panel flex items-center justify-between p-4 mt-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${enabled ? "bg-facts/10 text-facts" : "bg-muted text-muted-foreground"}`}>
          {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        </div>
        <div>
          <p className="font-display text-sm font-bold">
            {enabled ? "Notifications enabled" : "Enable notifications"}
          </p>
          <p className="label-xs text-muted-foreground">
            {enabled ? "You'll be notified of new challenges" : "Get notified when friends challenge you"}
          </p>
        </div>
      </div>
      
      <button
        type="button"
        onClick={handleToggle}
        disabled={enabled === true || loading}
        className={`fa-chip ${enabled ? "border-facts/50 text-facts" : "border-accent/50 text-accent hover:bg-accent/10"}`}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : enabled ? (
          <Check className="size-3.5" />
        ) : (
          "Enable"
        )}
      </button>
    </div>
  );
}
